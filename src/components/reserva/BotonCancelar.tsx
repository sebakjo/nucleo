'use client'

import { AlertDialog } from 'radix-ui'
import { useState, useTransition } from 'react'
import { cancelar } from '@/app/acciones/reservas'
import { evaluarCancelacion, HORAS_CANCELACION_SIN_COSTO } from '@/lib/dominio/reglas'
import { diaSemana, hora } from '@/lib/tiempo'

type Props = {
  reservaId: string
  iniciaEn: string
  tipo: string
  /** Una reserva pendiente de pago se cancela sin consecuencias: solo libera el lugar. */
  pendiente?: boolean
  pagadaSuelta?: boolean
  onCancelada?: (mensaje: string) => void
  className?: string
}

/** Cancelar con confirmación: antes de confirmar dice si recuperás el crédito o si se pierde. */
export function BotonCancelar({
  reservaId,
  iniciaEn,
  tipo,
  pendiente,
  pagadaSuelta,
  onCancelada,
  className,
}: Props) {
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enCurso, iniciar] = useTransition()
  const inicio = new Date(iniciaEn)
  const evaluacion = evaluarCancelacion(inicio, new Date())
  const sinCosto = evaluacion.permitida && evaluacion.sinCosto
  const cuando = `${diaSemana(inicio)} ${hora(inicio)}`

  const consecuencia = pendiente
    ? 'Liberás el lugar que tenías guardado. No se te cobra nada.'
    : sinCosto
      ? pagadaSuelta
        ? `Faltan más de ${HORAS_CANCELACION_SIN_COSTO} horas: te damos un crédito para otra clase.`
        : `Faltan más de ${HORAS_CANCELACION_SIN_COSTO} horas: te devolvemos el crédito.`
      : `Faltan menos de ${HORAS_CANCELACION_SIN_COSTO} horas: si cancelás, el crédito se pierde. Liberás el lugar para otra persona.`

  const confirmar = () =>
    iniciar(async () => {
      setError(null)
      const r = await cancelar(reservaId)
      if (!r.ok) {
        setError(r.mensaje)
        return
      }
      setAbierto(false)
      const mensaje =
        r.valor.tipo === 'liberada'
          ? `Liberaste el lugar del ${cuando}.`
          : r.valor.creditoDevuelto
            ? `Cancelaste tu clase del ${cuando}. ${pagadaSuelta ? 'Te dimos un crédito' : 'Te devolvimos el crédito'}.`
            : `Cancelaste tu clase del ${cuando}. El crédito no se devuelve.`
      onCancelada?.(mensaje)
    })

  return (
    <AlertDialog.Root open={abierto} onOpenChange={setAbierto}>
      <AlertDialog.Trigger asChild>
        <button type="button" className={className ?? 'boton boton-peligro'}>
          {pendiente ? 'Liberar el lugar' : 'Cancelar reserva'}
        </button>
      </AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-grafito/40" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-bloque border border-linea bg-superficie p-6 text-grafito">
          <AlertDialog.Title className="text-seccion font-semibold">
            {pendiente ? `¿Liberar el lugar del ${cuando}?` : `¿Cancelar ${tipo} del ${cuando}?`}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-grafito-2">{consecuencia}</AlertDialog.Description>
          {error && (
            <p role="alert" className="mt-3 rounded-boton bg-error-tenue px-3 py-2 text-chico text-error">
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <AlertDialog.Cancel asChild>
              <button type="button" className="boton boton-secundario">
                Volver
              </button>
            </AlertDialog.Cancel>
            <button type="button" className="boton boton-peligro" onClick={confirmar} disabled={enCurso}>
              {enCurso ? 'Cancelando…' : pendiente ? 'Liberar el lugar' : 'Cancelar reserva'}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
