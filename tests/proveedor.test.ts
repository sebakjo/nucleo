import { afterEach, describe, expect, it } from 'vitest'
import { db } from '@/db'
import { proveedorPagos } from '@/lib/pagos'

const ORIGINAL = { ...process.env }

function entorno(vars: Record<string, string | undefined>) {
  for (const [clave, valor] of Object.entries(vars)) {
    if (valor === undefined) delete process.env[clave]
    else process.env[clave] = valor
  }
}

describe('proveedor de pagos', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL }
  })

  it('en test siempre usa el simulado, aunque haya token de Mercado Pago', () => {
    entorno({ APP_ENV: 'test', MP_ACCESS_TOKEN: 'TEST-token', PAGOS_PROVEEDOR: undefined })
    expect(proveedorPagos(db).nombre).toBe('simulado')
  })

  it('en local sin token usa el simulado, y con token Mercado Pago', () => {
    entorno({ APP_ENV: 'local', MP_ACCESS_TOKEN: undefined, PAGOS_PROVEEDOR: undefined })
    expect(proveedorPagos(db).nombre).toBe('simulado')
    entorno({ MP_ACCESS_TOKEN: 'TEST-token' })
    expect(proveedorPagos(db).nombre).toBe('mercadopago')
  })

  it('en producción nunca usa el simulado: ni forzado ni como respaldo', () => {
    entorno({ APP_ENV: 'production', MP_ACCESS_TOKEN: 'APP_USR-token', PAGOS_PROVEEDOR: 'simulado' })
    expect(() => proveedorPagos(db)).toThrow(/pagos no están disponibles/)
    entorno({ MP_ACCESS_TOKEN: undefined, PAGOS_PROVEEDOR: undefined })
    expect(() => proveedorPagos(db)).toThrow(/pagos no están disponibles/)
    entorno({ MP_ACCESS_TOKEN: 'APP_USR-token' })
    expect(proveedorPagos(db).nombre).toBe('mercadopago')
  })
})
