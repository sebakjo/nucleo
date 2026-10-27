import Link from 'next/link'
import { Carriles } from '@/components/Carriles'
import { cancelarClaseComoAdmin, cancelarReservaComoAdmin, marcarAsistio } from '@/app/acciones/admin'
import type { detalleClaseAdmin } from '@/lib/consultas/admin'
import { evaluarCancelacion, HORAS_CANCELACION_SIN_COSTO, sePuedeMover } from '@/lib/dominio/reglas'
import { claveDia, hora } from '@/lib/tiempo'
import { BotonAsistencia, ConfirmarAccion } from './Acciones'
import { FormularioMover } from './Formularios'
import { Insignia } from './ui'

type Detalle = NonNullable<Awaited<ReturnType<typeof detalleClaseAdmin>>>
type Activa = Detalle['activas'][number]

/** La asistencia se puede marcar desde media hora antes de empezar. */
const MARGEN_ASISTENCIA_MS = 30 * 60 * 1000

const OTRAS: Record<string, string> = {
  cancelada: 'canceló a tiempo',
  cancelada_tarde: 'canceló tarde',
  pendiente_pago: 'no completó el pago',
}

function consecuencia(r: Activa, inicio: Date, ahora: Date, hayEspera: boolean): string {
  const espera = hayEspera ? ' El lugar pasa a la primera persona de la lista de espera.' : ''
  if (r.estado === 'pendiente_pago')
    return `Se libera el lugar que tenía guardado mientras pagaba. No se cobra nada.${espera}`
  const ev = evaluarCancelacion(inicio, ahora)
  if (ev.permitida && ev.sinCosto) {
    return (
      (r.medio === 'credito'
        ? `Faltan más de ${HORAS_CANCELACION_SIN_COSTO} horas: se le devuelve el crédito.`
        : `Faltan más de ${HORAS_CANCELACION_SIN_COSTO} horas: recibe un crédito para otra clase.`) + espera
    )
  }
  return `Faltan menos de ${HORAS_CANCELACION_SIN_COSTO} horas: por la regla de cancelación, el crédito no se devuelve. Si corresponde compensar, sumá un crédito desde su ficha.${espera}`
}

