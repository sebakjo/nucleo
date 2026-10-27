import { and, eq, gt, inArray, isNull, lte, sql } from 'drizzle-orm'
import type { DB } from '@/db'
import { clases, listaEspera, plantillas, reservas } from '@/db/schema'
import { encolarEmail } from '@/lib/email/outbox'
import { instanteDePlantilla, inicioDeSemana, sumarMinutos, sumarSemanas } from '@/lib/tiempo'
import { vencerPacks as vencerPacksTx } from './creditos'
import { bloquearClase, datosUsuario, detalleClase, liberarRetencionesVencidas } from './cupos'
import { asignarLugaresLiberados } from './lista-espera'
import { limiteCancelacionSinCosto } from './reglas'

/**
 * Tareas programadas. Cada una es idempotente: correrla dos veces seguidas no cambia nada la
 * segunda vez. Se disparan desde /api/cron/[tarea] (cron del deploy) o con `pnpm cron` en local.
 */

/** Libera las reservas pendientes de pago cuya retención venció y pasa esos lugares a la lista. */
export async function liberarReservasVencidas(db: DB, ahora: Date) {
  const afectadas = await db
    .selectDistinct({ claseId: reservas.claseId })
    .from(reservas)
    .where(and(eq(reservas.estado, 'pendiente_pago'), lte(reservas.retenidaHasta, ahora)))
  let liberadas = 0
  let promovidas = 0
  for (const { claseId } of afectadas) {
    await db.transaction(async (tx) => {
      const clase = await bloquearClase(tx, claseId)
      liberadas += await liberarRetencionesVencidas(tx, clase.id, ahora)
      promovidas += (await asignarLugaresLiberados(tx, clase, ahora)).length
    })
  }
  return { liberadas, promovidas }
}

/** Red de seguridad: clases futuras con lugar libre y gente esperando (por ejemplo, si subió el cupo). */
export async function promoverListasDeEspera(db: DB, ahora: Date) {
  const candidatas = await db
    .selectDistinct({ claseId: listaEspera.claseId })
    .from(listaEspera)
    .innerJoin(clases, eq(clases.id, listaEspera.claseId))
    .where(
      and(eq(listaEspera.estado, 'esperando'), eq(clases.estado, 'programada'), gt(clases.iniciaEn, ahora)),
    )
  let promovidas = 0
  for (const { claseId } of candidatas) {
    await db.transaction(async (tx) => {
      const clase = await bloquearClase(tx, claseId)
      await liberarRetencionesVencidas(tx, clase.id, ahora)
      promovidas += (await asignarLugaresLiberados(tx, clase, ahora)).length
    })
  }
  return { promovidas }
}

/**
 * Recordatorio por email 24 horas antes. Se manda una sola vez por reserva (clave única en la
 * outbox y `recordatorio_enviado_en`), cuando faltan 24 horas o menos y al menos 1 hora, y solo si
 * la reserva se hizo antes de esa ventana (quien reserva 3 horas antes no necesita recordatorio).
 */
export async function enviarRecordatorios(db: DB, ahora: Date) {
  const desde = sumarMinutos(ahora, 60)
  const hasta = sumarMinutos(ahora, 24 * 60)
  const pendientes = await db
    .select({
      id: reservas.id,
      usuarioId: reservas.usuarioId,
      claseId: reservas.claseId,
      reformer: reservas.reformer,
    })
    .from(reservas)
    .innerJoin(clases, eq(clases.id, reservas.claseId))
    .where(
      and(
        eq(reservas.estado, 'confirmada'),
        isNull(reservas.recordatorioEnviadoEn),
        eq(clases.estado, 'programada'),
        eq(clases.sandbox, false),
        gt(clases.iniciaEn, desde),
        lte(clases.iniciaEn, hasta),
        sql`${reservas.creadaEn} <= ${clases.iniciaEn} - interval '24 hours'`,
      ),
    )
  let enviados = 0
  for (const r of pendientes) {
    await db.transaction(async (tx) => {
      const [marcada] = await tx
        .update(reservas)
        .set({ recordatorioEnviadoEn: ahora })
        .where(and(eq(reservas.id, r.id), isNull(reservas.recordatorioEnviadoEn)))
        .returning({ id: reservas.id })
      if (!marcada) return
      const alumno = await datosUsuario(tx, r.usuarioId)
      const detalle = await detalleClase(tx, r.claseId)
      await encolarEmail(tx, {
        plantilla: 'recordatorio',
        para: alumno.email,
        usuarioId: alumno.id,
        claveUnica: `recordatorio:${r.id}`,
        datos: {
          nombre: alumno.nombre,
          clase: detalle.tipo,
          instructor: detalle.instructor,
          iniciaEn: detalle.iniciaEn.toISOString(),
          reformer: r.reformer,
          limiteCancelacion: limiteCancelacionSinCosto(detalle.iniciaEn).toISOString(),
        },
      })
      enviados++
    })
  }
  return { enviados }
}

export async function vencerPacks(db: DB, ahora: Date) {
  const vencidos = await db.transaction((tx) => vencerPacksTx(tx, ahora))
  return { vencidos }
}

/**
 * Genera las clases de las plantillas activas desde la semana de `desde` hasta `semanas` semanas
 * adelante. La restricción única (plantilla, inicio) hace que repetirla no duplique nada.
 */
export async function generarClases(db: DB, ahora: Date, opciones: { desde?: Date; semanas?: number } = {}) {
  const activas = await db
    .select({
      id: plantillas.id,
      diaSemana: plantillas.diaSemana,
      hora: plantillas.hora,
      duracionMin: plantillas.duracionMin,
      instructorId: plantillas.instructorId,
      tipoClaseId: plantillas.tipoClaseId,
      cupo: plantillas.cupo,
    })
    .from(plantillas)
    .where(eq(plantillas.activa, true))
  const primerLunes = inicioDeSemana(opciones.desde ?? ahora)
  const semanas = opciones.semanas ?? 3
  const filas = []
  for (let s = 0; s < semanas; s++) {
    const lunes = sumarSemanas(primerLunes, s)
    for (const p of activas) {
      const inicia = instanteDePlantilla(lunes, p.diaSemana, p.hora)
      if (inicia <= ahora && !opciones.desde) continue
      filas.push({
        plantillaId: p.id,
        tipoClaseId: p.tipoClaseId,
        instructorId: p.instructorId,
        iniciaEn: inicia,
        terminaEn: sumarMinutos(inicia, p.duracionMin),
        cupo: p.cupo,
      })
    }
  }
  if (filas.length === 0) return { creadas: 0 }
  const creadas = await db
    .insert(clases)
    .values(filas)
    .onConflictDoNothing({ target: [clases.plantillaId, clases.iniciaEn] })
    .returning({ id: clases.id })
  return { creadas: creadas.length }
}

/** Ids de clases futuras de una plantilla (para tests y para el panel). */
export async function clasesDePlantilla(db: DB, plantillaId: string, ahora: Date) {
  return db
    .select({ id: clases.id, iniciaEn: clases.iniciaEn })
    .from(clases)
    .where(
      and(
        eq(clases.plantillaId, plantillaId),
        gt(clases.iniciaEn, ahora),
        inArray(clases.estado, ['programada']),
      ),
    )
}
