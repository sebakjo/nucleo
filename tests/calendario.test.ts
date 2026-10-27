import { describe, expect, it } from 'vitest'
import { archivoIcs, escaparTexto, plegar } from '@/lib/calendario'

const evento = {
  uid: 'r1@nucleo',
  inicio: new Date('2026-10-29T21:00:00Z'), // jueves 18:00 en Buenos Aires
  fin: new Date('2026-10-29T21:55:00Z'),
  titulo: 'Reformer clásico en Núcleo',
  descripcion: 'Con Lucía Ferreyra. Tu lugar es el reformer 4.\nCancelás sin costo hasta el jueves 06:00.',
  lugar: 'Núcleo, pilates reformer · Buenos Aires',
  url: 'http://localhost:3030/mis-reservas',
  creado: new Date('2026-10-27T12:00:00Z'),
}

describe('archivo .ics', () => {
  it('usa horas en UTC, líneas con CRLF y una alarma una hora antes', () => {
    const ics = archivoIcs(evento)
    expect(ics).toContain('DTSTART:20261029T210000Z\r\n')
    expect(ics).toContain('DTEND:20261029T215500Z\r\n')
    expect(ics).toContain('TRIGGER:-PT1H')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/\n/)
  })

  it('escapa comas, punto y coma, barras y saltos de línea', () => {
    expect(escaparTexto('a, b; c\\d\ne')).toBe('a\\, b\; c\\\\d\\ne')
    expect(archivoIcs(evento)).toContain('LOCATION:Núcleo\\, pilates reformer · Buenos Aires')
  })

  it('pliega las líneas largas a 75 bytes sin partir caracteres', () => {
    const larga = `DESCRIPTION:${'ñ'.repeat(80)}`
    const lineas = plegar(larga).split('\r\n')
    expect(lineas.length).toBeGreaterThan(1)
    for (const l of lineas) expect(Buffer.byteLength(l)).toBeLessThanOrEqual(75)
    expect(lineas.slice(1).every((l) => l.startsWith(' '))).toBe(true)
    expect(lineas.map((l, i) => (i === 0 ? l : l.slice(1))).join('')).toBe(larga)
  })
})
