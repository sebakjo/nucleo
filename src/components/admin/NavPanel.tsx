'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Suspense } from 'react'

const SECCIONES = [
  { href: '/admin', texto: 'Agenda' },
  { href: '/admin/plantillas', texto: 'Plantillas' },
  { href: '/admin/instructores', texto: 'Instructores' },
  { href: '/admin/alumnos', texto: 'Alumnos' },
  { href: '/admin/pagos', texto: 'Pagos' },
  { href: '/admin/metricas', texto: 'Métricas' },
  { href: '/admin/precios', texto: 'Precios' },
  { href: '/admin/mensajes', texto: 'Mensajes' },
]

function Enlaces({ ruta }: { ruta: string | null }) {
  return (
    <ul className="flex gap-1 overflow-x-auto px-3 pb-2 lg:grid lg:gap-0.5 lg:overflow-visible lg:px-3 lg:pb-0">
      {SECCIONES.map((s) => {
        const activo = ruta !== null && (s.href === '/admin' ? ruta === '/admin' : ruta.startsWith(s.href))
        return (
          <li key={s.href} className="shrink-0">
            <Link
              href={s.href}
              aria-current={activo ? 'page' : undefined}
              className={`flex min-h-10 items-center rounded-boton px-3 text-chico font-medium transition-colors ${
                activo ? 'bg-eucalipto-tenue text-grafito' : 'text-grafito-2 hover:bg-cal hover:text-grafito'
              }`}
            >
              {s.texto}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

function ConRuta() {
  return <Enlaces ruta={usePathname()} />
}

export function NavPanel() {
  return (
    <Suspense fallback={<Enlaces ruta={null} />}>
      <ConRuta />
    </Suspense>
  )
}
