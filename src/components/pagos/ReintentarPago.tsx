'use client'

import { useState, useTransition } from 'react'
import { pagarReserva } from '@/app/acciones/reservas'

export function ReintentarPago({ reservaId }: { reservaId: string }) {
  const [enCurso, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <>
      <button
        type="button"
        className="boton boton-principal"
        disabled={enCurso}
        onClick={() =>
          iniciar(async () => {
            setError(null)
            const r = await pagarReserva(reservaId)
            if (!r.ok) setError(r.mensaje)
            else window.location.assign(r.valor.urlPago)
          })
        }
      >
        {enCurso ? 'Abriendo el pago…' : 'Probar con otro medio'}
      </button>
      {error && (
        <p role="alert" className="basis-full text-chico text-error">
          {error}
        </p>
      )}
    </>
  )
}
