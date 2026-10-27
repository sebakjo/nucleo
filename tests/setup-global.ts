import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { crearDb } from '../src/db'

/** Aplica las migraciones en la base de tests antes de correr nada. */
export default async function setup() {
  const url = process.env.DATABASE_URL_TEST
  if (!url) throw new Error('Falta DATABASE_URL_TEST (ver .env.example)')
  const { db, pool } = crearDb(url, 1)
  await migrate(db, { migrationsFolder: 'drizzle' })
  await pool.end()
}
