import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { EncabezadoPanel, EsqueletoPanel, fila, MarcoTabla, td, th, Vacio } from '@/components/admin/ui'
import { listarAlumnos } from '@/lib/consultas/admin'
import { exigirRol } from '@/lib/sesion'
import { diaYMes, fechaCorta, hora } from '@/lib/tiempo'

export const metadata: Metadata = { title: 'Alumnos' }

export default function PaginaAlumnos({ searchParams }: PageProps<'/admin/alumnos'>) {
  return (
    <>
      <EncabezadoPanel
        titulo="Alumnos"
        descripcion="Créditos, próximas clases e historial de cada persona."
      />
      <Suspense fallback={<EsqueletoPanel />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
    </>
  )
}

async function Contenido({ searchParams }: { searchParams: PageProps<'/admin/alumnos'>['searchParams'] }) {
  const sp = await searchParams
  await exigirRol(['admin'], '/admin/alumnos')
  const q = typeof sp.q === 'string' ? sp.q.slice(0, 80) : ''
  const lista = await listarAlumnos(q, new Date())

  return (
    <div className="mt-6">
      <form role="search" className="flex max-w-md gap-2" action="/admin/alumnos">
        <label htmlFor="q" className="sr-only">
          Buscar por nombre o email
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Buscar por nombre o email"
          className="campo"
        />
        <button type="submit" className="boton boton-secundario">
          Buscar
        </button>
      </form>
      <p className="mt-4 mb-3 text-chico text-grafito-2 tabular" aria-live="polite">
        {q
          ? `${lista.length} ${lista.length === 1 ? 'resultado' : 'resultados'} para “${q}”`
          : `${lista.length} alumnos`}
      </p>
      {lista.length ? (
        <MarcoTabla etiqueta="Alumnos">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr>
                <th className={th}>Nombre</th>
                <th className={`${th} text-right`}>Créditos</th>
                <th className={th}>Próxima clase</th>
                <th className={`${th} text-right`}>Asistencias</th>
                <th className={`${th} text-right`}>Cancel. tardías</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((a) => (
                <tr key={a.id} className={fila}>
                  <td className={td}>
                    <Link href={`/admin/alumnos/${a.id}`} className="font-medium hover:underline">
                      {a.nombre}
                    </Link>
                    <span className="block text-leyenda text-grafito-2">{a.email}</span>
                  </td>
                  <td className={`${td} text-right tabular`}>
                    <span className="font-semibold">{a.creditos}</span>
                    {a.vence && a.creditos > 0 && (
                      <span className="block text-leyenda text-grafito-2">
                        vence {diaYMes(new Date(a.vence))}
                      </span>
                    )}
                  </td>
                  <td className={`${td} tabular`}>
                    {a.proxima ? (
                      `${fechaCorta(new Date(a.proxima))} · ${hora(new Date(a.proxima))}`
                    ) : (
                      <span className="text-grafito-2">—</span>
                    )}
                  </td>
                  <td className={`${td} text-right tabular`}>{a.asistencias}</td>
                  <td className={`${td} text-right tabular`}>{a.tardias}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </MarcoTabla>
      ) : (
        <Vacio>No encontramos alumnos con “{q}”. Probá con otra parte del nombre o del email.</Vacio>
      )}
    </div>
  )
}
