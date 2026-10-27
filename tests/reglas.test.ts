import { describe, expect, it } from 'vitest'
import {
  creditoCubreClase,
  estadoDeCupo,
  evaluarCancelacion,
  HORAS_CANCELACION_SIN_COSTO,
  limiteCancelacionSinCosto,
  vencimientoOferta,
  vencimientoRetencion,
} from '@/lib/dominio/reglas'

const HORA = 60 * 60 * 1000
const inicio = new Date('2026-10-30T21:00:00Z') // viernes 30, 18:00 en Buenos Aires

describe('regla de cancelación (12 horas)', () => {
  it('es de 12 horas', () => {
    expect(HORAS_CANCELACION_SIN_COSTO).toBe(12)
    expect(limiteCancelacionSinCosto(inicio).toISOString()).toBe('2026-10-30T09:00:00.000Z')
  })

  it('sin costo con más de 12 horas de anticipación', () => {
    const r = evaluarCancelacion(inicio, new Date(inicio.getTime() - 13 * HORA))
    expect(r).toMatchObject({ permitida: true, sinCosto: true })
  })

  it('sin costo justo a las 12 horas (el límite es inclusivo)', () => {
    const r = evaluarCancelacion(inicio, new Date(inicio.getTime() - 12 * HORA))
    expect(r).toMatchObject({ permitida: true, sinCosto: true })
  })

  it('con costo un minuto después del límite', () => {
    const r = evaluarCancelacion(inicio, new Date(inicio.getTime() - 12 * HORA + 60_000))
    expect(r).toMatchObject({ permitida: true, sinCosto: false })
  })

  it('no se puede cancelar una clase que ya empezó', () => {
    expect(evaluarCancelacion(inicio, inicio)).toEqual({ permitida: false, motivo: 'clase_iniciada' })
  })
})

describe('retenciones y ofertas', () => {
  it('la reserva pendiente retiene el lugar 10 minutos', () => {
    const ahora = new Date('2026-10-28T15:00:00Z')
    expect(vencimientoRetencion(ahora).toISOString()).toBe('2026-10-28T15:10:00.000Z')
  })

  it('la oferta de la lista de espera dura 30 minutos, pero no más allá del inicio', () => {
    const ahora = new Date(inicio.getTime() - 3 * HORA)
    expect(vencimientoOferta(ahora, inicio).getTime() - ahora.getTime()).toBe(30 * 60_000)
    const casi = new Date(inicio.getTime() - 10 * 60_000)
    expect(vencimientoOferta(casi, inicio)).toEqual(inicio)
  })
})

describe('créditos y cupos', () => {
  it('un crédito sirve si el pack sigue vigente cuando empieza la clase', () => {
    expect(creditoCubreClase(new Date(inicio.getTime() + 1), inicio)).toBe(true)
    expect(creditoCubreClase(inicio, inicio)).toBe(false)
  })

  it('el estado del cupo da el color de la clase', () => {
    expect(estadoDeCupo(0, 6)).toBe('libre')
    expect(estadoDeCupo(3, 6)).toBe('libre')
    expect(estadoDeCupo(4, 6)).toBe('ultimos')
    expect(estadoDeCupo(5, 6)).toBe('ultimos')
    expect(estadoDeCupo(6, 6)).toBe('completa')
  })
})
