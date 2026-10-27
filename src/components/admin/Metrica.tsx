import type { ReactNode } from 'react'

/** Una cifra con su etiqueta. La comparación va en texto, sin flechas ni colores de "bien/mal". */
export function Metrica({
  etiqueta,
  valor,
  detalle,
  grande = false,
}: {
  etiqueta: string
  valor: ReactNode
  detalle?: ReactNode
  grande?: boolean
}) {
  return (
    <div className="min-w-0 rounded-bloque border border-linea bg-superficie px-4 py-3.5">
      <p className="text-chico text-grafito-2">{etiqueta}</p>
      <p
        className={`mt-1 font-semibold tabular ${grande ? 'text-[2.75rem] leading-[3rem] tracking-[-0.02em]' : 'text-dato'}`}
      >
        {valor}
      </p>
      {detalle && <p className="mt-1 text-leyenda text-grafito-2">{detalle}</p>}
    </div>
  )
}

export function porcentaje(parte: number, total: number): number {
  return total > 0 ? Math.round((parte / total) * 100) : 0
}
