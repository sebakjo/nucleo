import { timingSafeEqual } from 'node:crypto'
import { db } from '@/db'
import {
  enviarRecordatorios,
  generarClases,
  liberarReservasVencidas,
  promoverListasDeEspera,
  vencerPacks,
} from '@/lib/dominio/tareas'
import { despacharEmails } from '@/lib/email/despachar'

/**
 * Tareas programadas protegidas con `Authorization: Bearer $CRON_SECRET` (el formato que usa el
 * cron de Vercel). Todas son idempotentes. Los emails que encolan se despachan al final.
 */
const TAREAS = {
  liberar: (ahora: Date) => liberarReservasVencidas(db, ahora),
  'lista-de-espera': (ahora: Date) => promoverListasDeEspera(db, ahora),
  recordatorios: (ahora: Date) => enviarRecordatorios(db, ahora),
  'vencer-packs': (ahora: Date) => vencerPacks(db, ahora),
  'generar-clases': (ahora: Date) => generarClases(db, ahora, { semanas: 3 }),
  emails: () => despacharEmails(db),
} as const

type Tarea = keyof typeof TAREAS

function autorizado(req: Request): boolean {
  const secreto = process.env.CRON_SECRET
  if (!secreto) return false
  const recibido = Buffer.from(req.headers.get('authorization') ?? '')
  const esperado = Buffer.from(`Bearer ${secreto}`)
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado)
}

async function correr(req: Request, { params }: RouteContext<'/api/cron/[tarea]'>) {
  if (!autorizado(req)) return Response.json({ error: 'no_autorizado' }, { status: 401 })
  const { tarea } = await params
  const ahora = new Date()
  if (tarea === 'todo') {
    const resultado: Record<string, unknown> = {}
    for (const t of [
      'liberar',
      'lista-de-espera',
      'vencer-packs',
      'recordatorios',
      'generar-clases',
      'emails',
    ] as Tarea[]) {
      resultado[t] = await TAREAS[t](ahora)
    }
    return Response.json({ ok: true, ahora: ahora.toISOString(), resultado })
  }
  if (!(tarea in TAREAS)) return Response.json({ error: 'tarea_desconocida' }, { status: 404 })
  const resultado = await TAREAS[tarea as Tarea](ahora)
  if (tarea !== 'emails') await despacharEmails(db)
  return Response.json({ ok: true, ahora: ahora.toISOString(), resultado })
}

export const GET = correr
export const POST = correr
