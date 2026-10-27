'use client'

import { useSyncExternalStore } from 'react'

const CLAVE = 'nucleo-tema'
const EVENTO = 'nucleo:tema'
type Tema = 'claro' | 'oscuro'

/**
 * Corre en <head> antes de pintar (ver el layout raíz): lee la preferencia guardada o la del sistema
 * y la deja en <html data-tema-panel>. El CSS solo la aplica dentro del panel.
 */
export const SCRIPT_TEMA = `try{var t=localStorage.getItem('${CLAVE}');if(t!=='claro'&&t!=='oscuro')t=matchMedia('(prefers-color-scheme: dark)').matches?'oscuro':'claro';document.documentElement.dataset.temaPanel=t}catch(e){}`

function suscribir(avisar: () => void) {
  window.addEventListener(EVENTO, avisar)
  return () => window.removeEventListener(EVENTO, avisar)
}

const leer = () => (document.documentElement.dataset.temaPanel as Tema | undefined) ?? 'claro'

export function BotonTema() {
  const tema = useSyncExternalStore(suscribir, leer, () => null)

  const cambiar = () => {
    const nuevo: Tema = tema === 'oscuro' ? 'claro' : 'oscuro'
    document.documentElement.dataset.temaPanel = nuevo
    window.dispatchEvent(new Event(EVENTO))
    try {
      localStorage.setItem(CLAVE, nuevo)
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={cambiar}
      aria-pressed={tema === 'oscuro'}
      className="inline-flex min-h-10 items-center gap-2.5 text-chico font-medium text-grafito"
    >
      <span
        aria-hidden="true"
        className={`relative inline-block h-5 w-9 rounded-full border transition-colors ${
          tema === 'oscuro' ? 'border-eucalipto bg-eucalipto' : 'border-linea bg-cal'
        }`}
      >
        <span
          className={`absolute top-1/2 left-0.5 h-3.5 w-3.5 -translate-y-1/2 rounded-full transition-transform ${
            tema === 'oscuro' ? 'translate-x-4 bg-cal' : 'bg-grafito-2'
          }`}
        />
      </span>
      Modo oscuro
    </button>
  )
}
