import { mkdirSync, writeFileSync } from 'node:fs'
import { and, eq, inArray } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db'
import { movimientosCredito, reservas } from '@/db/schema'
import { ErrorDominio } from '@/lib/dominio/errores'
import { reservarClase } from '@/lib/dominio/reservas'
import { acreditar, baseLimpia, crearAlumno, crearClase, creditosDe, DIA, en } from './ayudas'

/**
 * El test que importa: 20 personas reservan el mismo reformer al mismo tiempo contra Postgres
 * real. Cada reserva corre en su propia conexión y su propia transacción.
 */
describe('concurrencia: 20 reservas simultáneas para 6 lugares', () => {
  beforeEach(baseLimpia)

  it('deja exactamente 6 confirmadas y 14 rechazadas por cupo', async () => {
    const ahora = new Date()
    const claseId = await crearClase(en(ahora, 2 * DIA))
    const alumnos = await Promise.all(Array.from({ length: 20 }, () => crearAlumno()))
    await Promise.all(alumnos.map((a) => acreditar(a, 4, ahora)))

    const t0 = performance.now()
    const resultados = await Promise.allSettled(
      alumnos.map((usuarioId) => reservarClase(db, { usuarioId, claseId, medio: 'credito', ahora })),
    )
    const duracionMs = Math.round(performance.now() - t0)

    const ok = resultados.filter((r) => r.status === 'fulfilled')
    const fallidas = resultados.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    expect(ok).toHaveLength(6)
    expect(fallidas).toHaveLength(14)
    for (const f of fallidas) {
      expect(f.reason).toBeInstanceOf(ErrorDominio)
      expect((f.reason as ErrorDominio).codigo).toBe('CLASE_LLENA')
    }

    // En la base: 6 confirmadas, una por reformer, y 6 créditos descontados (ni uno más).
    const filas = await db.select().from(reservas).where(eq(reservas.claseId, claseId))
    expect(filas.filter((f) => f.estado === 'confirmada')).toHaveLength(6)
    expect(filas.map((f) => f.reformer).sort()).toEqual([1, 2, 3, 4, 5, 6])
    const descuentos = await db
      .select()
      .from(movimientosCredito)
      .where(and(eq(movimientosCredito.motivo, 'reserva'), inArray(movimientosCredito.usuarioId, alumnos)))
    expect(descuentos).toHaveLength(6)
    const saldos = await Promise.all(alumnos.map(creditosDe))
    expect(saldos.reduce((a, b) => a + b, 0)).toBe(20 * 4 - 6)

    mkdirSync('docs/metricas', { recursive: true })
    writeFileSync(
      'docs/metricas/concurrencia.json',
      JSON.stringify(
        {
          fecha: new Date().toISOString(),
          intentos: 20,
          cupo: 6,
          confirmadas: ok.length,
          rechazadasPorCupo: fallidas.length,
          reformers: filas.map((f) => f.reformer).sort(),
          duracionMs,
        },
        null,
        2,
      ) + '\n',
    )
  })

  it('las reservas pendientes de pago también ocupan lugar: 6 retenidas, 14 rechazadas', async () => {
    const ahora = new Date()
    const claseId = await crearClase(en(ahora, 2 * DIA))
    const alumnos = await Promise.all(Array.from({ length: 20 }, () => crearAlumno()))
    const resultados = await Promise.allSettled(
      alumnos.map((usuarioId) => reservarClase(db, { usuarioId, claseId, medio: 'pago', ahora })),
    )
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(6)
    const filas = await db.select().from(reservas).where(eq(reservas.claseId, claseId))
    expect(filas.every((f) => f.estado === 'pendiente_pago' && f.precioArs === 22000)).toBe(true)
    expect(filas).toHaveLength(6)
  })

  it('la misma persona tocando "Reservar" 20 veces obtiene una sola reserva y gasta un crédito', async () => {
    const ahora = new Date()
    const claseId = await crearClase(en(ahora, 2 * DIA))
    const alumno = await crearAlumno()
    await acreditar(alumno, 4, ahora)
    const resultados = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        reservarClase(db, { usuarioId: alumno, claseId, medio: 'credito', ahora }),
      ),
    )
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rechazos = resultados.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    expect(rechazos.every((r) => (r.reason as ErrorDominio).codigo === 'YA_RESERVADA')).toBe(true)
    expect(await creditosDe(alumno)).toBe(3)
  })
})
