import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { Refrescar } from '@/components/pagos/Refrescar'
import { ReintentarPago } from '@/components/pagos/ReintentarPago'
import { db } from '@/db'
import { pagoDelUsuario } from '@/lib/consultas/pagos'
import { precio } from '@/lib/dinero'
import { sincronizarPago } from '@/lib/dominio/pagos'
import { despacharEmails } from '@/lib/email/despachar'
import { despuesDeResponder } from '@/lib/despues'
import { proveedorPagos } from '@/lib/pagos'
import { exigirUsuario } from '@/lib/sesion'
import { diaSemana, diaYMes, fechaLarga, hora } from '@/lib/tiempo'

export const metadata: Metadata = { title: 'Tu pago', robots: { index: false } }

export default function PaginaRetornoPago({ params, searchParams }: PageProps<'/pago/[id]'>) {
  return (
    <Suspense fallback={<div className="h-72 max-w-2xl esqueleto" aria-label="Consultando el pago" />}>
      <Retorno params={params} searchParams={searchParams} />
    </Suspense>
  )
}

const MOTIVOS_RECHAZO: Record<string, string> = {
  cc_rejected_insufficient_amount: 'La tarjeta no tiene fondos suficientes.',
  cc_rejected_bad_filled_security_code: 'El código de seguridad no es correcto.',
  cc_rejected_bad_filled_date: 'La fecha de vencimiento no es correcta.',
  cc_rejected_bad_filled_card_number: 'El número de tarjeta no es correcto.',
  cc_rejected_call_for_authorize: 'Tu banco pidió autorizar el pago. Llamalo o probá con otra tarjeta.',
  cc_rejected_high_risk: 'Mercado Pago rechazó el pago por seguridad.',
}

/** Un carril grande que resume el estado: lleno (aprobado), rayado (en proceso) o vacío (rechazado). */
function CarrilEstado({ estado }: { estado: 'aprobado' | 'proceso' | 'rechazado' }) {
  const clase =
    estado === 'aprobado'
      ? 'border-rosa-tinta bg-rosa'
      : estado === 'proceso'
        ? 'carril-rayado border-dashed border-rosa-tinta'
        : 'border-error bg-superficie'
  return <div className={`h-28 w-10 shrink-0 rounded-[5px] border-[1.5px] ${clase}`} aria-hidden="true" />
}

