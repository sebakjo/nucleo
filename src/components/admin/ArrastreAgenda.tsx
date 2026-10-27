'use client'

import { useRef, useState, useTransition, type ReactNode } from 'react'
import { moverClase } from '@/app/acciones/admin'
import { avisar } from './Acciones'

/** Tipo propio en el dataTransfer: así solo se aceptan clases de esta agenda, no texto ni enlaces. */
const TIPO = 'application/x-nucleo-clase'

/** Una clase que se puede arrastrar a otro horario. Sin arrastrar, se mueve desde el panel lateral. */
export function Arrastrable({ claseId, children }: { claseId: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div
      ref={ref}
      className="cursor-grab active:cursor-grabbing"
      onDragStart={(e) => {
        e.dataTransfer.setData(TIPO, claseId)
        e.dataTransfer.effectAllowed = 'move'
        if (ref.current) e.dataTransfer.setDragImage(ref.current, 24, 24)
        document.documentElement.dataset.arrastrando = ''
      }}
      onDragEnd={() => delete document.documentElement.dataset.arrastrando}
    >
      {children}
    </div>
  )
}

/** Un horario libre de la agenda donde se puede soltar una clase. */
export function Destino({ inicio, etiqueta }: { inicio: string; etiqueta: string }) {
  const [encima, setEncima] = useState(false)
  const [moviendo, iniciar] = useTransition()
  return (
    <div
      data-destino=""
      title={etiqueta}
      className={`h-16 rounded-bloque border border-dashed transition-colors ${
        encima ? 'border-eucalipto bg-eucalipto-tenue' : 'border-transparent'
      }`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(TIPO)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setEncima(true)
      }}
      onDragLeave={() => setEncima(false)}
      onDrop={(e) => {
        e.preventDefault()
        setEncima(false)
        delete document.documentElement.dataset.arrastrando
        const claseId = e.dataTransfer.getData(TIPO)
        if (!claseId) return
        iniciar(async () => {
          const r = await moverClase(claseId, inicio)
          avisar(r.ok ? r.valor : r.mensaje, r.ok ? 'ok' : 'error')
        })
      }}
    >
      {moviendo && (
        <span className="grid h-full place-items-center text-leyenda text-grafito-2">Moviendo…</span>
      )}
    </div>
  )
}
