import { and, asc, eq, inArray, like, sql } from 'drizzle-orm'
import { crearDb, type DB } from '@/db'
import {
  clases,
  instructores,
  listaEspera,
  movimientosCredito,
  packs,
  reservas,
  tiposClase,
  user,
} from '@/db/schema'
import { ocupaLugar } from '@/lib/dominio/cupos'
import { ErrorDominio } from '@/lib/dominio/errores'
import { anotarEnEspera } from '@/lib/dominio/lista-espera'
import { reservarClase } from '@/lib/dominio/reservas'
import { crearNavegador } from './prototipo'

export const PERSONAS = 20
export const CUPO = 6
/** Clave del advisory lock de Postgres: una simulación por vez en todo el sistema. */
const CLAVE_BLOQUEO = 31_415_926

export type Lado = 'prototipo' | 'produccion'
export type EventoSimulacion =
  | { tipo: 'inicio'; personas: number; cupo: number }
  | {
      tipo: 'intento'
      lado: Lado
      persona: number
      resultado: 'reservada' | 'espera'
      reformer?: number
      puesto?: number
      ms: number
    }
  | { tipo: 'fin'; lado: Lado; ocupados: number; espera: number; ms: number }
  | {
      tipo: 'verificacion'
      activas: number
      enEspera: number
      reformersRepetidos: number
      creditosUsados: number
    }

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms))
const latencia = () => 15 + Math.random() * 90

let pool: ReturnType<typeof crearDb> | null = null

/** Pool propio de 20+ conexiones para que las 20 reservas lleguen de verdad en paralelo a Postgres. */
export function poolSimulacion() {
  pool ??= crearDb(process.env.DATABASE_URL!, PERSONAS + 2, { idleTimeoutMillis: 120_000 })
  return pool
}

/**
 * Deja la clase aislada como nueva: 20 personas de prueba con 1 crédito cada una y una clase
 * "sandbox" vacía de 6 lugares que no aparece en horarios, agenda ni métricas.
 */
export async function prepararSandbox(db: DB, ahora: Date): Promise<{ claseId: string; usuarios: string[] }> {
  return db.transaction(async (tx) => {
    const usuarios = Array.from({ length: PERSONAS }, (_, i) => `sim-${String(i + 1).padStart(2, '0')}`)
    await tx
      .insert(user)
      .values(
        usuarios.map((id, i) => ({
          id,
          name: `Persona ${i + 1}`,
          email: `${id}@nucleo.test`,
          role: 'alumno' as const,
        })),
      )
      .onConflictDoNothing()

    await tx.delete(clases).where(eq(clases.sandbox, true))
    await tx.delete(packs).where(inArray(packs.usuarioId, usuarios))

    const [tipo] = await tx.select().from(tiposClase).orderBy(asc(tiposClase.nombre)).limit(1)
    const [inst] = await tx.select().from(instructores).orderBy(asc(instructores.nombre)).limit(1)
    const inicio = new Date(ahora.getTime() + 3 * 86_400_000)
    const [clase] = await tx
      .insert(clases)
      .values({
        tipoClaseId: tipo.id,
        instructorId: inst.id,
        iniciaEn: inicio,
        terminaEn: new Date(inicio.getTime() + 55 * 60_000),
        cupo: CUPO,
        sandbox: true,
      })
      .returning({ id: clases.id })

    const nuevos = await tx
      .insert(packs)
      .values(
        usuarios.map((u) => ({
          usuarioId: u,
          nombre: 'Crédito de simulación',
          creditosTotales: 1,
          creditosRestantes: 1,
          estado: 'activo' as const,
          compradoEn: ahora,
          venceEn: new Date(ahora.getTime() + 7 * 86_400_000),
          creadoEn: ahora,
        })),
      )
      .returning({ id: packs.id, usuarioId: packs.usuarioId })
    await tx.insert(movimientosCredito).values(
      nuevos.map((p) => ({
        usuarioId: p.usuarioId,
        packId: p.id,
        delta: 1,
        motivo: 'ajuste' as const,
        nota: 'Simulación /caso',
        creadoEn: ahora,
      })),
    )
    return { claseId: clase.id, usuarios }
  })
}

