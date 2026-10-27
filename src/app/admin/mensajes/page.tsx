import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense, type ReactNode } from 'react'
import {
  EncabezadoPanel,
  EsqueletoPanel,
  fila,
  Insignia,
  MarcoTabla,
  td,
  th,
  Vacio,
} from '@/components/admin/ui'
import { ultimosEmails } from '@/lib/consultas/admin'
import { limiteCancelacionSinCosto } from '@/lib/dominio/reglas'
import { comoWhatsApp } from '@/lib/email/contenido'
import { renderizarEmail } from '@/lib/email/despachar'
import type { DatosPorPlantilla, NombrePlantilla } from '@/lib/email/tipos'
import { exigirRol } from '@/lib/sesion'
import { diaIso, fechaCorta, hora, inicioDeSemana, instanteDePlantilla, sumarMinutos } from '@/lib/tiempo'

export const metadata: Metadata = { title: 'Mensajes' }

const NOMBRES: Record<NombrePlantilla, string> = {
  recordatorio: 'Recordatorio 24 h antes',
  reserva_confirmada: 'Reserva confirmada',
  reserva_cancelada: 'Reserva cancelada',
  espera_promovida: 'Lugar desde la lista de espera',
  espera_oferta: 'Lugar para pagar en 30 min',
  pack_comprado: 'Pack comprado',
  pago_tardio: 'Pago acreditado tarde',
  clase_cancelada: 'Clase cancelada por el estudio',
  clase_reprogramada: 'Clase con horario nuevo',
}

const ESTADO_EMAIL: Record<string, { texto: string; tono: 'bien' | 'atencion' | 'error' | 'neutro' }> = {
  enviado: { texto: 'Enviado', tono: 'bien' },
  pendiente: { texto: 'En cola', tono: 'atencion' },
  registrado: { texto: 'Registrado (sin proveedor)', tono: 'neutro' },
  fallido: { texto: 'Falló', tono: 'error' },
}

/** Datos de ejemplo para la vista previa: mañana a las 18:00, con Lucía. */
function ejemplo(ahora: Date): DatosPorPlantilla {
  const manana = new Date(ahora.getTime() + 86_400_000)
  const inicio = instanteDePlantilla(inicioDeSemana(manana), diaIso(manana), '18:00')
  const clase = {
    nombre: 'Sofía',
    clase: 'Reformer clásico',
    instructor: 'Lucía Ferreyra',
    iniciaEn: inicio.toISOString(),
  }
  const limite = limiteCancelacionSinCosto(inicio).toISOString()
  const en30 = new Date(Math.min(sumarMinutos(ahora, 30).getTime(), inicio.getTime())).toISOString()
  const en30Dias = new Date(ahora.getTime() + 30 * 86_400_000).toISOString()
  return {
    recordatorio: { ...clase, reformer: 3, limiteCancelacion: limite },
    reserva_confirmada: {
      ...clase,
      reformer: 3,
      creditosRestantes: 1,
      limiteCancelacion: limite,
      pagada: false,
    },
    reserva_cancelada: { ...clase, sinCosto: true, creditoDevuelto: true },
    espera_promovida: { ...clase, reformer: 5, creditosRestantes: 3 },
    espera_oferta: {
      ...clase,
      claseId: '00000000-0000-0000-0000-000000000000',
      venceEn: en30,
      precioArs: 22000,
    },
    pack_comprado: { nombre: 'Sofía', pack: 'Pack de 8', creditos: 8, venceEn: en30Dias },
    pago_tardio: { ...clase, venceEn: en30Dias },
    clase_cancelada: { ...clase, creditoDevuelto: true },
    clase_reprogramada: {
      ...clase,
      iniciaEn: sumarMinutos(inicio, 75).toISOString(),
      anterior: inicio.toISOString(),
      reformer: 3,
      limiteCancelacion: limiteCancelacionSinCosto(sumarMinutos(inicio, 75)).toISOString(),
    },
  }
}

/** Negritas de WhatsApp (*así*) como <strong>, y los saltos de línea tal cual. */
function textoWhatsApp(texto: string): ReactNode[] {
  return texto
    .split(/(\*[^*\n]+\*)/g)
    .map((parte, i) =>
      parte.startsWith('*') && parte.endsWith('*') ? <strong key={i}>{parte.slice(1, -1)}</strong> : parte,
    )
}

