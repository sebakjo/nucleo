import { clasesDeLaSemana } from '@/lib/consultas/horarios'
import { usuarioActual } from '@/lib/sesion'
import { inicioDeSemana, semanaDesdeClave } from '@/lib/tiempo'

/** Cupos de la semana para el polling de la grilla (y lo tuyo, si hay sesión). */
export async function GET(req: Request) {
  const semana = new URL(req.url).searchParams.get('semana')
  const ahora = new Date()
  const lunes = semanaDesdeClave(semana) ?? inicioDeSemana(ahora)
  const usuario = await usuarioActual()
  const clases = await clasesDeLaSemana(lunes, usuario?.id ?? null, ahora)
  return Response.json({ ahora: ahora.toISOString(), clases }, { headers: { 'Cache-Control': 'no-store' } })
}