/** El prototipo: 20 navegadores, cada uno con su localStorage vacío y el cupo "6 libres" del HTML. */
export async function simularPrototipo(emitir: (e: EventoSimulacion) => void) {
  const t0 = performance.now()
  const clase = { id: 'sandbox', cupo: CUPO, ocupados: 0 }
  let ocupados = 0
  await Promise.all(
    Array.from({ length: PERSONAS }, async (_, i) => {
      const navegador = crearNavegador()
      await espera(latencia())
      if (navegador.reservar(clase, `Persona ${i + 1}`)) {
        ocupados++
        emitir({
          tipo: 'intento',
          lado: 'prototipo',
          persona: i + 1,
          resultado: 'reservada',
          ms: Math.round(performance.now() - t0),
        })
      }
    }),
  )
  emitir({ tipo: 'fin', lado: 'prototipo', ocupados, espera: 0, ms: Math.round(performance.now() - t0) })
}

/** Producción: las mismas 20 personas contra Postgres, cada una por su propia conexión. */
export async function simularProduccion(
  db: DB,
  sandbox: { claseId: string; usuarios: string[] },
  ahora: Date,
  emitir: (e: EventoSimulacion) => void,
) {
  const t0 = performance.now()
  let ocupados = 0
  let enEspera = 0
  await Promise.all(
    sandbox.usuarios.map(async (usuarioId, i) => {
      await espera(latencia())
      try {
        const r = await reservarClase(db, {
          usuarioId,
          claseId: sandbox.claseId,
          medio: 'credito',
          ahora,
          origen: 'simulacion',
        })
        ocupados++
        emitir({
          tipo: 'intento',
          lado: 'produccion',
          persona: i + 1,
          resultado: 'reservada',
          reformer: r.reformer,
          ms: Math.round(performance.now() - t0),
        })
      } catch (e) {
        if (!(e instanceof ErrorDominio) || e.codigo !== 'CLASE_LLENA') throw e
        const w = await anotarEnEspera(db, { usuarioId, claseId: sandbox.claseId, ahora })
        enEspera++
        emitir({
          tipo: 'intento',
          lado: 'produccion',
          persona: i + 1,
          resultado: 'espera',
          puesto: w.puesto,
          ms: Math.round(performance.now() - t0),
        })
      }
    }),
  )
  emitir({
    tipo: 'fin',
    lado: 'produccion',
    ocupados,
    espera: enEspera,
    ms: Math.round(performance.now() - t0),
  })
}

/** Lo que quedó escrito en la base, contado de nuevo: no lo que la simulación cree que pasó. */
export async function verificar(db: DB, claseId: string, ahora: Date): Promise<EventoSimulacion> {
  const [activas] = await db
    .select({
      n: sql<number>`count(*)::int`,
      repetidos: sql<number>`(count(*) - count(distinct ${reservas.reformer}))::int`,
    })
    .from(reservas)
    .where(and(eq(reservas.claseId, claseId), ocupaLugar(ahora)))
  const [esperando] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(listaEspera)
    .where(and(eq(listaEspera.claseId, claseId), eq(listaEspera.estado, 'esperando')))
  const [usados] = await db
    .select({ n: sql<number>`(-coalesce(sum(${movimientosCredito.delta}), 0))::int` })
    .from(movimientosCredito)
    .where(and(eq(movimientosCredito.motivo, 'reserva'), like(movimientosCredito.usuarioId, 'sim-%')))
  return {
    tipo: 'verificacion',
    activas: activas.n,
    enEspera: esperando.n,
    reformersRepetidos: activas.repetidos,
    creditosUsados: usados.n,
  }
}

export class SimulacionOcupada extends Error {}

/**
 * Corre la simulación completa con un advisory lock: si otra persona la está corriendo, falla
 * enseguida en lugar de mezclar resultados.
 */
export async function ejecutarSimulacion(emitir: (e: EventoSimulacion) => void, ahora = new Date()) {
  const { pool: pg, db } = poolSimulacion()
  const cliente = await pg.connect()
  try {
    const { rows } = await cliente.query<{ ok: boolean }>('select pg_try_advisory_lock($1) as ok', [
      CLAVE_BLOQUEO,
    ])
    if (!rows[0]?.ok) throw new SimulacionOcupada()
    try {
      const sandbox = await prepararSandbox(db, ahora)
      // Abrir las 20 conexiones antes de largar: el tiempo medido es el de las reservas, no el del login a Postgres.
      const abiertas = await Promise.all(Array.from({ length: PERSONAS }, () => pg.connect()))
      abiertas.forEach((c) => c.release())
      emitir({ tipo: 'inicio', personas: PERSONAS, cupo: CUPO })
      await Promise.all([simularPrototipo(emitir), simularProduccion(db, sandbox, ahora, emitir)])
      emitir(await verificar(db, sandbox.claseId, ahora))
    } finally {
      await cliente.query('select pg_advisory_unlock($1)', [CLAVE_BLOQUEO])
    }
  } finally {
    cliente.release()
  }
}
