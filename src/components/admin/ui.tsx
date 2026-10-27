import type { ReactNode } from 'react'

export function EncabezadoPanel({
  titulo,
  descripcion,
  children,
}: {
  titulo: string
  descripcion?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-titulo font-bold">{titulo}</h1>
        {descripcion && <p className="mt-1 max-w-[70ch] text-grafito-2">{descripcion}</p>}
      </div>
      {children}
    </div>
  )
}

export type Tono = 'bien' | 'atencion' | 'error' | 'neutro' | 'rosa'

const TONOS: Record<Tono, string> = {
  bien: 'bg-eucalipto-tenue text-eucalipto',
  atencion: 'bg-ambar-tenue text-ambar-tinta',
  error: 'bg-error-tenue text-error',
  neutro: 'bg-cal text-grafito-2 border border-linea',
  rosa: 'bg-rosa-tenue text-rosa-tinta',
}

/** Estado como texto con fondo: el color acompaña, nunca es la única señal. */
export function Insignia({ tono, children }: { tono: Tono; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-[4px] px-2 py-0.5 text-leyenda font-semibold whitespace-nowrap ${TONOS[tono]}`}
    >
      {children}
    </span>
  )
}

/** Contenedor de tabla con desplazamiento horizontal en pantallas chicas. */
export function MarcoTabla({ children, etiqueta }: { children: ReactNode; etiqueta: string }) {
  return (
    <div
      className="-mx-4 overflow-x-auto border-y border-linea bg-superficie sm:mx-0 sm:rounded-bloque sm:border"
      role="region"
      aria-label={etiqueta}
      tabIndex={0}
    >
      {children}
    </div>
  )
}

export const th = 'px-3 py-2.5 text-left text-leyenda font-semibold text-grafito-2 whitespace-nowrap'
export const td = 'px-3 py-2.5 align-top text-chico'
export const fila = 'border-t border-linea'

export function Vacio({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-bloque border border-dashed border-linea p-6 text-center text-chico text-grafito-2">
      {children}
    </p>
  )
}

export function EsqueletoPanel() {
  return (
    <div aria-hidden="true">
      <div className="h-9 w-48 esqueleto" />
      <div className="mt-3 h-5 w-80 max-w-full esqueleto" />
      <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 esqueleto" />
        ))}
      </div>
      <div className="mt-6 h-96 esqueleto" />
    </div>
  )
}

/** Iniciales para el avatar de instructores (sin fotos de personas reales). */
export function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}
