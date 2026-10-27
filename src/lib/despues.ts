import { after } from 'next/server'

/**
 * Corre trabajo después de responder (despachar emails, por ejemplo) sin hacer esperar a la persona.
 * Fuera de una petición de Next.js (tests, scripts) `after` no existe y se corre en el momento.
 */
export function despuesDeResponder(fn: () => Promise<unknown>): void {
  const seguro = () => fn().catch((e) => console.error('[después de responder]', e))
  try {
    after(seguro)
  } catch {
    void seguro()
  }
}
