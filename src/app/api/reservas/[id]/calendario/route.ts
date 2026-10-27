import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { clases, instructores, reservas, tiposClase } from '@/db/schema'
import { archivoIcs } from '@/lib/calendario'
import { urlApp } from '@/lib/config'
import { limiteCancelacionSinCosto } from '@/lib/dominio/reglas'
import { claveDia, diaSemana, hora } from '@/lib/tiempo'
import { usuarioActual } from '@/lib/sesion'

/** Descarga la clase reservada como .ics. Solo la persona que reservó, y solo si está confirmada. */
export async function GET(_: Request, { params }: RouteContext<'/api/reservas/[id]/calendario'>) {
  const { id } = await params
  const u = await usuarioActual()
  if (!u) return Response.json({ error: 'no_autorizado' }, { status: 401 })
  if (!z.string().uuid().safeParse(id).success)
    return Response.json({ error: 'no_encontrada' }, { status: 404 })

  const [r] = await db
    .select({
      id: reservas.id,
      reformer: reservas.reformer,
      creadaEn: reservas.creadaEn,
      iniciaEn: clases.iniciaEn,
      terminaEn: clases.terminaEn,
      tipo: tiposClase.nombre,
      instructor: instructores.nombre,
    })
    .from(reservas)
    .innerJoin(clases, eq(clases.id, reservas.claseId))
    .innerJoin(tiposClase, eq(tiposClase.id, clases.tipoClaseId))
    .innerJoin(instructores, eq(instructores.id, clases.instructorId))
    .where(
      and(
        eq(reservas.id, id),
        eq(reservas.usuarioId, u.id),
        inArray(reservas.estado, ['confirmada', 'asistio']),
      ),
    )
  if (!r) return Response.json({ error: 'no_encontrada' }, { status: 404 })

  const limite = limiteCancelacionSinCosto(r.iniciaEn)
  const ics = archivoIcs({
    uid: `${r.id}@nucleo`,
    inicio: r.iniciaEn,
    fin: r.terminaEn,
    titulo: `${r.tipo} en Núcleo`,
    descripcion: `Con ${r.instructor}. Tu lugar es el reformer ${r.reformer}.\nCancelás sin costo hasta el ${diaSemana(limite)} ${hora(limite)}.\n${urlApp()}/mis-reservas`,
    lugar: 'Núcleo, pilates reformer · Buenos Aires',
    url: `${urlApp()}/mis-reservas`,
    creado: r.creadaEn,
  })
  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="nucleo-${claveDia(r.iniciaEn)}-${hora(r.iniciaEn).replace(':', '')}.ics"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
