// Cuenta los tests (Vitest y Playwright) y lo guarda en docs/metricas/tests.json para /caso.
// Uso: pnpm tsx scripts/metricas-tests.ts
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const vitest = JSON.parse(
  execFileSync('pnpm', ['exec', 'vitest', 'list', '--json'], { encoding: 'utf8' }),
) as unknown[]
const playwright = JSON.parse(
  execFileSync('pnpm', ['exec', 'playwright', 'test', '--list', '--reporter=json'], { encoding: 'utf8' }),
) as { stats?: { expected?: number }; suites: { specs?: unknown[]; suites?: unknown[] }[] }

function contarSpecs(s: { specs?: unknown[]; suites?: unknown[] }): number {
  return (s.specs?.length ?? 0) + (s.suites ?? []).reduce<number>((n, x) => n + contarSpecs(x as typeof s), 0)
}

const datos = {
  fecha: new Date().toISOString(),
  vitest: vitest.length,
  playwright: playwright.suites.reduce((n, s) => n + contarSpecs(s), 0),
}
writeFileSync('docs/metricas/tests.json', JSON.stringify(datos, null, 2) + '\n')
console.log(datos)
