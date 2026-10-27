import { describe, expect, it } from 'vitest'
import { aCsv, celda } from '@/lib/csv'

describe('CSV', () => {
  it('separa con punto y coma, empieza con BOM y termina las filas con CRLF', () => {
    const csv = aCsv([
      ['Persona', 'Monto (ARS)'],
      ['Sofía Benítez', 22000],
    ])
    expect(csv).toBe('﻿Persona;Monto (ARS)\r\nSofía Benítez;22000\r\n')
  })

  it('entrecomilla lo que tiene separador, comillas o saltos de línea', () => {
    expect(celda('Pack 8; promo')).toBe('"Pack 8; promo"')
    expect(celda('dijo "hola"')).toBe('"dijo ""hola"""')
    expect(celda('dos\nlíneas')).toBe('"dos\nlíneas"')
  })

  it('neutraliza las celdas que una planilla ejecutaría como fórmula', () => {
    expect(celda('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`)
    expect(celda('+54 11')).toBe("'+54 11")
    expect(celda('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(celda(-500)).toBe('-500')
  })

  it('las celdas vacías quedan vacías', () => {
    expect(celda(null)).toBe('')
    expect(celda(undefined)).toBe('')
  })
})
