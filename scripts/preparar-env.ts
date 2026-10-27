// Crea .env a partir de .env.example la primera vez, con secretos aleatorios para correr en local.
// Si .env ya existe no lo toca. Lo llama `pnpm setup`.
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

if (existsSync('.env')) {
  console.log('.env ya existe: se deja como está.')
  process.exit(0)
}

const aleatorio = (bytes: number) => randomBytes(bytes).toString('base64url')
const generados: Record<string, string> = {
  BETTER_AUTH_SECRET: aleatorio(32),
  DEMO_PASSWORD: `demo-${aleatorio(9)}`,
  CRON_SECRET: aleatorio(24),
  MP_WEBHOOK_SECRET: aleatorio(24),
}

const contenido = readFileSync('.env.example', 'utf8').replace(/^([A-Z_]+)=$/gm, (linea, clave: string) =>
  clave in generados ? `${clave}=${generados[clave]}` : linea,
)
writeFileSync('.env', contenido, { mode: 0o600 })
console.log('Creé .env con secretos aleatorios. La contraseña de las cuentas demo está en DEMO_PASSWORD.')
