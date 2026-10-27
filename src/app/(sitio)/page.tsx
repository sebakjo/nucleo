import { connection } from 'next/server'
import { Suspense } from 'react'
import { GrillaSemanal } from '@/components/horarios/GrillaSemanal'
import { Leyenda } from '@/components/horarios/Leyenda'
import { NavegacionSemana } from '@/components/horarios/NavegacionSemana'
import { clasesDeLaSemana } from '@/lib/consultas/horarios'
import { usuarioActual } from '@/lib/sesion'
import { claveDia, diaIso, inicioDeSemana, rangoSemana, semanaDesdeClave, sumarSemanas } from '@/lib/tiempo'
import { EsqueletoSemana } from './EsqueletoSemana'
import { Estudio } from './Estudio'

export default function PaginaHorarios({ searchParams }: PageProps<'/'>) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-titulo font-bold tracking-[-0.01em]">Horarios de la semana</h1>
        <p className="max-w-[60ch] text-grafito-2">
          Seis reformers por clase. Elegí un horario con lugar y reservalo con un crédito o pagando la clase
          suelta.
        </p>
      </div>
      <Suspense fallback={<EsqueletoSemana />}>
        <Semana searchParams={searchParams} />
      </Suspense>
      <Estudio />
    </>
  )
}

async function Semana({ searchParams }: { searchParams: PageProps<'/'>['searchParams'] }) {
  const sp = await searchParams
  await connection()
  const ahora = new Date()
  const actual = inicioDeSemana(ahora)
  const pedida = semanaDesdeClave(typeof sp.semana === 'string' ? sp.semana : null)
  const lunes = pedida ?? actual
  const usuario = await usuarioActual()
  const clases = await clasesDeLaSemana(lunes, usuario?.id ?? null, ahora)
  const hayDomingo = clases.some((c) => diaIso(new Date(c.iniciaEn)) === 7)
  const dias = Array.from({ length: hayDomingo ? 7 : 6 }, (_, i) => {
    const inicio = new Date(lunes.getTime() + i * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000)
    return { clave: claveDia(inicio), inicio: inicio.toISOString() }
  })
  const clave = claveDia(lunes)

  return (
    <section aria-labelledby="titulo-semana" className="mt-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="titulo-semana" className="text-seccion font-semibold tabular">
          {rangoSemana(lunes)}
        </h2>
        <NavegacionSemana
          anterior={claveDia(sumarSemanas(lunes, -1))}
          siguiente={claveDia(sumarSemanas(lunes, 1))}
          estaSemana={lunes.getTime() === actual.getTime()}
        />
      </div>
      <div className="mt-4">
        <Leyenda />
      </div>
      <div className="mt-4">
        {clases.length ? (
          <GrillaSemanal key={clave} clases={clases} ahora={ahora.toISOString()} semana={clave} dias={dias} />
        ) : (
          <p className="rounded-bloque border border-dashed border-linea p-8 text-center text-grafito-2">
            Todavía no hay clases cargadas para esta semana. Mirá la semana actual o la siguiente.
          </p>
        )}
      </div>
      {!hayDomingo && <p className="mt-3 text-chico text-grafito-2">Los domingos el estudio está cerrado.</p>}
    </section>
  )
}
