import { eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db'
import { packs, reservas } from '@/db/schema'
import { contarOcupados } from '@/lib/dominio/cupos'
import { confirmarReservaPagada, reservarClase } from '@/lib/dominio/reservas'
import { liberarReservasVencidas } from '@/lib/dominio/tareas'
import { acreditar, baseLimpia, crearAlumno, crearClase, DIA, en, MIN } from './ayudas'

describe('retención de 10 minutos', () => {
  beforeEach(baseLimpia)

  it('una reserva pendiente ocupa el lugar mientras no vence, y lo libera sola después', async () => {
    const ahora = new Date()
    const claseId = await crearClase(en(ahora, 2 * DIA), { cupo: 1 })
    const primera = await crearAlumno()
    const segunda = await crearAlumno()
    await acreditar(segunda, 2, ahora)

    const r = await reservarClase(db, { usuarioId: primera, claseId, medio: 'pago', ahora })
    expect(r.retenidaHasta!.getTime() - ahora.getTime()).toBe(10 * MIN)
    expect(await contarOcupados(db, claseId, en(ahora, 9 * MIN))).toBe(1)
    await expect(
      reservarClase(db, { usuarioId: segunda, claseId, medio: 'credito', ahora: en(ahora, 9 * MIN) }),
    ).rejects.toMatchObject({ codigo: 'CLASE_LLENA' })

    // A los 10 minutos el lugar cuenta como libre, aunque el cron todavía no haya pasado.
    expect(await contarOcupados(db, claseId, en(ahora, 10 * MIN))).toBe(0)
    const otra = await reservarClase(db, {
      usuarioId: segunda,
      claseId,
      medio: 'credito',
      ahora: en(ahora, 11 * MIN),
    })
    expect(otra.estado).toBe('confirmada')
    const [vencida] = await db.select().from(reservas).where(eq(reservas.id, r.reservaId))
    expect(vencida.estado).toBe('vencida')
  })

  it('el cron marca vencidas las retenciones que pasaron los 10 minutos', async () => {
    const ahora = new Date()
    const claseId = await crearClase(en(ahora, 2 * DIA))
    const alumno = await crearAlumno()
    const r = await reservarClase(db, { usuarioId: alumno, claseId, medio: 'pago', ahora })
    expect((await liberarReservasVencidas(db, en(ahora, 5 * MIN))).liberadas).toBe(0)
    expect((await liberarReservasVencidas(db, en(ahora, 10 * MIN))).liberadas).toBe(1)
    const [fila] = await db.select().from(reservas).where(eq(reservas.id, r.reservaId))
    expect(fila.estado).toBe('vencida')
  })

  it('un pago aprobado dentro de los 10 minutos confirma la reserva', async () => {
    const ahora = new Date()
    const claseId = await crearClase(en(ahora, 2 * DIA))
    const alumno = await crearAlumno()
    const r = await reservarClase(db, { usuarioId: alumno, claseId, medio: 'pago', ahora })
    const res = await db.transaction((tx) =>
      confirmarReservaPagada(tx, { reservaId: r.reservaId, ahora: en(ahora, 4 * MIN) }),
    )
    expect(res).toBe('confirmada')
  })

  it('un pago que llega tarde confirma si todavía hay lugar', async () => {
    const ahora = new Date()
    const claseId = await crearClase(en(ahora, 2 * DIA))
    const alumno = await crearAlumno()
    const r = await reservarClase(db, { usuarioId: alumno, claseId, medio: 'pago', ahora })
    const res = await db.transaction((tx) =>
      confirmarReservaPagada(tx, { reservaId: r.reservaId, ahora: en(ahora, 30 * MIN) }),
    )
    expect(res).toBe('confirmada_tarde')
  })

  it('un pago que llega tarde a una clase que se llenó se convierte en un crédito', async () => {
    const ahora = new Date()
    const claseId = await crearClase(en(ahora, 2 * DIA), { cupo: 1 })
    const lenta = await crearAlumno()
    const rapida = await crearAlumno()
    await acreditar(rapida, 1, ahora)
    const r = await reservarClase(db, { usuarioId: lenta, claseId, medio: 'pago', ahora })
    await reservarClase(db, { usuarioId: rapida, claseId, medio: 'credito', ahora: en(ahora, 12 * MIN) })
    const res = await db.transaction((tx) =>
      confirmarReservaPagada(tx, { reservaId: r.reservaId, ahora: en(ahora, 15 * MIN) }),
    )
    expect(res).toBe('credito')
    const [credito] = await db.select().from(packs).where(eq(packs.usuarioId, lenta))
    expect(credito).toMatchObject({ nombre: 'Crédito por pago acreditado tarde', creditosRestantes: 1 })
  })
})
