import 'server-only'
import { and, asc, desc, eq, gte, ilike, inArray, lt, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  clases,
  emails,
  instructores,
  listaEspera,
  movimientosCredito,
  packs,
  pagos,
  plantillas,
  productosPack,
  reservas,
  tiposClase,
  user,
} from '@/db/schema'
import { ocupaLugar } from '@/lib/dominio/cupos'
import { sumarSemanas } from '@/lib/tiempo'

/** Clases de la semana para la agenda (incluye canceladas, excluye la clase aislada de /caso). */
export async function agendaSemana(lunes: Date, ahora: Date) {
  return db
    .select({
      id: clases.id,
      iniciaEn: clases.iniciaEn,
      terminaEn: clases.terminaEn,
      cupo: clases.cupo,
      estado: clases.estado,
      tipo: tiposClase.nombre,
      instructor: instructores.nombre,
      reformers: sql<
        number[]
      >`coalesce(array_agg(${reservas.reformer} order by ${reservas.reformer}) filter (where ${reservas.id} is not null), '{}')`,
      enEspera: sql<number>`(select count(*)::int from lista_espera le where le.clase_id = clases.id and le.estado = 'esperando')`,
    })
    .from(clases)
    .innerJoin(tiposClase, eq(tiposClase.id, clases.tipoClaseId))
    .innerJoin(instructores, eq(instructores.id, clases.instructorId))
    .leftJoin(reservas, and(eq(reservas.claseId, clases.id), ocupaLugar(ahora)))
    .where(
      and(
        eq(clases.sandbox, false),
        gte(clases.iniciaEn, lunes),
        lt(clases.iniciaEn, sumarSemanas(lunes, 1)),
      ),
    )
    .groupBy(clases.id, tiposClase.nombre, instructores.nombre)
    .orderBy(asc(clases.iniciaEn))
}

export type ClaseAgenda = Awaited<ReturnType<typeof agendaSemana>>[number]

/** Lista de la clase: quién viene, en qué reformer, cómo pagó, y la lista de espera. */
export async function detalleClaseAdmin(claseId: string, ahora: Date) {
  if (!/^[0-9a-f-]{36}$/.test(claseId)) return null
  const [clase] = await db
    .select({
      id: clases.id,
      iniciaEn: clases.iniciaEn,
      terminaEn: clases.terminaEn,
      cupo: clases.cupo,
      estado: clases.estado,
      tipo: tiposClase.nombre,
      instructor: instructores.nombre,
      instructorUsuarioId: instructores.usuarioId,
    })
    .from(clases)
    .innerJoin(tiposClase, eq(tiposClase.id, clases.tipoClaseId))
    .innerJoin(instructores, eq(instructores.id, clases.instructorId))
    .where(and(eq(clases.id, claseId), eq(clases.sandbox, false)))
  if (!clase) return null
  const lista = await db
    .select({
      id: reservas.id,
      usuarioId: reservas.usuarioId,
      nombre: user.name,
      estado: reservas.estado,
      medio: reservas.medio,
      origen: reservas.origen,
      reformer: reservas.reformer,
      retenidaHasta: reservas.retenidaHasta,
      canceladaEn: reservas.canceladaEn,
    })
    .from(reservas)
    .innerJoin(user, eq(user.id, reservas.usuarioId))
    .where(eq(reservas.claseId, claseId))
    .orderBy(asc(reservas.reformer), desc(reservas.creadaEn))
  const espera = await db
    .select({
      id: listaEspera.id,
      nombre: user.name,
      estado: listaEspera.estado,
      posicion: listaEspera.posicion,
    })
    .from(listaEspera)
    .innerJoin(user, eq(user.id, listaEspera.usuarioId))
    .where(and(eq(listaEspera.claseId, claseId), inArray(listaEspera.estado, ['esperando', 'oferta'])))
    .orderBy(asc(listaEspera.posicion))
  const activas = lista.filter(
    (r) =>
      r.estado === 'confirmada' ||
      r.estado === 'asistio' ||
      (r.estado === 'pendiente_pago' && r.retenidaHasta !== null && r.retenidaHasta > ahora),
  )
  const otras = lista.filter((r) => !activas.includes(r) && r.estado !== 'vencida')
  return { clase, activas, otras, espera }
}

