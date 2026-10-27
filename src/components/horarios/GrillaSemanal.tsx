'use client'

import { Tabs } from 'radix-ui'
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import type { ClaseVista } from '@/lib/consultas/horarios'
import { claveDia, diaDelMes, diaSemanaCorto, hora } from '@/lib/tiempo'
import { BloqueClase } from './BloqueClase'

type Props = {
  clases: ClaseVista[]
  /** Hora del servidor: decide qué clases ya terminaron sin depender del reloj del navegador. */
  ahora: string
  /** Lunes de la semana como "2026-10-26": clave para el polling. */
  semana: string
  dias: { clave: string; inicio: string }[]
}

const INTERVALO_MS = 10_000

/** Disponibilidad en tiempo real: consulta los cupos cada 10 s mientras la pestaña está visible. */
function useDisponibilidad(iniciales: ClaseVista[], ahoraInicial: string, semana: string) {
  const [estado, setEstado] = useState({ clases: iniciales, ahora: ahoraInicial })
  useEffect(() => {
    let vigente = true
    const actualizar = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const res = await fetch(`/api/disponibilidad?semana=${semana}`, { cache: 'no-store' })
        if (!res.ok) return
        const datos = (await res.json()) as { clases: ClaseVista[]; ahora: string }
        if (vigente) setEstado(datos)
      } catch {
        // Sin red: se reintenta en el próximo intervalo.
      }
    }
    const id = window.setInterval(actualizar, INTERVALO_MS)
    document.addEventListener('visibilitychange', actualizar)
    return () => {
      vigente = false
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', actualizar)
    }
  }, [semana])
  return estado
}

/** Flechas para moverse entre bloques de la grilla (la tecla Tab sigue recorriéndolos en orden). */
function moverConFlechas(e: KeyboardEvent<HTMLTableElement>) {
  const desde = (e.target as HTMLElement).closest<HTMLElement>('[data-celda]')
  if (!desde) return
  const [fila, col] = desde.dataset.celda!.split(':').map(Number)
  const paso = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] }[e.key]
  if (!paso) return
  const celdas = [...e.currentTarget.querySelectorAll<HTMLElement>('[data-celda]')]
  let [f, c] = [fila, col]
  for (let i = 0; i < 12; i++) {
    f += paso[0]
    c += paso[1]
    const destino = celdas.find((x) => x.dataset.celda === `${f}:${c}`)
    const foco = destino?.querySelector<HTMLElement>('a, [role="group"]')
    if (foco) {
      e.preventDefault()
      foco.focus()
      return
    }
  }
}

export function GrillaSemanal({ clases: iniciales, ahora: ahoraInicial, semana, dias }: Props) {
  const { clases, ahora: ahoraIso } = useDisponibilidad(iniciales, ahoraInicial, semana)
  const ahora = useMemo(() => new Date(ahoraIso), [ahoraIso])
  const hoy = claveDia(ahora)

  const porDia = useMemo(() => {
    const m = new Map<string, ClaseVista[]>()
    for (const c of clases) {
      const k = claveDia(new Date(c.iniciaEn))
      m.set(k, [...(m.get(k) ?? []), c])
    }
    return m
  }, [clases])
  const horarios = useMemo(() => [...new Set(clases.map((c) => hora(new Date(c.iniciaEn))))].sort(), [clases])
  const diaInicial = dias.find((d) => d.clave === hoy)?.clave ?? dias[0]!.clave

  return (
    <>
      {/* Escritorio: la semana completa, filas por horario y columnas por día. */}
      <table
        className="hidden w-full table-fixed border-separate border-spacing-1.5 lg:table"
        onKeyDown={moverConFlechas}
      >
        <caption className="sr-only">
          Clases de la semana por horario y día. Usá las flechas para moverte entre clases.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="w-16">
              <span className="sr-only">Horario</span>
            </th>
            {dias.map((d) => {
              const inicio = new Date(d.inicio)
              const esHoy = d.clave === hoy
              return (
                <th
                  key={d.clave}
                  scope="col"
                  className={`pb-1 text-left text-chico font-semibold ${esHoy ? 'text-eucalipto' : 'text-grafito-2'}`}
                >
                  {diaSemanaCorto(inicio)} <span className="tabular">{diaDelMes(inicio)}</span>
                  {esHoy && <span className="ml-1.5 font-normal">· hoy</span>}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {horarios.map((h, fila) => (
            <tr key={h}>
              <th scope="row" className="pt-2.5 pr-2 text-left align-top text-dato font-semibold tabular">
                {h}
              </th>
              {dias.map((d, col) => {
                const clase = porDia.get(d.clave)?.find((c) => hora(new Date(c.iniciaEn)) === h)
                return (
                  <td key={d.clave} className="align-top" data-celda={`${fila}:${col}`}>
                    {clase && <BloqueClase clase={clase} ahora={ahora} variante="grilla" />}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Móvil y tablet: días como pestañas deslizables y clases en lista. */}
      <Tabs.Root defaultValue={diaInicial} className="lg:hidden">
        <Tabs.List
          aria-label="Días de la semana"
          className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 sm:-mx-8 sm:px-8"
        >
          {dias.map((d) => {
            const inicio = new Date(d.inicio)
            return (
              <Tabs.Trigger
                key={d.clave}
                value={d.clave}
                className="min-h-11 shrink-0 snap-start rounded-full border border-linea bg-superficie px-4 text-chico font-medium data-[state=active]:border-grafito data-[state=active]:bg-grafito data-[state=active]:text-white"
              >
                {diaSemanaCorto(inicio)} <span className="tabular">{diaDelMes(inicio)}</span>
                {d.clave === hoy && <span className="sr-only"> (hoy)</span>}
              </Tabs.Trigger>
            )
          })}
        </Tabs.List>
        {dias.map((d) => {
          const delDia = porDia.get(d.clave) ?? []
          return (
            <Tabs.Content key={d.clave} value={d.clave} className="mt-3 focus-visible:outline-none">
              {delDia.length ? (
                <ul className="space-y-2">
                  {delDia.map((c) => (
                    <li key={c.id}>
                      <BloqueClase clase={c} ahora={ahora} variante="lista" />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-bloque border border-dashed border-linea p-6 text-center text-grafito-2">
                  No hay clases este día. Mirá los otros días de la semana.
                </p>
              )}
            </Tabs.Content>
          )
        })}
      </Tabs.Root>
    </>
  )
}
