import { TZDate } from '@date-fns/tz'
import { z } from 'zod'
import { ZONA } from '@/lib/tiempo'
import {
  estadoDesdeMercadoPago,
  type NuevaPreferencia,
  type PagoExterno,
  type ProveedorPagos,
} from './proveedor'

const API = 'https://api.mercadopago.com'

const PreferenciaCreada = z.object({ id: z.string(), init_point: z.string().url() })

const PagoMP = z.object({
  id: z.union([z.number(), z.string()]).transform(String),
  status: z.string(),
  status_detail: z.string().nullish(),
  external_reference: z.string().nullish(),
  transaction_amount: z.number(),
  currency_id: z.string(),
})

/**
 * Mercado Pago Checkout Pro por API REST. Dos llamadas: crear la preferencia (a dónde redirigir)
 * y consultar un pago por id (para conocer su estado real después de una notificación).
 */
export function crearMercadoPago(accessToken: string): ProveedorPagos {
  async function llamar(ruta: string, init: RequestInit = {}) {
    const res = await fetch(`${API}${ruta}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...init.headers,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    return res
  }

  return {
    nombre: 'mercadopago',

    async crearPreferencia(p: NuevaPreferencia) {
      const cuerpo = {
        items: [
          {
            id: p.pagoId,
            title: p.titulo,
            quantity: 1,
            unit_price: p.montoArs,
            currency_id: 'ARS',
          },
        ],
        payer: { email: p.email },
        external_reference: p.pagoId,
        back_urls: { success: p.urlRetorno, pending: p.urlRetorno, failure: p.urlRetorno },
        auto_return: 'approved',
        statement_descriptor: 'NUCLEO PILATES',
        binary_mode: p.modoBinario,
        // Mercado Pago solo acepta notification_url públicas: en local se concilia desde el retorno.
        ...(p.urlNotificacion.startsWith('https://') ? { notification_url: p.urlNotificacion } : {}),
        ...(p.vence
          ? {
              expires: true,
              expiration_date_to: new TZDate(p.vence.getTime(), ZONA).toISOString(),
            }
          : {}),
      }
      const res = await llamar('/checkout/preferences', {
        method: 'POST',
        body: JSON.stringify(cuerpo),
        headers: { 'X-Idempotency-Key': p.pagoId },
      })
      if (!res.ok) {
        throw new Error(`Mercado Pago rechazó la preferencia (${res.status}): ${await res.text()}`)
      }
      const pref = PreferenciaCreada.parse(await res.json())
      return { preferenciaId: pref.id, urlPago: pref.init_point }
    },

    async obtenerPago(id: string): Promise<PagoExterno | null> {
      if (!/^\d+$/.test(id)) return null
      const res = await llamar(`/v1/payments/${id}`)
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`No se pudo consultar el pago ${id} (${res.status})`)
      const json = await res.json()
      const pago = PagoMP.parse(json)
      return {
        id: pago.id,
        estado: estadoDesdeMercadoPago(pago.status),
        detalle: pago.status_detail ?? pago.status,
        referenciaExterna: pago.external_reference ?? null,
        monto: pago.transaction_amount,
        moneda: pago.currency_id,
        datos: json,
      }
    },
  }
}
