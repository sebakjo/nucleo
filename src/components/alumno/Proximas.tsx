'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import { pagarReserva, salirDeLaLista } from '@/app/acciones/reservas'
import { BotonCancelar } from '@/components/reserva/BotonCancelar'
import { CuentaRegresiva } from '@/components/reserva/CuentaRegresiva'
import { precio } from '@/lib/dinero'
import { evaluarCancelacion, limiteCancelacionSinCosto } from '@/lib/dominio/reglas'
import { diaSemana, fechaCorta, hora } from '@/lib/tiempo'

type Proxima = {
  id: string
  estado: string
  medio: 'credito' | 'pago'
  reformer: number
  retenidaHasta: string | null
  precioArs: number | null
  claseId: string
  iniciaEn: string
  tipo: string
  instructor: string
}
type Espera = {
  id: string
  puesto: number
  claseId: string
  iniciaEn: string
  tipo: string
  instructor: string
}

function Fecha({ iso }: { iso: string }) {
  const d = new Date(iso)
  return (
    <div className="w-24 shrink-0">
      <p className="text-chico text-grafito-2">{fechaCorta(d)}</p>
      <p className="text-dato font-semibold tabular">{hora(d)}</p>
    </div>
  )
}

export function Proximas({
  proximas,
  espera,
  ahora,
}: {
  proximas: Proxima[]
  espera: Espera[]
  ahora: string
}) {
  const [aviso, setAviso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [enCurso, iniciar] = useTransition()

  const pagar = (id: string) =>
    iniciar(async () => {
      setError(null)
      const r = await pagarReserva(id)
      if (!r.ok) setError(r.mensaje)
      else window.location.assign(r.valor.urlPago)
    })
  const salir = (e: Espera) =>
    iniciar(async () => {
      setError(null)
      const r = await salirDeLaLista(e.id)
      if (!r.ok) setError(r.mensaje)
      else
        setAviso(
          `Saliste de la lista de espera del ${diaSemana(new Date(e.iniciaEn))} ${hora(new Date(e.iniciaEn))}.`,
        )
    })

  return (
    <>
      <div aria-live="polite">
        {aviso && (
          <p
            role="status"
            className="mb-4 rounded-boton border border-linea bg-superficie px-4 py-3 text-chico"
          >
            {aviso}
          </p>
        )}
        {error && (
          <p role="alert" className="mb-4 rounded-boton bg-error-tenue px-4 py-3 text-chico text-error">
            {error}
          </p>
        )}
      </div>

      <section aria-labelledby="titulo-proximas">
        <h2 id="titulo-proximas" className="text-seccion font-semibold">
          Próximas clases
        </h2>
        {proximas.length === 0 ? (
          <div className="mt-3 rounded-bloque border border-dashed border-linea p-6">
            <p className="text-grafito-2">
              Todavía no reservaste ninguna clase. Elegí un horario de la semana.
            </p>
            <Link href="/" className="mt-4 boton boton-principal">
              Ver horarios
            </Link>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-linea rounded-bloque border border-linea bg-superficie">
            {proximas.map((r) => {
              const inicio = new Date(r.iniciaEn)
              const pendiente = r.estado === 'pendiente_pago'
              const ev = evaluarCancelacion(inicio, new Date(ahora))
              const limite = limiteCancelacionSinCosto(inicio)
              return (
                <li
                  key={r.id}
                  className={`flex flex-wrap items-center gap-x-6 gap-y-3 p-4 ${pendiente ? 'bg-rosa-tenue' : ''}`}
                >
                  <Fecha iso={r.iniciaEn} />
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="font-semibold">
                      <Link href={`/clase/${r.claseId}`} className="hover:underline">
                        {r.tipo}
                      </Link>{' '}
                      <span className="font-normal text-grafito-2">con {r.instructor}</span>
                    </p>
                    {pendiente ? (
                      <p className="text-chico text-rosa-tinta">
                        Pago pendiente: te guardamos el reformer {r.reformer} por{' '}
                        <CuentaRegresiva hasta={r.retenidaHasta!} />
                      </p>
                    ) : (
                      <p className="text-chico text-grafito-2">
                        Reformer {r.reformer} ·{' '}
                        {ev.permitida && ev.sinCosto
                          ? `cancelás sin costo hasta el ${diaSemana(limite)} ${hora(limite)}`
                          : 'si cancelás ahora, el crédito se pierde'}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {pendiente && (
                      <button
                        type="button"
                        className="boton boton-principal"
                        disabled={enCurso}
                        onClick={() => pagar(r.id)}
                      >
                        Pagar {precio(r.precioArs ?? 0)}
                      </button>
                    )}
                    <BotonCancelar
                      reservaId={r.id}
                      iniciaEn={r.iniciaEn}
                      tipo={r.tipo}
                      pendiente={pendiente}
                      pagadaSuelta={r.medio === 'pago'}
                      onCancelada={setAviso}
                      className="boton boton-secundario"
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {espera.length > 0 && (
        <section aria-labelledby="titulo-espera" className="mt-10">
          <h2 id="titulo-espera" className="text-seccion font-semibold">
            En lista de espera
          </h2>
          <ul className="mt-3 divide-y divide-linea rounded-bloque border border-linea bg-superficie">
            {espera.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4">
                <Fecha iso={e.iniciaEn} />
                <div className="min-w-0 flex-1 basis-56">
                  <p className="font-semibold">
                    {e.tipo} <span className="font-normal text-grafito-2">con {e.instructor}</span>
                  </p>
                  <p className="text-chico text-grafito-2">
                    Puesto {e.puesto}. Si se libera un lugar y tenés crédito, te lo reservamos solos.
                  </p>
                </div>
                <button
                  type="button"
                  className="boton boton-secundario"
                  disabled={enCurso}
                  onClick={() => salir(e)}
                >
                  Salir de la lista
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