export default function PaginaMensajes({ searchParams }: PageProps<'/admin/mensajes'>) {
  return (
    <>
      <EncabezadoPanel
        titulo="Mensajes"
        descripcion="Los emails salen solos después de cada reserva, cancelación o pago. WhatsApp es una vista previa de la misma plantilla: en esta demo no se envía."
      />
      <Suspense fallback={<EsqueletoPanel />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Contenido({ searchParams }: { searchParams: PageProps<'/admin/mensajes'>['searchParams'] }) {
  const sp = await searchParams
  await exigirRol(['admin'], '/admin/mensajes')
  const nombres = Object.keys(NOMBRES) as NombrePlantilla[]
  const plantilla = nombres.find((n) => n === sp.plantilla) ?? 'recordatorio'
  const ahora = new Date()
  const datos = ejemplo(ahora)
  const [{ contenido, html }, enviados] = await Promise.all([
    renderizarEmail(plantilla, datos[plantilla] as never),
    ultimosEmails(),
  ])
  const whatsapp = comoWhatsApp(contenido)

  return (
    <div className="mt-6 grid gap-8">
      <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Plantillas">
          <ul className="flex gap-1 overflow-x-auto pb-1 lg:grid lg:overflow-visible">
            {nombres.map((n) => (
              <li key={n} className="shrink-0">
                <Link
                  href={`/admin/mensajes?plantilla=${n}`}
                  scroll={false}
                  aria-current={n === plantilla ? 'page' : undefined}
                  className={`flex min-h-10 items-center rounded-boton px-3 text-chico font-medium ${
                    n === plantilla
                      ? 'bg-eucalipto-tenue text-grafito'
                      : 'text-grafito-2 hover:bg-superficie hover:text-grafito'
                  }`}
                >
                  {NOMBRES[n]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section aria-labelledby="titulo-email" className="min-w-0">
            <h2 id="titulo-email" className="text-subtitulo font-semibold">
              Email
            </h2>
            <p className="text-chico text-grafito-2">
              Asunto: <span className="text-grafito">{contenido.asunto}</span>
            </p>
            <iframe
              title={`Vista previa del email: ${NOMBRES[plantilla]}`}
              srcDoc={html}
              sandbox="allow-same-origin"
              className="mt-3 h-[560px] w-full rounded-bloque border border-linea bg-white"
            />
          </section>
          <section aria-labelledby="titulo-whatsapp">
            <h2 id="titulo-whatsapp" className="text-subtitulo font-semibold">
              WhatsApp
            </h2>
            <p className="text-chico text-grafito-2">Vista previa, sin envío real.</p>
            <div className="mt-3 rounded-bloque border border-linea bg-cal p-4">
              <p className="mb-3 text-center text-leyenda text-grafito-2">Núcleo · pilates reformer</p>
              <div className="relative max-w-[280px] rounded-[10px] rounded-tl-[3px] border border-linea bg-superficie px-3 py-2.5 text-chico leading-5 break-words whitespace-pre-line">
                {textoWhatsApp(whatsapp)}
                <span className="mt-1 block text-right text-leyenda text-grafito-2 tabular">
                  {hora(ahora)}
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>

      <section aria-labelledby="titulo-enviados">
        <h2 id="titulo-enviados" className="text-seccion font-semibold">
          Últimos envíos
        </h2>
        <p className="mt-1 mb-3 text-chico text-grafito-2">
          Cola de salida: cada email se guarda en la misma transacción que la reserva y se envía después.
        </p>
        {enviados.length ? (
          <MarcoTabla etiqueta="Últimos envíos">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr>
                  <th className={th}>Fecha</th>
                  <th className={th}>Para</th>
                  <th className={th}>Mensaje</th>
                  <th className={th}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {enviados.map((e) => {
                  const est = ESTADO_EMAIL[e.estado] ?? { texto: e.estado, tono: 'neutro' as const }
                  return (
                    <tr key={e.id} className={fila}>
                      <td className={`${td} whitespace-nowrap tabular`}>
                        {fechaCorta(e.creadoEn)} · {hora(e.creadoEn)}
                      </td>
                      <td className={td}>{e.para}</td>
                      <td className={td}>
                        {NOMBRES[e.plantilla as NombrePlantilla] ?? e.plantilla}
                        {e.asunto && <span className="block text-leyenda text-grafito-2">{e.asunto}</span>}
                      </td>
                      <td className={td}>
                        <Insignia tono={est.tono}>{est.texto}</Insignia>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </MarcoTabla>
        ) : (
          <Vacio>Todavía no salió ningún email. Hacé una reserva y aparece acá.</Vacio>
        )}
      </section>
    </div>
  )
}
