'use client'

import { useEffect, useRef, useState } from 'react'
import type { EventoSimulacion } from '@/lib/caso/simulacion'

const PERSONAS = 20
const CUPO = 6
/** Separación entre eventos al animar: los resultados llegan en milisegundos y así se ven llegar. */
const PASO_MS = 110

type Fin = Extract<EventoSimulacion, { tipo: 'fin' }>
type Verificacion = Extract<EventoSimulacion, { tipo: 'verificacion' }>

type Estado = {
  fase: 'lista' | 'corriendo' | 'terminada' | 'error'
  prototipo: number[]
  produccion: { persona: number; reformer: number }[]
  espera: { persona: number; puesto: number }[]
  finPrototipo: Fin | null
  finProduccion: Fin | null
  verificacion: Verificacion | null
  mensaje: string | null
}

const INICIAL: Estado = {
  fase: 'lista',
  prototipo: [],
  produccion: [],
  espera: [],
  finPrototipo: null,
  finProduccion: null,
  verificacion: null,
  mensaje: null,
}

function aplicar(e: Estado, ev: EventoSimulacion): Estado {
  switch (ev.tipo) {
    case 'intento':
      if (ev.lado === 'prototipo') return { ...e, prototipo: [...e.prototipo, ev.persona] }
      return ev.resultado === 'reservada'
        ? { ...e, produccion: [...e.produccion, { persona: ev.persona, reformer: ev.reformer! }] }
        : { ...e, espera: [...e.espera, { persona: ev.persona, puesto: ev.puesto! }] }
    case 'fin':
      return ev.lado === 'prototipo' ? { ...e, finPrototipo: ev } : { ...e, finProduccion: ev }
    case 'verificacion':
      return { ...e, verificacion: ev, fase: 'terminada' }
    default:
      return e
  }
}

function Carril({ lleno, exceso, nuevo }: { lleno: boolean; exceso?: boolean; nuevo?: boolean }) {
  const borde = exceso ? 'border-error' : lleno ? 'border-completa-carril' : 'border-eucalipto'
  const fondo = exceso ? 'bg-error' : 'bg-completa-carril'
  return (
    <span
      className={`relative block h-16 w-5 shrink-0 overflow-hidden rounded-carril border-[1.5px] sm:h-20 sm:w-6 ${borde} ${
        lleno ? '' : 'bg-eucalipto-tenue'
      }`}
    >
      {lleno && <span className={`absolute inset-0 ${fondo} ${nuevo ? 'carril-llenandose' : ''}`} />}
    </span>
  )
}

/**
 * La segunda prueba del caso: 20 personas reservan la misma clase de 6 lugares al mismo tiempo.
 * El servidor corre las dos versiones de verdad (el código del prototipo y el dominio contra
 * Postgres) y manda cada resultado apenas ocurre.
 */
