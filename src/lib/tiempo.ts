import { TZDate, tz } from '@date-fns/tz'
import { addDays, addMinutes, startOfWeek } from 'date-fns'

/**
 * Todo se guarda en UTC y se muestra en la hora de Buenos Aires, sin importar la zona del navegador
 * ni la del servidor. Cualquier fecha que se le muestra a alguien pasa por estas funciones.
 */
export const ZONA = 'America/Argentina/Buenos_Aires'
const enZona = tz(ZONA)

/** Lunes 00:00 (hora de Buenos Aires) de la semana que contiene `fecha`. */
export function inicioDeSemana(fecha: Date): Date {
  return new Date(startOfWeek(fecha, { weekStartsOn: 1, in: enZona }).getTime())
}

export function sumarSemanas(fecha: Date, semanas: number): Date {
  return new Date(addDays(new TZDate(fecha.getTime(), ZONA), semanas * 7).getTime())
}

export function sumarMinutos(fecha: Date, minutos: number): Date {
  return addMinutes(fecha, minutos)
}

/** Instante de una plantilla (día ISO 1 = lunes, "HH:MM" en Buenos Aires) dentro de una semana. */
export function instanteDePlantilla(lunes: Date, diaSemana: number, hora: string): Date {
  const dia = addDays(new TZDate(lunes.getTime(), ZONA), diaSemana - 1)
  const [h, m] = hora.split(':').map(Number)
  return new Date(new TZDate(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, m, ZONA).getTime())
}

/** Día ISO (1 = lunes … 7 = domingo) en Buenos Aires. */
export function diaIso(fecha: Date): number {
  const d = new TZDate(fecha.getTime(), ZONA).getDay()
  return d === 0 ? 7 : d
}

const formatos = new Map<string, Intl.DateTimeFormat>()
function formato(opciones: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const clave = JSON.stringify(opciones)
  let f = formatos.get(clave)
  if (!f) {
    f = new Intl.DateTimeFormat('es-AR', { timeZone: ZONA, ...opciones })
    formatos.set(clave, f)
  }
  return f
}

/** "18:00" */
export function hora(fecha: Date): string {
  return formato({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(fecha)
}

/** "jueves" */
export function diaSemana(fecha: Date): string {
  return formato({ weekday: 'long' }).format(fecha)
}

/** "jue" */
export function diaSemanaCorto(fecha: Date): string {
  return formato({ weekday: 'short' }).format(fecha).replace('.', '')
}

/** "30" */
export function diaDelMes(fecha: Date): string {
  return formato({ day: 'numeric' }).format(fecha)
}

/** "octubre" */
export function mes(fecha: Date): string {
  return formato({ month: 'long' }).format(fecha)
}

/** "oct" */
export function mesCorto(fecha: Date): string {
  return formato({ month: 'short' }).format(fecha).replace('.', '')
}

/** "jueves 30 de octubre" */
export function fechaLarga(fecha: Date): string {
  return `${diaSemana(fecha)} ${diaDelMes(fecha)} de ${mes(fecha)}`
}

/** "jue 30" */
export function fechaCorta(fecha: Date): string {
  return `${diaSemanaCorto(fecha)} ${diaDelMes(fecha)}`
}

/** "30 de octubre" */
export function diaYMes(fecha: Date): string {
  return `${diaDelMes(fecha)} de ${mes(fecha)}`
}

/** "27 oct – 1 nov" */
export function rangoSemana(lunes: Date, dias = 6): string {
  const fin = new Date(addDays(new TZDate(lunes.getTime(), ZONA), dias - 1).getTime())
  return `${diaDelMes(lunes)} ${mesCorto(lunes)} – ${diaDelMes(fin)} ${mesCorto(fin)}`
}

/** "2026-10-30" en Buenos Aires: sirve para agrupar por día y para URLs. */
export function claveDia(fecha: Date): string {
  const p = formato({ year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(fecha)
  const v = (t: string) => p.find((x) => x.type === t)?.value
  return `${v('year')}-${v('month')}-${v('day')}`
}

/** Lunes de la semana indicada por "2026-10-26" (cualquier día de esa semana); null si no es válida. */
export function semanaDesdeClave(clave: string | undefined | null): Date | null {
  if (!clave || !/^\d{4}-\d{2}-\d{2}$/.test(clave)) return null
  const [a, m, d] = clave.split('-').map(Number)
  const fecha = new TZDate(a, m - 1, d, 12, 0, ZONA)
  if (Number.isNaN(fecha.getTime())) return null
  return inicioDeSemana(new Date(fecha.getTime()))
}
