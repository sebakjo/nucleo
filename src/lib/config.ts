/**
 * Configuración leída del entorno en el momento de usarla (no al importar), así los tests y los
 * scripts pueden ajustar variables antes de llamar.
 */
export type EntornoApp = 'local' | 'test' | 'production'

export function entorno(): EntornoApp {
  const v = process.env.APP_ENV
  return v === 'test' || v === 'production' ? v : 'local'
}

export function urlApp(): string {
  return (process.env.APP_URL ?? 'http://localhost:3030').replace(/\/$/, '')
}

/** Muestra los botones "Entrar como alumno demo / admin demo". */
export function modoDemo(): boolean {
  return process.env.DEMO_MODE === '1'
}

export function contrasenaDemo(): string | undefined {
  return process.env.DEMO_PASSWORD || undefined
}

export const CUENTAS_DEMO = {
  alumno: { email: 'sofia@nucleo.test', nombre: 'Sofía Benítez' },
  admin: { email: 'admin@nucleo.test', nombre: 'Carla Méndez' },
  instructor: { email: 'lucia@nucleo.test', nombre: 'Lucía Ferreyra' },
} as const