export function Simulacion() {
  const [estado, setEstado] = useState<Estado>(INICIAL)
  const [quedan, setQuedan] = useState<number | null>(null)
  // Una cola por lado: así los dos paneles avanzan a la vez aunque el prototipo termine antes.
  const colas = useRef({
    prototipo: [] as EventoSimulacion[],
    produccion: [] as EventoSimulacion[],
    final: [] as EventoSimulacion[],
  })
  const reloj = useRef<number | null>(null)

  useEffect(() => {
    fetch('/api/caso/simulacion', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { quedan: number } | null) => d && setQuedan(d.quedan))
      .catch(() => {})
    return () => {
      if (reloj.current) window.clearInterval(reloj.current)
    }
  }, [])

  const vacias = () =>
    !colas.current.prototipo.length && !colas.current.produccion.length && !colas.current.final.length

  const drenar = (todo = false) => {
    const lote: EventoSimulacion[] = []
    do {
      const a = colas.current.prototipo.shift()
      const b = colas.current.produccion.shift()
      if (a) lote.push(a)
      if (b) lote.push(b)
      if (!a && !b) {
        const f = colas.current.final.shift()
        if (!f) break
        lote.push(f)
      }
    } while (todo)
    if (lote.length) setEstado((e) => lote.reduce(aplicar, e))
  }

  const correr = async () => {
    colas.current = { prototipo: [], produccion: [], final: [] }
    setEstado({ ...INICIAL, fase: 'corriendo' })
    const sinMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    try {
      const res = await fetch('/api/caso/simulacion', { method: 'POST' })
      if (!res.ok || !res.body) {
        const datos = (await res.json().catch(() => null)) as { mensaje?: string; quedan?: number } | null
        if (typeof datos?.quedan === 'number') setQuedan(datos.quedan)
        setEstado({
          ...INICIAL,
          fase: 'error',
          mensaje: datos?.mensaje ?? 'No se pudo correr la simulación.',
        })
        return
      }
      const restantes = Number(res.headers.get('X-Simulaciones-Restantes'))
      if (Number.isFinite(restantes)) setQuedan(restantes)
      if (!sinMovimiento) reloj.current = window.setInterval(() => drenar(), PASO_MS)

      const lector = res.body.pipeThrough(new TextDecoderStream()).getReader()
      let resto = ''
      for (;;) {
        const { value, done } = await lector.read()
        if (done) break
        resto += value
        const lineas = resto.split('\n')
        resto = lineas.pop() ?? ''
        for (const l of lineas) {
          if (!l.trim()) continue
          const ev = JSON.parse(l) as EventoSimulacion | { tipo: 'error'; mensaje: string }
          if (ev.tipo === 'error') {
            setEstado((e) => ({ ...e, fase: 'error', mensaje: ev.mensaje }))
            continue
          }
          if (ev.tipo === 'intento' || ev.tipo === 'fin') colas.current[ev.lado].push(ev)
          else if (ev.tipo === 'verificacion') colas.current.final.push(ev)
        }
      }
      if (sinMovimiento) drenar(true)
    } catch {
      setEstado((e) => ({ ...e, fase: 'error', mensaje: 'Se cortó la conexión. Probá de nuevo.' }))
    }
  }

  // Cuando la cola se vacía después del último evento, se detiene el reloj.
  useEffect(() => {
    if (estado.fase !== 'corriendo' && reloj.current && vacias()) {
      window.clearInterval(reloj.current)
      reloj.current = null
    }
  }, [estado])

  const corriendo = estado.fase === 'corriendo'
  const exceso = Math.max(0, estado.prototipo.length - CUPO)
  const ocupadosProd = new Map(estado.produccion.map((p) => [p.reformer, p.persona]))
  const ultimoReformer = estado.produccion.at(-1)?.reformer
  const terminada = estado.fase === 'terminada'

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <button
          type="button"
          onClick={correr}
          disabled={corriendo || quedan === 0}
          className="boton boton-principal"
        >
          {corriendo ? 'Reservando…' : terminada ? 'Correr de nuevo' : 'Simular 20 reservas al mismo tiempo'}
        </button>
        {quedan !== null && (
          <p className="text-chico text-grafito-2 tabular">
            {quedan === 0
              ? 'Llegaste al límite: 5 simulaciones cada 10 minutos.'
              : `Te ${quedan === 1 ? 'queda 1 simulación' : `quedan ${quedan} simulaciones`} en los próximos 10 minutos.`}
          </p>
        )}
      </div>
      {estado.mensaje && (
        <p role="alert" className="mt-3 rounded-boton bg-error-tenue px-4 py-3 text-chico text-error">
          {estado.mensaje}
        </p>
      )}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section
          aria-labelledby="sim-prototipo"
          className="rounded-bloque border border-linea bg-superficie p-5"
        >
          <h3 id="sim-prototipo" className="text-subtitulo font-semibold">
            Prototipo
          </h3>
          <p className="text-chico text-grafito-2">Cada navegador guarda sus reservas en localStorage.</p>
          <div className="mt-5 flex flex-wrap items-end gap-1.5" aria-hidden="true">
            {Array.from({ length: CUPO }, (_, i) => (
              <Carril key={i} lleno={i < estado.prototipo.length} nuevo />
            ))}
            {exceso > 0 && <span className="mx-1 block h-20 w-px self-stretch bg-grafito-2/40" />}
            {Array.from({ length: exceso }, (_, i) => (
              <Carril key={`x${i}`} lleno exceso nuevo />
            ))}
          </div>
          <p className="mt-4 text-dato-grande font-semibold tabular">
            <span className={exceso > 0 ? 'text-error' : ''}>{estado.prototipo.length}</span>
            <span className="text-dato text-grafito-2"> de {CUPO} lugares vendidos</span>
          </p>
          <p className="mt-1 min-h-10 text-chico text-grafito-2">
            {exceso > 0
              ? `${exceso} ${exceso === 1 ? 'persona llega' : 'personas llegan'} a la clase y no tienen reformer. Ningún navegador veía las reservas de los otros.`
              : 'Cada persona ve “6 lugares libres”, porque solo cuenta lo que reservó desde su navegador.'}
          </p>
        </section>

        <section
          aria-labelledby="sim-produccion"
          className="rounded-bloque border border-linea bg-superficie p-5"
        >
          <h3 id="sim-produccion" className="text-subtitulo font-semibold">
            Producción
          </h3>
          <p className="text-chico text-grafito-2">
            PostgreSQL: la clase se bloquea, se cuenta y se inserta.
          </p>
          <div className="mt-5 flex flex-wrap items-end gap-1.5" aria-hidden="true">
            {Array.from({ length: CUPO }, (_, i) => (
              <Carril key={i} lleno={ocupadosProd.has(i + 1)} nuevo={ultimoReformer === i + 1} />
            ))}
          </div>
          <p className="mt-4 text-dato-grande font-semibold tabular">
            {estado.produccion.length}
            <span className="text-dato text-grafito-2"> de {CUPO} lugares vendidos</span>
          </p>
          <div className="mt-1 min-h-10">
            {estado.espera.length > 0 ? (
              <>
                <p className="text-chico text-grafito-2 tabular">
                  {estado.espera.length} {estado.espera.length === 1 ? 'persona' : 'personas'} en lista de
                  espera, en orden de llegada:
                </p>
                <ol className="mt-2 flex flex-wrap gap-1" aria-label="Lista de espera">
                  {[...estado.espera]
                    .sort((a, b) => a.puesto - b.puesto)
                    .map((p) => (
                      <li
                        key={p.persona}
                        className="grid h-7 min-w-7 place-items-center rounded-full border border-linea px-1.5 text-leyenda font-semibold tabular"
                      >
                        {p.puesto}
                      </li>
                    ))}
                </ol>
              </>
            ) : (
              <p className="text-chico text-grafito-2">
                Las que no entran pasan a la lista de espera, con su puesto.
              </p>
            )}
          </div>
        </section>
      </div>

      <div aria-live="polite" className="mt-4 min-h-12 text-chico text-grafito-2">
        {terminada && estado.verificacion && estado.finProduccion && (
          <p>
            Verificado en la base después de correr: {estado.verificacion.activas} reservas activas,{' '}
            {estado.verificacion.enEspera} en espera, {estado.verificacion.reformersRepetidos} reformers
            repetidos y {estado.verificacion.creditosUsados} créditos descontados. Las {PERSONAS} reservas se
            resolvieron en <span className="tabular">{estado.finProduccion.ms} ms</span>.
          </p>
        )}
      </div>
    </div>
  )
}
