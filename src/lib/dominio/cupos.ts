import { and, eq, gt, inArray, or, sql, type SQL } from 'drizzle-orm'
import type { Ejecutor, Tx } from '@/db'
import { clases, instructores, listaEspera, reservas, tiposClase, user, type Clase } from '@/db/schema'
import { ErrorDominio } from './errores'

/**
 * Una reserva ocupa un reformer si está confirmada (o asistió), o si está pendiente de pago y la
 * retención no venció. Así la disponibilidad es correcta aunque el cron todavía no haya pasado.
 */
export function ocupaLugar(ahora: Date): SQL {
  return or(
    inArray(reservas.estado, ['confirmada', 'asistio']),
    and(eq(reservas.estado, 'pendiente_pago'), gt(reservas.retenidaHasta, ahora)),
  )!
}

/** SELECT ... FOR UPDATE sobre la fila de la clase: serializa todo lo que cambia sus cupos. */
export async function bloquearClase(tx: Tx, claseId: string): Promise<Clase> {
  const [clase] = await tx.select().from(clases).where(eq(clases.id, claseId)).for('update')
  if (!clase) throw new ErrorDominio('NO_ENCONTRADO')
  return clase
}

export async function contarOcupados(tx: Ejecutor, claseId: string, ahora: Date): Promise<number> {
  const [fila] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(reservas)
    .where(and(eq(reservas.claseId, claseId), ocupaLugar(ahora)))
  return fila?.n ?? 0
}

/** El reformer libre con el número más bajo (1 a cupo). Requiere la clase bloqueada. */
export async function reformerLibre(tx: Tx, clase: Clase, ahora: Date): Promise<number | null> {
  const usados = await tx
    .select({ reformer: reservas.reformer })
    .from(reservas)
    .where(and(eq(reservas.claseId, clase.id), ocupaLugar(ahora)))
  const set = new Set(usados.map((u) => u.reformer))
  for (let r = 1; r <= clase.cupo; r++) if (!set.has(r)) return r
  return null
}

/**
 * Marca como vencidas las reservas pendientes cuya retención terminó (y las ofertas de lista de
 * espera asociadas). Devuelve cuántas liberó. Requiere la clase bloqueada.
 */
export async function liberarRetencionesVencidas(tx: Tx, claseId: string, ahora: Date): Promise<number> {
  const vencidas = await tx
    .update(reservas)
    .set({ estado: 'vencida' })
    .where(
      and(
        eq(reservas.claseId, claseId),
        eq(reservas.estado, 'pendiente_pago'),
        sql`${reservas.retenidaHasta} <= ${ahora}`,
      ),
    )
    .returning({ id: reservas.id })
  if (vencidas.length === 0) return 0
  const ids = vencidas.map((v) => v.id)
  await tx
    .update(listaEspera)
    .set({ estado: 'vencida' })
    .where(and(inArray(listaEspera.reservaId, ids), eq(listaEspera.estado, 'oferta')))
  // El pago queda abierto en el proveedor: si se acredita tarde, se resuelve al procesarlo
  // (se confirma si todavía hay lugar o se convierte en un crédito).
  return vencidas.length
}

export type DetalleClase = {
  id: string
  iniciaEn: Date
  terminaEn: Date
  cupo: number
  estado: Clase['estado']
  sandbox: boolean
  tipo: string
  instructor: string
}

export async function detalleClase(tx: Ejecutor, claseId: string): Promise<DetalleClase> {
  const [fila] = await tx
    .select({
      id: clases.id,
      iniciaEn: clases.iniciaEn,
      terminaEn: clases.terminaEn,
      cupo: clases.cupo,
      estado: clases.estado,
      sandbox: clases.sandbox,
      tipo: tiposClase.nombre,
      instructor: instructores.nombre,
    })
    .from(clases)
    .innerJoin(tiposClase, eq(tiposClase.id, clases.tipoClaseId))
    .innerJoin(instructores, eq(instructores.id, clases.instructorId))
    .where(eq(clases.id, claseId))
  if (!fila) throw new ErrorDominio('NO_ENCONTRADO')
  return fila
}

export async function datosUsuario(tx: Ejecutor, usuarioId: string) {
  const [u] = await tx
    .select({ id: user.id, nombre: user.name, email: user.email, rol: user.role })
    .from(user)
    .where(eq(user.id, usuarioId))
  if (!u) throw new ErrorDominio('NO_ENCONTRADO')
  return u
}

/** "Lucía Ferreyra" → "Lucía" (como se nombra a la instructora en los mensajes). */
export function primerNombre(nombre: string): string {
  return nombre.split(' ')[0] ?? nombre
}
