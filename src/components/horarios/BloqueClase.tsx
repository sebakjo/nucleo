import Link from 'next/link'
import { Carriles } from '@/components/Carriles'
import type { ClaseVista } from '@/lib/consultas/horarios'
import { estadoDeCupo } from '@/lib/dominio/reglas'
import { diaDelMes, diaSemana, hora } from '@/lib/tiempo'

export type EstadoBloque = 'libre' | 'ultimos' | 'completa' | 'mia' | 'pendiente' | 'pasada' | 'cancelada'

export function estadoDelBloque(c: ClaseVista, ahora: Date): EstadoBloque {
  if (c.cancelada) return 'cancelada'
  if (new Date(c.iniciaEn) <= ahora) return 'pasada'
  if (c.mia?.tipo === 'reservada') return 'mia'
  if (c.mia?.tipo === 'pendiente') return 'pendiente'
  return estadoDeCupo(c.reformers.length, c.cupo)
}

const FONDO: Record<EstadoBloque, string> = {
  libre: 'bg-superficie border-linea hover:border-eucalipto',
  ultimos: 'bg-ambar-tenue border-ambar/70 hover:border-ambar-tinta',
  completa: 'bg-completa border-completa text-sobre-completa',
  mia: 'bg-rosa-tenue border-rosa-tinta/50 hover:border-rosa-tinta',
  pendiente: 'bg-rosa-tenue border-dashed border-rosa-tinta hover:border-solid',
  pasada: 'bg-transparent border-linea/70 text-grafito-2',
  cancelada: 'bg-transparent border-dashed border-linea text-grafito-2',
}

function nota(c: ClaseVista, estado: EstadoBloque): string {
  const libres = c.cupo - c.reformers.length
  switch (estado) {
    case 'mia':
      return c.mia?.tipo === 'reservada' ? `tu reformer ${c.mia.reformer}` : 'tu reserva'
    case 'pendiente':
      return 'pago pendiente'
    case 'completa':
      return c.mia?.tipo === 'espera' ? `en espera, ${c.mia.puesto}.º` : 'completa'
    case 'pasada':
      return 'terminó'
    case 'cancelada':
      return 'cancelada'
    case 'ultimos':
      return libres === 1 ? 'queda 1' : `quedan ${libres}`
    default:
      return `${libres} libres`
  }
}

/** Texto para lectores de pantalla: todo lo que los carriles muestran con color. */
export function descripcionAccesible(c: ClaseVista, estado: EstadoBloque): string {
  const inicio = new Date(c.iniciaEn)
  const base = `${diaSemana(inicio)} ${diaDelMes(inicio)}, ${hora(inicio)}, ${c.tipo} con ${c.instructor}, ${c.reformers.length} de ${c.cupo} lugares ocupados`
  const extra: Record<EstadoBloque, string> = {
    libre: '',
    ultimos: ', últimos lugares',
    completa:
      c.mia?.tipo === 'espera'
        ? `, completa, estás en el puesto ${c.mia.puesto} de la lista de espera`
        : ', completa',
    mia: ', tenés una reserva',
    pendiente: ', tu reserva está pendiente de pago',
    pasada: ', ya terminó',
    cancelada: ', cancelada',
  }
  return base + extra[estado]
}

type Props = { clase: ClaseVista; ahora: Date; variante: 'grilla' | 'lista' }

export function BloqueClase({ clase: c, ahora, variante }: Props) {
  const estado = estadoDelBloque(c, ahora)
  const inicio = new Date(c.iniciaEn)
  const interactivo = estado !== 'pasada' && estado !== 'cancelada'
  const primerNombre = c.instructor.split(' ')[0]
  const mio = c.mia?.tipo === 'reservada' ? c.mia.reformer : null
  const retenido = c.mia?.tipo === 'pendiente' ? c.mia.reformer : null
  const textoSecundario = estado === 'completa' ? 'text-sobre-completa/75' : 'text-grafito-2'

  const contenido =
    variante === 'grilla' ? (
      <>
        <span className={`block text-chico font-semibold ${estado === 'cancelada' ? 'line-through' : ''}`}>
          {c.tipo}
        </span>
        <span className={`mt-0.5 flex items-baseline justify-between gap-2 text-leyenda ${textoSecundario}`}>
          <span className="min-w-0 truncate">{primerNombre}</span>
          <span className="shrink-0 text-right">{nota(c, estado)}</span>
        </span>
        <span className="mt-2 flex items-end justify-between gap-2">
          <Carriles cupo={c.cupo} ocupados={c.reformers} mio={mio} retenido={retenido} />
          <span className="text-leyenda font-semibold tabular">
            {c.reformers.length}/{c.cupo}
          </span>
        </span>
      </>
    ) : (
      <span className="flex items-center gap-4">
        <span className="w-14 shrink-0 text-dato font-semibold tabular">{hora(inicio)}</span>
        <span className="min-w-0 flex-1">
          <span className={`block font-semibold ${estado === 'cancelada' ? 'line-through' : ''}`}>
            {c.tipo}
          </span>
          <span className={`block text-chico ${textoSecundario}`}>
            {c.instructor} · {c.nivel}
          </span>
          <span className="mt-2 flex items-center gap-3">
            <Carriles cupo={c.cupo} ocupados={c.reformers} mio={mio} retenido={retenido} />
            <span className={`text-chico ${textoSecundario}`}>{nota(c, estado)}</span>
          </span>
        </span>
      </span>
    )

  const clases = `block w-full rounded-bloque border p-2.5 text-left transition-colors ${FONDO[estado]} ${
    variante === 'lista' ? 'p-4' : ''
  }`
  const etiqueta = descripcionAccesible(c, estado)

  if (!interactivo) {
    return (
      <div className={`${clases} opacity-60 grayscale`} role="group" aria-label={etiqueta} tabIndex={-1}>
        {contenido}
      </div>
    )
  }
  return (
    <Link href={`/clase/${c.id}`} className={clases} aria-label={etiqueta} prefetch={false}>
      {contenido}
    </Link>
  )
}
