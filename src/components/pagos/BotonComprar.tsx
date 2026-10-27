'use client'

import { useState, useTransition } from 'react'
import { comprar } from '@/app/acciones/reservas'

export function BotonComprar({ productoId, texto }: { productoId: string; texto: string }) {
  const [enCurso, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  return (
    <div>
      <button
        type="button"
        className="boton w-full boton-principal sm:w-auto"
        disabled={enCurso}
        onClick={() =>
          iniciar(async () => {
            setError(null)
            const r = await comprar(productoId)
            if (!r.ok) setError(r.mensaje)
            else window.location.assign(r.valor.urlPago)
          })
        }
      >
        {enCurso ? 'Abriendo el pago…' : texto}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-chico text-error">
          {error}
        </p>
      )}
    </div>
  )
}
