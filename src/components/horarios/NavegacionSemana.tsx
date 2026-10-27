'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { KeyboardEvent } from 'react'

type Props = { anterior: string; siguiente: string; estaSemana: boolean; base?: string }

const flecha = (dir: 'izq' | 'der') => (
  <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
    <path
      d={dir === 'izq' ? 'M10 3 5 8l5 5' : 'm6 3 5 5-5 5'}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

/** Semana anterior y siguiente. Con el foco en estos controles, ← y → también cambian de semana. */
export function NavegacionSemana({ anterior, siguiente, estaSemana, base = '/' }: Props) {
  const router = useRouter()
  const url = (s: string | null) => (s ? `${base}?semana=${s}` : base)
  const teclas = (e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') router.push(url(anterior))
    if (e.key === 'ArrowRight') router.push(url(siguiente))
  }
  return (
    <div className="flex items-center gap-2" onKeyDown={teclas} role="group" aria-label="Cambiar de semana">
      <Link href={url(anterior)} className="boton w-11 boton-secundario px-0" aria-label="Semana anterior">
        {flecha('izq')}
      </Link>
      <Link
        href={base}
        className="boton boton-secundario px-4"
        aria-current={estaSemana ? 'date' : undefined}
        aria-disabled={estaSemana}
      >
        Esta semana
      </Link>
      <Link href={url(siguiente)} className="boton w-11 boton-secundario px-0" aria-label="Semana siguiente">
        {flecha('der')}
      </Link>
    </div>
  )
}
