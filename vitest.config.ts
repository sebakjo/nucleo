import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

try {
  process.loadEnvFile()
} catch {
  // CI: variables del entorno.
}

/**
 * Tests de reglas puras y de integración contra Postgres real (DATABASE_URL_TEST). Corren de a un
 * archivo por vez porque comparten la base; dentro del test de concurrencia las 20 reservas sí van
 * en paralelo, cada una con su propia conexión.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'server-only': fileURLToPath(new URL('./tests/vacio.ts', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    globalSetup: ['tests/setup-global.ts'],
    env: {
      APP_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL_TEST ?? '',
      DB_POOL_MAX: '25',
      MP_WEBHOOK_SECRET: process.env.MP_WEBHOOK_SECRET || 'secreto-de-test',
      SMTP_URL: '',
      RESEND_API_KEY: '',
      APP_URL: 'http://localhost:3030',
    },
  },
})