export async function listarPlantillas() {
  return db
    .select({
      id: plantillas.id,
      diaSemana: plantillas.diaSemana,
      hora: plantillas.hora,
      cupo: plantillas.cupo,
      activa: plantillas.activa,
      duracionMin: plantillas.duracionMin,
      tipo: tiposClase.nombre,
      instructor: instructores.nombre,
    })
    .from(plantillas)
    .innerJoin(tiposClase, eq(tiposClase.id, plantillas.tipoClaseId))
    .innerJoin(instructores, eq(instructores.id, plantillas.instructorId))
    .orderBy(asc(plantillas.diaSemana), asc(plantillas.hora))
}

export async function catalogo() {
  const [tipos, profes] = await Promise.all([
    db.select().from(tiposClase).orderBy(asc(tiposClase.nombre)),
    db.select().from(instructores).orderBy(asc(instructores.nombre)),
  ])
  return { tipos, instructores: profes }
}

export async function listarInstructores(ahora: Date) {
  // Subconsultas correlacionadas con nombres calificados: sin joins, Drizzle no califica las columnas.
  return db
    .select({
      id: instructores.id,
      nombre: instructores.nombre,
      bio: instructores.bio,
      activo: instructores.activo,
      conCuenta: sql<boolean>`${instructores.usuarioId} is not null`,
      plantillas: sql<number>`(select count(*)::int from plantillas p where p.instructor_id = instructores.id and p.activa)`,
      proximas: sql<number>`(select count(*)::int from clases c where c.instructor_id = instructores.id and c.inicia_en > ${ahora} and c.estado = 'programada' and not c.sandbox)`,
    })
    .from(instructores)
    .orderBy(asc(instructores.nombre))
}

export async function listarAlumnos(busqueda: string, ahora: Date) {
  const q = busqueda.trim()
  return db
    .select({
      id: user.id,
      nombre: user.name,
      email: user.email,
      creditos: sql<number>`(select coalesce(sum(p.creditos_restantes), 0)::int from packs p where p.usuario_id = usuarios.id and p.estado = 'activo' and p.vence_en > ${ahora})`,
      vence: sql<
        string | null
      >`(select min(p.vence_en) from packs p where p.usuario_id = usuarios.id and p.estado = 'activo' and p.vence_en > ${ahora} and p.creditos_restantes > 0)`,
      asistencias: sql<number>`(select count(*)::int from reservas r where r.usuario_id = usuarios.id and r.estado = 'asistio')`,
      proxima: sql<
        string | null
      >`(select min(c.inicia_en) from reservas r join clases c on c.id = r.clase_id where r.usuario_id = usuarios.id and r.estado = 'confirmada' and c.inicia_en > ${ahora})`,
      tardias: sql<number>`(select count(*)::int from reservas r where r.usuario_id = usuarios.id and r.estado = 'cancelada_tarde')`,
    })
    .from(user)
    .where(
      and(
        eq(user.role, 'alumno'),
        sql`${user.email} not like 'sim-%'`,
        q ? or(ilike(user.name, `%${q}%`), ilike(user.email, `%${q}%`)) : undefined,
      ),
    )
    .orderBy(asc(user.name))
    .limit(200)
}

export async function fichaAlumno(id: string, ahora: Date) {
  const [alumno] = await db
    .select({ id: user.id, nombre: user.name, email: user.email, rol: user.role, desde: user.createdAt })
    .from(user)
    .where(eq(user.id, id))
  if (!alumno) return null
  const [historial, susPacks, movimientos, susPagos] = await Promise.all([
    db
      .select({
        id: reservas.id,
        estado: reservas.estado,
        medio: reservas.medio,
        reformer: reservas.reformer,
        iniciaEn: clases.iniciaEn,
        tipo: tiposClase.nombre,
        instructor: instructores.nombre,
        claseId: clases.id,
      })
      .from(reservas)
      .innerJoin(clases, eq(clases.id, reservas.claseId))
      .innerJoin(tiposClase, eq(tiposClase.id, clases.tipoClaseId))
      .innerJoin(instructores, eq(instructores.id, clases.instructorId))
      .where(and(eq(reservas.usuarioId, id), eq(clases.sandbox, false)))
      .orderBy(desc(clases.iniciaEn))
      .limit(40),
    db.select().from(packs).where(eq(packs.usuarioId, id)).orderBy(desc(packs.creadoEn)),
    db
      .select({
        id: movimientosCredito.id,
        delta: movimientosCredito.delta,
        motivo: movimientosCredito.motivo,
        nota: movimientosCredito.nota,
        creadoEn: movimientosCredito.creadoEn,
        pack: packs.nombre,
      })
      .from(movimientosCredito)
      .innerJoin(packs, eq(packs.id, movimientosCredito.packId))
      .where(eq(movimientosCredito.usuarioId, id))
      .orderBy(desc(movimientosCredito.creadoEn))
      .limit(40),
    db.select().from(pagos).where(eq(pagos.usuarioId, id)).orderBy(desc(pagos.creadoEn)).limit(20),
  ])
  const creditos = susPacks
    .filter((p) => p.estado === 'activo' && p.venceEn && p.venceEn > ahora)
    .reduce((s, p) => s + p.creditosRestantes, 0)
  return { alumno, historial, packs: susPacks, movimientos, pagos: susPagos, creditos }
}

