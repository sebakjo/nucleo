import { db } from '@/db'
import { procesarNotificacion } from '@/lib/dominio/pagos'
import { despacharEmails } from '@/lib/email/despachar'
import { despuesDeResponder } from '@/lib/despues'
import { verificarFirma } from '@/lib/pagos/firma'
import { proveedorPagos } from '@/lib/pagos'

/**
 * Notificaciones de Mercado Pago (y del proveedor simulado, que las imita).
 * 1. Valida la firma x-signature con la clave secreta del webhook. Sin firma válida: 401.
 * 2. Registra la notificación con su id: si ya se procesó, responde 200 sin hacer nada.
 * 3. Consulta el pago a la API del proveedor y aplica su estado real (nunca el del cuerpo).
 */
export async function POST(req: Request) {
  const url = new URL(req.url)
  const dataId = url.searchParams.get('data.id') ?? url.searchParams.get('id')
  const tipo = url.searchParams.get('type') ?? url.searchParams.get('topic') ?? ''
  const requestId = req.headers.get('x-request-id')
  const cuerpo = (await req.json().catch(() => null)) as { id?: string | number; type?: string } | null

  const firma = verificarFirma({
    secreto: process.env.MP_WEBHOOK_SECRET,
    cabecera: req.headers.get('x-signature'),
    requestId,
    dataId,
  })
  if (!firma.valida) {
    return Response.json({ error: 'firma_invalida', motivo: firma.motivo }, { status: 401 })
  }
  if (tipo !== 'payment' || !dataId) return Response.json({ ignorado: true })

  const clave = `mp:${cuerpo?.id ?? requestId ?? `${dataId}:${Date.now()}`}`
  const resultado = await procesarNotificacion(db, proveedorPagos(), {
    clave,
    tipo,
    recursoId: dataId,
    payload: cuerpo,
    ahora: new Date(),
  })
  despuesDeResponder(() => despacharEmails(db))
  return Response.json(resultado)
}
