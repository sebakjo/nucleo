import { and, asc, eq, inArray, lte, sql } from 'drizzle-orm'
import type { DB, Tx } from '@/db'
import { listaEspera, reservas, type Clase } from '@/db/schema'
import { encolarEmail } from '@/lib/email/outbox'
import { moverCredito, packParaClase, saldoCreditos } from './creditos'
import {
  bloquearClase,
  contarOcupados,
  datosUsuario,
  detalleClase,
  liberarRetencionesVencidas,
  reformerLibre,
} from './cupos'
import { ErrorDominio } from './errores'
import { precioClaseSuelta } from './precios'
import { vencimientoOferta } from './reglas'

export type ResultadoPromocion = { usuarioId: string; tipo: 'promovida' | 'oferta'; reservaId: string }

/**
 * Asigna los lugares libres de una clase a la lista de espera, en orden. Cuando una clase tiene
 * gente esperando, un lugar que se libera es para ellos antes que para una reserva nueva.
 *
 * - Si el primero tiene un crédito vigente, queda reservado y recibe un email.
 * - Si no, el lugar le queda retenido 30 minutos (reserva pendiente de pago) y recibe un email
 *   para pagar. Si no paga, la retención vence y el lugar pasa al siguiente.
 *
 * Requiere la clase bloqueada con `bloquearClase`.
 */
export async function asignarLugaresLiberados(
  tx: Tx,
  clase: Clase,
  ahora: Date,
): Promise<ResultadoPromocion[]> {
  const resultado: ResultadoPromocion[] = []
  if (clase.estado !== 'programada' || clase.iniciaEn <= ahora) return resultado

  while ((await contarOcupados(tx, clase.id, ahora)) < clase.cupo) {
    const [entrada] = await tx
      .select()
      .from(listaEspera)
      .where(and(eq(listaEspera.claseId, clase.id), eq(listaEspera.estado, 'esperando')))
      .orderBy(asc(listaEspera.posicion))
      .limit(1)
      .for('update')
    if (!entrada) break

    // Si ya tiene un lugar en la clase (por ejemplo, se lo dio el administrador), sale de la lista.
    const [yaReservada] = await tx
      .select({ id: reservas.id })
      .from(reservas)
      .where(
        and(
          eq(reservas.usuarioId, entrada.usuarioId),
          eq(reservas.claseId, clase.id),
          inArray(reservas.estado, ['pendiente_pago', 'confirmada', 'asistio']),
        ),
      )
    if (yaReservada) {
      await tx.update(listaEspera).set({ estado: 'retirada' }).where(eq(listaEspera.id, entrada.id))
      continue
    }

    const reformer = await reformerLibre(tx, clase, ahora)
    if (reformer === null) break
    const alumno = await datosUsuario(tx, entrada.usuarioId)
    const detalle = await detalleClase(tx, clase.id)
    const pack = await packParaClase(tx, entrada.usuarioId, clase.iniciaEn)

    if (pack) {
      const [reserva] = await tx
        .insert(reservas)
        .values({
          usuarioId: entrada.usuarioId,
          claseId: clase.id,
          estado: 'confirmada',
          medio: 'credito',
          origen: 'lista_espera',
          reformer,
          packId: pack.id,
          confirmadaEn: ahora,
          creadaEn: ahora,
        })
        .returning()
      await moverCredito(tx, {
        usuarioId: entrada.usuarioId,
        packId: pack.id,
        delta: -1,
        motivo: 'reserva',
        reservaId: reserva.id,
        ahora,
      })
      await tx
        .update(listaEspera)
        .set({ estado: 'promovida', reservaId: reserva.id })
        .where(eq(listaEspera.id, entrada.id))
      const saldo = await saldoCreditos(tx, entrada.usuarioId, ahora)
      await encolarEmail(tx, {
        plantilla: 'espera_promovida',
        para: alumno.email,
        usuarioId: alumno.id,
        claveUnica: `espera_promovida:${reserva.id}`,
        datos: {
          nombre: alumno.nombre,
          clase: detalle.tipo,
          instructor: detalle.instructor,
          iniciaEn: clase.iniciaEn.toISOString(),
          reformer,
          creditosRestantes: saldo.disponibles,
        },
      })
      resultado.push({ usuarioId: entrada.usuarioId, tipo: 'promovida', reservaId: reserva.id })
    } else {
      const vence = vencimientoOferta(ahora, clase.iniciaEn)
      const precio = await precioClaseSuelta(tx)
      const [reserva] = await tx
        .insert(reservas)
        .values({
          usuarioId: entrada.usuarioId,
          claseId: clase.id,
          estado: 'pendiente_pago',
          medio: 'pago',
          origen: 'lista_espera',
          reformer,
          retenidaHasta: vence,
          precioArs: precio,
          creadaEn: ahora,
        })
        .returning()
      await tx
        .update(listaEspera)
        .set({ estado: 'oferta', reservaId: reserva.id, ofertaVence: vence })
        .where(eq(listaEspera.id, entrada.id))
      await encolarEmail(tx, {
        plantilla: 'espera_oferta',
        para: alumno.email,
        usuarioId: alumno.id,
        claveUnica: `espera_oferta:${reserva.id}`,
        datos: {
          nombre: alumno.nombre,
          clase: detalle.tipo,
          instructor: detalle.instructor,
          iniciaEn: clase.iniciaEn.toISOString(),
          claseId: clase.id,
          venceEn: vence.toISOString(),
          precioArs: precio,
        },
      })
      resultado.push({ usuarioId: entrada.usuarioId, tipo: 'oferta', reservaId: reserva.id })
    }
  }
  return resultado
}

