import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { Reserva } from '@/components/reserva/Reserva'
import { detalleParaReservar } from '@/lib/consultas/horarios'
import { usuarioActual } from '@/lib/sesion'

export const metadata: Metadata = {
  title: 'Reservar clase',
  description: 'Confirmá tu clase de pilates reformer: elegí si usás un crédito o pagás la clase suelta.',
}

export default function PaginaClase({ params }: PageProps<'/clase/[id]'>) {
  return (
    <Suspense fallback={<EsqueletoReserva />}>
      <Detalle params={params} />
    </Suspense>
  )
}

async function Detalle({ params }: { params: PageProps<'/clase/[id]'>['params'] }) {
  const { id } = await params
  await connection()
  const ahora = new Date()
  const usuario = await usuarioActual()
  const detalle = await detalleParaReservar(id, usuario?.id ?? null, ahora)
  if (!detalle) notFound()
  return (
    <Reserva
      {...detalle}
      ahora={ahora.toISOString()}
      nombreUsuario={usuario?.nombre ?? null}
      volver={`/clase/${id}`}
    />
  )
}

function EsqueletoReserva() {
  return (
    <div
      className="grid gap-8 lg:grid-cols-[1fr_440px] lg:gap-12"
      aria-busy="true"
      aria-label="Cargando la clase"
    >
      <div>
        <div className="h-5 w-64 max-w-full esqueleto" />
        <div className="mt-8 h-5 w-48 esqueleto" />
        <div className="mt-2 h-9 w-56 esqueleto" />
        <div className="mt-3 h-6 w-72 max-w-full esqueleto" />
        <div className="mt-3 h-12 w-full max-w-md esqueleto" />
        <div className="mt-8 flex gap-2.5">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-28 w-10 esqueleto" />
          ))}
        </div>
      </div>
      <div className="lg:pt-10">
        <div className="h-[380px] w-full esqueleto" />
      </div>
    </div>
  )
}
