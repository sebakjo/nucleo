import Link from 'next/link'
import { Suspense } from 'react'
import { Logo } from '@/components/Logo'
import { salir } from '@/app/acciones/sesion'
import { usuarioActual } from '@/lib/sesion'
import { NavPrincipal } from './EnlaceNav'

async function Cuenta() {
  const u = await usuarioActual()
  if (!u) {
    return (
      <Link href="/entrar" className="boton min-h-10 boton-secundario px-4">
        Entrar
      </Link>
    )
  }
  return (
    <div className="flex items-center gap-3">
      {u.rol === 'admin' && (
        <Link href="/admin" className="text-chico font-medium text-eucalipto hover:underline">
          Panel
        </Link>
      )}
      {u.rol === 'instructor' && (
        <Link href="/instructor" className="text-chico font-medium text-eucalipto hover:underline">
          Mis clases
        </Link>
      )}
      <span className="hidden text-chico text-grafito-2 sm:inline">{u.nombre.split(' ')[0]}</span>
      <form action={salir}>
        <button type="submit" className="boton min-h-10 boton-secundario px-4">
          Salir
        </button>
      </form>
    </div>
  )
}

export function Encabezado() {
  return (
    <header className="border-b border-linea bg-cal">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-8 px-4 sm:px-8">
        <Link href="/" className="flex min-h-14 items-center" aria-label="Núcleo, ir a los horarios">
          <Logo />
        </Link>
        <nav aria-label="Principal" className="order-3 -mx-1 flex w-full gap-5 sm:order-none sm:w-auto">
          <NavPrincipal />
        </nav>
        <div className="ml-auto flex min-h-14 items-center">
          <Suspense fallback={<div className="h-10 w-20 esqueleto" />}>
            <Cuenta />
          </Suspense>
        </div>
      </div>
    </header>
  )
}
