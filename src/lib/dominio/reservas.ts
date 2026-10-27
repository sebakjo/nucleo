import { and, eq, inArray } from 'drizzle-orm'
import type { DB, Tx } from '@/db'
import { clases, listaEspera, reservas, type Rol } from '@/db/schema'
import { encolarEmail } from '@/lib/email/outbox'
import { crearCreditoSuelto, devolverCredito, moverCredito, packParaClase, saldoCreditos } from './creditos'
import {
  bloquearClase,
  contarOcupados,
  datosUsuario,
  detalleClase,
  liberarRetencionesVencidas,
  reformerLibre,
} from './cupos'
import { ErrorDominio } from './errores'
import { asignarLugaresLiberados } from './lista-espera'
import { precioClaseSuelta } from './precios'
import { evaluarCancelacion, limiteCancelacionSinCosto, vencimientoRetencion } from './reglas'

export type MedioReserva = 'credito' | 'pago'

export type ReservaHecha = {
  reservaId: string
  claseId: string
  estado: 'confirmada' | 'pendiente_pago'
  medio: MedioReserva
  reformer: number
  retenidaHasta: Date | null
  precioArs: number | null
  /** Créditos que le quedan después de reservar (solo si usó un crédito). */
  creditosRestantes: number | null
}

async function reservaActivaDe(tx: Tx, usuarioId: string, claseId: string) {
  const [r] = await tx
    .select()
    .from(reservas)
    .where(
      and(
        eq(reservas.usuarioId, usuarioId),
        eq(reservas.claseId, claseId),
        inArray(reservas.estado, ['pendiente_pago', 'confirmada', 'asistio']),
      ),
    )
    .for('update')
  return r ?? null
}

async function emailConfirmada(
  tx: Tx,
  datos: {
    usuarioId: string
    claseId: string
    reservaId: string
    reformer: number
    pagada: boolean
    ahora: Date
  },
) {
  const alumno = await datosUsuario(tx, datos.usuarioId)
  const detalle = await detalleClase(tx, datos.claseId)
  if (detalle.sandbox) return
  const saldo = await saldoCreditos(tx, datos.usuarioId, datos.ahora)
  await encolarEmail(tx, {
    plantilla: 'reserva_confirmada',
    para: alumno.email,
    usuarioId: alumno.id,
    claveUnica: `reserva_confirmada:${datos.reservaId}`,
    datos: {
      nombre: alumno.nombre,
      clase: detalle.tipo,
      instructor: detalle.instructor,
      iniciaEn: detalle.iniciaEn.toISOString(),
      reformer: datos.reformer,
      creditosRestantes: datos.pagada ? null : saldo.disponibles,
      limiteCancelacion: limiteCancelacionSinCosto(detalle.iniciaEn).toISOString(),
      pagada: datos.pagada,
    },
  })
}

/**
 * Reserva un lugar. Todo pasa dentro de una transacción que bloquea la fila de la clase
 * (SELECT ... FOR UPDATE): recién con el bloqueo se cuentan los lugares ocupados y se inserta.
 * Veinte reservas simultáneas se ejecutan una detrás de otra sobre esa fila, así que nunca se
 * venden más lugares que reformers.
 *
 * - medio "credito": descuenta un crédito en la misma transacción y la reserva queda confirmada.
 * - medio "pago": la reserva queda pendiente y retiene el lugar 10 minutos; el precio sale de la base.
 */
