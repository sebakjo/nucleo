import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db'
import { clases, emails, instructores, plantillas, reservas, tiposClase } from '@/db/schema'
import { reservarClase } from '@/lib/dominio/reservas'
import { enviarRecordatorios, generarClases } from '@/lib/dominio/tareas'
import { despacharEmails } from '@/lib/email/despachar'
import { diaIso, hora } from '@/lib/tiempo'
import { acreditar, baseLimpia, crearAlumno, crearClase, DIA, emailsDe, en, HORA } from './ayudas'

describe('recordatorios 24 horas antes', () => {
  beforeEach(baseLimpia)

  it('se encola uno solo por reserva, aunque el cron corra varias veces', async () => {
    const ahora = new Date()
    const inicio = en(ahora, 3 * DIA)
    const claseId = await crearClase(inicio)
    const alumno = await crearAlumno()
    await acreditar(alumno, 2, ahora)
    await reservarClase(db, { usuarioId: alumno, claseId, medio: 'credito', ahora })

    expect((await enviarRecordatorios(db, en(inicio, -30 * HORA))).enviados).toBe(0)
    expect((await enviarRecordatorios(db, en(inicio, -23 * HORA))).enviados).toBe(1)
    expect((await enviarRecordatorios(db, en(inicio, -22 * HORA))).enviados).toBe(0)
    expect(await emailsDe('recordatorio')).toHaveLength(1)
    const [r] = await db.select().from(reservas).where(eq(reservas.claseId, claseId))
    expect(r.recordatorioEnviadoEn).not.toBeNull()
  })

  it('no manda recordatorio a quien reservó dentro de las últimas 24 horas', async () => {
    const ahora = new Date()
    const inicio = en(ahora, 10 * HORA)
    const claseId = await crearClase(inicio)
    const alumno = await crearAlumno()
    await acreditar(alumno, 2, ahora)
    await reservarClase(db, { usuarioId: alumno, claseId, medio: 'credito', ahora })
    expect((await enviarRecordatorios(db, en(ahora, HORA))).enviados).toBe(0)
  })

  it('el despachador renderiza la plantilla y deja el email registrado (sin SMTP en tests)', async () => {
    const ahora = new Date()
    const claseId = await crearClase(en(ahora, 2 * DIA))
    const alumno = await crearAlumno('Sofía Benítez')
    await acreditar(alumno, 2, ahora)
    await reservarClase(db, { usuarioId: alumno, claseId, medio: 'credito', ahora })
    const r = await despacharEmails(db)
    expect(r).toEqual({ enviados: 1, fallidos: 0 })
    const [e] = await db.select().from(emails)
    expect(e.estado).toBe('registrado')
    expect(e.asunto).toMatch(/^Reservaste el \w+ \d\d:\d\d con Lucía$/)
  })
})

describe('plantillas semanales', () => {
  beforeEach(baseLimpia)

  it('una plantilla genera una clase por semana, en la hora de Buenos Aires, sin duplicar', async () => {
    const ahora = new Date('2026-10-27T12:00:00Z')
    const [tipo] = await db.select().from(tiposClase)
    const [inst] = await db.select().from(instructores)
    const [p] = await db
      .insert(plantillas)
      .values({ diaSemana: 4, hora: '18:00', instructorId: inst.id, tipoClaseId: tipo.id })
      .returning()
    expect((await generarClases(db, ahora, { semanas: 3 })).creadas).toBe(3)
    expect((await generarClases(db, ahora, { semanas: 3 })).creadas).toBe(0)
    const generadas = await db.select().from(clases).where(eq(clases.plantillaId, p.id))
    for (const c of generadas) {
      expect(diaIso(c.iniciaEn)).toBe(4)
      expect(hora(c.iniciaEn)).toBe('18:00')
      expect(c.iniciaEn.getUTCHours()).toBe(21)
    }
  })
})
