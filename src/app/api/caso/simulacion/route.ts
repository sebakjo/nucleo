import { NextResponse } from 'next/server'
import { ejecutarSimulacion, SimulacionOcupada, type EventoSimulacion } from '@/lib/caso/simulacion'
import { consumirLimite, usosRestantes } from '@/lib/limite'
import { ipActual } from '@/lib/sesion'

/** Por persona: 5 corridas cada 10 minutos. En total: 120 por hora, para cuidar la base del demo. */
const POR_IP = { max: 5, ventanaSeg: 600 }
const GLOBAL = { max: 120, ventanaSeg: 3600 }

export async function GET() {
  const ip = await ipActual()
  const quedan = await usosRestantes(`caso:${ip}`, POR_IP.max, POR_IP.ventanaSeg)
  return NextResponse.json({ quedan, max: POR_IP.max }, { headers: { 'Cache-Control': 'no-store' } })
}

/**
 * Corre la simulación y devuelve cada evento como una línea JSON (NDJSON) a medida que pasa, para
 * que la página anime los carriles en vivo.
 */
export async function POST() {
  const ip = await ipActual()
  if (!(await consumirLimite(`caso:${ip}`, POR_IP.max, POR_IP.ventanaSeg))) {
    return NextResponse.json(
      { mensaje: 'Ya corriste la simulación 5 veces en 10 minutos. Probá de nuevo en un rato.', quedan: 0 },
      { status: 429 },
    )
  }
  if (!(await consumirLimite('caso:global', GLOBAL.max, GLOBAL.ventanaSeg))) {
    return NextResponse.json(
      { mensaje: 'La simulación llegó a su límite por esta hora. Probá más tarde.', quedan: 0 },
      { status: 429 },
    )
  }
  const quedan = await usosRestantes(`caso:${ip}`, POR_IP.max, POR_IP.ventanaSeg)

  const codificador = new TextEncoder()
  let resolverInicio: (ok: boolean) => void = () => {}
  const arranco = new Promise<boolean>((r) => (resolverInicio = r))

  const cuerpo = new ReadableStream<Uint8Array>({
    async start(control) {
      const enviar = (e: EventoSimulacion | { tipo: 'error'; mensaje: string }) =>
        control.enqueue(codificador.encode(JSON.stringify(e) + '\n'))
      try {
        await ejecutarSimulacion((e) => {
          if (e.tipo === 'inicio') resolverInicio(true)
          enviar(e)
        })
      } catch (e) {
        if (e instanceof SimulacionOcupada) {
          resolverInicio(false)
        } else {
          console.error('[caso]', e)
          enviar({ tipo: 'error', mensaje: 'La simulación se cortó. Probá de nuevo.' })
        }
      } finally {
        resolverInicio(true)
        control.close()
      }
    },
  })

  if (!(await arranco)) {
    return NextResponse.json(
      { mensaje: 'Otra persona está corriendo la simulación. Probá en unos segundos.', quedan },
      { status: 409 },
    )
  }
  return new Response(cuerpo, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Simulaciones-Restantes': String(quedan),
    },
  })
}
