/**
 * Capturas del comparador de /caso: el prototipo (/antes) y los horarios en producción, con el
 * mismo tamaño de ventana. Requiere la app corriendo (pnpm dev). Uso: pnpm tsx scripts/capturas-caso.ts
 */
import { chromium } from '@playwright/test'

const BASE = process.env.APP_URL_CAPTURAS ?? 'http://localhost:3030'
const navegador = await chromium.launch()
const pagina = await navegador.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5 })
for (const [ruta, archivo] of [
  ['/antes', 'antes'],
  ['/', 'despues'],
] as const) {
  await pagina.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' })
  await pagina.waitForTimeout(800)
  await pagina.screenshot({ path: `public/caso/${archivo}.jpg`, type: 'jpeg', quality: 82 })
  console.log(`public/caso/${archivo}.jpg`)
}
await navegador.close()
