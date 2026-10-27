import { randomInt, randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { DB } from '@/db'
import { pagosSimulados } from '@/db/schema'
import { firmar } from './firma'
import { estadoDesdeMercadoPago, type ProveedorPagos } from './proveedor'

/**
 * Proveedor simulado: imita a Mercado Pago para los tests de punta a punta (y para correr la demo
 * en local sin credenciales). Tiene su propio "checkout" en /pago-simulado/[id], guarda los pagos en
 * `pagos_simulados` (lo que respondería GET /v1/payments/{id}) y avisa con una notificación firmada
 * igual que Mercado Pago, así el webhook real hace todo el recorrido: firma, idempotencia y consulta.
 */
export function crearSimulado(db: DB, urlApp: string): ProveedorPagos {
  return {
    nombre: 'simulado',
    async crearPreferencia(p) {
      return { preferenciaId: `sim-pref-${p.pagoId}`, urlPago: `${urlApp}/pago-simulado/${p.pagoId}` }
    },
    async obtenerPago(id) {
      const [pago] = await db.select().from(pagosSimulados).where(eq(pagosSimulados.id, id))
      if (!pago) return null
      return {
        id: pago.id,
        estado: estadoDesdeMercadoPago(pago.estado),
        detalle: pago.detalleEstado,
        referenciaExterna: pago.referenciaExterna,
        monto: pago.monto,
        moneda: pago.moneda,
        datos: pago,
      }
    },
  }
}

export type ResultadoSimulado = 'aprobado' | 'pendiente' | 'rechazado'

const COMO_MP: Record<ResultadoSimulado, { status: string; detalle: string }> = {
  aprobado: { status: 'approved', detalle: 'accredited' },
  pendiente: { status: 'in_process', detalle: 'pending_contingency' },
  rechazado: { status: 'rejected', detalle: 'cc_rejected_insufficient_amount' },
}

/** Registra el pago en la "API" simulada y devuelve su id (numérico, como los de Mercado Pago). */
export async function registrarPagoSimulado(
  db: DB,
  datos: { pagoId: string; resultado: ResultadoSimulado; montoArs: number },
): Promise<string> {
  const id = `${Date.now()}${randomInt(100, 999)}`
  const mp = COMO_MP[datos.resultado]
  await db.insert(pagosSimulados).values({
    id,
    referenciaExterna: datos.pagoId,
    estado: mp.status,
    detalleEstado: mp.detalle,
    monto: datos.montoArs,
  })
  return id
}

/** Arma la notificación tal como la manda Mercado Pago (query, cuerpo y cabeceras firmadas). */
export function notificacionFirmada(secreto: string, pagoExternoId: string) {
  const requestId = randomUUID()
  const ts = String(Date.now())
  const v1 = firmar(secreto, pagoExternoId, requestId, ts)
  return {
    query: `data.id=${pagoExternoId}&type=payment`,
    headers: {
      'content-type': 'application/json',
      'x-request-id': requestId,
      'x-signature': `ts=${ts},v1=${v1}`,
    },
    body: {
      id: Number(`${Date.now()}${randomInt(10, 99)}`),
      live_mode: false,
      type: 'payment',
      date_created: new Date().toISOString(),
      action: 'payment.updated',
      api_version: 'v1',
      data: { id: pagoExternoId },
    },
  }
}
