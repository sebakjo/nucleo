import type { Metadata } from 'next'
import { Suspense } from 'react'
import { CuentasDemo } from '@/components/cuenta/CuentasDemo'
import { FormularioEntrar } from '@/components/cuenta/Formularios'
import { modoDemo } from '@/lib/config'
import { rutaSegura } from '@/lib/sesion'

export const metadata: Metadata = {
  title: 'Entrar',
  description: 'Entrá a tu cuenta de Núcleo para reservar clases.',
}

export default function PaginaEntrar({ searchParams }: PageProps<'/entrar'>) {
  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-16">
      <div className="max-w-md">
        <h1 className="text-titulo font-bold">Entrá a tu cuenta</h1>
        <p className="mt-2 text-grafito-2">Para reservar, ver tus créditos y cancelar.</p>
        <div className="mt-8">
          <Suspense fallback={<div className="h-72 esqueleto" />}>
            <ConVolver searchParams={searchParams} vista="formulario" />
          </Suspense>
        </div>
      </div>
      {modoDemo() && (
        <div className="md:pt-14">
          <Suspense fallback={<div className="h-56 esqueleto" />}>
            <ConVolver searchParams={searchParams} vista="demo" />
          </Suspense>
        </div>
      )}
    </div>
  )
}

async function ConVolver({
  searchParams,
  vista,
}: {
  searchParams: PageProps<'/entrar'>['searchParams']
  vista: 'formulario' | 'demo'
}) {
  const sp = await searchParams
  const volver = rutaSegura(typeof sp.volver === 'string' ? sp.volver : null)
  return vista === 'formulario' ? <FormularioEntrar volver={volver} /> : <CuentasDemo volver={volver} />
}
