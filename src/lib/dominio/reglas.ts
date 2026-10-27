/**
 * Reglas del estudio. Es el único lugar donde viven estos números: la UI, las acciones del
 * servidor, las tareas programadas y los tests los leen de acá.
 */

/** Se puede cancelar sin costo hasta 12 horas antes del inicio de la clase. */
export const HORAS_CANCELACION_SIN_COSTO = 12

/** Una reserva pendiente de pago retiene el lugar 10 minutos. */
export const MINUTOS_RETENCION_PAGO = 10

/** Si el primero de la lista de espera no tiene créditos, tiene 30 minutos para pagar. */
export const MINUTOS_OFERTA_LISTA_ESPERA = 30

/** Validez de un crédito generado por cancelación o por un pago acreditado tarde. */
export const DIAS_VALIDEZ_CREDITO_DEVUELTO = 30

/** Cupos libres a partir de los cuales una clase se muestra como "últimos lugares". */
export const UMBRAL_ULTIMOS_LUGARES = 2

const HORA_MS = 60 * 60 * 1000
const MINUTO_MS = 60 * 1000

export function limiteCancelacionSinCosto(inicioClase: Date): Date {
  return new Date(inicioClase.getTime() - HORAS_CANCELACION_SIN_COSTO * HORA_MS)
}

export type EvaluacionCancelacion =
  { permitida: false; motivo: 'clase_iniciada' } | { permitida: true; sinCosto: boolean; limite: Date }

/**
 * Hasta 12 horas antes (inclusive) la cancelación devuelve el crédito, o lo genera si la clase se
 * pagó suelta. Después se puede cancelar igual para liberar el lugar, pero el crédito se pierde.
 * Una clase que ya empezó no se puede cancelar.
 */
export function evaluarCancelacion(inicioClase: Date, ahora: Date): EvaluacionCancelacion {
  if (ahora.getTime() >= inicioClase.getTime()) return { permitida: false, motivo: 'clase_iniciada' }
  const limite = limiteCancelacionSinCosto(inicioClase)
  return { permitida: true, sinCosto: ahora.getTime() <= limite.getTime(), limite }
}

export function vencimientoRetencion(ahora: Date): Date {
  return new Date(ahora.getTime() + MINUTOS_RETENCION_PAGO * MINUTO_MS)
}

/** La oferta de la lista de espera dura 30 minutos, pero nunca más allá del inicio de la clase. */
export function vencimientoOferta(ahora: Date, inicioClase: Date): Date {
  return new Date(Math.min(ahora.getTime() + MINUTOS_OFERTA_LISTA_ESPERA * MINUTO_MS, inicioClase.getTime()))
}

export function vencimientoCreditoDevuelto(ahora: Date): Date {
  return new Date(ahora.getTime() + DIAS_VALIDEZ_CREDITO_DEVUELTO * 24 * HORA_MS)
}

export function vencimientoPack(compra: Date, validezDias: number): Date {
  return new Date(compra.getTime() + validezDias * 24 * HORA_MS)
}

/** Un crédito sirve para una clase si el pack sigue vigente cuando la clase empieza. */
export function creditoCubreClase(venceEn: Date, inicioClase: Date): boolean {
  return venceEn.getTime() > inicioClase.getTime()
}

export type EstadoCupo = 'libre' | 'ultimos' | 'completa'

export function estadoDeCupo(ocupados: number, cupo: number): EstadoCupo {
  const libres = cupo - ocupados
  if (libres <= 0) return 'completa'
  if (libres <= UMBRAL_ULTIMOS_LUGARES) return 'ultimos'
  return 'libre'
}
