import type { Metadata } from 'next'
import { Suspense } from 'react'
import { marcarAsistio } from '@/app/acciones/admin'
import { Avisos, BotonAsistencia } from '@/components/admin/Acciones'
import { Carriles } from '@/components/Carriles'
import { NavegacionSemana } from '@/components/horarios/NavegacionSemana'
import { clasesDeInstructor, listasDeClases } from '@/lib/consultas/admin'
import { exigirRol } from '@/lib/sesion'
import {
  claveDia,
  diaDelMes,
  diaSemana,
  hora,
  inicioDeSemana,
  rangoSemana,
  semanaDesdeClave,
  sumarSemanas,
} from '@/lib/tiempo'

export const metadata: Metadata = { title: 'Mis clases', robots: { index: false } }

export default function PaginaInstructor({ searchParams }: PageProps<'/instructor'>) {
  return (
    <>
      <h1 className="text-titulo font-bold">Mis clases</h1>
      <Suspense fallback={<div className="mt-6 h-96 esqueleto" />}>
        <Contenido searchParams={searchParams} />
      </Suspense>
      <Avisos />
    </>
  )
}

const MARGEN_ASISTENCIA_MS = 30 * 60 * 1000

async function Contenido({ searchParams }: { searchParams: PageProps<'/instructor'>['searchParams'] }) {
  const sp = await searchParams
  const u = await exigirRol(['instructor', 'admin'], '/instructor')
  const ahora = new Date()
  const actual = inicioDeSemana(ahora)
  const lunes = semanaDesdeClave(typeof sp.semana === 'string' ? sp.semana : null) ?? actual
  const datos = await clasesDeInstructor(u.id, lunes)
  if (!datos) {
    return (
      <p className="mt-6 max-w-[60ch] text-grafito-2">
        Tu cuenta no está asociada a ningún instructor. Desde el panel podés ver la agenda completa.
      </p>
    )
  }
  const listas = await listasDeClases(
    datos.clases.map((c) => c.id),
    ahora,
  )

  return (
    <>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <p className="text-grafito-2">
          {datos.instructor.nombre} · <span className="tabular">{rangoSemana(lunes)}</span>
        </p>
        <NavegacionSemana
          anterior={claveDia(sumarSemanas(lunes, -1))}
          siguiente={claveDia(sumarSemanas(lunes, 1))}
          estaSemana={lunes.getTime() === actual.getTime()}
          base="/instructor"
        />
      </div>
      {datos.clases.length ? (
        <ul className="mt-6 grid gap-3">
          {datos.clases.map((c) => {
            const lista = listas.get(c.id) ?? []
            const abierta =
              c.estado !== 'cancelada' && c.iniciaEn.getTime() - MARGEN_ASISTENCIA_MS <= ahora.getTime()
            return (
              <li key={c.id} className="rounded-bloque border border-linea bg-superficie p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {diaSemana(c.iniciaEn)} {diaDelMes(c.iniciaEn)} ·{' '}
                      <span className="tabular">{hora(c.iniciaEn)}</span> · {c.tipo}
                    </p>
                    <p className="text-chico text-grafito-2">
                      {c.estado === 'cancelada'
                        ? 'Cancelada'
                        : `${lista.length} de ${c.cupo} lugares${abierta ? '' : ' · la asistencia se marca desde 30 min antes'}`}
                    </p>
                  </div>
                  <Carriles cupo={c.cupo} ocupados={lista.map((r) => r.reformer)} />
                </div>
                {lista.length > 0 && c.estado !== 'cancelada' && (
                  <ol className="mt-3 divide-y divide-linea border-t border-linea">
                    {lista.map((r) => (
                      <li key={r.id} className="flex min-h-12 items-center gap-3 py-1.5">
                        <span className="w-6 text-right text-chico font-semibold tabular">{r.reformer}</span>
                        <span className="flex-1">{r.nombre}</span>
                        {r.estado === 'pendiente_pago' ? (
                          <span className="text-leyenda text-grafito-2">pagando</span>
                        ) : (
                          abierta && (
                            <BotonAsistencia
                              accion={marcarAsistio.bind(null, r.id)}
                              asistio={r.estado === 'asistio'}
                              nombre={r.nombre}
                            />
                          )
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-6 text-grafito-2">No tenés clases esta semana.</p>
      )}
    </>
  )
}
