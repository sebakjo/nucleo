'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Suspense } from 'react'

const ENLACES = [
  { href: '/', texto: 'Horarios' },
  { href: '/packs', texto: 'Packs' },
  { href: '/mis-reservas', texto: 'Mis reservas' },
]

function Enlace({ href, texto, activo }: { href: string; texto: string; activo: boolean }) {
  return (
    <Link
      href={href}
      aria-current={activo ? 'page' : undefined}
      className={`inline-flex min-h-11 items-center border-b-2 px-1 text-chico font-medium transition-colors ${
        activo ? 'border-eucalipto text-grafito' : 'border-transparent text-grafito-2 hover:text-grafito'
      }`}
    >
      {texto}
    </Link>
  )
}

function ConRuta() {
  const ruta = usePathname()
  const activo = (href: string) =>
    href === '/' ? ruta === '/' || ruta.startsWith('/clase') : ruta.startsWith(href)
  return ENLACES.map((e) => <Enlace key={e.href} {...e} activo={activo(e.href)} />)
}

/** La ruta actual solo se conoce al pedir la página: mientras tanto, los mismos enlaces sin marcar. */
export function NavPrincipal() {
  return (
    <Suspense
      fallback={ENLACES.map((e) => (
        <Enlace key={e.href} {...e} activo={false} />
      ))}
    >
      <ConRuta />
    </Suspense>
  )
}