export async function reservarClase(
  db: DB,
  datos: {
    usuarioId: string
    claseId: string
    medio: MedioReserva
    ahora: Date
    origen?: 'directa' | 'simulacion'
  },
): Promise<ReservaHecha> {
  return db.transaction(async (tx) => {
    const clase = await bloquearClase(tx, datos.claseId)
    if (clase.estado !== 'programada') throw new ErrorDominio('CLASE_NO_DISPONIBLE')
    if (clase.iniciaEn <= datos.ahora) throw new ErrorDominio('CLASE_INICIADA')

    // Primero se ordena la clase: retenciones vencidas afuera y lugares libres a la lista de espera.
    await liberarRetencionesVencidas(tx, clase.id, datos.ahora)
    await asignarLugaresLiberados(tx, clase, datos.ahora)

    const existente = await reservaActivaDe(tx, datos.usuarioId, clase.id)
    if (existente) {
      if (existente.estado !== 'pendiente_pago') throw new ErrorDominio('YA_RESERVADA')
      if (datos.medio === 'pago') {
        // Volvió a tocar "Pagar": sigue la misma reserva pendiente.
        return {
          reservaId: existente.id,
          claseId: clase.id,
          estado: 'pendiente_pago',
          medio: 'pago',
          reformer: existente.reformer,
          retenidaHasta: existente.retenidaHasta,
          precioArs: existente.precioArs,
          creditosRestantes: null,
        }
      }
      // Tenía el lugar retenido para pagar (por ejemplo, desde la lista de espera) y prefiere usar un crédito.
      const pack = await packParaClase(tx, datos.usuarioId, clase.iniciaEn)
      if (!pack) throw new ErrorDominio('SIN_CREDITOS')
      await tx
        .update(reservas)
        .set({
          estado: 'confirmada',
          medio: 'credito',
          packId: pack.id,
          retenidaHasta: null,
          confirmadaEn: datos.ahora,
        })
        .where(eq(reservas.id, existente.id))
      await moverCredito(tx, {
        usuarioId: datos.usuarioId,
        packId: pack.id,
        delta: -1,
        motivo: 'reserva',
        reservaId: existente.id,
        ahora: datos.ahora,
      })
      await tx
        .update(listaEspera)
        .set({ estado: 'promovida' })
        .where(and(eq(listaEspera.reservaId, existente.id), eq(listaEspera.estado, 'oferta')))
      await emailConfirmada(tx, {
        ...datos,
        claseId: clase.id,
        reservaId: existente.id,
        reformer: existente.reformer,
        pagada: false,
      })
      const saldo = await saldoCreditos(tx, datos.usuarioId, datos.ahora)
      return {
        reservaId: existente.id,
        claseId: clase.id,
        estado: 'confirmada',
        medio: 'credito',
        reformer: existente.reformer,
        retenidaHasta: null,
        precioArs: null,
        creditosRestantes: saldo.disponibles,
      }
    }

    const ocupados = await contarOcupados(tx, clase.id, datos.ahora)
    if (ocupados >= clase.cupo) throw new ErrorDominio('CLASE_LLENA')
    const reformer = await reformerLibre(tx, clase, datos.ahora)
    if (reformer === null) throw new ErrorDominio('CLASE_LLENA')

    let hecha: ReservaHecha
    if (datos.medio === 'credito') {
      const pack = await packParaClase(tx, datos.usuarioId, clase.iniciaEn)
      if (!pack) throw new ErrorDominio('SIN_CREDITOS')
      const [reserva] = await tx
        .insert(reservas)
        .values({
          usuarioId: datos.usuarioId,
          claseId: clase.id,
          estado: 'confirmada',
          medio: 'credito',
          origen: datos.origen ?? 'directa',
          reformer,
          packId: pack.id,
          confirmadaEn: datos.ahora,
          creadaEn: datos.ahora,
        })
        .returning()
      await moverCredito(tx, {
        usuarioId: datos.usuarioId,
        packId: pack.id,
        delta: -1,
        motivo: 'reserva',
        reservaId: reserva.id,
        ahora: datos.ahora,
      })
      await emailConfirmada(tx, {
        ...datos,
        claseId: clase.id,
        reservaId: reserva.id,
        reformer,
        pagada: false,
      })
      const saldo = await saldoCreditos(tx, datos.usuarioId, datos.ahora)
      hecha = {
        reservaId: reserva.id,
        claseId: clase.id,
        estado: 'confirmada',
        medio: 'credito',
        reformer,
        retenidaHasta: null,
        precioArs: null,
        creditosRestantes: saldo.disponibles,
      }
    } else {
      const precio = await precioClaseSuelta(tx)
      const retenidaHasta = vencimientoRetencion(datos.ahora)
      const [reserva] = await tx
        .insert(reservas)
        .values({
          usuarioId: datos.usuarioId,
          claseId: clase.id,
          estado: 'pendiente_pago',
          medio: 'pago',
          origen: datos.origen ?? 'directa',
          reformer,
          retenidaHasta,
          precioArs: precio,
          creadaEn: datos.ahora,
        })
        .returning()
      hecha = {
        reservaId: reserva.id,
        claseId: clase.id,
        estado: 'pendiente_pago',
        medio: 'pago',
        reformer,
        retenidaHasta,
        precioArs: precio,
        creditosRestantes: null,
      }
    }

    // Si estaba esperando en esta clase, ya no hace falta.
    await tx
      .update(listaEspera)
      .set({ estado: 'retirada' })
      .where(
        and(
          eq(listaEspera.usuarioId, datos.usuarioId),
          eq(listaEspera.claseId, clase.id),
          eq(listaEspera.estado, 'esperando'),
        ),
      )
    return hecha
  })
}