/** Pagos más recientes primero; la página muestra 150 y la exportación, todos. */
export async function listarPagos(filtro: { estado?: string; todos?: boolean }) {
  const estados = ['pendiente', 'en_proceso', 'aprobado', 'rechazado', 'cancelado', 'reembolsado'] as const
  const estado = estados.find((e) => e === filtro.estado)
  const filas = await db
    .select({
      id: pagos.id,
      creadoEn: pagos.creadoEn,
      aprobadoEn: pagos.aprobadoEn,
      estado: pagos.estado,
      detalle: pagos.detalleEstado,
      tipo: pagos.tipo,
      descripcion: pagos.descripcion,
      montoArs: pagos.montoArs,
      proveedor: pagos.proveedor,
      idExterno: pagos.idExterno,
      usuarioId: pagos.usuarioId,
      nombre: user.name,
      email: user.email,
    })
    .from(pagos)
    .innerJoin(user, eq(user.id, pagos.usuarioId))
    .where(estado ? eq(pagos.estado, estado) : undefined)
    .orderBy(desc(pagos.creadoEn))
    .limit(filtro.todos ? 100_000 : 150)
  const totales = await db
    .select({
      estado: pagos.estado,
      n: sql<number>`count(*)::int`,
      monto: sql<number>`coalesce(sum(${pagos.montoArs}), 0)::int`,
    })
    .from(pagos)
    .groupBy(pagos.estado)
  return { filas, totales }
}

export async function productos() {
  return db.select().from(productosPack).orderBy(asc(productosPack.orden))
}

export async function ultimosEmails() {
  return db
    .select({
      id: emails.id,
      para: emails.para,
      plantilla: emails.plantilla,
      asunto: emails.asunto,
      estado: emails.estado,
      creadoEn: emails.creadoEn,
      enviadoEn: emails.enviadoEn,
    })
    .from(emails)
    .orderBy(desc(emails.creadoEn))
    .limit(30)
}

/** Clases de la semana de un instructor (vista /instructor). */
export async function clasesDeInstructor(usuarioId: string, lunes: Date) {
  const [inst] = await db.select().from(instructores).where(eq(instructores.usuarioId, usuarioId))
  if (!inst) return null
  const lista = await db
    .select({
      id: clases.id,
      iniciaEn: clases.iniciaEn,
      tipo: tiposClase.nombre,
      cupo: clases.cupo,
      estado: clases.estado,
    })
    .from(clases)
    .innerJoin(tiposClase, eq(tiposClase.id, clases.tipoClaseId))
    .where(
      and(
        eq(clases.instructorId, inst.id),
        eq(clases.sandbox, false),
        gte(clases.iniciaEn, lunes),
        lt(clases.iniciaEn, sumarSemanas(lunes, 1)),
      ),
    )
    .orderBy(asc(clases.iniciaEn))
  return { instructor: inst, clases: lista }
}

type FilaDia = { dia: string; lugares: number; ocupados: number; ingresos: number }

/**
 * Métricas de una semana: ocupación (reservas confirmadas o asistidas sobre lugares de clases no
 * canceladas), ingresos aprobados, cancelaciones tardías y personas esperando. Se comparan con la
 * semana anterior.
 */
