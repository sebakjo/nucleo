// Aplica las migraciones versionadas de /drizzle. Uso: `pnpm db:migrate` (o `-- --test` para la base de tests).
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { crearDb } from '../src/db'

try {
  process.loadEnvFile()
} catch {
  // Sin .env: variables del entorno.
}

const url = process.argv.includes('--test') ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL
if (!url) throw new Error('Falta DATABASE_URL')

const { db, pool } = crearDb(url, 1)
await migrate(db, { migrationsFolder: 'drizzle' })
await pool.end()
console.log(`Migraciones aplicadas en ${new URL(url).pathname.slice(1)}`)
