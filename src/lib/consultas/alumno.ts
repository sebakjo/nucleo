import 'server-only'
import { and, asc, desc, eq, gt, inArray, lte, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  clases,
  instructores,
  listaEspera,
  movimientosCredito,
  packs,
  pagos,
  reservas,
  tiposClase,
} from '@/db/schema'
import { saldoCreditos } from '@/lib/dominio/creditos'
import { ocupaLugar } from '@/lib/dominio/cupos'

const columnasClase = {
  claseId: clases.id,
  iniciaEn: clases.iniciaEn,
  tipo: tiposClase.nombre,
  instructor: instructores.nombre,
  claseCancelada: sql<boolean>`${clases.estado} = 'cancelada'`,
}

/** Todo lo que muestra "Mis reservas", solo del usuario de la sesión. */
export async function misReservas(usuarioId: string, ahora: Date) {
  const proximas = await db
    .select({
      id: reservas.id,
      estado: reservas.estado,
      medio: reservas.medio,
      reformer: reservas.reformer,
      retenidaHasta: reservas.retenidaHasta,
      precioArs: reservas.precioArs,
      ...columnasClase,
    })
    .from(reservas)
    .innerJoin(clases, eq(clases.id, reservas.claseId))
    .innerJoin(tiposClase, eq(tiposClase.id, clases.tipoClaseId))
    .innerJoin(instructores, eq(instructores.id, clases.instructorId))
    .where(and(eq(reservas.usuarioId, usuarioId), gt(clases.iniciaEn, ahora), ocupaLugar(ahora)))
    .orderBy(asc(clases.iniciaEn))

  const espera = await db
    .select({
      id: listaEspera.id,
      puesto: sql<number>`(select count(*)::int from ${listaEspera} le2 where le2.clase_id = ${listaEspera.claseId} and le2.estado = 'esperando' and le2.posicion <= ${listaEspera.posicion})`,
      ...columnasClase,
    })
    .from(listaEspera)
    .innerJoin(clases, eq(clases.id, listaEspera.claseId))
    .innerJoin(tiposClase, eq(tiposClase.id, clases.tipoClaseId))
    .innerJoin(instructores, eq(instructores.id, clases.instructorId))
    .where(
      and(
        eq(listaEspera.usuarioId, usuarioId),
        eq(listaEspera.estado, 'esperando'),
        gt(clases.iniciaEn, ahora),
      ),
    )
    .orderBy(asc(clases.iniciaEn))

  const pasadas = await db
    .select({ id: reservas.id, estado: reservas.estado, medio: reservas.medio, ...columnasClase })
    .from(reservas)
    .innerJoin(clases, eq(clases.id, reservas.claseId))
    .innerJoin(tiposClase, eq(tiposClase.id, clases.tipoClaseId))
    .innerJoin(instructores, eq(instructores.id, clases.instructorId))
    .where(
      and(
        eq(reservas.usuarioId, usuarioId),
        eq(clases.sandbox, false),
        or(
          lte(clases.iniciaEn, ahora),
          inArray(reservas.estado, ['cancelada', 'cancelada_tarde', 'vencida']),
        ),
      ),
    )
    .orderBy(desc(clases.iniciaEn))
    .limit(30)

  const movimientos = await db
    .select({
      id: movimientosCredito.id,
      delta: movimientosCredito.delta,
      motivo: movimientosCredito.motivo,
      creadoEn: movimientosCredito.creadoEn,
      pack: packs.nombre,
    })
    .from(movimientosCredito)
    .innerJoin(packs, eq(packs.id, movimientosCredito.packId))
    .where(eq(movimientosCredito.usuarioId, usuarioId))
    .orderBy(desc(movimientosCredito.creadoEn))
    .limit(15)

  const pagosPendientes = await db
    .select({ id: pagos.id, descripcion: pagos.descripcion, montoArs: pagos.montoArs, estado: pagos.estado })
    .from(pagos)
    .where(
      and(
        eq(pagos.usuarioId, usuarioId),
        eq(pagos.tipo, 'pack'),
        inArray(pagos.estado, ['pendiente', 'en_proceso']),
      ),
    )
    .orderBy(desc(pagos.creadoEn))
    .limit(3)

  return {
    saldo: await saldoCreditos(db, usuarioId, ahora),
    proximas,
    espera,
    pasadas,
    movimientos,
    pagosPendientes: pagosPendientes.filter((p) => p.estado === 'en_proceso'),
  }
}

export type MisReservas = Awaited<ReturnType<typeof misReservas>>