/** Puesto en la fila (1 = el próximo) contando solo a quienes siguen esperando. */
async function puestoEnFila(tx: Tx, claseId: string, posicion: number): Promise<number> {
  const [fila] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(listaEspera)
    .where(
      and(
        eq(listaEspera.claseId, claseId),
        eq(listaEspera.estado, 'esperando'),
        lte(listaEspera.posicion, posicion),
      ),
    )
  return fila?.n ?? 1
}

export async function anotarEnEspera(
  db: DB,
  datos: { usuarioId: string; claseId: string; ahora: Date },
): Promise<{ entradaId: string; puesto: number }> {
  return db.transaction(async (tx) => {
    const clase = await bloquearClase(tx, datos.claseId)
    if (clase.estado !== 'programada') throw new ErrorDominio('CLASE_NO_DISPONIBLE')
    if (clase.iniciaEn <= datos.ahora) throw new ErrorDominio('CLASE_INICIADA')
    await liberarRetencionesVencidas(tx, clase.id, datos.ahora)
    await asignarLugaresLiberados(tx, clase, datos.ahora)

    const [reservada] = await tx
      .select({ id: reservas.id })
      .from(reservas)
      .where(
        and(
          eq(reservas.usuarioId, datos.usuarioId),
          eq(reservas.claseId, clase.id),
          inArray(reservas.estado, ['pendiente_pago', 'confirmada', 'asistio']),
        ),
      )
    if (reservada) throw new ErrorDominio('YA_RESERVADA')

    const [enLista] = await tx
      .select({ id: listaEspera.id })
      .from(listaEspera)
      .where(
        and(
          eq(listaEspera.usuarioId, datos.usuarioId),
          eq(listaEspera.claseId, clase.id),
          inArray(listaEspera.estado, ['esperando', 'oferta']),
        ),
      )
    if (enLista) throw new ErrorDominio('YA_EN_LISTA')

    if ((await contarOcupados(tx, clase.id, datos.ahora)) < clase.cupo) throw new ErrorDominio('HAY_LUGAR')

    const [{ siguiente }] = await tx
      .select({ siguiente: sql<number>`coalesce(max(${listaEspera.posicion}), 0)::int + 1` })
      .from(listaEspera)
      .where(eq(listaEspera.claseId, clase.id))
    const [entrada] = await tx
      .insert(listaEspera)
      .values({ usuarioId: datos.usuarioId, claseId: clase.id, posicion: siguiente, creadaEn: datos.ahora })
      .returning()
    return { entradaId: entrada.id, puesto: await puestoEnFila(tx, clase.id, entrada.posicion) }
  })
}

/** Salir de la lista. Si tenía un lugar retenido para pagar, se libera y pasa al siguiente. */
export async function salirDeEspera(
  db: DB,
  datos: { usuarioId: string; entradaId: string; ahora: Date },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [previa] = await tx.select().from(listaEspera).where(eq(listaEspera.id, datos.entradaId))
    if (!previa || previa.usuarioId !== datos.usuarioId) throw new ErrorDominio('NO_EN_LISTA')
    const clase = await bloquearClase(tx, previa.claseId)
    const [entrada] = await tx
      .select()
      .from(listaEspera)
      .where(eq(listaEspera.id, datos.entradaId))
      .for('update')
    if (!entrada || !['esperando', 'oferta'].includes(entrada.estado)) throw new ErrorDominio('NO_EN_LISTA')
    await tx.update(listaEspera).set({ estado: 'retirada' }).where(eq(listaEspera.id, entrada.id))
    if (entrada.estado === 'oferta' && entrada.reservaId) {
      await tx
        .update(reservas)
        .set({ estado: 'cancelada', canceladaEn: datos.ahora, retenidaHasta: null })
        .where(and(eq(reservas.id, entrada.reservaId), eq(reservas.estado, 'pendiente_pago')))
      await asignarLugaresLiberados(tx, clase, datos.ahora)
    }
  })
}
