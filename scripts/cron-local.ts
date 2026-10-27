// Cron en local: llama a /api/cron/todo cada minuto con el secreto, como haría el cron del deploy.
// Uso: con la app corriendo (`pnpm dev` o `pnpm start`), `pnpm cron`. Ctrl+C para cortar.
try {
  process.loadEnvFile()
} catch {
  // Variables del entorno.
}

const url = `${(process.env.APP_URL ?? 'http://localhost:3030').replace(/\/$/, '')}/api/cron/todo`
const secreto = process.env.CRON_SECRET
if (!secreto) throw new Error('Falta CRON_SECRET en .env')
const una = process.argv.includes('--una-vez')

async function tick() {
  const hora = new Date().toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${secreto}` } })
    const cuerpo = (await res.json()) as { resultado?: Record<string, unknown>; error?: string }
    console.log(`[${hora}] ${res.status}`, JSON.stringify(cuerpo.resultado ?? cuerpo))
  } catch (e) {
    console.error(`[${hora}] no se pudo llamar a ${url}:`, e instanceof Error ? e.message : e)
  }
}

export {}

await tick()
if (!una) setInterval(tick, 60_000)
