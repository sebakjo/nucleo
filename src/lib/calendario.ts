/**
 * Archivo .ics (RFC 5545) para agregar una clase al calendario. Las horas van en UTC con `Z`: cada
 * calendario las muestra en la zona de quien lo abre, así que no hace falta un VTIMEZONE.
 */
export type EventoCalendario = {
  uid: string
  inicio: Date
  fin: Date
  titulo: string
  descripcion: string
  lugar: string
  url: string
  creado: Date
}

const utc = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')

/** Escapa barras, comas, punto y coma y saltos de línea en los textos. */
export function escaparTexto(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** Corta las líneas de más de 75 bytes (UTF-8) sin partir un carácter, como pide la norma. */
export function plegar(linea: string): string {
  const partes: string[] = []
  let actual = ''
  let bytes = 0
  for (const c of linea) {
    const n = Buffer.byteLength(c)
    const max = partes.length === 0 ? 75 : 74 // las continuaciones empiezan con un espacio
    if (bytes + n > max) {
      partes.push(actual)
      actual = ''
      bytes = 0
    }
    actual += c
    bytes += n
  }
  partes.push(actual)
  return partes.join('\r\n ')
}

export function archivoIcs(e: EventoCalendario): string {
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Nucleo//Reservas//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTAMP:${utc(e.creado)}`,
    `DTSTART:${utc(e.inicio)}`,
    `DTEND:${utc(e.fin)}`,
    `SUMMARY:${escaparTexto(e.titulo)}`,
    `DESCRIPTION:${escaparTexto(e.descripcion)}`,
    `LOCATION:${escaparTexto(e.lugar)}`,
    `URL:${e.url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:-PT1H',
    `DESCRIPTION:${escaparTexto(e.titulo)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lineas.map(plegar).join('\r\n') + '\r\n'
}
