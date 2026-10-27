import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

export function crearDb(connectionString: string | undefined, max = 10) {
  const pool = new Pool({ connectionString, max })
  return { pool, db: drizzle(pool, { schema, casing: 'snake_case' }) }
}

export type DB = ReturnType<typeof crearDb>['db']
export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0]
/** Cualquier cosa que pueda ejecutar consultas: la base o una transacción abierta. */
export type Ejecutor = DB | Tx

// Una sola pool por proceso (en desarrollo, sobrevive a la recarga en caliente).
const global = globalThis as unknown as { nucleoDb?: ReturnType<typeof crearDb> }
const instancia = global.nucleoDb ?? crearDb(process.env.DATABASE_URL, Number(process.env.DB_POOL_MAX ?? 10))
if (process.env.NODE_ENV !== 'production') global.nucleoDb = instancia

export const db = instancia.db
export const pool = instancia.pool
