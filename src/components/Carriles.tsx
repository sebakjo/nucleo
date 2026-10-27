import { estadoDeCupo } from '@/lib/dominio/reglas'

type Props = {
  cupo: number
  /** Reformers ocupados (incluye el tuyo, si tenés uno). */
  ocupados: number[]
  /** Tu reformer confirmado. */
  mio?: number | null
  /** Tu reformer retenido mientras pagás. */
  retenido?: number | null
  tamano?: 'grilla' | 'grande' | 'chico'
  /** Al confirmar una reserva, tu carril se llena de abajo hacia arriba. */
  animarMio?: boolean
  /** En la reserva, el número de cada reformer debajo del carril. */
  numeros?: boolean
  className?: string
}

const MEDIDAS = {
  chico: 'h-4 w-[7px] rounded-[2px]',
  grilla: 'h-6 w-2.5 rounded-carril',
  grande: 'h-24 w-9 rounded-[5px] sm:h-28 sm:w-10',
}

/**
 * Los 6 carriles de una clase, uno por reformer. Son decorativos para lectores de pantalla: el
 * bloque que los contiene lleva el texto completo ("4 de 6 lugares ocupados").
 */
export function Carriles({
  cupo,
  ocupados,
  mio = null,
  retenido = null,
  tamano = 'grilla',
  animarMio = false,
  numeros = false,
  className = '',
}: Props) {
  const set = new Set(ocupados)
  const estado = estadoDeCupo(set.size, cupo)
  const gap = tamano === 'grande' ? 'gap-2 sm:gap-2.5' : tamano === 'grilla' ? 'gap-1' : 'gap-[3px]'
  return (
    <div className={`flex items-end ${gap} ${className}`} aria-hidden="true">
      {Array.from({ length: cupo }, (_, i) => {
        const n = i + 1
        let clase: string
        if (n === mio) clase = 'border-[1.5px] border-rosa-tinta bg-rosa-tenue'
        else if (n === retenido) clase = 'carril-rayado border-[1.5px] border-dashed border-rosa-tinta'
        else if (set.has(n)) clase = estado === 'completa' ? 'bg-completa-carril' : 'bg-ocupado'
        else if (estado === 'ultimos') clase = 'border-[1.5px] border-ambar bg-ambar-tenue'
        else clase = 'border-[1.5px] border-eucalipto bg-eucalipto-tenue'
        return (
          <div key={n} className="flex flex-col items-center gap-1.5">
            <div className={`relative overflow-hidden ${MEDIDAS[tamano]} ${clase}`}>
              {n === mio && (
                <div className={`absolute inset-0 bg-rosa ${animarMio ? 'carril-llenandose' : ''}`} />
              )}
            </div>
            {numeros && <span className="text-leyenda text-grafito-2 tabular">{n}</span>}
          </div>
        )
      })}
    </div>
  )
}
