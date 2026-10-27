import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { DETALLE_RECHAZO, ESTADO_PAGO } from '@/components/admin/estados'
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
import { listarPagos } from '@/lib/consultas/admin'
import { precio } from '@/lib/dinero'
import { exigirRol } from '@/lib/sesion'
import { fechaCorta, hora } from '@/lib/tiempo'

export const metadata: Metadata = { title: 'Pagos' }

const FILTROS = [
  { valor: null, texto: 'Todos' },
  { valor: 'aprobado', texto: 'Aprobados' },
  { valor: 'en_proceso', texto: 'En proceso' },
  { valor: 'rechazado', texto: 'Rechazados' },
  { valor: 'pendiente', texto: 'Sin completar' },
]

export default function PaginaPagos({ searchParams }: PageProps<'/admin/pagos'>) {
  return (
    <>
      <EncabezadoPanel
        titulo="Pagos"
        descripcion="Cada pago se confirma consultando a Mercado Pago, no con lo que dice el navegador."
      />
      <Suspense fallback={<EsqueletoPanel />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Contenido({ searchParams }: { searchParams: PageProps<'/admin/pagos'>['searchParams'] }) {
  const sp = await searchParams
  await exigirRol(['admin'], '/admin/pagos')
  const estado = typeof sp.estado === 'string' ? sp.estado : undefined
  const { filas, totales } = await listarPagos({ estado })
  const total = (e: string) => totales.find((t) => t.estado === e)
  const cuenta = (valor: string | null) =>
    valor ? (total(valor)?.n ?? 0) : totales.reduce((s, t) => s + t.n, 0)
  const aprobados = total('aprobado')

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-chico text-grafito-2">
          Aprobado en total:{' '}
          <span className="font-semibold text-grafito tabular">{precio(aprobados?.monto ?? 0)}</span>{' '}
          <span className="tabular">en {aprobados?.n ?? 0} pagos</span>
        </p>
        <a
          href={`/admin/pagos/exportar${estado && ESTADO_PAGO[estado] ? `?estado=${estado}` : ''}`}
          download
          className="boton boton-secundario"
        >
          Descargar CSV
        </a>
      </div>
      <nav aria-label="Filtrar por estado" className="mt-4 flex flex-wrap gap-2">
        {FILTROS.map((f) => {
          const activo = (f.valor ?? undefined) === estado || (!f.valor && !ESTADO_PAGO[estado ?? ''])
          return (
            <Link
              key={f.texto}
              href={f.valor ? `/admin/pagos?estado=${f.valor}` : '/admin/pagos'}
              aria-current={activo ? 'page' : undefined}
              className={`inline-flex min-h-10 items-center gap-2 rounded-boton border px-3 text-chico font-medium ${
                activo
                  ? 'border-grafito bg-grafito text-cal'
                  : 'border-linea bg-superficie text-grafito-2 hover:text-grafito'
              }`}
            >
              {f.texto}
              <span className="tabular opacity-75">{cuenta(f.valor)}</span>
            </Link>
          )
        })}
      </nav>
      <div className="mt-4">
        {filas.length ? (
          <MarcoTabla etiqueta="Pagos">
            <table className="w-full min-w-[820px]">
              <thead>
                <tr>
                  <th className={th}>Fecha</th>
                  <th className={th}>Persona</th>
                  <th className={th}>Concepto</th>
                  <th className={`${th} text-right`}>Monto</th>
                  <th className={th}>Estado</th>
                  <th className={th}>Operación</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((p) => {
                  const e = ESTADO_PAGO[p.estado]!
                  return (
                    <tr key={p.id} className={fila}>
                      <td className={`${td} whitespace-nowrap tabular`}>
                        {fechaCorta(p.creadoEn)} · {hora(p.creadoEn)}
                      </td>
                      <td className={td}>
                        <Link href={`/admin/alumnos/${p.usuarioId}`} className="font-medium hover:underline">
                          {p.nombre}
                        </Link>
                      </td>
                      <td className={td}>{p.descripcion}</td>
                      <td className={`${td} text-right font-semibold tabular`}>{precio(p.montoArs)}</td>
                      <td className={td}>
                        <Insignia tono={e.tono}>{e.texto}</Insignia>
                        {p.detalle && p.estado !== 'aprobado' && (
                          <span className="mt-0.5 block text-leyenda text-grafito-2">
                            {DETALLE_RECHAZO[p.detalle] ?? p.detalle}
                          </span>
                        )}
                      </td>
                      <td className={`${td} text-leyenda text-grafito-2`}>
                        {p.proveedor === 'simulado' ? 'Simulado' : 'Mercado Pago'}
                        {p.idExterno && <span className="block tabular">n.º {p.idExterno}</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </MarcoTabla>
        ) : (
          <Vacio>No hay pagos con este estado.</Vacio>
        )}
      </div>
      {filas.length === 150 && (
        <p className="mt-3 text-leyenda text-grafito-2">Se muestran los 150 más recientes.</p>
      )}
    </div>
  )
}
