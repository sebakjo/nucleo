import { and, desc, eq } from 'drizzle-orm'
import type { DB } from '@/db'
import { eventosWebhook, pagos, packs, productosPack, reservas, type EstadoPago } from '@/db/schema'
import { urlApp } from '@/lib/config'
import { encolarEmail } from '@/lib/email/outbox'
import type { PagoExterno, ProveedorPagos } from '@/lib/pagos/proveedor'
import { fechaCorta, hora } from '@/lib/tiempo'
import { activarPack } from './creditos'
import { datosUsuario, detalleClase } from './cupos'
import { ErrorDominio } from './errores'
import { confirmarReservaPagada, type ResultadoPagoReserva } from './reservas'

/** Un pago aprobado o reembolsado no vuelve atrás por una notificación vieja que llega tarde. */
const FINALES: EstadoPago[] = ['aprobado', 'reembolsado']

function urlRetorno(pagoId: string) {
  return `${urlApp()}/pago/${pagoId}`
}
function urlNotificacion() {
  return `${urlApp()}/api/webhooks/mercadopago`
}

/**
 * Inicia (o retoma) el pago de una reserva pendiente. El monto es el que guardó el servidor al
 * reservar; la preferencia vence junto con la retención del lugar.
 */
export async function iniciarPagoReserva(
  db: DB,
  proveedor: ProveedorPagos,
  datos: { reservaId: string; usuarioId: string; ahora: Date },
): Promise<{ pagoId: string; urlPago: string }> {
  const pago = await db.transaction(async (tx) => {
    const [reserva] = await tx.select().from(reservas).where(eq(reservas.id, datos.reservaId)).for('update')
    if (!reserva || reserva.usuarioId !== datos.usuarioId) throw new ErrorDominio('NO_ENCONTRADO')
    if (
      reserva.estado !== 'pendiente_pago' ||
      !reserva.retenidaHasta ||
      reserva.retenidaHasta <= datos.ahora
    ) {
      throw new ErrorDominio('RETENCION_VENCIDA')
    }
    const [existente] = await tx
      .select()
      .from(pagos)
      .where(
        and(
          eq(pagos.reservaId, reserva.id),
          eq(pagos.estado, 'pendiente'),
          eq(pagos.proveedor, proveedor.nombre),
        ),
      )
      .orderBy(desc(pagos.creadoEn))
      .limit(1)
    if (existente?.urlPago) return { ...existente, nuevo: false, reserva }

    const detalle = await detalleClase(tx, reserva.claseId)
    const [nuevo] = await tx
      .insert(pagos)
      .values({
        usuarioId: datos.usuarioId,
        tipo: 'clase',
        reservaId: reserva.id,
        proveedor: proveedor.nombre,
        montoArs: reserva.precioArs!,
        descripcion: `${detalle.tipo} · ${fechaCorta(detalle.iniciaEn)} ${hora(detalle.iniciaEn)}`,
        creadoEn: datos.ahora,
        actualizadoEn: datos.ahora,
      })
      .returning()
    return { ...nuevo, nuevo: true, reserva }
  })
  if (!pago.nuevo && pago.urlPago) return { pagoId: pago.id, urlPago: pago.urlPago }

  const alumno = await datosUsuario(db, datos.usuarioId)
  const pref = await proveedor.crearPreferencia({
    pagoId: pago.id,
    titulo: `Núcleo · ${pago.descripcion}`,
    montoArs: pago.montoArs,
    email: alumno.email,
    vence: pago.reserva.retenidaHasta,
    modoBinario: true,
    urlRetorno: urlRetorno(pago.id),
    urlNotificacion: urlNotificacion(),
  })
  await db
    .update(pagos)
    .set({ preferenciaId: pref.preferenciaId, urlPago: pref.urlPago })
    .where(eq(pagos.id, pago.id))
  return { pagoId: pago.id, urlPago: pref.urlPago }
}

/** Compra de un pack: queda pendiente hasta que el proveedor apruebe el pago. */
export async function comprarPack(
  db: DB,
  proveedor: ProveedorPagos,
  datos: { productoId: string; usuarioId: string; ahora: Date },
): Promise<{ pagoId: string; urlPago: string }> {
  const pago = await db.transaction(async (tx) => {
    const [producto] = await tx.select().from(productosPack).where(eq(productosPack.id, datos.productoId))
    if (!producto || !producto.activo) throw new ErrorDominio('NO_ENCONTRADO')
    const [pack] = await tx
      .insert(packs)
      .values({
        usuarioId: datos.usuarioId,
        productoId: producto.id,
        nombre: producto.nombre,
        creditosTotales: producto.creditos,
        creditosRestantes: 0,
        estado: 'pendiente_pago',
        creadoEn: datos.ahora,
      })
      .returning()
    const [nuevo] = await tx
      .insert(pagos)
      .values({
        usuarioId: datos.usuarioId,
        tipo: 'pack',
        packId: pack.id,
        proveedor: proveedor.nombre,
        montoArs: producto.precioArs,
        descripcion: `${producto.nombre} · válido ${producto.validezDias} días`,
        creadoEn: datos.ahora,
        actualizadoEn: datos.ahora,
      })
      .returning()
    return nuevo
  })
  const alumno = await datosUsuario(db, datos.usuarioId)
  const pref = await proveedor.crearPreferencia({
    pagoId: pago.id,
    titulo: `Núcleo · ${pago.descripcion}`,
    montoArs: pago.montoArs,
    email: alumno.email,
    vence: null,
    modoBinario: false,
    urlRetorno: urlRetorno(pago.id),
    urlNotificacion: urlNotificacion(),
  })
  await db
    .update(pagos)
    .set({ preferenciaId: pref.preferenciaId, urlPago: pref.urlPago })
    .where(eq(pagos.id, pago.id))
  return { pagoId: pago.id, urlPago: pref.urlPago }
}

