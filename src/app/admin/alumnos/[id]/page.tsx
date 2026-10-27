import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import {
  DETALLE_RECHAZO,
  ESTADO_PACK,
  ESTADO_PAGO,
  ESTADO_RESERVA,
  MOTIVO_MOVIMIENTO,
} from '@/components/admin/estados'
import { FormularioAjuste } from '@/components/admin/Formularios'
import { EsqueletoPanel, fila, Insignia, MarcoTabla, td, th, Vacio } from '@/components/admin/ui'
import { fichaAlumno } from '@/lib/consultas/admin'
import { precio } from '@/lib/dinero'
import { exigirRol } from '@/lib/sesion'
import { diaYMes, fechaCorta, fechaLarga, hora } from '@/lib/tiempo'

export const metadata: Metadata = { title: 'Ficha de alumno' }

export default function PaginaFicha({ params }: PageProps<'/admin/alumnos/[id]'>) {
  return (
    <>
      <Link href="/admin/alumnos" className="text-chico font-medium text-eucalipto hover:underline">
        Todos los alumnos
      </Link>
      <Suspense fallback={<EsqueletoPanel />}>
        <Ficha params={params} />
      </Suspense>
    </>
  )
}

async function Ficha({ params }: { params: PageProps<'/admin/alumnos/[id]'>['params'] }) {
  const { id } = await params
  await exigirRol(['admin'], `/admin/alumnos/${id}`)
  const ahora = new Date()
  const f = await fichaAlumno(id, ahora)
  if (!f) notFound()
  const proximas = f.historial.filter(
    (r) => r.iniciaEn > ahora && ['confirmada', 'pendiente_pago'].includes(r.estado),
  )

  return (
    <>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-titulo font-bold">{f.alumno.nombre}</h1>
          <p className="mt-1 text-grafito-2">
            {f.alumno.email} · se registró el {fechaLarga(f.alumno.desde)}
          </p>
        </div>
      </div>

      <div className="mt-6 grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid min-w-0 gap-8">
          <section aria-labelledby="titulo-reservas">
            <h2 id="titulo-reservas" className="text-seccion font-semibold">
              Reservas
            </h2>
            <p className="mt-1 mb-3 text-chico text-grafito-2">
              {proximas.length ? `${proximas.length} por venir · ` : ''}últimas {f.historial.length}
            </p>
            {f.historial.length ? (
              <MarcoTabla etiqueta="Reservas">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr>
                      <th className={th}>Clase</th>
                      <th className={th}>Cuándo</th>
                      <th className={th}>Cómo</th>
                      <th className={th}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.historial.map((r) => {
                      const e = ESTADO_RESERVA[r.estado]!
                      return (
                        <tr key={r.id} className={fila}>
                          <td className={td}>
                            {r.tipo}
                            <span className="block text-leyenda text-grafito-2">con {r.instructor}</span>
                          </td>
                          <td className={`${td} tabular`}>
                            {fechaCorta(r.iniciaEn)} · {hora(r.iniciaEn)}
                          </td>
                          <td className={td}>{r.medio === 'credito' ? 'Crédito' : 'Clase suelta'}</td>
                          <td className={td}>
                            <Insignia tono={e.tono}>{e.texto}</Insignia>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </MarcoTabla>
            ) : (
              <Vacio>Todavía no reservó ninguna clase.</Vacio>
            )}
          </section>

          <section aria-labelledby="titulo-movimientos">
            <h2 id="titulo-movimientos" className="text-seccion font-semibold">
              Movimientos de créditos
            </h2>
            <p className="mt-1 mb-3 text-chico text-grafito-2">
              Cada crédito que entra o sale, con su motivo.
            </p>
            {f.movimientos.length ? (
              <MarcoTabla etiqueta="Movimientos de créditos">
                <table className="w-full min-w-[560px]">
                  <thead>
                    <tr>
                      <th className={th}>Fecha</th>
                      <th className={th}>Motivo</th>
                      <th className={th}>Pack</th>
                      <th className={`${th} text-right`}>Créditos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {f.movimientos.map((m) => (
                      <tr key={m.id} className={fila}>
                        <td className={`${td} tabular`}>
                          {fechaCorta(m.creadoEn)} · {hora(m.creadoEn)}
                        </td>
                        <td className={td}>
                          {MOTIVO_MOVIMIENTO[m.motivo] ?? m.motivo}
                          {m.nota && <span className="block text-leyenda text-grafito-2">{m.nota}</span>}
                        </td>
                        <td className={`${td} text-grafito-2`}>{m.pack}</td>
                        <td className={`${td} text-right font-semibold tabular`}>
                          {m.delta > 0 ? `+${m.delta}` : `−${Math.abs(m.delta)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </MarcoTabla>
            ) : (
              <Vacio>Sin movimientos de créditos.</Vacio>
            )}
          </section>

          <section aria-labelledby="titulo-pagos">
            <h2 id="titulo-pagos" className="text-seccion font-semibold">
              Pagos
            </h2>
            <div className="mt-3">
              {f.pagos.length ? (
                <MarcoTabla etiqueta="Pagos">
                  <table className="w-full min-w-[560px]">
                    <thead>
                      <tr>
                        <th className={th}>Fecha</th>
                        <th className={th}>Concepto</th>
                        <th className={`${th} text-right`}>Monto</th>
                        <th className={th}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {f.pagos.map((p) => {
                        const e = ESTADO_PAGO[p.estado]!
                        return (
                          <tr key={p.id} className={fila}>
                            <td className={`${td} tabular`}>{fechaCorta(p.creadoEn)}</td>
                            <td className={td}>{p.descripcion}</td>
                            <td className={`${td} text-right tabular`}>{precio(p.montoArs)}</td>
                            <td className={td}>
                              <Insignia tono={e.tono}>{e.texto}</Insignia>
                              {p.estado === 'rechazado' && p.detalleEstado && (
                                <span className="mt-0.5 block text-leyenda text-grafito-2">
                                  {DETALLE_RECHAZO[p.detalleEstado] ?? p.detalleEstado}
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </MarcoTabla>
              ) : (
                <Vacio>Sin pagos.</Vacio>
              )}
            </div>
          </section>
        </div>

        <aside className="grid gap-6 xl:sticky xl:top-6">
          <section
            aria-labelledby="titulo-creditos"
            className="rounded-bloque border border-linea bg-superficie p-5"
          >
            <h2 id="titulo-creditos" className="text-chico text-grafito-2">
              Créditos vigentes
            </h2>
            <p className="mt-1 text-dato-grande font-semibold tabular">{f.creditos}</p>
            <ul className="mt-3 grid gap-1.5 text-chico">
              {f.packs
                .filter((p) => p.estado !== 'pendiente_pago')
                .slice(0, 6)
                .map((p) => {
                  const e = ESTADO_PACK[p.estado]!
                  const vigente = p.estado === 'activo' && p.venceEn && p.venceEn > ahora
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-3">
                      <span className="min-w-0">
                        {p.nombre}
                        <span className="block text-leyenda text-grafito-2 tabular">
                          {p.creditosRestantes} de {p.creditosTotales}
                          {p.venceEn && ` · ${vigente ? 'vence' : 'venció'} ${diaYMes(p.venceEn)}`}
                        </span>
                      </span>
                      <Insignia tono={vigente ? e.tono : 'neutro'}>{vigente ? e.texto : 'Vencido'}</Insignia>
                    </li>
                  )
                })}
            </ul>
            <div className="mt-5 border-t border-linea pt-4">
              <FormularioAjuste usuarioId={f.alumno.id} />
            </div>
          </section>
        </aside>
      </div>
    </>
  )
}