export function DetalleClase({ detalle, ahora }: { detalle: Detalle; ahora: Date }) {
  const { clase, activas, otras, espera } = detalle
  const cancelada = clase.estado === 'cancelada'
  const empezo = clase.iniciaEn <= ahora
  const asistenciaAbierta = !cancelada && clase.iniciaEn.getTime() - MARGEN_ASISTENCIA_MS <= ahora.getTime()
  const porReformer = new Map(activas.map((r) => [r.reformer, r]))
  const movible = !cancelada && sePuedeMover(clase.iniciaEn, ahora)

  return (
    <div className="grid gap-7">
      <div className="flex items-end gap-4">
        <Carriles cupo={clase.cupo} ocupados={activas.map((r) => r.reformer)} tamano="grilla" numeros />
        <p className="text-chico text-grafito-2">
          <span className="font-semibold text-grafito tabular">
            {activas.length} de {clase.cupo}
          </span>{' '}
          lugares
          {espera.length > 0 && <> · {espera.length} en espera</>}
        </p>
        {cancelada && <Insignia tono="error">Cancelada</Insignia>}
      </div>

      <section aria-labelledby="titulo-lista">
        <h3 id="titulo-lista" className="text-subtitulo font-semibold">
          Quién viene
        </h3>
        <ol className="mt-2 divide-y divide-linea border-y border-linea">
          {Array.from({ length: clase.cupo }, (_, i) => {
            const n = i + 1
            const r = porReformer.get(n)
            if (!r) {
              return (
                <li key={n} className="flex min-h-12 items-center gap-3 py-2 text-chico text-grafito-2">
                  <span className="w-6 text-right font-semibold tabular">{n}</span>
                  {cancelada ? '—' : 'Libre'}
                </li>
              )
            }
            const pendiente = r.estado === 'pendiente_pago'
            return (
              <li key={n} className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 py-2">
                <span className="w-6 text-right text-chico font-semibold tabular">{n}</span>
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/alumnos/${r.usuarioId}`} className="font-medium hover:underline">
                    {r.nombre}
                  </Link>
                  <p className="text-leyenda text-grafito-2">
                    {pendiente
                      ? `Pagando, guardado hasta las ${hora(r.retenidaHasta!)}`
                      : r.medio === 'credito'
                        ? 'Con crédito'
                        : 'Clase suelta paga'}
                    {r.origen === 'lista_espera' && ' · desde la lista de espera'}
                  </p>
                </div>
                {pendiente && <Insignia tono="atencion">Pago pendiente</Insignia>}
                {asistenciaAbierta && !pendiente && (
                  <BotonAsistencia
                    accion={marcarAsistio.bind(null, r.id)}
                    asistio={r.estado === 'asistio'}
                    nombre={r.nombre}
                  />
                )}
                {!empezo && !cancelada && (
                  <ConfirmarAccion
                    boton={pendiente ? 'Liberar' : 'Cancelar'}
                    titulo={`¿Cancelar la reserva de ${r.nombre}?`}
                    descripcion={consecuencia(r, clase.iniciaEn, ahora, espera.length > 0)}
                    confirmar="Cancelar reserva"
                    exito={`Cancelaste la reserva de ${r.nombre}.`}
                    accion={cancelarReservaComoAdmin.bind(null, r.id)}
                  />
                )}
              </li>
            )
          })}
        </ol>
      </section>

      <section aria-labelledby="titulo-espera">
        <h3 id="titulo-espera" className="text-subtitulo font-semibold">
          Lista de espera
        </h3>
        {espera.length ? (
          <ol className="mt-2 grid gap-1.5">
            {espera.map((e, i) => (
              <li key={e.id} className="flex items-center gap-3 text-chico">
                <span className="w-6 text-right font-semibold tabular">{i + 1}.º</span>
                <span className="flex-1">{e.nombre}</span>
                {e.estado === 'oferta' && <Insignia tono="rosa">Tiene una oferta para pagar</Insignia>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-1 text-chico text-grafito-2">Nadie está esperando lugar en esta clase.</p>
        )}
      </section>

      {otras.length > 0 && (
        <section aria-labelledby="titulo-otras">
          <h3 id="titulo-otras" className="text-subtitulo font-semibold">
            Cancelaciones
          </h3>
          <ul className="mt-2 grid gap-1 text-chico">
            {otras.map((r) => (
              <li key={r.id} className="flex justify-between gap-3">
                <span>{r.nombre}</span>
                <span className="text-grafito-2">
                  {OTRAS[r.estado] ?? r.estado}
                  {r.canceladaEn && <span className="tabular"> · {hora(r.canceladaEn)}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {movible && (
        <section aria-labelledby="titulo-mover" className="border-t border-linea pt-5">
          <h3 id="titulo-mover" className="text-subtitulo font-semibold">
            Mover a otro horario
          </h3>
          <p className="mt-1 mb-3 text-chico text-grafito-2">
            También podés arrastrarla en la agenda. Las reservas y los reformers se mantienen, y avisamos por
            email a quien reservó y a la lista de espera.
          </p>
          <FormularioMover
            claseId={clase.id}
            dia={claveDia(clase.iniciaEn)}
            hora={hora(clase.iniciaEn)}
            minimo={claveDia(new Date(ahora.getTime() + HORAS_CANCELACION_SIN_COSTO * 3_600_000))}
          />
        </section>
      )}

      {!cancelada && !empezo && (
        <div className="border-t border-linea pt-5">
          <ConfirmarAccion
            boton="Cancelar la clase"
            claseBoton="boton boton-peligro w-full"
            titulo="¿Cancelar la clase?"
            descripcion={
              activas.length
                ? `Se cancelan ${activas.length === 1 ? 'la reserva' : `las ${activas.length} reservas`}: cada persona recupera su crédito y recibe un email. La lista de espera se cierra.`
                : 'No hay reservas. La clase deja de aparecer con lugar en los horarios.'
            }
            confirmar="Cancelar la clase"
            exito="Cancelaste la clase y avisamos a quienes tenían reserva."
            accion={cancelarClaseComoAdmin.bind(null, clase.id)}
          />
        </div>
      )}
    </div>
  )
}
