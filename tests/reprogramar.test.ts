import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db'
import { clases, instructores, plantillas, tiposClase } from '@/db/schema'
import { anotarEnEspera } from '@/lib/dominio/lista-espera'
import { reprogramarClase, reservarClase } from '@/lib/dominio/reservas'
import { generarClases } from '@/lib/dominio/tareas'
import { contenidoDe } from '@/lib/email/contenido'
import type { DatosPorPlantilla } from '@/lib/email/tipos'
import { acreditar, baseLimpia, crearAlumno, crearClase, DIA, emailsDe, en, HORA, reservasDe } from './ayudas'

describe('mover una clase de horario', () => {
  beforeEach(baseLimpia)

  it('conserva reservas y reformers, y avisa a quien reservó y a la lista de espera', async () => {
    const ahora = new Date()
    const claseId = await crearClase(en(ahora, 2 * DIA), { cupo: 1 })
    const ana = await crearAlumno('Ana Paz')
    const beto = await crearAlumno('Beto Gil')
    await acreditar(ana, 2, ahora)
    const r = await reservarClase(db, { usuarioId: ana, claseId, medio: 'credito', ahora })
    await anotarEnEspera(db, { usuarioId: beto, claseId, ahora })

    const nuevo = en(ahora, 3 * DIA)
    const hecha = await reprogramarClase(db, { claseId, iniciaEn: nuevo, ahora })
    expect(hecha.avisados).toBe(2)

    const [c] = await db.select().from(clases).where(eq(clases.id, claseId))
    expect(c.iniciaEn).toEqual(nuevo)
    expect(c.terminaEn.getTime() - c.iniciaEn.getTime()).toBe(55 * 60 * 1000)
    const [reserva] = await reservasDe(claseId)
    expect(reserva).toMatchObject({ id: r.reservaId, estado: 'confirmada', reformer: r.reformer })

    const avisos = await emailsDe('clase_reprogramada')
    expect(avisos).toHaveLength(2)
    const datos = avisos.map((e) => e.datos as DatosPorPlantilla['clase_reprogramada'])
    expect(datos.map((d) => d.reformer).sort()).toEqual([r.reformer, null])
    const contenido = contenidoDe(
      'clase_reprogramada',
      datos.find((d) => d.reformer !== null)!,
    )
    expect(contenido.asunto).toMatch(/^Tu clase del \S+ \d\d:\d\d pasa al \S+ \d\d:\d\d$/)
    expect(contenido.parrafos.join(' ')).toMatch(/cancelá sin costo hasta el/)
  })

  it('no se puede pisar con otra clase: el estudio tiene una sola sala', async () => {
    const ahora = new Date()
    const claseId = await crearClase(en(ahora, 2 * DIA))
    const otra = en(ahora, 3 * DIA)
    await crearClase(otra)
    await expect(
      reprogramarClase(db, { claseId, iniciaEn: en(otra, 30 * 60 * 1000), ahora }),
    ).rejects.toThrow(/una sola sala/)
    // Justo cuando termina la otra (55 minutos) sí se puede.
    await expect(
      reprogramarClase(db, { claseId, iniciaEn: en(otra, 55 * 60 * 1000), ahora }),
    ).resolves.toMatchObject({ avisados: 0 })
  })

  it('solo con más de 12 horas de anticipación, antes y después del cambio', async () => {
    const ahora = new Date()
    const pronto = await crearClase(en(ahora, 10 * HORA))
    await expect(
      reprogramarClase(db, { claseId: pronto, iniciaEn: en(ahora, 3 * DIA), ahora }),
    ).rejects.toThrow(/ya no se puede mover/)
    const lejos = await crearClase(en(ahora, 3 * DIA))
    await expect(
      reprogramarClase(db, { claseId: lejos, iniciaEn: en(ahora, 6 * HORA), ahora }),
    ).rejects.toThrow(/más de 12 horas/)
  })

  it('una clase de plantilla movida no se vuelve a generar en su horario original', async () => {
    const ahora = new Date('2026-10-27T12:00:00Z')
    const [tipo] = await db.select().from(tiposClase)
    const [inst] = await db.select().from(instructores)
    const [p] = await db
      .insert(plantillas)
      .values({ diaSemana: 4, hora: '18:00', instructorId: inst.id, tipoClaseId: tipo.id })
      .returning()
    await generarClases(db, ahora, { semanas: 1 })
    const [c] = await db.select().from(clases).where(eq(clases.plantillaId, p.id))
    await reprogramarClase(db, { claseId: c.id, iniciaEn: en(c.iniciaEn, DIA), ahora })
    expect((await generarClases(db, ahora, { semanas: 1 })).creadas).toBe(0)
    expect(await db.$count(clases, eq(clases.plantillaId, p.id))).toBe(1)
  })
})