export type Actor = { id: string; rol: Rol }

export type CancelacionHecha = {
  claseId: string
  tipo: 'liberada' | 'sin_costo' | 'tarde'
  creditoDevuelto: boolean
  creditosRestantes: number
  promovidos: number
}

/**
 * Cancela una reserva propia (o cualquiera, si es admin). La regla de 12 horas está en
 * `evaluarCancelacion`; el crédito se devuelve en la misma transacción y el lugar liberado pasa
 * a la lista de espera.
 */
export async function cancelarReserva(
  db: DB,
  datos: { reservaId: string; actor: Actor; ahora: Date },
): Promise<CancelacionHecha> {
  return db.transaction(async (tx) => {
    const [previa] = await tx.select().from(reservas).where(eq(reservas.id, datos.reservaId))
    if (!previa) throw new ErrorDominio('NO_ENCONTRADO')
    if (previa.usuarioId !== datos.actor.id && datos.actor.rol !== 'admin')
      throw new ErrorDominio('NO_AUTORIZADO')

    const clase = await bloquearClase(tx, previa.claseId)
    const [reserva] = await tx.select().from(reservas).where(eq(reservas.id, previa.id)).for('update')

    if (reserva.estado === 'pendiente_pago') {
      await tx
        .update(reservas)
        .set({ estado: 'cancelada', canceladaEn: datos.ahora, retenidaHasta: null })
        .where(eq(reservas.id, reserva.id))
      await tx
        .update(listaEspera)
        .set({ estado: 'retirada' })
        .where(and(eq(listaEspera.reservaId, reserva.id), eq(listaEspera.estado, 'oferta')))
      const promovidos = await asignarLugaresLiberados(tx, clase, datos.ahora)
      const saldo = await saldoCreditos(tx, reserva.usuarioId, datos.ahora)
      return {
        claseId: clase.id,
        tipo: 'liberada',
        creditoDevuelto: false,
        creditosRestantes: saldo.disponibles,
        promovidos: promovidos.length,
      }
    }

    if (reserva.estado !== 'confirmada') throw new ErrorDominio('NO_CANCELABLE')
    const evaluacion = evaluarCancelacion(clase.iniciaEn, datos.ahora)
    if (!evaluacion.permitida) throw new ErrorDominio('NO_CANCELABLE')

    await tx
      .update(reservas)
      .set({ estado: evaluacion.sinCosto ? 'cancelada' : 'cancelada_tarde', canceladaEn: datos.ahora })
      .where(eq(reservas.id, reserva.id))

    if (evaluacion.sinCosto) {
      await devolverCredito(tx, {
        usuarioId: reserva.usuarioId,
        reservaId: reserva.id,
        packId: reserva.medio === 'credito' ? reserva.packId : null,
        ahora: datos.ahora,
        motivo: reserva.medio === 'credito' ? 'devolucion' : 'credito_por_cancelacion',
      })
    }

    const promovidos = await asignarLugaresLiberados(tx, clase, datos.ahora)

    const alumno = await datosUsuario(tx, reserva.usuarioId)
    const detalle = await detalleClase(tx, clase.id)
    if (!detalle.sandbox) {
      await encolarEmail(tx, {
        plantilla: 'reserva_cancelada',
        para: alumno.email,
        usuarioId: alumno.id,
        claveUnica: `reserva_cancelada:${reserva.id}`,
        datos: {
          nombre: alumno.nombre,
          clase: detalle.tipo,
          instructor: detalle.instructor,
          iniciaEn: clase.iniciaEn.toISOString(),
          sinCosto: evaluacion.sinCosto,
          creditoDevuelto: evaluacion.sinCosto,
        },
      })
    }
    const saldo = await saldoCreditos(tx, reserva.usuarioId, datos.ahora)
    return {
      claseId: clase.id,
      tipo: evaluacion.sinCosto ? 'sin_costo' : 'tarde',
      creditoDevuelto: evaluacion.sinCosto,
      creditosRestantes: saldo.disponibles,
      promovidos: promovidos.length,
    }
  })
}

