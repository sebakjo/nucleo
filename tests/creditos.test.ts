import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db'
import { movimientosCredito, packs, reservas } from '@/db/schema'
import { ajustarCreditos, vencerPacks } from '@/lib/dominio/creditos'
import { ErrorDominio } from '@/lib/dominio/errores'
import { cancelarReserva, confirmarReservaPagada, reservarClase } from '@/lib/dominio/reservas'
import { acreditar, baseLimpia, crearAlumno, crearClase, creditosDe, DIA, emailsDe, en, HORA } from './ayudas'

describe('créditos y cancelación', () => {
  beforeEach(baseLimpia)

  it('reservar con crédito descuenta uno en la misma transacción', async () => {
    const ahora = new Date()
    const alumno = await crearAlumno()
    const pack = await acreditar(alumno, 4, ahora)
    const claseId = await crearClase(en(ahora, 2 * DIA))
    const r = await reservarClase(db, { usuarioId: alumno, claseId, medio: 'credito', ahora })
    expect(r).toMatchObject({ estado: 'confirmada', reformer: 1, creditosRestantes: 3 })
    const movs = await db.select().from(movimientosCredito).where(eq(movimientosCredito.packId, pack))
    expect(movs.map((m) => [m.motivo, m.delta])).toEqual([
      ['compra', 4],
      ['reserva', -1],
    ])
    expect(await emailsDe('reserva_confirmada')).toHaveLength(1)
  })

  it('sin créditos vigentes no se puede reservar con crédito', async () => {
    const ahora = new Date()
    const alumno = await crearAlumno()
    const claseId = await crearClase(en(ahora, 2 * DIA))
    await expect(
      reservarClase(db, { usuarioId: alumno, claseId, medio: 'credito', ahora }),
    ).rejects.toMatchObject({
      codigo: 'SIN_CREDITOS',
    })
  })

  it('un pack que vence antes de la clase no sirve para esa clase', async () => {
    const ahora = new Date()
    const alumno = await crearAlumno()
    await acreditar(alumno, 4, ahora, en(ahora, 1 * DIA))
    const claseId = await crearClase(en(ahora, 2 * DIA))
    await expect(
      reservarClase(db, { usuarioId: alumno, claseId, medio: 'credito', ahora }),
    ).rejects.toBeInstanceOf(ErrorDominio)
  })

  it('cancelar con más de 12 horas devuelve el crédito al mismo pack', async () => {
    const ahora = new Date()
    const alumno = await crearAlumno()
    const pack = await acreditar(alumno, 4, ahora)
    const claseId = await crearClase(en(ahora, 2 * DIA))
    const r = await reservarClase(db, { usuarioId: alumno, claseId, medio: 'credito', ahora })
    const c = await cancelarReserva(db, {
      reservaId: r.reservaId,
      actor: { id: alumno, rol: 'alumno' },
      ahora: en(ahora, HORA),
    })
    expect(c).toMatchObject({ tipo: 'sin_costo', creditoDevuelto: true, creditosRestantes: 4 })
    const [p] = await db.select().from(packs).where(eq(packs.id, pack))
    expect(p.creditosRestantes).toBe(4)
    const [fila] = await db.select().from(reservas).where(eq(reservas.id, r.reservaId))
    expect(fila.estado).toBe('cancelada')
  })

  it('cancelar con menos de 12 horas libera el lugar pero el crédito se pierde', async () => {
    const ahora = new Date()
    const alumno = await crearAlumno()
    await acreditar(alumno, 4, ahora)
    const inicio = en(ahora, 2 * DIA)
    const claseId = await crearClase(inicio)
    const r = await reservarClase(db, { usuarioId: alumno, claseId, medio: 'credito', ahora })
    const tarde = en(inicio, -11 * HORA)
    const c = await cancelarReserva(db, {
      reservaId: r.reservaId,
      actor: { id: alumno, rol: 'alumno' },
      ahora: tarde,
    })
    expect(c).toMatchObject({ tipo: 'tarde', creditoDevuelto: false, creditosRestantes: 3 })
    const [fila] = await db.select().from(reservas).where(eq(reservas.id, r.reservaId))
    expect(fila.estado).toBe('cancelada_tarde')
  })

  it('cancelar a tiempo una clase pagada suelta genera un crédito de 30 días', async () => {
    const ahora = new Date()
    const alumno = await crearAlumno()
    const claseId = await crearClase(en(ahora, 3 * DIA))
    const r = await reservarClase(db, { usuarioId: alumno, claseId, medio: 'pago', ahora })
    await db.transaction((tx) =>
      confirmarReservaPagada(tx, { reservaId: r.reservaId, ahora: en(ahora, 60_000) }),
    )
    await cancelarReserva(db, {
      reservaId: r.reservaId,
      actor: { id: alumno, rol: 'alumno' },
      ahora: en(ahora, HORA),
    })
    const generados = await db.select().from(packs).where(eq(packs.usuarioId, alumno))
    expect(generados).toHaveLength(1)
    expect(generados[0]).toMatchObject({
      nombre: 'Crédito por cancelación',
      creditosRestantes: 1,
      creditosTotales: 1,
    })
    const dias = (generados[0].venceEn!.getTime() - en(ahora, HORA).getTime()) / DIA
    expect(dias).toBeCloseTo(30)
  })

  it('nadie cancela la reserva de otra persona', async () => {
    const ahora = new Date()
    const duena = await crearAlumno()
    const otra = await crearAlumno()
    await acreditar(duena, 4, ahora)
    const claseId = await crearClase(en(ahora, 2 * DIA))
    const r = await reservarClase(db, { usuarioId: duena, claseId, medio: 'credito', ahora })
    await expect(
      cancelarReserva(db, { reservaId: r.reservaId, actor: { id: otra, rol: 'alumno' }, ahora }),
    ).rejects.toMatchObject({ codigo: 'NO_AUTORIZADO' })
  })
})

