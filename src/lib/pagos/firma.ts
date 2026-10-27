import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Validación de la cabecera x-signature de las notificaciones de Mercado Pago.
 *
 * Mercado Pago firma con HMAC-SHA256 (clave secreta del webhook) este "manifest":
 *   id:[data.id];request-id:[x-request-id];ts:[ts];
 * y manda `x-signature: ts=1704908010,v1=<hex>`. El data.id viaja en la query string y, si es
 * alfanumérico, se usa en minúsculas. Si falta el x-request-id, esa parte se omite.
 */
export function manifiesto(dataId: string | null, requestId: string | null, ts: string): string {
  let m = ''
  if (dataId) m += `id:${/^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId};`
  if (requestId) m += `request-id:${requestId};`
  m += `ts:${ts};`
  return m
}

export function firmar(secreto: string, dataId: string | null, requestId: string | null, ts: string): string {
  return createHmac('sha256', secreto)
    .update(manifiesto(dataId, requestId, ts))
    .digest('hex')
}

export function leerCabeceraFirma(cabecera: string | null): { ts: string; v1: string } | null {
  if (!cabecera) return null
  const partes = Object.fromEntries(
    cabecera.split(',').map((p) => {
      const [k, ...v] = p.split('=')
      return [k?.trim(), v.join('=').trim()]
    }),
  )
  if (!partes.ts || !partes.v1) return null
  return { ts: partes.ts, v1: partes.v1 }
}

export type ResultadoFirma =
  { valida: true } | { valida: false; motivo: 'sin_secreto' | 'sin_firma' | 'no_coincide' }

export function verificarFirma(datos: {
  secreto: string | undefined
  cabecera: string | null
  requestId: string | null
  dataId: string | null
}): ResultadoFirma {
  if (!datos.secreto) return { valida: false, motivo: 'sin_secreto' }
  const firma = leerCabeceraFirma(datos.cabecera)
  if (!firma) return { valida: false, motivo: 'sin_firma' }
  const esperada = Buffer.from(firmar(datos.secreto, datos.dataId, datos.requestId, firma.ts), 'hex')
  const recibida = Buffer.from(firma.v1, 'hex')
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) {
    return { valida: false, motivo: 'no_coincide' }
  }
  return { valida: true }
}