export async function metricasSemana(lunes: Date) {
  const fin = sumarSemanas(lunes, 1)
  const previo = sumarSemanas(lunes, -1)
  const resumen = async (desde: Date, hasta: Date) => {
    const { rows } = await db.execute<{
      lugares: number
      ocupados: number
      ingresos: number
      pagos: number
      tardias: number
      completas: number
      clases: number
    }>(sql`
      with c as (
        select c.id, c.cupo,
          (select count(*) from reservas r where r.clase_id = c.id and r.estado in ('confirmada', 'asistio'))::int as ocupados
        from clases c
        where not c.sandbox and c.estado = 'programada' and c.inicia_en >= ${desde} and c.inicia_en < ${hasta}
      )
      select
        coalesce((select sum(cupo) from c), 0)::int as lugares,
        coalesce((select sum(ocupados) from c), 0)::int as ocupados,
        (select count(*) from c)::int as clases,
        (select count(*) from c where ocupados >= cupo)::int as completas,
        coalesce((select sum(monto_ars) from pagos where estado = 'aprobado' and aprobado_en >= ${desde} and aprobado_en < ${hasta}), 0)::int as ingresos,
        (select count(*) from pagos where estado = 'aprobado' and aprobado_en >= ${desde} and aprobado_en < ${hasta})::int as pagos,
        (select count(*) from reservas r join clases cl on cl.id = r.clase_id
          where not cl.sandbox and r.estado = 'cancelada_tarde' and cl.inicia_en >= ${desde} and cl.inicia_en < ${hasta})::int as tardias
    `)
    return rows[0]!
  }
  const [actual, anterior] = await Promise.all([resumen(lunes, fin), resumen(previo, lunes)])

  const { rows: porDia } = await db.execute<FilaDia>(sql`
    with dias as (
      select to_char(d, 'YYYY-MM-DD') as dia
      from generate_series((${lunes}::timestamptz at time zone 'America/Argentina/Buenos_Aires')::date,
                           (${lunes}::timestamptz at time zone 'America/Argentina/Buenos_Aires')::date + 6, interval '1 day') d
    ),
    oc as (
      select to_char(c.inicia_en at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD') as dia,
        sum(c.cupo)::int as lugares,
        sum((select count(*) from reservas r where r.clase_id = c.id and r.estado in ('confirmada', 'asistio')))::int as ocupados
      from clases c
      where not c.sandbox and c.estado = 'programada' and c.inicia_en >= ${lunes} and c.inicia_en < ${fin}
      group by 1
    ),
    ing as (
      select to_char(aprobado_en at time zone 'America/Argentina/Buenos_Aires', 'YYYY-MM-DD') as dia, sum(monto_ars)::int as ingresos
      from pagos where estado = 'aprobado' and aprobado_en >= ${lunes} and aprobado_en < ${fin}
      group by 1
    )
    select dias.dia, coalesce(oc.lugares, 0)::int as lugares, coalesce(oc.ocupados, 0)::int as ocupados,
      coalesce(ing.ingresos, 0)::int as ingresos
    from dias left join oc using (dia) left join ing using (dia)
    order by dias.dia
  `)

  const tardias = await db
    .select({
      id: reservas.id,
      nombre: user.name,
      usuarioId: user.id,
      iniciaEn: clases.iniciaEn,
      canceladaEn: reservas.canceladaEn,
      tipo: tiposClase.nombre,
    })
    .from(reservas)
    .innerJoin(clases, eq(clases.id, reservas.claseId))
    .innerJoin(tiposClase, eq(tiposClase.id, clases.tipoClaseId))
    .innerJoin(user, eq(user.id, reservas.usuarioId))
    .where(
      and(
        eq(reservas.estado, 'cancelada_tarde'),
        eq(clases.sandbox, false),
        gte(clases.iniciaEn, lunes),
        lt(clases.iniciaEn, fin),
      ),
    )
    .orderBy(asc(clases.iniciaEn))

  const [espera] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(listaEspera)
    .innerJoin(clases, eq(clases.id, listaEspera.claseId))
    .where(
      and(
        eq(listaEspera.estado, 'esperando'),
        eq(clases.sandbox, false),
        gte(clases.iniciaEn, lunes),
        lt(clases.iniciaEn, fin),
      ),
    )

  return { actual, anterior, porDia, tardias, enEspera: espera?.n ?? 0 }
}

export type MetricasSemana = Awaited<ReturnType<typeof metricasSemana>>

/** Quién viene a cada clase (vista del instructor): reservas activas ordenadas por reformer. */
export async function listasDeClases(claseIds: string[], ahora: Date) {
  if (!claseIds.length)
    return new Map<string, { id: string; nombre: string; reformer: number; estado: string }[]>()
  const filas = await db
    .select({
      id: reservas.id,
      claseId: reservas.claseId,
      nombre: user.name,
      reformer: reservas.reformer,
      estado: reservas.estado,
    })
    .from(reservas)
    .innerJoin(user, eq(user.id, reservas.usuarioId))
    .where(and(inArray(reservas.claseId, claseIds), ocupaLugar(ahora)))
    .orderBy(asc(reservas.reformer))
  const porClase = new Map<string, { id: string; nombre: string; reformer: number; estado: string }[]>()
  for (const f of filas) porClase.set(f.claseId, [...(porClase.get(f.claseId) ?? []), f])
  return porClase
}
