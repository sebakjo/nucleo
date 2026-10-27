const pesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

/** "$ 22.000". Los montos se guardan en pesos enteros. */
export function precio(ars: number): string {
  return pesos.format(ars)
}
