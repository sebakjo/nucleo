import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db'
import { clases } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { crearNavegador } from '@/lib/caso/prototipo'
import {
  ejecutarSimulacion,
  poolSimulacion,
  SimulacionOcupada,
  type EventoSimulacion,
} from '@/lib/caso/simulacion'
import { baseLimpia } from './ayudas'

async function correr() {
  const eventos: EventoSimulacion[] = []
  await ejecutarSimulacion((e) => eventos.push(e))
  const fin = (lado: 'prototipo' | 'produccion') =>
    eventos.find((e) => e.tipo === 'fin' && e.lado === lado) as Extract<EventoSimulacion, { tipo: 'fin' }>
  const intentos = (lado: string) =>
    eventos.filter(
      (e): e is Extract<EventoSimulacion, { tipo: 'intento' }> => e.tipo === 'intento' && e.lado === lado,
    )
  return { eventos, fin, intentos, verificacion: eventos.find((e) => e.tipo === 'verificacion') }
}

describe('simulación de /caso', () => {
  beforeEach(baseLimpia)
  afterAll(() => poolSimulacion().pool.end())

  it('el prototipo, con un localStorage por navegador, acepta a todos', () => {
    const clase = { id: 'x', cupo: 6, ocupados: 0 }
    const aceptadas = Array.from({ length: 20 }, (_, i) => crearNavegador().reservar(clase, `P${i}`)).filter(
      Boolean,
    )
    expect(aceptadas).toHaveLength(20)
    const mismo = crearNavegador()
    expect(Array.from({ length: 8 }, () => mismo.reservar(clase, 'yo')).filter(Boolean)).toHaveLength(6)
  })

  it('20 a la vez: prototipo 20 de 6, producción 6 de 6 y 14 en espera', async () => {
    const { fin, intentos, verificacion } = await correr()
    expect(fin('prototipo')).toMatchObject({ ocupados: 20, espera: 0 })
    expect(fin('produccion')).toMatchObject({ ocupados: 6, espera: 14 })
    const reformers = intentos('produccion').flatMap((e) => (e.reformer ? [e.reformer] : []))
    expect(reformers.sort()).toEqual([1, 2, 3, 4, 5, 6])
    const puestos = intentos('produccion').flatMap((e) => (e.puesto ? [e.puesto] : []))
    expect(puestos.sort((a, b) => a - b)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1))
    expect(verificacion).toEqual({
      tipo: 'verificacion',
      activas: 6,
      enEspera: 14,
      reformersRepetidos: 0,
      creditosUsados: 6,
    })
  })

  it('cada corrida empieza de cero sobre una clase aislada', async () => {
    await correr()
    const segunda = await correr()
    expect(segunda.verificacion).toMatchObject({ activas: 6, enEspera: 14, creditosUsados: 6 })
    expect(await db.$count(clases, eq(clases.sandbox, true))).toBe(1)
  })

  it('dos simulaciones a la vez: la segunda espera su turno', async () => {
    const resultados = await Promise.allSettled([correr(), correr()])
    const ocupadas = resultados.filter((r) => r.status === 'rejected')
    expect(ocupadas).toHaveLength(1)
    expect((ocupadas[0] as PromiseRejectedResult).reason).toBeInstanceOf(SimulacionOcupada)
  })
})
