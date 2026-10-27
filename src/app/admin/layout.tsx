import Link from 'next/link'
import { Suspense } from 'react'
import { Logo } from '@/components/Logo'
import { Avisos } from '@/components/admin/Acciones'
import { BotonTema } from '@/components/admin/BotonTema'
import { NavPanel } from '@/components/admin/NavPanel'
import { salir } from '@/app/acciones/sesion'
import { usuarioActual } from '@/lib/sesion'

export const metadata = {
  title: { default: 'Panel', template: '%s · Panel · Núcleo' },
  robots: { index: false },
}

async function Cuenta() {
  const u = await usuarioActual()
  if (!u) return null
  return (
    <div className="flex items-center justify-between gap-3 text-chico">
      <span className="min-w-0 truncate text-grafito-2">{u.nombre}</span>
      <form action={salir}>
        <button type="submit" className="font-medium text-eucalipto hover:underline">
          Salir
        </button>
      </form>
    </div>
  )
}

/**
 * Panel del estudio. El tema (claro u oscuro) lo fija antes de pintar un script del layout raíz,
 * con la preferencia guardada o, si no hay, la del sistema.
 */
export default function LayoutPanel({ children }: LayoutProps<'/admin'>) {
  return (
    <div id="panel" className="min-h-dvh bg-cal text-grafito lg:grid lg:grid-cols-[224px_minmax(0,1fr)]">
      <aside className="border-b border-linea bg-superficie lg:sticky lg:top-0 lg:min-h-dvh lg:self-start lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-4 px-4 pt-3 lg:block lg:px-5 lg:pt-6">
          <Link
            href="/admin"
            className="flex min-h-11 items-center gap-2"
            aria-label="Núcleo, panel del estudio"
          >
            <Logo />
            <span className="text-chico text-grafito-2">panel</span>
          </Link>
          <div className="lg:hidden">
            <BotonTema />
          </div>
        </div>
        <nav aria-label="Panel" className="mt-1 lg:mt-6">
          <NavPanel />
        </nav>
        <div className="hidden gap-3 border-t border-linea px-5 py-5 lg:mt-8 lg:grid">
          <BotonTema />
          <Link href="/" className="text-chico font-medium text-eucalipto hover:underline">
            Ver el sitio
          </Link>
          <Suspense>
            <Cuenta />
          </Suspense>
        </div>
      </aside>
      <main id="contenido" className="min-w-0 px-4 py-6 sm:px-8 lg:py-8">
        <div className="mx-auto max-w-[1180px]">{children}</div>
      </main>
      <Avisos />
    </div>
  )
}