async function Retorno({
  params,
  searchParams,
}: {
  params: PageProps<'/pago/[id]'>['params']
  searchParams: PageProps<'/pago/[id]'>['searchParams']
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams])
  await connection()
  const usuario = await exigirUsuario(`/pago/${id}`)
  let datos = await pagoDelUsuario(id, usuario.id)
  if (!datos) notFound()

  // Al volver de Mercado Pago, se consulta el pago a la API (nunca se confía en el ?status= de la URL).
  const idExterno = typeof sp.payment_id === 'string' ? sp.payment_id : null
  if (idExterno && datos.pago.estado !== 'aprobado') {
    try {
      await sincronizarPago(db, proveedorPagos(), idExterno, new Date())
      despuesDeResponder(() => despacharEmails(db))
      datos = (await pagoDelUsuario(id, usuario.id))!
    } catch (e) {
      console.error('[retorno de pago]', e)
    }
  }

  const { pago, reserva, pack } = datos
  const ahora = new Date()
  const enProceso = pago.estado === 'pendiente' || pago.estado === 'en_proceso'
  const rechazado = pago.estado === 'rechazado' || pago.estado === 'cancelado'
  const cuando = reserva ? `${diaSemana(reserva.iniciaEn)} ${hora(reserva.iniciaEn)}` : ''
  const sigueRetenida =
    reserva?.estado === 'pendiente_pago' && reserva.retenidaHasta !== null && reserva.retenidaHasta > ahora

  let titulo: string
  let detalle: string
  let carril: 'aprobado' | 'proceso' | 'rechazado'
  let acciones: React.ReactNode

  if (pago.estado === 'aprobado' && pago.tipo === 'pack' && pack) {
    carril = 'aprobado'
    titulo = `Compraste el ${pack.nombre.toLowerCase()}`
    detalle = `Tenés ${pack.creditosTotales} créditos para usar hasta el ${pack.venceEn ? diaYMes(pack.venceEn) : ''}.`
    acciones = (
      <Link href="/" className="boton boton-principal">
        Reservar una clase
      </Link>
    )
  } else if (
    pago.estado === 'aprobado' &&
    reserva &&
    (reserva.estado === 'confirmada' || reserva.estado === 'asistio')
  ) {
    carril = 'aprobado'
    titulo = 'Pagaste y reservaste'
    detalle = `${fechaLarga(reserva.iniciaEn)}, ${hora(reserva.iniciaEn)}: ${reserva.tipo} con ${reserva.instructor}. Tu lugar es el reformer ${reserva.reformer}.`
    acciones = (
      <>
        <Link href="/mis-reservas" className="boton boton-principal">
          Ver mis reservas
        </Link>
        <Link href="/" className="boton boton-secundario">
          Reservar otra clase
        </Link>
      </>
    )
  } else if (pago.estado === 'aprobado' && reserva) {
    carril = 'aprobado'
    titulo = 'Tu pago se acreditó, pero el lugar ya no estaba'
    detalle = `El pago de la clase del ${cuando} llegó después de que venció la reserva y la clase se llenó. Te dimos un crédito de 30 días para cualquier otra clase.`
    acciones = (
      <Link href="/" className="boton boton-principal">
        Usar mi crédito
      </Link>
    )
  } else if (enProceso) {
    carril = 'proceso'
    titulo = 'Tu pago está en proceso'
    detalle = reserva
      ? sigueRetenida
        ? `Te guardamos el reformer ${reserva.reformer} del ${cuando} hasta las ${hora(reserva.retenidaHasta!)}. Esta pantalla se actualiza sola cuando Mercado Pago confirme.`
        : 'Cuando Mercado Pago confirme el pago, te avisamos por email. Si el lugar ya no está, te damos un crédito.'
      : 'Cuando Mercado Pago lo confirme, los créditos aparecen en tu cuenta y te avisamos por email.'
    acciones = (
      <>
        <Refrescar />
        <Link href="/mis-reservas" className="boton boton-secundario">
          Ver mis reservas
        </Link>
      </>
    )
  } else {
    carril = 'rechazado'
    titulo = rechazado ? 'El pago fue rechazado' : 'No pudimos confirmar el pago'
    detalle =
      (MOTIVOS_RECHAZO[pago.detalleEstado ?? ''] ?? 'Mercado Pago no aprobó el pago.') +
      (reserva
        ? sigueRetenida
          ? ` Tu lugar sigue guardado hasta las ${hora(reserva.retenidaHasta!)}: probá con otro medio de pago.`
          : ' El lugar se liberó. Si la clase sigue con lugar, podés volver a reservar.'
        : ' No se cobró nada.')
    acciones = (
      <>
        {reserva && sigueRetenida && <ReintentarPago reservaId={reserva.id} />}
        {reserva && !sigueRetenida && (
          <Link href={`/clase/${reserva.claseId}`} className="boton boton-principal">
            Volver a la clase
          </Link>
        )}
        {pack && (
          <Link href="/packs" className="boton boton-principal">
            Volver a los packs
          </Link>
        )}
      </>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="flex gap-6">
        <CarrilEstado estado={carril} />
        <div>
          <h1 className="text-titulo font-bold" role="status">
            {titulo}
          </h1>
          <p className="mt-2 text-grafito-2">{detalle}</p>
          <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-chico">
            <dt className="text-grafito-2">Concepto</dt>
            <dd>{pago.descripcion}</dd>
            <dt className="text-grafito-2">Monto</dt>
            <dd className="tabular">{precio(pago.montoArs)}</dd>
            {pago.idExterno && (
              <>
                <dt className="text-grafito-2">Operación</dt>
                <dd className="tabular">{pago.idExterno}</dd>
              </>
            )}
          </dl>
          <div className="mt-6 flex flex-wrap gap-3">{acciones}</div>
        </div>
      </div>
    </div>
  )
}
