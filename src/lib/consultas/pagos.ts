import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { clases, instructores, packs, pagos, reservas, tiposClase } from '@/db/schema'

/** El pago y lo que compró, solo si es del usuario que lo pide. */
export async function pagoDelUsuario(pagoId: string, usuarioId: string) {
  if (!/^[0-9a-f-]{36}$/.test(pagoId)) return null
  const [pago] = await db.select().from(pagos).where(eq(pagos.id, pagoId))
  if (!pago || pago.usuarioId !== usuarioId) return null
  const reserva = pago.reservaId
    ? (
        await db
          .select({
            id: reservas.id,
            estado: reservas.estado,
            reformer: reservas.reformer,
            retenidaHasta: reservas.retenidaHasta,
            claseId: clases.id,
            iniciaEn: clases.iniciaEn,
            tipo: tiposClase.nombre,
            instructor: instructores.nombre,
          })
          .from(reservas)
          .innerJoin(clases, eq(clases.id, reservas.claseId))
          .innerJoin(tiposClase, eq(tiposClase.id, clases.tipoClaseId))
          .innerJoin(instructores, eq(instructores.id, clases.instructorId))
          .where(eq(reservas.id, pago.reservaId))
      )[0]
    : null
  const pack = pago.packId ? (await db.select().from(packs).where(eq(packs.id, pago.packId)))[0] : null
  return { pago, reserva: reserva ?? null, pack: pack ?? null }
}
