'use client'

import Link from 'next/link'
import { RadioGroup } from 'radix-ui'
import { useRouter } from 'next/navigation'
import { useCallback, useState, useTransition } from 'react'
import { anotarme, pagarReserva, reservar, salirDeLaLista } from '@/app/acciones/reservas'
import { Carriles } from '@/components/Carriles'
import type { DetalleReserva } from '@/lib/consultas/horarios'
import { precio } from '@/lib/dinero'
import {
  estadoDeCupo,
  HORAS_CANCELACION_SIN_COSTO,
  limiteCancelacionSinCosto,
  MINUTOS_RETENCION_PAGO,
} from '@/lib/dominio/reglas'
import { diaSemana, diaYMes, fechaLarga, hora } from '@/lib/tiempo'
import { AgregarAlCalendario } from './AgregarAlCalendario'
import { BotonCancelar } from './BotonCancelar'
import { CuentaRegresiva } from './CuentaRegresiva'

type Props = DetalleReserva & { ahora: string; nombreUsuario: string | null; volver: string }

type Confirmacion = { titulo: string; detalle: string; reformer: number; reservaId: string }

const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** El tercer paso es pagar si la clase se paga suelta; con crédito, o una vez reservada, es el lugar asignado. */
function Pasos({ actual, ultimo }: { actual: 2 | 3; ultimo: 'Pagá' | 'Tu lugar' }) {
  const pasos = ['Elegí la clase', 'Confirmá', ultimo]
  return (
    <ol className="flex flex-wrap items-center gap-x-3 gap-y-1 text-chico" aria-label="Pasos de la reserva">
      {pasos.map((p, i) => {
        const n = i + 1
        const estado = n < actual ? 'hecho' : n === actual ? 'actual' : 'pendiente'
        return (
          <li
            key={p}
            className="flex items-center gap-3"
            aria-current={estado === 'actual' ? 'step' : undefined}
          >
            {i > 0 && <span className="h-px w-5 bg-linea" aria-hidden="true" />}
            <span
              className={
                estado === 'actual'
                  ? 'font-semibold text-grafito'
                  : estado === 'hecho'
                    ? 'text-eucalipto'
                    : 'text-grafito-2'
              }
            >
              {n === 1 ? (
                <Link href="/" className="hover:underline">
                  {p}
                </Link>
              ) : (
                p
              )}
            </span>
          </li>
        )
      })}
      <li className="ml-auto text-grafito-2 tabular">
        <span className="sr-only">Paso </span>
        {actual} de 3
      </li>
    </ol>
  )
}