describe('vencimiento de packs', () => {
  beforeEach(baseLimpia)

  it('los créditos sin usar se pierden con un movimiento auditable', async () => {
    const ahora = new Date()
    const alumno = await crearAlumno()
    const pack = await acreditar(alumno, 8, en(ahora, -31 * DIA), en(ahora, -1 * DIA))
    const vencidos = await db.transaction((tx) => vencerPacks(tx, ahora))
    expect(vencidos).toBe(1)
    const [p] = await db.select().from(packs).where(eq(packs.id, pack))
    expect(p).toMatchObject({ estado: 'vencido', creditosRestantes: 0 })
    const [mov] = await db
      .select()
      .from(movimientosCredito)
      .where(and(eq(movimientosCredito.packId, pack), eq(movimientosCredito.motivo, 'vencimiento')))
    expect(mov.delta).toBe(-8)
    // Idempotente: correrlo de nuevo no hace nada.
    expect(await db.transaction((tx) => vencerPacks(tx, ahora))).toBe(0)
  })

  it('si el pack venció, cancelar a tiempo genera un crédito nuevo en vez de devolverlo al pack vencido', async () => {
    const ahora = new Date()
    const alumno = await crearAlumno()
    const inicio = en(ahora, 5 * DIA)
    await acreditar(alumno, 4, en(ahora, -20 * DIA), en(inicio, HORA))
    const claseId = await crearClase(inicio)
    const r = await reservarClase(db, { usuarioId: alumno, claseId, medio: 'credito', ahora })
    // Entre la reserva y la cancelación el pack venció (lo marca el cron de vencimientos).
    await db.update(packs).set({ estado: 'vencido', creditosRestantes: 0 }).where(eq(packs.usuarioId, alumno))
    await cancelarReserva(db, {
      reservaId: r.reservaId,
      actor: { id: alumno, rol: 'alumno' },
      ahora: en(ahora, HORA),
    })
    expect(await creditosDe(alumno)).toBe(1)
  })

  it('el ajuste manual suma en un pack nuevo y resta desde el que vence primero', async () => {
    const ahora = new Date()
    const alumno = await crearAlumno()
    const admin = await crearAlumno('Admin')
    const viejo = await acreditar(alumno, 2, en(ahora, -20 * DIA))
    const nuevo = await acreditar(alumno, 4, ahora)
    await ajustarCreditos(db, { usuarioId: alumno, delta: 2, nota: 'Regalo', actorId: admin, ahora })
    expect(await creditosDe(alumno)).toBe(8)
    await ajustarCreditos(db, { usuarioId: alumno, delta: -3, nota: 'Error de carga', actorId: admin, ahora })
    expect(await creditosDe(alumno)).toBe(5)
    const [p1] = await db.select().from(packs).where(eq(packs.id, viejo))
    const [p2] = await db.select().from(packs).where(eq(packs.id, nuevo))
    expect([p1.creditosRestantes, p2.creditosRestantes]).toEqual([0, 3])
    const ajustes = await db
      .select()
      .from(movimientosCredito)
      .where(and(eq(movimientosCredito.usuarioId, alumno), eq(movimientosCredito.motivo, 'ajuste')))
    expect(ajustes.map((m) => m.delta).sort()).toEqual([-1, -2, 2].sort())
    expect(ajustes.every((m) => m.actorId === admin)).toBe(true)
    await expect(
      ajustarCreditos(db, { usuarioId: alumno, delta: -9, nota: 'x', actorId: admin, ahora }),
    ).rejects.toMatchObject({ codigo: 'SIN_CREDITOS' })
    expect(await creditosDe(alumno)).toBe(5)
  })
})