export type ResultadoPagoReserva = 'confirmada' | 'ya_confirmada' | 'confirmada_tarde' | 'credito'

/**
 * Se llama cuando el proveedor aprueba el pago de una clase suelta (dentro de la transacción del
 * pago). Si la retención sigue vigente, confirma. Si venció pero todavía hay lugar, confirma igual.
 * Si el lugar ya no está, el pago no se pierde: se convierte en un crédito de 30 días.
 */
export async function confirmarReservaPagada(
  tx: Tx,
  datos: { reservaId: string; ahora: Date },
): Promise<ResultadoPagoReserva> {
  const [previa] = await tx.select().from(reservas).where(eq(reservas.id, datos.reservaId))
  if (!previa) throw new ErrorDominio('NO_ENCONTRADO')
  const clase = await bloquearClase(tx, previa.claseId)
  const [reserva] = await tx.select().from(reservas).where(eq(reservas.id, previa.id)).for('update')

  if (reserva.estado === 'confirmada' || reserva.estado === 'asistio') return 'ya_confirmada'

  const vigente =
    reserva.estado === 'pendiente_pago' &&
    reserva.retenidaHasta !== null &&
    reserva.retenidaHasta > datos.ahora
  if (vigente) {
    await tx
      .update(reservas)
      .set({ estado: 'confirmada', retenidaHasta: null, confirmadaEn: datos.ahora })
      .where(eq(reservas.id, reserva.id))
    await tx
      .update(listaEspera)
      .set({ estado: 'promovida' })
      .where(and(eq(listaEspera.reservaId, reserva.id), eq(listaEspera.estado, 'oferta')))
    await emailConfirmada(tx, {
      usuarioId: reserva.usuarioId,
      claseId: clase.id,
      reservaId: reserva.id,
      reformer: reserva.reformer,
      pagada: true,
      ahora: datos.ahora,
    })
    return 'confirmada'
  }

  // Pago acreditado después de que venció la retención.
  await liberarRetencionesVencidas(tx, clase.id, datos.ahora)
  const otraActiva = await reservaActivaDe(tx, reserva.usuarioId, clase.id)
  const hayLugar =
    clase.estado === 'programada' &&
    clase.iniciaEn > datos.ahora &&
    !otraActiva &&
    (await contarOcupados(tx, clase.id, datos.ahora)) < clase.cupo
  if (hayLugar) {
    const reformer = (await reformerLibre(tx, clase, datos.ahora))!
    await tx
      .update(reservas)
      .set({ estado: 'confirmada', reformer, retenidaHasta: null, confirmadaEn: datos.ahora })
      .where(eq(reservas.id, reserva.id))
    await emailConfirmada(tx, {
      usuarioId: reserva.usuarioId,
      claseId: clase.id,
      reservaId: reserva.id,
      reformer,
      pagada: true,
      ahora: datos.ahora,
    })
    return 'confirmada_tarde'
  }

  const credito = await crearCreditoSuelto(tx, {
    usuarioId: reserva.usuarioId,
    ahora: datos.ahora,
    nombre: 'Crédito por pago acreditado tarde',
    motivo: 'pago_tardio',
    reservaId: reserva.id,
  })
  const alumno = await datosUsuario(tx, reserva.usuarioId)
  const detalle = await detalleClase(tx, clase.id)
  await encolarEmail(tx, {
    plantilla: 'pago_tardio',
    para: alumno.email,
    usuarioId: alumno.id,
    claveUnica: `pago_tardio:${reserva.id}`,
    datos: {
      nombre: alumno.nombre,
      clase: detalle.tipo,
      instructor: detalle.instructor,
      iniciaEn: clase.iniciaEn.toISOString(),
      venceEn: credito.venceEn!.toISOString(),
    },
  })
  return 'credito'
}

