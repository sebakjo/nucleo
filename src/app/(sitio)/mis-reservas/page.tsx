import type { Metadata } from 'next'
import Link from 'next/link'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { Proximas } from '@/components/alumno/Proximas'
import { misReservas } from '@/lib/consultas/alumno'
import { exigirUsuario } from '@/lib/sesion'
import { diaYMes, fechaCorta, hora } from '@/lib/tiempo'

export const metadata: Metadata = {
  title: 'Mis reservas',
  description: 'Tus próximas clases, tus créditos y su vencimiento.',
}

export default function PaginaMisReservas() {
  return (
    <>
      <h1 className="text-titulo font-bold">Mis reservas</h1>
      <Suspense fallback={<Esqueleto />}>
        <Contenido />
      </Suspense>
    </>
  )
}

const ESTADO_PASADA: Record<string, string> = {
  asistio: 'Asististe',
  confirmada: 'Sin asistencia registrada',
  cancelada: 'Cancelaste a tiempo',
  cancelada_tarde: 'Cancelaste tarde',
  vencida: 'No se completó el pago',
  pendiente_pago: 'Pago pendiente',
}

const MOTIVO: Record<string, string> = {
  compra: 'Compra',
  reserva: 'Reserva',
  devolucion: 'Devolución por cancelar a tiempo',
  credito_por_cancelacion: 'Crédito por cancelar una clase paga',
  clase_cancelada: 'El estudio canceló la clase',
  pago_tardio: 'Pago acreditado tarde',
  vencimiento: 'Vencimiento',
  ajuste: 'Ajuste del estudio',
}

async function Contenido() {
  await connection()
  const usuario = await exigirUsuario('/mis-reservas')
  const ahora = new Date()
  const datos = await misReservas(usuario.id, ahora)
  const iso = (d: Date | null) => (d ? d.toISOString() : null)

  return (
    <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0">
        <Proximas
          ahora={ahora.toISOString()}
          proximas={datos.proximas.map((r) => ({
            ...r,
            iniciaEn: r.iniciaEn.toISOString(),
            retenidaHasta: iso(r.retenidaHasta),
          }))}
          espera={datos.espera.map((e) => ({ ...e, iniciaEn: e.iniciaEn.toISOString() }))}
        />

        <section aria-labelledby="titulo-pasadas" className="mt-10">
          <h2 id="titulo-pasadas" className="text-seccion font-semibold">
            Clases pasadas y canceladas
          </h2>
          {datos.pasadas.length === 0 ? (
            <p className="mt-3 text-grafito-2">Acá vas a ver tus clases cuando pasen.</p>
          ) : (
            <ul className="mt-3 divide-y divide-linea">
              {datos.pasadas.map((p) => (
                <li key={p.id} className="flex flex-wrap items-baseline gap-x-6 gap-y-1 py-3">
                  <span className="w-28 shrink-0 text-chico text-grafito-2 tabular">
                    {fechaCorta(p.iniciaEn)} · {hora(p.iniciaEn)}
                  </span>
                  <span className="min-w-0 flex-1">
                    {p.tipo} <span className="text-grafito-2">con {p.instructor}</span>
                  </span>
                  <span
                    className={`text-chico ${
                      p.estado === 'cancelada_tarde' || p.estado === 'vencida'
                        ? 'text-ambar-tinta'
                        : 'text-grafito-2'
                    }`}
                  >
                    {p.claseCancelada ? 'El estudio canceló la clase' : ESTADO_PASADA[p.estado]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="space-y-8 lg:order-none">
        <section
          aria-labelledby="titulo-creditos"
          className="rounded-bloque border border-linea bg-superficie p-6"
        >
          <h2 id="titulo-creditos" className="text-seccion font-semibold">
            Tus créditos
          </h2>
          <p className="mt-3 flex items-baseline gap-2">
            <span className="text-dato-grande font-semibold tabular">{datos.saldo.disponibles}</span>
            <span className="text-grafito-2">
              {datos.saldo.disponibles === 1 ? 'crédito disponible' : 'créditos disponibles'}
            </span>
          </p>
          {datos.saldo.packs.length > 0 ? (
            <ul className="mt-4 space-y-2 text-chico">
              {datos.saldo.packs.map((p) => (
                <li key={p.id}>
                  <span className="font-medium">{p.nombre}</span>
                  <span className="block text-grafito-2 tabular">
                    {p.restantes === 1 ? 'Te queda 1' : `Te quedan ${p.restantes}`} · vence el{' '}
                    {diaYMes(p.venceEn)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-chico text-grafito-2">
              No tenés créditos. Comprá un pack o pagá la clase suelta cuando reserves.
            </p>
          )}
          {datos.pagosPendientes.length > 0 && (
            <p className="mt-3 text-chico text-ambar-tinta">
              Tenés un pago de pack en proceso: los créditos aparecen cuando se acredite.
            </p>
          )}
          <Link href="/packs" className="mt-5 boton w-full boton-secundario">
            Comprar un pack
          </Link>
        </section>

        {datos.movimientos.length > 0 && (
          <section aria-labelledby="titulo-movimientos">
            <h2 id="titulo-movimientos" className="text-subtitulo font-semibold">
              Movimientos de créditos
            </h2>
            <table className="mt-3 w-full text-chico">
              <caption className="sr-only">Últimos movimientos de tus créditos</caption>
              <thead className="sr-only">
                <tr>
                  <th>Fecha</th>
                  <th>Motivo</th>
                  <th>Créditos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {datos.movimientos.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2 pr-3 whitespace-nowrap text-grafito-2 tabular">
                      {fechaCorta(m.creadoEn)}
                    </td>
                    <td className="py-2 pr-3">{MOTIVO[m.motivo]}</td>
                    <td
                      className={`py-2 text-right font-semibold tabular ${m.delta > 0 ? 'text-eucalipto' : ''}`}
                    >
                      {m.delta > 0 ? `+${m.delta}` : `−${Math.abs(m.delta)}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </aside>
    </div>
  )
}

function Esqueleto() {
  return (
    <div
      className="mt-6 grid gap-10 lg:grid-cols-[1fr_340px]"
      aria-busy="true"
      aria-label="Cargando tus reservas"
    >
      <div className="space-y-3">
        <div className="h-7 w-48 esqueleto" />
        <div className="h-20 esqueleto" />
        <div className="h-20 esqueleto" />
        <div className="h-20 esqueleto" />
      </div>
      <div className="h-64 esqueleto" />
    </div>
  )
}
