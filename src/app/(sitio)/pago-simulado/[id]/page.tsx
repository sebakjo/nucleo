import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { simularPago } from '@/app/acciones/pago-simulado'
import { pagoDelUsuario } from '@/lib/consultas/pagos'
import { precio } from '@/lib/dinero'
import { proveedorPagos } from '@/lib/pagos'
import { exigirUsuario } from '@/lib/sesion'

export const metadata: Metadata = { title: 'Checkout de prueba', robots: { index: false } }

export default function PaginaPagoSimulado({ params }: PageProps<'/pago-simulado/[id]'>) {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-md esqueleto" />}>
      <Checkout params={params} />
    </Suspense>
  )
}

async function Checkout({ params }: { params: PageProps<'/pago-simulado/[id]'>['params'] }) {
  const { id } = await params
  await connection()
  let simulado = false
  try {
    simulado = proveedorPagos().nombre === 'simulado'
  } catch {
    simulado = false
  }
  if (!simulado) notFound()
  const usuario = await exigirUsuario(`/pago-simulado/${id}`)
  const datos = await pagoDelUsuario(id, usuario.id)
  if (!datos) notFound()
  const { pago, reserva } = datos
  const cerrado = pago.estado === 'aprobado'

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-bloque border border-linea bg-superficie">
        <div className="border-b border-linea p-6">
          <p className="text-chico font-semibold text-grafito-2">Checkout de prueba</p>
          <h1 className="mt-1 text-seccion font-semibold">{pago.descripcion}</h1>
          <p className="mt-3 text-dato-grande font-semibold tabular">{precio(pago.montoArs)}</p>
        </div>
        <div className="p-6">
          <p className="text-chico text-grafito-2">
            Sin credenciales de Mercado Pago, la demo usa este checkout simulado. Elegí cómo termina el pago:
            la app recibe una notificación firmada igual que la de Mercado Pago y consulta el resultado.
          </p>
          {cerrado ? (
            <p className="mt-5">Este pago ya se aprobó.</p>
          ) : (
            <form action={simularPago} className="mt-5 grid gap-2">
              <input type="hidden" name="pagoId" value={pago.id} />
              <button name="resultado" value="aprobado" className="boton boton-principal">
                Aprobar el pago
              </button>
              <button name="resultado" value="pendiente" className="boton boton-secundario">
                Dejarlo en proceso
              </button>
              <button name="resultado" value="rechazado" className="boton boton-peligro">
                Rechazar el pago
              </button>
            </form>
          )}
          <Link
            href={reserva ? `/clase/${reserva.claseId}` : '/packs'}
            className="mt-4 inline-block text-chico text-grafito-2 hover:underline"
          >
            Volver sin pagar
          </Link>
        </div>
      </div>
    </div>
  )
}
