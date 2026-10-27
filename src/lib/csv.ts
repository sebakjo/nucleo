/**
 * CSV para abrir en Excel o Google Sheets con configuración regional argentina: separador `;`
 * (la coma es el separador decimal) y BOM para que se vean los acentos.
 */
export type Celda = string | number | null | undefined

/** Una celda que empieza con = + - @ se ejecutaría como fórmula al abrir el archivo: se neutraliza. */
export function celda(valor: Celda, sep = ';'): string {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'number') return String(valor)
  let s = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor
  if (s.includes(sep) || s.includes('"') || /[\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
  return s
}

export function aCsv(filas: Celda[][], sep = ';'): string {
  return '﻿' + filas.map((f) => f.map((v) => celda(v, sep)).join(sep)).join('\r\n') + '\r\n'
}
