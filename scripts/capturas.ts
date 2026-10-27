/**
 * Capturas para /docs/screenshots: escritorio y móvil, panel en claro y oscuro, y la portada (el
 * momento de la confirmación). Requiere la app corriendo con los datos de demo recién sembrados.
 * Uso: pnpm tsx scripts/capturas.ts [url]. Reserva una clase con la cuenta demo de Sofía.
 */
import { mkdirSync } from 'node:fs'
import { chromium, type Browser, type Page } from '@playwright/test'

const BASE = (process.argv[2] ?? 'http://localhost:3030').replace(/\/$/, '')
const OUT = 'docs/screenshots'
mkdirSync(OUT, { recursive: true })

const ESCRITORIO = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }
const MOVIL = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }

async function contexto(
  navegador: Browser,
  opciones: typeof ESCRITORIO | typeof MOVIL,
  tema?: 'claro' | 'oscuro',
) {
  const ctx = await navegador.newContext({
    ...opciones,
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Buenos_Aires',
    reducedMotion: 'reduce',
  })
  if (tema) await ctx.addInitScript((t) => localStorage.setItem('nucleo-tema', t), tema)
  return ctx.newPage()
}

async function entrar(page: Page, rol: 'alumno' | 'admin') {
  await page.goto(`${BASE}/entrar`)
  await page.getByRole('button', { name: `Entrar como ${rol} demo` }).click()
  await page.waitForURL(rol === 'admin' ? /\/admin/ : new RegExp(`${BASE}/$`))
}

async function foto(page: Page, nombre: string, completa = false) {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${OUT}/${nombre}.png`, fullPage: completa })
  console.log(`${OUT}/${nombre}.png`)
}

/** El jueves a las 18:00 de esta semana (la clase de Lucía del brief), si tiene lugar. */
async function claseDelJueves(): Promise<string> {
  const { clases, ahora } = (await fetch(`${BASE}/api/disponibilidad`).then((r) => r.json())) as {
    ahora: string
    clases: { id: string; iniciaEn: string; reformers: number[]; cupo: number; instructor: string }[]
  }
  const fmt = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
  const jueves = clases.find((c) => fmt.format(new Date(c.iniciaEn)) === 'jueves, 18:00')
  const libre = (c: (typeof clases)[number]) => c.iniciaEn > ahora && c.reformers.length < c.cupo
  const elegida = jueves && libre(jueves) ? jueves : clases.find(libre)
  if (!elegida) throw new Error('No hay clases con lugar esta semana')
  return elegida.id
}

const navegador = await chromium.launch()

// Público, escritorio y móvil.
for (const [opciones, sufijo] of [
  [ESCRITORIO, 'escritorio'],
  [MOVIL, 'movil'],
] as const) {
  const page = await contexto(navegador, opciones)
  await page.goto(`${BASE}/`)
  await foto(page, `horarios-${sufijo}`)
  await page.goto(`${BASE}/antes`)
  await foto(page, `prototipo-${sufijo}`)
  await page.goto(`${BASE}/caso`)
  await foto(page, `caso-${sufijo}`)
  await page.close()
}

// Alumno: reserva con crédito (la portada) y mis reservas.
const jueves = await claseDelJueves()
{
  const page = await contexto(navegador, ESCRITORIO)
  await entrar(page, 'alumno')
  await page.goto(`${BASE}/clase/${jueves}`)
  await foto(page, 'reserva-escritorio')
  await page.getByRole('radio', { name: /Usar 1 crédito/ }).check()
  await page.getByRole('button', { name: 'Reservar', exact: true }).click()
  await page.getByText(/^Reservaste el /).waitFor()
  await page.waitForTimeout(700)
  await foto(page, 'confirmacion-escritorio')
  await page.screenshot({ path: `${OUT}/portada.png`, clip: { x: 0, y: 0, width: 1440, height: 560 } })
  await page.goto(`${BASE}/mis-reservas`)
  await foto(page, 'mis-reservas-escritorio')
  await page.close()
}
{
  const page = await contexto(navegador, MOVIL)
  await entrar(page, 'alumno')
  await page.goto(`${BASE}/clase/${jueves}`)
  await foto(page, 'reserva-movil')
  await page.goto(`${BASE}/mis-reservas`)
  await foto(page, 'mis-reservas-movil')
  await page.close()
}

// La simulación de /caso, terminada.
{
  const page = await contexto(navegador, ESCRITORIO)
  await page.goto(`${BASE}/caso`)
  const boton = page.getByRole('button', { name: 'Simular 20 reservas al mismo tiempo' })
  await boton.scrollIntoViewIfNeeded()
  await boton.click()
  await page.getByText(/Verificado en la base/).waitFor({ timeout: 30_000 })
  await page.locator('section', { has: page.getByRole('heading', { name: /La prueba/ }) }).screenshot({
    path: `${OUT}/simulacion-escritorio.png`,
  })
  console.log(`${OUT}/simulacion-escritorio.png`)
  await page.close()
}

// Panel, en claro y en oscuro.
for (const tema of ['claro', 'oscuro'] as const) {
  const page = await contexto(navegador, ESCRITORIO, tema)
  await entrar(page, 'admin')
  await page.goto(`${BASE}/admin?clase=${jueves}`)
  await page.getByRole('dialog').waitFor()
  await foto(page, `admin-agenda-${tema}`)
  // La semana anterior está completa: muestra mejor la forma de las métricas.
  await page.goto(`${BASE}/admin/metricas`)
  await page.getByRole('link', { name: 'Semana anterior' }).click()
  await page.waitForURL(/semana=/)
  await foto(page, `admin-metricas-${tema}`)
  await page.goto(`${BASE}/admin/mensajes`)
  await foto(page, `admin-mensajes-${tema}`)
  await page.close()
}
{
  const page = await contexto(navegador, MOVIL, 'claro')
  await entrar(page, 'admin')
  await foto(page, 'admin-agenda-movil')
  await page.close()
}

await navegador.close()
