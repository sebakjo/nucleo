import { db as dbPorDefecto, type DB } from '@/db'
import { entorno, urlApp } from '@/lib/config'
import { ErrorDominio } from '@/lib/dominio/errores'
import { crearMercadoPago } from './mercadopago'
import type { ProveedorPagos } from './proveedor'
import { crearSimulado } from './simulado'

/**
 * Elige el proveedor de pagos:
 * - APP_ENV=test → simulado (tests de punta a punta deterministas).
 * - Con MP_ACCESS_TOKEN → Mercado Pago.
 * - Sin token, en local → simulado (documentado en el README).
 * - En producción sin token → los pagos quedan deshabilitados; nunca se usa el simulado.
 */
export function proveedorPagos(db: DB = dbPorDefecto): ProveedorPagos {
  const env = entorno()
  const simuladoPermitido = env === 'test' || env === 'local'
  const forzado = process.env.PAGOS_PROVEEDOR
  if (env === 'test' || forzado === 'simulado') {
    if (!simuladoPermitido) throw new ErrorDominio('PAGOS_NO_CONFIGURADOS')
    return crearSimulado(db, urlApp())
  }
  const token = process.env.MP_ACCESS_TOKEN
  if (token) return crearMercadoPago(token)
  if (simuladoPermitido) return crearSimulado(db, urlApp())
  throw new ErrorDominio('PAGOS_NO_CONFIGURADOS')
}

export function usaSimulado(): boolean {
  try {
    return proveedorPagos().nombre === 'simulado'
  } catch {
    return false
  }
}