export function Reserva({
  clase,
  precioArs,
  enEspera,
  usuario,
  ahora: ahoraIso,
  nombreUsuario,
  volver,
}: Props) {
  const router = useRouter()
  const [enCurso, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null)
  const creditos = usuario?.creditosParaClase ?? 0
  const [medio, setMedio] = useState<'credito' | 'pago'>(creditos > 0 ? 'credito' : 'pago')

  const inicio = new Date(clase.iniciaEn)
  const fin = new Date(clase.terminaEn)
  const ahora = new Date(ahoraIso)
  const limite = limiteCancelacionSinCosto(inicio)
  const pasada = inicio <= ahora
  const instructora = clase.instructor.split(' ')[0]
  const cuando = `${diaSemana(inicio)} ${hora(inicio)}`

  const mia = clase.mia
  const reformerMio = confirmacion?.reformer ?? (mia?.tipo === 'reservada' ? mia.reformer : null)
  const ocupados = confirmacion ? [...new Set([...clase.reformers, confirmacion.reformer])] : clase.reformers
  const estadoCupo = estadoDeCupo(ocupados.length, clase.cupo)
  const libres = clase.cupo - ocupados.length

  const onVencida = useCallback(() => router.refresh(), [router])

  const ejecutarReserva = (elegido: 'credito' | 'pago') =>
    iniciar(async () => {
      setError(null)
      const r = await reservar(clase.id, elegido)
      if (!r.ok) {
        setError(r.mensaje)
        if (r.codigo === 'CLASE_LLENA') router.refresh()
        return
      }
      if (r.valor.tipo === 'pago') {
        window.location.assign(r.valor.urlPago)
        return
      }
      const quedan = r.valor.creditosRestantes
      setConfirmacion({
        titulo: `Reservaste el ${cuando} con ${instructora}.`,
        detalle:
          quedan === null
            ? `Tu lugar es el reformer ${r.valor.reformer}.`
            : `${quedan === 1 ? 'Te queda 1 crédito' : `Te quedan ${quedan} créditos`}. Tu lugar es el reformer ${r.valor.reformer}.`,
        reformer: r.valor.reformer,
        reservaId: r.valor.reservaId,
      })
    })

  const ejecutarPagoPendiente = (reservaId: string) =>
    iniciar(async () => {
      setError(null)
      const r = await pagarReserva(reservaId)
      if (!r.ok) {
        setError(r.mensaje)
        router.refresh()
        return
      }
      window.location.assign(r.valor.urlPago)
    })

  const ejecutarAnotarme = () =>
    iniciar(async () => {
      setError(null)
      const r = await anotarme(clase.id)
      if (!r.ok) {
        setError(r.mensaje)
        router.refresh()
        return
      }
      setAviso(`Te anotaste en la lista de espera. Sos el puesto ${r.valor.puesto}.`)
    })

  const ejecutarSalir = (entradaId: string) =>
    iniciar(async () => {
      setError(null)
      const r = await salirDeLaLista(entradaId)
      if (!r.ok) setError(r.mensaje)
      else setAviso('Saliste de la lista de espera.')
    })

  let panel: React.ReactNode
  if (confirmacion) {
    panel = (
      <div role="status" className="rounded-bloque border border-rosa-tinta/40 bg-rosa-tenue p-6">
        <p className="text-seccion font-semibold">{confirmacion.titulo}</p>
        <p className="mt-1 text-grafito-2">{confirmacion.detalle}</p>
        <p className="mt-4 text-chico text-grafito-2">
          Te mandamos la confirmación por email. Podés cancelar sin costo hasta el {fechaLarga(limite)} a las{' '}
          {hora(limite)}.
        </p>
        <AgregarAlCalendario reservaId={confirmacion.reservaId} className="mt-2" />
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/mis-reservas" className="boton boton-principal">
            Ver mis reservas
          </Link>
          <Link href="/" className="boton boton-secundario">
            Reservar otra clase
          </Link>
        </div>
      </div>
    )
  } else if (clase.cancelada) {
    panel = <Aviso>El estudio canceló esta clase. Elegí otro horario de la semana.</Aviso>
  } else if (pasada) {
    panel = <Aviso>Esta clase ya empezó. Elegí otro horario de la semana.</Aviso>
  } else if (!usuario) {
    panel = (
      <div className="rounded-bloque border border-linea bg-superficie p-6">
        <p className="text-seccion font-semibold">Entrá para reservar</p>
        <p className="mt-1 text-grafito-2">
          La clase suelta cuesta{' '}
          <span className="font-semibold text-grafito tabular">{precio(precioArs)}</span>. Con un pack, cada
          clase es un crédito.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={`/entrar?volver=${encodeURIComponent(volver)}`} className="boton boton-principal">
            Entrar
          </Link>
          <Link href={`/registrarme?volver=${encodeURIComponent(volver)}`} className="boton boton-secundario">
            Crear una cuenta
          </Link>
        </div>
      </div>
    )
  } else if (mia?.tipo === 'reservada') {
    panel = (
      <div className="rounded-bloque border border-rosa-tinta/40 bg-rosa-tenue p-6">
        <p className="text-seccion font-semibold">Ya tenés el reformer {mia.reformer} en esta clase</p>
        <p className="mt-1 text-grafito-2">
          Podés cancelar sin costo hasta el {fechaLarga(limite)} a las {hora(limite)}.
        </p>
        <AgregarAlCalendario reservaId={mia.reservaId} className="mt-2" />
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/mis-reservas" className="boton boton-secundario">
            Ver mis reservas
          </Link>
          <BotonCancelar
            reservaId={mia.reservaId}
            iniciaEn={clase.iniciaEn}
            tipo={clase.tipo}
            onCancelada={(m) => setAviso(m)}
          />
        </div>
      </div>
    )
  } else if (mia?.tipo === 'pendiente') {
    panel = (
      <div className="rounded-bloque border border-dashed border-rosa-tinta bg-rosa-tenue p-6">
        <p className="text-seccion font-semibold">Te guardamos el reformer {mia.reformer}</p>
        <p className="mt-1 text-grafito-2">
          Pagá antes de que pase el tiempo para confirmarlo. Quedan{' '}
          <span className="font-semibold text-grafito">
            <CuentaRegresiva hasta={mia.hasta} onVencida={onVencida} />
          </span>
          .
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            className="boton boton-principal"
            disabled={enCurso}
            onClick={() => ejecutarPagoPendiente(mia.reservaId)}
          >
            {enCurso ? 'Abriendo el pago…' : `Pagar ${precio(precioArs)}`}
          </button>
          {creditos > 0 && (
            <button
              type="button"
              className="boton boton-secundario"
              disabled={enCurso}
              onClick={() => ejecutarReserva('credito')}
            >
              Usar 1 crédito
            </button>
          )}
          <BotonCancelar
            reservaId={mia.reservaId}
            iniciaEn={clase.iniciaEn}
            tipo={clase.tipo}
            pendiente
            onCancelada={(m) => setAviso(m)}
            className="boton boton-secundario"
          />
        </div>
      </div>
    )
  } else if (mia?.tipo === 'espera') {
    panel = (
      <div className="rounded-bloque border border-linea bg-superficie p-6">
        <p className="text-seccion font-semibold">Estás en el puesto {mia.puesto} de la lista de espera</p>
        <p className="mt-1 text-grafito-2">
          Si se libera un lugar y tenés un crédito, te lo reservamos solos y te avisamos por email. Si no
          tenés créditos, te guardamos el lugar 30 minutos para que lo pagues.
        </p>
        <div className="mt-5">
          <button
            type="button"
            className="boton boton-secundario"
            disabled={enCurso}
            onClick={() => ejecutarSalir(mia.entradaId)}
          >
            Salir de la lista
          </button>
        </div>
      </div>
    )
  } else if (estadoCupo === 'completa') {
    panel = (
      <div className="rounded-bloque border border-linea bg-superficie p-6">
        <p className="text-seccion font-semibold">La clase está completa</p>
        <p className="mt-1 text-grafito-2">
          {enEspera === 0
            ? 'Nadie está esperando todavía. Si te anotás y se libera un lugar, es tuyo.'
            : `${enEspera === 1 ? 'Hay 1 persona' : `Hay ${enEspera} personas`} en la lista de espera. Si se libera un lugar, se asigna en orden.`}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            className="boton boton-principal"
            disabled={enCurso}
            onClick={ejecutarAnotarme}
          >
            {enCurso ? 'Anotando…' : 'Anotarme en la lista de espera'}
          </button>
          <Link href="/" className="boton boton-secundario">
            Elegir otro horario
          </Link>
        </div>
      </div>
    )
  } else {
    const total = medio === 'credito' ? 0 : precioArs
    panel = (
      <div className="rounded-bloque border border-linea bg-superficie p-6">
        <fieldset>
          <legend className="text-seccion font-semibold">Cómo pagás</legend>
          <RadioGroup.Root
            value={medio}
            onValueChange={(v) => setMedio(v as 'credito' | 'pago')}
            className="mt-3 grid gap-2"
            aria-label="Cómo pagás"
          >
            <Opcion
              value="credito"
              disabled={creditos === 0}
              titulo="Usar 1 crédito"
              detalle={
                creditos === 0
                  ? 'No tenés créditos vigentes para esta clase.'
                  : `${creditos === 1 ? 'Te queda 1 crédito' : `Te quedan ${creditos} créditos`}${
                      usuario.proximoVencimiento
                        ? `, el próximo vence el ${diaYMes(new Date(usuario.proximoVencimiento))}`
                        : ''
                    }.`
              }
              valor="$ 0"
            />
            <Opcion
              value="pago"
              titulo="Pagar la clase suelta"
              detalle={`Con Mercado Pago. Te guardamos el lugar ${MINUTOS_RETENCION_PAGO} minutos mientras pagás.`}
              valor={precio(precioArs)}
            />
          </RadioGroup.Root>
          {creditos === 0 && (
            <p className="mt-2 text-chico text-grafito-2">
              <Link href="/packs" className="font-medium text-eucalipto underline-offset-2 hover:underline">
                Comprá un pack
              </Link>{' '}
              y cada clase te sale menos.
            </p>
          )}
        </fieldset>
        <dl className="mt-5 flex items-baseline justify-between border-t border-linea pt-4">
          <dt className="font-semibold">Total ahora</dt>
          <dd className="text-dato font-semibold tabular">{precio(total)}</dd>
        </dl>
        <p className="mt-2 text-chico text-grafito-2">
          Podés cancelar sin costo hasta el {fechaLarga(limite)} a las {hora(limite)} y{' '}
          {medio === 'credito' ? 'recuperás el crédito' : 'te damos un crédito para otra clase'}. Con menos de{' '}
          {HORAS_CANCELACION_SIN_COSTO} horas, se pierde.
        </p>
        <button
          type="button"
          className="mt-5 boton w-full boton-principal sm:w-auto"
          disabled={enCurso}
          onClick={() => ejecutarReserva(medio)}
        >
          {enCurso
            ? medio === 'credito'
              ? 'Reservando…'
              : 'Abriendo el pago…'
            : medio === 'credito'
              ? 'Reservar'
              : `Pagar ${precio(precioArs)}`}
        </button>
        {nombreUsuario && <p className="mt-3 text-leyenda text-grafito-2">Reservás como {nombreUsuario}.</p>}
      </div>
    )
  }

  const reservada = Boolean(confirmacion) || mia?.tipo === 'reservada'
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_440px] lg:gap-12">
      <div>
        <Pasos
          actual={reservada || (medio === 'pago' && usuario) ? 3 : 2}
          ultimo={medio === 'pago' && !reservada ? 'Pagá' : 'Tu lugar'}
        />
        <p className="mt-8 text-grafito-2">{mayuscula(fechaLarga(inicio))}</p>
        <h1 className="mt-1 text-dato-grande font-semibold tracking-[-0.01em] tabular">
          {hora(inicio)} – {hora(fin)}
        </h1>
        <p className="mt-2 text-seccion font-semibold">
          {clase.tipo} con {clase.instructor}
        </p>
        <p className="mt-2 max-w-[56ch] text-grafito-2">
          {clase.descripcion} Nivel {clase.nivel}, {clase.duracionMin} minutos.
        </p>

        <figure className="mt-8">
          <Carriles
            cupo={clase.cupo}
            ocupados={ocupados}
            mio={reformerMio}
            retenido={mia?.tipo === 'pendiente' ? mia.reformer : null}
            tamano="grande"
            numeros
            animarMio={Boolean(confirmacion)}
          />
          <figcaption className="mt-3 text-chico text-grafito-2">
            <span className="font-semibold text-grafito tabular">
              {ocupados.length} de {clase.cupo}
            </span>{' '}
            lugares ocupados
            {estadoCupo !== 'completa' &&
              !reformerMio &&
              ` · ${libres === 1 ? 'queda 1' : `quedan ${libres}`}`}
            {reformerMio && ` · el tuyo es el reformer ${reformerMio}`}
          </figcaption>
        </figure>
      </div>

      <div className="lg:pt-10">
        {panel}
        <div aria-live="polite">
          {aviso && (
            <p
              className="mt-4 rounded-boton border border-linea bg-superficie px-4 py-3 text-chico"
              role="status"
            >
              {aviso}
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-4 rounded-boton bg-error-tenue px-4 py-3 text-chico text-error">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

function Opcion(props: {
  value: string
  titulo: string
  detalle: string
  valor: string
  disabled?: boolean
}) {
  return (
    <RadioGroup.Item
      value={props.value}
      disabled={props.disabled}
      className="group flex w-full items-start gap-3 rounded-boton border border-linea p-4 text-left transition-colors hover:border-grafito-2 disabled:cursor-not-allowed disabled:opacity-60 data-[state=checked]:border-eucalipto data-[state=checked]:bg-eucalipto-tenue"
    >
      <span
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-grafito-2 group-data-[state=checked]:border-eucalipto"
        aria-hidden="true"
      >
        <RadioGroup.Indicator className="h-2.5 w-2.5 rounded-full bg-eucalipto" />
      </span>
      <span className="flex-1">
        <span className="flex items-baseline justify-between gap-3">
          <span className="font-semibold">{props.titulo}</span>
          <span className="font-semibold tabular">{props.valor}</span>
        </span>
        <span className="mt-0.5 block text-chico text-grafito-2">{props.detalle}</span>
      </span>
    </RadioGroup.Item>
  )
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-bloque border border-linea bg-superficie p-6">
      <p>{children}</p>
      <Link href="/" className="mt-4 boton boton-secundario">
        Ver los horarios
      </Link>
    </div>
  )
}
