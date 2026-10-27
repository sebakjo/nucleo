'use server'

import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { pagos } from '@/db/schema'
import { urlApp } from '@/lib/config'
import { proveedorPagos } from '@/lib/pagos'
import { notificacionFirmada, registrarPagoSimulado, type ResultadoSimulado } from '@/lib/pagos/simulado'
import { exigirUsuario } from '@/lib/sesion'

/**
 * El "botón de Mercado Pago" del checkout simulado: registra el pago en la API simulada y manda la
 * notificación firmada al webhook real, igual que haría Mercado Pago. Después vuelve a la app con
 * los mismos parámetros que agrega Mercado Pago a la back_url.
 */
export async function simularPago(form: FormData) {
  const pagoId = String(form.get('pagoId') ?? '')
  const resultado = String(form.get('resultado') ?? '') as ResultadoSimulado
  if (!['aprobado', 'pendiente', 'rechazado'].includes(resultado)) redirect('/')
  if (proveedorPagos().nombre !== 'simulado') redirect('/')
  const usuario = await exigirUsuario(`/pago-simulado/${pagoId}`)
  const [pago] = await db.select().from(pagos).where(eq(pagos.id, pagoId))
  if (!pago || pago.usuarioId !== usuario.id) redirect('/')

  const idExterno = await registrarPagoSimulado(db, { pagoId, resultado, montoArs: pago.montoArs })
  const secreto = process.env.MP_WEBHOOK_SECRET
  if (secreto) {
    const n = notificacionFirmada(secreto, idExterno)
    await fetch(`${urlApp()}/api/webhooks/mercadopago?${n.query}`, {
      method: 'POST',
      headers: n.headers,
      body: JSON.stringify(n.body),
      signal: AbortSignal.timeout(8000),
    }).catch((e) => console.error('[pago simulado] no se pudo notificar al webhook', e))
  }
  const estado = { aprobado: 'approved', pendiente: 'in_process', rechazado: 'rejected' }[resultado]
  redirect(`/pago/${pagoId}?payment_id=${idExterno}&status=${estado}&external_reference=${pagoId}`)
}
