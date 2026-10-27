import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { POST } from '@/app/api/webhooks/mercadopago/route'
import { db } from '@/db'
import { eventosWebhook, movimientosCredito, pagos, packs, reservas } from '@/db/schema'
import { comprarPack, iniciarPagoReserva } from '@/lib/dominio/pagos'
import { reservarClase } from '@/lib/dominio/reservas'
import { proveedorPagos } from '@/lib/pagos'
import { firmar } from '@/lib/pagos/firma'
import { notificacionFirmada, registrarPagoSimulado } from '@/lib/pagos/simulado'
import { productosPack } from '@/db/schema'
import { baseLimpia, crearAlumno, crearClase, DIA, en } from './ayudas'

const SECRETO = process.env.MP_WEBHOOK_SECRET!
const URL_WEBHOOK = 'http://localhost:3030/api/webhooks/mercadopago'

function pedido(
  n: ReturnType<typeof notificacionFirmada>,
  cambios: { headers?: Record<string, string> } = {},
) {
  return new Request(`${URL_WEBHOOK}?${n.query}`, {
    method: 'POST',
    headers: { ...n.headers, ...cambios.headers },
    body: JSON.stringify(n.body),
  })
}

async function reservaConPago(ahora: Date) {
  const alumno = await crearAlumno()
  const claseId = await crearClase(en(ahora, 2 * DIA))
  const r = await reservarClase(db, { usuarioId: alumno, claseId, medio: 'pago', ahora })
  const { pagoId } = await iniciarPagoReserva(db, proveedorPagos(), {
    reservaId: r.reservaId,
    usuarioId: alumno,
    ahora,
  })
  return { alumno, claseId, reservaId: r.reservaId, pagoId }
}

describe('webhook de Mercado Pago', () => {
  beforeEach(baseLimpia)

  it('rechaza una notificación sin firma o con firma inválida', async () => {
    const ahora = new Date()
    const { pagoId, reservaId } = await reservaConPago(ahora)
    const idExterno = await registrarPagoSimulado(db, { pagoId, resultado: 'aprobado', montoArs: 22000 })
    const n = notificacionFirmada(SECRETO, idExterno)

    const sinFirma = await POST(pedido(n, { headers: { 'x-signature': '' } }))
    expect(sinFirma.status).toBe(401)

    const otraClave = notificacionFirmada('otra-clave', idExterno)
    expect((await POST(pedido(otraClave))).status).toBe(401)

    // Firma válida pero para otro data.id: también se rechaza.
    const ts = String(Date.now())
    const v1 = firmar(SECRETO, '999', n.headers['x-request-id'], ts)
    expect((await POST(pedido(n, { headers: { 'x-signature': `ts=${ts},v1=${v1}` } }))).status).toBe(401)

    const [reserva] = await db.select().from(reservas).where(eq(reservas.id, reservaId))
    expect(reserva.estado).toBe('pendiente_pago')
    expect(await db.select().from(eventosWebhook)).toHaveLength(0)
  })

  it('con firma válida consulta el pago y confirma la reserva', async () => {
    const ahora = new Date()
    const { pagoId, reservaId } = await reservaConPago(ahora)
    const idExterno = await registrarPagoSimulado(db, { pagoId, resultado: 'aprobado', montoArs: 22000 })
    const res = await POST(pedido(notificacionFirmada(SECRETO, idExterno)))
    expect(res.status).toBe(200)
    const [pago] = await db.select().from(pagos).where(eq(pagos.id, pagoId))
    expect(pago).toMatchObject({ estado: 'aprobado', idExterno })
    const [reserva] = await db.select().from(reservas).where(eq(reservas.id, reservaId))
    expect(reserva.estado).toBe('confirmada')
  })

  it('una notificación duplicada no tiene efectos dobles', async () => {
    const ahora = new Date()
    const alumno = await crearAlumno()
    const [producto] = await db
      .insert(productosPack)
      .values({ nombre: 'Pack de 8 clases', creditos: 8, precioArs: 136000 })
      .returning()
    const { pagoId } = await comprarPack(db, proveedorPagos(), {
      productoId: producto.id,
      usuarioId: alumno,
      ahora,
    })
    const idExterno = await registrarPagoSimulado(db, { pagoId, resultado: 'aprobado', montoArs: 136000 })
    const n = notificacionFirmada(SECRETO, idExterno)

    const primera = await (await POST(pedido(n))).json()
    const segunda = await (await POST(pedido(n))).json()
    expect(primera.tipo).toBe('procesado')
    expect(segunda.tipo).toBe('duplicado')

    // Otra notificación distinta del mismo pago (payment.created + payment.updated) tampoco duplica.
    const tercera = await (await POST(pedido(notificacionFirmada(SECRETO, idExterno)))).json()
    expect(tercera).toMatchObject({ tipo: 'procesado', resultado: { tipo: 'ignorado' } })

    const [pack] = await db.select().from(packs).where(eq(packs.usuarioId, alumno))
    expect(pack).toMatchObject({ estado: 'activo', creditosRestantes: 8 })
    const compras = await db
      .select()
      .from(movimientosCredito)
      .where(and(eq(movimientosCredito.usuarioId, alumno), eq(movimientosCredito.motivo, 'compra')))
    expect(compras).toHaveLength(1)
    expect(await db.select().from(eventosWebhook)).toHaveLength(2)
  })

  it('no aprueba un pago cuyo monto no coincide con el que definió el servidor', async () => {
    const ahora = new Date()
    const { pagoId, reservaId } = await reservaConPago(ahora)
    const idExterno = await registrarPagoSimulado(db, { pagoId, resultado: 'aprobado', montoArs: 1 })
    await POST(pedido(notificacionFirmada(SECRETO, idExterno)))
    const [pago] = await db.select().from(pagos).where(eq(pagos.id, pagoId))
    expect(pago.estado).toBe('pendiente')
    expect(pago.detalleEstado).toContain('monto_no_coincide')
    const [reserva] = await db.select().from(reservas).where(eq(reservas.id, reservaId))
    expect(reserva.estado).toBe('pendiente_pago')
  })

  it('un rechazo seguido de una aprobación termina aprobado, y una notificación vieja no lo revierte', async () => {
    const ahora = new Date()
    const { pagoId, reservaId } = await reservaConPago(ahora)
    const rechazado = await registrarPagoSimulado(db, { pagoId, resultado: 'rechazado', montoArs: 22000 })
    const aprobado = await registrarPagoSimulado(db, { pagoId, resultado: 'aprobado', montoArs: 22000 })
    await POST(pedido(notificacionFirmada(SECRETO, rechazado)))
    await POST(pedido(notificacionFirmada(SECRETO, aprobado)))
    await POST(pedido(notificacionFirmada(SECRETO, rechazado)))
    const [pago] = await db.select().from(pagos).where(eq(pagos.id, pagoId))
    expect(pago.estado).toBe('aprobado')
    const [reserva] = await db.select().from(reservas).where(eq(reservas.id, reservaId))
    expect(reserva.estado).toBe('confirmada')
  })
})
