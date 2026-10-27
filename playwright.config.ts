import { defineConfig } from '@playwright/test'

try {
  process.loadEnvFile()
} catch {
  // En CI las variables vienen del entorno.
}

const PUERTO = 3100
const URL_APP = `http://localhost:${PUERTO}`

/**
 * Los e2e corren contra una build de producción con APP_ENV=test: base de tests resembrada,
 * proveedor de pagos simulado y emails al log. Nunca tocan la base de demo.
 */
export const entornoE2E = {
  APP_ENV: 'test',
  APP_URL: URL_APP,
  DATABASE_URL: process.env.DATABASE_URL_TEST ?? '',
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? 'secreto-de-e2e-solo-para-tests-0123456789',
  DEMO_MODE: '1',
  DEMO_PASSWORD: process.env.DEMO_PASSWORD ?? 'demo-nucleo-2026',
  MP_WEBHOOK_SECRET: process.env.MP_WEBHOOK_SECRET ?? 'secreto-webhook-e2e',
  CRON_SECRET: process.env.CRON_SECRET ?? 'secreto-cron-e2e',
  SMTP_URL: '',
  RESEND_API_KEY: '',
  NEXT_DIST_DIR: '.next-e2e',
}

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  globalSetup: './e2e/preparar.ts',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: URL_APP,
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    viewport: { width: 1280, height: 800 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `pnpm exec next build && pnpm exec next start --port ${PUERTO}`,
    url: URL_APP,
    env: entornoE2E,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