/** Marca (o desmarca) la asistencia. Solo la instructora de la clase o un admin. */
export async function marcarAsistencia(
  db: DB,
  datos: { reservaId: string; asistio: boolean; actor: Actor; instructorUsuarioId?: string | null },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [reserva] = await tx.select().from(reservas).where(eq(reservas.id, datos.reservaId)).for('update')
    if (!reserva) throw new ErrorDominio('NO_ENCONTRADO')
    if (datos.actor.rol !== 'admin' && datos.instructorUsuarioId !== datos.actor.id) {
      throw new ErrorDominio('NO_AUTORIZADO')
    }
    const desde = datos.asistio ? 'confirmada' : 'asistio'
    if (reserva.estado !== desde) return
    await tx
      .update(reservas)
      .set({ estado: datos.asistio ? 'asistio' : 'confirmada' })
      .where(eq(reservas.id, reserva.id))
  })
}

/**
 * El estudio cancela una clase: todas las reservas activas se cancelan y cada alumno recupera su
 * crédito (o recibe uno, si había pagado la clase suelta). La lista de espera se cierra.
 */
export async function cancelarClase(db: DB, datos: { claseId: string; ahora: Date }): Promise<number> {
  return db.transaction(async (tx) => {
    const clase = await bloquearClase(tx, datos.claseId)
    if (clase.estado === 'cancelada') return 0
    await tx.update(clases).set({ estado: 'cancelada' }).where(eq(clases.id, clase.id))
    const activas = await tx
      .select()
      .from(reservas)
      .where(and(eq(reservas.claseId, clase.id), inArray(reservas.estado, ['pendiente_pago', 'confirmada'])))
      .for('update')
    const detalle = await detalleClase(tx, clase.id)
    for (const r of activas) {
      await tx
        .update(reservas)
        .set({ estado: 'cancelada', canceladaEn: datos.ahora, retenidaHasta: null })
        .where(eq(reservas.id, r.id))
      const devuelve = r.estado === 'confirmada'
      if (devuelve) {
        await devolverCredito(tx, {
          usuarioId: r.usuarioId,
          reservaId: r.id,
          packId: r.medio === 'credito' ? r.packId : null,
          ahora: datos.ahora,
          motivo: 'clase_cancelada',
        })
      }
      const alumno = await datosUsuario(tx, r.usuarioId)
      await encolarEmail(tx, {
        plantilla: 'clase_cancelada',
        para: alumno.email,
        usuarioId: alumno.id,
        claveUnica: `clase_cancelada:${r.id}`,
        datos: {
          nombre: alumno.nombre,
          clase: detalle.tipo,
          instructor: detalle.instructor,
          iniciaEn: clase.iniciaEn.toISOString(),
          creditoDevuelto: devuelve,
        },
      })
    }
    await tx
      .update(listaEspera)
      .set({ estado: 'retirada' })
      .where(and(eq(listaEspera.claseId, clase.id), inArray(listaEspera.estado, ['esperando', 'oferta'])))
    return activas.length
  })
}
