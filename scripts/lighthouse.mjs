// Lighthouse en móvil (emulación y throttling por defecto) para el prototipo, horarios, la reserva
// y /caso. Uso: con la app en producción (`pnpm build && pnpm start`), `pnpm lighthouse [url]`.
// Calienta el servidor, mide tres veces cada página y guarda la corrida mediana (por rendimiento).
// Reportes en /docs/lighthouse y el resumen que lee /caso en /docs/metricas/lighthouse.json.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = (process.argv[2] ?? 'http://localhost:3030').replace(/\/$/, '')
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(RAIZ, 'docs/lighthouse')
const RUNS = 3
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']
const LABELS = {
  performance: 'Rendimiento',
  accessibility: 'Accesibilidad',
  'best-practices': 'Buenas prácticas',
  seo: 'SEO',
}

// Una clase futura con lugar, para medir la página de reserva tal como la ve alguien sin cuenta.
const { clases, ahora } = await fetch(`${BASE}/api/disponibilidad`).then((r) => r.json())
const conLugar = clases.find((c) => !c.cancelada && c.iniciaEn > ahora && c.reformers.length < c.cupo)
if (!conLugar) throw new Error('No hay clases futuras con lugar esta semana para medir la reserva')

const PAGES = [
  ['prototipo', '/antes', 'Prototipo (antes)'],
  ['horarios', '/', 'Horarios'],
  ['reserva', `/clase/${conLugar.id}`, 'Reserva'],
  ['caso', '/caso', 'Caso de estudio'],
]

mkdirSync(OUT, { recursive: true })
const rows = []

function lighthouse(url, outputPath) {
  execFileSync(
    'pnpm',
    [
      'dlx',
      'lighthouse@13.5.0',
      url,
      `--only-categories=${CATEGORIES.join(',')}`,
      '--output=html',
      '--output=json',
      `--output-path=${outputPath}`,
      '--chrome-flags=--headless=new',
      '--quiet',
    ],
    { stdio: 'inherit' },
  )
  return JSON.parse(readFileSync(`${outputPath}.report.json`, 'utf8'))
}

for (const [name, path, nombre] of PAGES) {
  const url = `${BASE}${path}`
  await fetch(url) // Calienta el servidor y la optimización de imágenes.
  const runs = []
  for (let i = 1; i <= RUNS; i++) {
    console.log(`→ ${name} (${i}/${RUNS}): ${url}`)
    const report = lighthouse(url, join(OUT, `${name}-${i}`))
    runs.push({ i, report, perf: report.categories.performance.score })
  }
  const median = [...runs].sort((a, b) => a.perf - b.perf)[Math.floor(RUNS / 2)]
  for (const run of runs) {
    for (const ext of ['html', 'json']) {
      const file = join(OUT, `${name}-${run.i}.report.${ext}`)
      if (run === median) renameSync(file, join(OUT, `${name}.report.${ext}`))
      else rmSync(file)
    }
  }
  const report = median.report
  rows.push({
    name,
    nombre,
    path: name === 'reserva' ? '/clase/[id]' : path,
    scores: CATEGORIES.map((c) => Math.round(report.categories[c].score * 100)),
    perfRuns: runs.map((r) => Math.round(r.perf * 100)),
    lcp: report.audits['largest-contentful-paint'].displayValue,
    cls: report.audits['cumulative-layout-shift'].displayValue,
  })
}

const fecha = new Date().toISOString()
const table = [
  `| Página | ${CATEGORIES.map((c) => LABELS[c]).join(' | ')} | LCP | CLS | Rendimiento en las ${RUNS} corridas |`,
  `|---|${CATEGORIES.map(() => '---:').join('|')}|---:|---:|---|`,
  ...rows.map(
    (r) =>
      `| [${r.nombre}](${r.name}.report.html) \`${r.path}\` | ${r.scores.join(' | ')} | ${r.lcp} | ${r.cls} | ${r.perfRuns.join(', ')} |`,
  ),
].join('\n')

writeFileSync(
  join(OUT, 'README.md'),
  `# Lighthouse

Lighthouse 13.5.0 en modo móvil (emulación de teléfono y red 4G lenta, los valores por defecto),
contra un build de producción (\`pnpm build && pnpm start\`) con PostgreSQL en Docker en la misma
máquina. Cada página se mide ${RUNS} veces después de calentar el servidor y se guarda la corrida
mediana. Medido el ${fecha.slice(0, 10)}.

${table}

Cada página tiene su reporte en HTML (para abrir en el navegador) y en JSON. Para repetir la
medición: \`pnpm lighthouse http://localhost:3030\` con la app en producción.
`,
)

writeFileSync(
  join(RAIZ, 'docs/metricas/lighthouse.json'),
  JSON.stringify(
    {
      fecha,
      herramienta: `Lighthouse 13.5.0, móvil, mediana de ${RUNS} corridas`,
      paginas: rows.map((r) => ({
        ruta: r.path,
        nombre: r.nombre,
        rendimiento: r.scores[0],
        accesibilidad: r.scores[1],
        buenasPracticas: r.scores[2],
        seo: r.scores[3],
      })),
    },
    null,
    2,
  ) + '\n',
)
console.log(`\n${table}`)