export type ResultadoAplicacion =
  | { tipo: 'ignorado'; motivo: 'referencia_desconocida' | 'sin_cambios' | 'estado_final' }
  | { tipo: 'monto_invalido' }
  | { tipo: 'actualizado'; estado: EstadoPago; efecto: ResultadoPagoReserva | 'pack_activado' | null }

/**
 * Aplica el estado real de un pago (consultado al proveedor). Es idempotente: si el estado no
 * cambió, no hace nada; los efectos (confirmar la reserva, activar el pack) ocurren solo en la
 * transición a "aprobado", con la fila del pago bloqueada.
 */
export async function aplicarEstadoPago(
  db: DB,
  externo: PagoExterno,
  ahora: Date,
): Promise<ResultadoAplicacion> {
  if (!externo.referenciaExterna) return { tipo: 'ignorado', motivo: 'referencia_desconocida' }
  return db.transaction(async (tx) => {
    const [pago] = await tx.select().from(pagos).where(eq(pagos.id, externo.referenciaExterna!)).for('update')
    if (!pago) return { tipo: 'ignorado', motivo: 'referencia_desconocida' } as const

    // El monto y la moneda tienen que coincidir con lo que definió el servidor.
    if (externo.monto !== pago.montoArs || externo.moneda !== pago.moneda) {
      await tx
        .update(pagos)
        .set({ detalleEstado: `monto_no_coincide:${externo.monto}${externo.moneda}`, actualizadoEn: ahora })
        .where(eq(pagos.id, pago.id))
      return { tipo: 'monto_invalido' } as const
    }

    if (FINALES.includes(pago.estado) && externo.estado !== 'reembolsado') {
      return { tipo: 'ignorado', motivo: 'estado_final' } as const
    }
    if (pago.estado === externo.estado && pago.idExterno === externo.id) {
      return { tipo: 'ignorado', motivo: 'sin_cambios' } as const
    }

    const pasaAAprobado = externo.estado === 'aprobado' && pago.estado !== 'aprobado'
    await tx
      .update(pagos)
      .set({
        estado: externo.estado,
        idExterno: externo.id,
        detalleEstado: externo.detalle,
        datosProveedor: externo.datos,
        actualizadoEn: ahora,
        ...(pasaAAprobado ? { aprobadoEn: ahora } : {}),
      })
      .where(eq(pagos.id, pago.id))

    let efecto: ResultadoPagoReserva | 'pack_activado' | null = null
    if (pasaAAprobado && pago.tipo === 'clase' && pago.reservaId) {
      efecto = await confirmarReservaPagada(tx, { reservaId: pago.reservaId, ahora })
    }
    if (pasaAAprobado && pago.tipo === 'pack' && pago.packId) {
      const [pack] = await tx
        .select({ validez: productosPack.validezDias })
        .from(packs)
        .leftJoin(productosPack, eq(productosPack.id, packs.productoId))
        .where(eq(packs.id, pago.packId))
      const activo = await activarPack(tx, pago.packId, pack?.validez ?? 30, ahora)
      if (activo) {
        efecto = 'pack_activado'
        const alumno = await datosUsuario(tx, pago.usuarioId)
        await encolarEmail(tx, {
          plantilla: 'pack_comprado',
          para: alumno.email,
          usuarioId: alumno.id,
          claveUnica: `pack_comprado:${activo.id}`,
          datos: {
            nombre: alumno.nombre,
            pack: activo.nombre,
            creditos: activo.creditosTotales,
            venceEn: activo.venceEn!.toISOString(),
          },
        })
      }
    }
    return { tipo: 'actualizado', estado: externo.estado, efecto } as const
  })
}

/** Consulta el pago al proveedor y aplica su estado. Lo usan el webhook y la página de retorno. */
export async function sincronizarPago(
  db: DB,
  proveedor: ProveedorPagos,
  idExterno: string,
  ahora: Date,
): Promise<ResultadoAplicacion | null> {
  const externo = await proveedor.obtenerPago(idExterno)
  if (!externo) return null
  return aplicarEstadoPago(db, externo, ahora)
}

export type ResultadoWebhook =
  { tipo: 'duplicado' } | { tipo: 'procesado'; resultado: ResultadoAplicacion | null }

/**
 * Procesa una notificación ya validada (firma correcta). Cada notificación se registra con una
 * clave única: si llega dos veces y la primera se procesó, la segunda no hace nada. Si la primera
 * falló a mitad de camino, la reintento vuelve a procesarla.
 */
export async function procesarNotificacion(
  db: DB,
  proveedor: ProveedorPagos,
  datos: { clave: string; tipo: string; recursoId: string; payload: unknown; ahora: Date },
): Promise<ResultadoWebhook> {
  const [registrado] = await db
    .insert(eventosWebhook)
    .values({
      proveedor: proveedor.nombre,
      clave: datos.clave,
      tipo: datos.tipo,
      recursoId: datos.recursoId,
      payload: datos.payload,
    })
    .onConflictDoNothing({ target: eventosWebhook.clave })
    .returning()
  if (!registrado) {
    const [previo] = await db.select().from(eventosWebhook).where(eq(eventosWebhook.clave, datos.clave))
    if (previo?.procesadoEn) return { tipo: 'duplicado' }
  }
  const resultado = await sincronizarPago(db, proveedor, datos.recursoId, datos.ahora)
  await db
    .update(eventosWebhook)
    .set({ procesadoEn: new Date(), resultado: resultado ? resultado.tipo : 'pago_no_encontrado' })
    .where(eq(eventosWebhook.clave, datos.clave))
  return { tipo: 'procesado', resultado }
}
