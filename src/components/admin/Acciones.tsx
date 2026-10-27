'use client'

import { AlertDialog } from 'radix-ui'
import { useEffect, useOptimistic, useState, useTransition } from 'react'
import type { Resultado } from '@/lib/dominio/errores'
import { useContenedorPanel } from './contenedor'

const EVENTO = 'nucleo:aviso'

/** Avisa algo que acaba de pasar, aunque el botón que lo disparó ya no esté en pantalla. */
export function avisar(mensaje: string, tono: 'ok' | 'error' = 'ok') {
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: { mensaje, tono } }))
}

export function Avisos() {
  const [aviso, setAviso] = useState<{ mensaje: string; tono: 'ok' | 'error'; id: number } | null>(null)
  useEffect(() => {
    const escuchar = (e: Event) => {
      const { mensaje, tono } = (e as CustomEvent<{ mensaje: string; tono: 'ok' | 'error' }>).detail
      setAviso({ mensaje, tono, id: Date.now() })
    }
    window.addEventListener(EVENTO, escuchar)
    return () => window.removeEventListener(EVENTO, escuchar)
  }, [])
  useEffect(() => {
    if (!aviso) return
    const t = window.setTimeout(() => setAviso(null), 6000)
    return () => window.clearTimeout(t)
  }, [aviso])
  return (
    <div
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4"
    >
      {aviso && (
        <p
          key={aviso.id}
          className={`pointer-events-auto max-w-lg rounded-boton border px-4 py-3 text-chico font-medium ${
            aviso.tono === 'ok'
              ? 'border-eucalipto/40 bg-superficie text-grafito'
              : 'border-error/50 bg-error-tenue text-error'
          }`}
        >
          {aviso.mensaje}
        </p>
      )}
    </div>
  )
}

type Confirmar = {
  boton: string
  titulo: string
  descripcion: string
  confirmar: string
  exito: string
  accion: () => Promise<Resultado<unknown>>
  peligro?: boolean
  claseBoton?: string
}

/** Acción con confirmación: el diálogo dice la consecuencia antes de hacerla. */
export function ConfirmarAccion({
  boton,
  titulo,
  descripcion,
  confirmar,
  exito,
  accion,
  peligro = true,
  claseBoton,
}: Confirmar) {
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enCurso, iniciar] = useTransition()
  const contenedor = useContenedorPanel()
  const ejecutar = () =>
    iniciar(async () => {
      setError(null)
      const r = await accion()
      if (!r.ok) {
        setError(r.mensaje)
        return
      }
      setAbierto(false)
      avisar(exito)
    })
  return (
    <AlertDialog.Root open={abierto} onOpenChange={setAbierto}>
      <AlertDialog.Trigger asChild>
        <button
          type="button"
          className={
            claseBoton ?? `boton min-h-9 px-3 text-chico ${peligro ? 'boton-peligro' : 'boton-secundario'}`
          }
        >
          {boton}
        </button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal container={contenedor}>
        <AlertDialog.Overlay className="fixed inset-0 z-[70] bg-grafito/40" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-[70] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-bloque border border-linea bg-superficie p-6 text-grafito">
          <AlertDialog.Title className="text-seccion font-semibold">{titulo}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-grafito-2">{descripcion}</AlertDialog.Description>
          {error && (
            <p role="alert" className="mt-3 rounded-boton bg-error-tenue px-3 py-2 text-chico text-error">
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <AlertDialog.Cancel asChild>
              <button type="button" className="boton boton-secundario">
                Volver
              </button>
            </AlertDialog.Cancel>
            <button
              type="button"
              className={`boton ${peligro ? 'boton-peligro' : 'boton-principal'}`}
              onClick={ejecutar}
              disabled={enCurso}
            >
              {enCurso ? 'Un momento…' : confirmar}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}

/** Asistencia con respuesta inmediata: si el servidor la rechaza, vuelve al estado anterior. */
export function BotonAsistencia({
  accion,
  asistio,
  nombre,
}: {
  accion: (asistio: boolean) => Promise<Resultado<null>>
  asistio: boolean
  nombre: string
}) {
  const [optimista, setOptimista] = useOptimistic(asistio)
  const [, iniciar] = useTransition()
  const cambiar = () =>
    iniciar(async () => {
      setOptimista(!optimista)
      const r = await accion(!optimista)
      if (!r.ok) avisar(r.mensaje, 'error')
    })
  return (
    <button
      type="button"
      onClick={cambiar}
      aria-pressed={optimista}
      aria-label={`${nombre} asistió`}
      className={`inline-flex min-h-9 items-center gap-2 rounded-boton border px-3 text-chico font-medium transition-colors ${
        optimista
          ? 'border-eucalipto bg-eucalipto-tenue text-eucalipto'
          : 'border-linea bg-superficie text-grafito-2 hover:border-grafito-2'
      }`}
    >
      <span
        aria-hidden="true"
        className={`grid h-4 w-4 place-items-center rounded-[3px] border ${
          optimista ? 'border-eucalipto bg-eucalipto text-superficie' : 'border-grafito-2'
        }`}
      >
        {optimista && (
          <svg viewBox="0 0 12 12" className="h-3 w-3">
            <path d="m2.5 6.2 2.3 2.3 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        )}
      </span>
      Asistió
    </button>
  )
}

/** Interruptor de activo/pausado (plantillas, instructores). */
export function Interruptor({
  accion,
  activo,
  etiqueta,
  textos = ['Activa', 'Pausada'],
}: {
  accion: (activo: boolean) => Promise<Resultado<null>>
  activo: boolean
  etiqueta: string
  textos?: [string, string]
}) {
  const [optimista, setOptimista] = useOptimistic(activo)
  const [, iniciar] = useTransition()
  const cambiar = () =>
    iniciar(async () => {
      setOptimista(!optimista)
      const r = await accion(!optimista)
      if (!r.ok) avisar(r.mensaje, 'error')
    })
  return (
    <button
      type="button"
      role="switch"
      aria-checked={optimista}
      aria-label={etiqueta}
      onClick={cambiar}
      className="inline-flex min-h-9 items-center gap-2 text-chico font-medium"
    >
      <span
        aria-hidden="true"
        className={`relative inline-block h-5 w-9 shrink-0 rounded-full border transition-colors ${
          optimista ? 'border-eucalipto bg-eucalipto' : 'border-linea bg-cal'
        }`}
      >
        <span
          className={`absolute top-1/2 left-0.5 h-3.5 w-3.5 -translate-y-1/2 rounded-full transition-transform ${
            optimista ? 'translate-x-4 bg-superficie' : 'bg-grafito-2'
          }`}
        />
      </span>
      <span className={optimista ? 'text-grafito' : 'text-grafito-2'}>
        {optimista ? textos[0] : textos[1]}
      </span>
    </button>
  )
}
