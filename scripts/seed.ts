// Carga los datos de demo. `pnpm db:seed` solo siembra si la base está vacía; `pnpm db:reset` la vacía antes.
// `--test` apunta a DATABASE_URL_TEST (la usan los tests de punta a punta).
import { sql } from 'drizzle-orm'
import { crearDb } from '../src/db'
import { sembrar, vaciar } from '../src/db/seed'
import { user } from '../src/db/schema'

try {
  process.loadEnvFile()
} catch {
  // Sin .env: variables del entorno.
}

const test = process.argv.includes('--test')
const url = test ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL
const contrasena = process.env.DEMO_PASSWORD
if (!url) throw new Error('Falta DATABASE_URL')
if (!contrasena) throw new Error('Falta DEMO_PASSWORD (contraseña de las cuentas demo)')

const { db, pool } = crearDb(url, 4)
const inicio = Date.now()
try {
  if (process.argv.includes('--reset')) {
    await vaciar(db)
  } else {
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(user)
    if (n > 0) {
      console.log(
        'La base ya tiene datos: no se siembra de nuevo (usá `pnpm db:reset` para empezar de cero).',
      )
      process.exit(0)
    }
  }
  await sembrar(db, { contrasena, log: (m) => console.log(`· ${m}`) })
  console.log(`Datos de demo listos en ${((Date.now() - inicio) / 1000).toFixed(1)} s`)
} finally {
  await pool.end()
}
