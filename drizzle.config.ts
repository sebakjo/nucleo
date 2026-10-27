import { defineConfig } from 'drizzle-kit'

try {
  process.loadEnvFile()
} catch {
  // Sin .env: se usan las variables del entorno (CI, deploy).
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  casing: 'snake_case',
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
})
