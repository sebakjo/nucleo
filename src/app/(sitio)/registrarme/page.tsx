import type { Metadata } from 'next'
import { Suspense } from 'react'
import { FormularioRegistro } from '@/components/cuenta/Formularios'
import { rutaSegura } from '@/lib/sesion'

export const metadata: Metadata = {
  title: 'Crear cuenta',
  description: 'Creá tu cuenta en Núcleo para reservar clases.',
}

export default function PaginaRegistro({ searchParams }: PageProps<'/registrarme'>) {
  return (
    <div className="max-w-md">
      <h1 className="text-titulo font-bold">Creá tu cuenta</h1>
      <p className="mt-2 text-grafito-2">
        Con tu cuenta reservás, pagás y ves tus créditos desde cualquier dispositivo.
      </p>
      <div className="mt-8">
        <Suspense fallback={<div className="h-80 esqueleto" />}>
          <Formulario searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  )
}

async function Formulario({ searchParams }: { searchParams: PageProps<'/registrarme'>['searchParams'] }) {
  const sp = await searchParams
  return <FormularioRegistro volver={rutaSegura(typeof sp.volver === 'string' ? sp.volver : null)} />
}
