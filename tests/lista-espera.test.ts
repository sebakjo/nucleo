import { and, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db'
import { listaEspera, reservas } from '@/db/schema'
import { anotarEnEspera } from '@/lib/dominio/lista-espera'
import { cancelarReserva, reservarClase } from '@/lib/dominio/reservas'
import { liberarReservasVencidas } from '@/lib/dominio/tareas'
import { acreditar, baseLimpia, crearAlumno, crearClase, creditosDe, DIA, emailsDe, en, MIN } from './ayudas'

async function claseLlena(ahora: Date, cupo = 2) {
  const claseId = await crearClase(en(ahora, 2 * DIA), { cupo })
  const ocupantes = []
  for (let i = 0; i < cupo; i++) {
    const a = await crearAlumno()
    await acreditar(a, 2, ahora)
    const r = await reservarClase(db, { usuarioId: a, claseId, medio: 'credito', ahora })
    ocupantes.push({ alumno: a, reservaId: r.reservaId })
  }
  return { claseId, ocupantes }
}

describe('lista de espera', () => {
  beforeEach(baseLimpia)

  it('solo se puede anotar si la clase está llena', async () => {
    const ahora = new Date()
    const claseId = await crearClase(en(ahora, 2 * DIA))
    const alumno = await crearAlumno()
    await expect(anotarEnEspera(db, { usuarioId: alumno, claseId, ahora })).rejects.toMatchObject({
      codigo: 'HAY_LUGAR',
    })
  })

  it('al liberarse un lugar, el primero con créditos queda reservado y recibe un email', async () => {
    const ahora = new Date()
    const { claseId, ocupantes } = await claseLlena(ahora)
    const primera = await crearAlumno()
    const segunda = await crearAlumno()
    await acreditar(primera, 3, ahora)
    await acreditar(segunda, 3, ahora)
    expect((await anotarEnEspera(db, { usuarioId: primera, claseId, ahora })).puesto).toBe(1)
    expect((await anotarEnEspera(db, { usuarioId: segunda, claseId, ahora })).puesto).toBe(2)

    const c = await cancelarReserva(db, {
      reservaId: ocupantes[0].reservaId,
      actor: { id: ocupantes[0].alumno, rol: 'alumno' },
      ahora: en(ahora, MIN),
    })
    expect(c.promovidos).toBe(1)
    const [reserva] = await db
      .select()
      .from(reservas)
      .where(and(eq(reservas.claseId, claseId), eq(reservas.usuarioId, primera)))
    expect(reserva).toMatchObject({
      estado: 'confirmada',
      origen: 'lista_espera',
      medio: 'credito',
      reformer: 1,
    })
    expect(await creditosDe(primera)).toBe(2)
    expect(await emailsDe('espera_promovida')).toHaveLength(1)
    const [entradaSegunda] = await db.select().from(listaEspera).where(eq(listaEspera.usuarioId, segunda))
    expect(entradaSegunda.estado).toBe('esperando')
  })

  it('si el primero no tiene créditos, el lugar le queda retenido 30 minutos para pagar', async () => {
    const ahora = new Date()
    const { claseId, ocupantes } = await claseLlena(ahora)
    const sinCreditos = await crearAlumno()
    const conCreditos = await crearAlumno()
    await acreditar(conCreditos, 2, ahora)
    await anotarEnEspera(db, { usuarioId: sinCreditos, claseId, ahora })
    await anotarEnEspera(db, { usuarioId: conCreditos, claseId, ahora })

    const t = en(ahora, MIN)
    await cancelarReserva(db, {
      reservaId: ocupantes[0].reservaId,
      actor: { id: ocupantes[0].alumno, rol: 'alumno' },
      ahora: t,
    })
    const [oferta] = await db.select().from(listaEspera).where(eq(listaEspera.usuarioId, sinCreditos))
    expect(oferta.estado).toBe('oferta')
    expect(oferta.ofertaVence!.getTime() - t.getTime()).toBe(30 * MIN)
    const [retenida] = await db.select().from(reservas).where(eq(reservas.id, oferta.reservaId!))
    expect(retenida).toMatchObject({ estado: 'pendiente_pago', origen: 'lista_espera' })
    expect(await emailsDe('espera_oferta')).toHaveLength(1)

    // Mientras dura la oferta, nadie más toma ese lugar.
    const colada = await crearAlumno()
    await acreditar(colada, 1, ahora)
    await expect(
      reservarClase(db, { usuarioId: colada, claseId, medio: 'credito', ahora: en(t, 20 * MIN) }),
    ).rejects.toMatchObject({ codigo: 'CLASE_LLENA' })

    // Si no paga en 30 minutos, el lugar pasa al siguiente (que tiene créditos).
    await liberarReservasVencidas(db, en(t, 31 * MIN))
    const [vencida] = await db.select().from(listaEspera).where(eq(listaEspera.usuarioId, sinCreditos))
    expect(vencida.estado).toBe('vencida')
    const [siguiente] = await db
      .select()
      .from(reservas)
      .where(and(eq(reservas.claseId, claseId), eq(reservas.usuarioId, conCreditos)))
    expect(siguiente.estado).toBe('confirmada')
  })

  it('una cancelación tardía también libera el lugar para la lista', async () => {
    const ahora = new Date()
    const { claseId, ocupantes } = await claseLlena(ahora)
    const espera = await crearAlumno()
    await acreditar(espera, 1, ahora)
    await anotarEnEspera(db, { usuarioId: espera, claseId, ahora })
    const inicio = en(ahora, 2 * DIA)
    await cancelarReserva(db, {
      reservaId: ocupantes[1].reservaId,
      actor: { id: ocupantes[1].alumno, rol: 'alumno' },
      ahora: en(inicio, -2 * 60 * MIN),
    })
    const [r] = await db.select().from(reservas).where(eq(reservas.usuarioId, espera))
    expect(r.estado).toBe('confirmada')
  })

  it('no se puede anotar dos veces', async () => {
    const ahora = new Date()
    const { claseId } = await claseLlena(ahora, 1)
    const a = await crearAlumno()
    await anotarEnEspera(db, { usuarioId: a, claseId, ahora })
    await expect(anotarEnEspera(db, { usuarioId: a, claseId, ahora })).rejects.toMatchObject({
      codigo: 'YA_EN_LISTA',
    })
  })
})
