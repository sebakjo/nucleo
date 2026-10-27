import 'server-only'
import { and, asc, eq, gt, gte, inArray, lt, sql, type SQL } from 'drizzle-orm'
import { db } from '@/db'
import { clases, instructores, listaEspera, packs, reservas, tiposClase } from '@/db/schema'
import { ocupaLugar } from '@/lib/dominio/cupos'
import { precioClaseSuelta } from '@/lib/dominio/precios'
import { sumarSemanas } from '@/lib/tiempo'

/** Lo que la grilla necesita de cada clase. Fechas en ISO: viaja al cliente para el polling. */
export type ClaseVista = {
  id: string
  iniciaEn: string
  terminaEn: string
  tipo: string
  nivel: string
  instructor: string
  cupo: number
  /** Números de reformer ocupados (1 a 6). */
  reformers: number[]
  cancelada: boolean
  mia: MiLugar | null
}

export type MiLugar =
  | { tipo: 'reservada'; reformer: number; reservaId: string }
  | { tipo: 'pendiente'; reformer: number; hasta: string; reservaId: string }
  | { tipo: 'espera'; puesto: number; entradaId: string }

export function clasesDeLaSemana(lunes: Date, usuarioId: string | null, ahora: Date): Promise<ClaseVista[]> {
  return consultarClases(
    and(gte(clases.iniciaEn, lunes), lt(clases.iniciaEn, sumarSemanas(lunes, 1)))!,
    usuarioId,
    ahora,
  )
}

async function consultarClases(filtro: SQL, usuarioId: string | null, ahora: Date): Promise<ClaseVista[]> {
  const filas = await db
    .select({
      id: clases.id,
      iniciaEn: clases.iniciaEn,
      terminaEn: clases.terminaEn,
      cupo: clases.cupo,
      estado: clases.estado,
      tipo: tiposClase.nombre,
      nivel: tiposClase.nivel,
      instructor: instructores.nombre,
      reformers: sql<
        number[]
      >`coalesce(array_agg(${reservas.reformer} order by ${reservas.reformer}) filter (where ${reservas.id} is not null), '{}')`,
    })
    .from(clases)
    .innerJoin(tiposClase, eq(tiposClase.id, clases.tipoClaseId))
    .innerJoin(instructores, eq(instructores.id, clases.instructorId))
    .leftJoin(reservas, and(eq(reservas.claseId, clases.id), ocupaLugar(ahora)))
    .where(and(eq(clases.sandbox, false), filtro))
    .groupBy(clases.id, tiposClase.nombre, tiposClase.nivel, instructores.nombre)
    .orderBy(asc(clases.iniciaEn))

  const ids = filas.map((f) => f.id)
  const mias = usuarioId && ids.length ? await misLugares(usuarioId, ids, ahora) : new Map<string, MiLugar>()

  return filas.map((f) => ({
    id: f.id,
    iniciaEn: f.iniciaEn.toISOString(),
    terminaEn: f.terminaEn.toISOString(),
    tipo: f.tipo,
    nivel: f.nivel,
    instructor: f.instructor,
    cupo: f.cupo,
    reformers: f.reformers.map(Number),
    cancelada: f.estado === 'cancelada',
    mia: mias.get(f.id) ?? null,
  }))
}

async function misLugares(usuarioId: string, claseIds: string[], ahora: Date) {
  const resultado = new Map<string, MiLugar>()
  const propias = await db
    .select({
      id: reservas.id,
      claseId: reservas.claseId,
      estado: reservas.estado,
      reformer: reservas.reformer,
      retenidaHasta: reservas.retenidaHasta,
    })
    .from(reservas)
    .where(and(eq(reservas.usuarioId, usuarioId), inArray(reservas.claseId, claseIds), ocupaLugar(ahora)))
  for (const r of propias) {
    resultado.set(
      r.claseId,
      r.estado === 'pendiente_pago'
        ? { tipo: 'pendiente', reformer: r.reformer, hasta: r.retenidaHasta!.toISOString(), reservaId: r.id }
        : { tipo: 'reservada', reformer: r.reformer, reservaId: r.id },
    )
  }
  const esperas = await db
    .select({
      id: listaEspera.id,
      claseId: listaEspera.claseId,
      puesto: sql<number>`(select count(*)::int from ${listaEspera} le2 where le2.clase_id = ${listaEspera.claseId} and le2.estado = 'esperando' and le2.posicion <= ${listaEspera.posicion})`,
    })
    .from(listaEspera)
    .where(
      and(
        eq(listaEspera.usuarioId, usuarioId),
        inArray(listaEspera.claseId, claseIds),
        eq(listaEspera.estado, 'esperando'),
      ),
    )
  for (const e of esperas) {
    if (!resultado.has(e.claseId))
      resultado.set(e.claseId, { tipo: 'espera', puesto: e.puesto, entradaId: e.id })
  }
  return resultado
}

export type DetalleReserva = {
  clase: ClaseVista & { descripcion: string; duracionMin: number }
  precioArs: number
  enEspera: number
  usuario: null | {
    /** Créditos que sirven para esta clase (packs vigentes cuando empieza). */
    creditosParaClase: number
    proximoVencimiento: string | null
  }
}

export async function detalleParaReservar(
  claseId: string,
  usuarioId: string | null,
  ahora: Date,
): Promise<DetalleReserva | null> {
  if (!/^[0-9a-f-]{36}$/.test(claseId)) return null
  const [c] = await db
    .select({
      id: clases.id,
      iniciaEn: clases.iniciaEn,
      sandbox: clases.sandbox,
      descripcion: tiposClase.descripcion,
      duracionMin: tiposClase.duracionMin,
    })
    .from(clases)
    .innerJoin(tiposClase, eq(tiposClase.id, clases.tipoClaseId))
    .where(eq(clases.id, claseId))
  if (!c || c.sandbox) return null
  const [vista] = await consultarClases(eq(clases.id, claseId), usuarioId, ahora)
  if (!vista) return null

  const [{ enEspera }] = await db
    .select({ enEspera: sql<number>`count(*)::int` })
    .from(listaEspera)
    .where(and(eq(listaEspera.claseId, claseId), eq(listaEspera.estado, 'esperando')))

  let usuario: DetalleReserva['usuario'] = null
  if (usuarioId) {
    const vigentes = await db
      .select({ restantes: packs.creditosRestantes, venceEn: packs.venceEn })
      .from(packs)
      .where(
        and(
          eq(packs.usuarioId, usuarioId),
          eq(packs.estado, 'activo'),
          gt(packs.creditosRestantes, 0),
          gt(packs.venceEn, c.iniciaEn),
        ),
      )
      .orderBy(asc(packs.venceEn))
    usuario = {
      creditosParaClase: vigentes.reduce((s, p) => s + p.restantes, 0),
      proximoVencimiento: vigentes[0]?.venceEn?.toISOString() ?? null,
    }
  }
  return {
    clase: { ...vista, descripcion: c.descripcion, duracionMin: c.duracionMin },
    precioArs: await precioClaseSuelta(db),
    enEspera,
    usuario,
  }
}
