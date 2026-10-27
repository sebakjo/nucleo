import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { Barras, type Barra } from '@/components/admin/Barras'
import { Metrica, porcentaje } from '@/components/admin/Metrica'
import { EncabezadoPanel, EsqueletoPanel, fila, MarcoTabla, td, th, Vacio } from '@/components/admin/ui'
import { NavegacionSemana } from '@/components/horarios/NavegacionSemana'
import { metricasSemana } from '@/lib/consultas/admin'
import { precio } from '@/lib/dinero'
import { exigirRol } from '@/lib/sesion'
import {
  claveDia,
  diaDelMes,
  diaSemana,
  diaSemanaCorto,
  fechaCorta,
  hora,
  inicioDeSemana,
  rangoSemana,
  semanaDesdeClave,
  sumarSemanas,
} from '@/lib/tiempo'

export const metadata: Metadata = { title: 'Métricas' }

export default function PaginaMetricas({ searchParams }: PageProps<'/admin/metricas'>) {
  return (
    <Suspense fallback={<EsqueletoPanel />}>
      <Contenido searchParams={searchParams} />
    </Suspense>
  )
}

/** Tope "redondo" para el eje: 1, 2, 2,5 o 5 por potencia de 10. */
function topeRedondo(v: number): number {
  if (v <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(v))
  return ([1, 2, 2.5, 5, 10].find((m) => m * p >= v) ?? 10) * p
}

const compacto = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 })

function diferencia(actual: number, anterior: number, unidad: string): string {
  const d = actual - anterior
  if (d === 0) return `igual que la semana anterior`
  return `${d > 0 ? '+' : '−'}${Math.abs(d)} ${unidad} frente a la semana anterior`
}

async function Contenido({ searchParams }: { searchParams: PageProps<'/admin/metricas'>['searchParams'] }) {
  const sp = await searchParams
  await exigirRol(['admin'], '/admin/metricas')
  const ahora = new Date()
  const actual = inicioDeSemana(ahora)
  const lunes = semanaDesdeClave(typeof sp.semana === 'string' ? sp.semana : null) ?? actual
  const m = await metricasSemana(lunes)
  const ocupacion = porcentaje(m.actual.ocupados, m.actual.lugares)
  const ocupacionAnterior = porcentaje(m.anterior.ocupados, m.anterior.lugares)
  const fechaDe = (dia: string) => new Date(`${dia}T15:00:00Z`)

  const barrasOcupacion: Barra[] = m.porDia
    .filter((d) => d.lugares > 0)
    .map((d) => {
      const f = fechaDe(d.dia)
      const pct = porcentaje(d.ocupados, d.lugares)
      return {
        etiqueta: `${diaSemanaCorto(f)} ${diaDelMes(f)}`,
        etiquetaLarga: `${diaSemana(f)} ${diaDelMes(f)}`,
        valor: pct,
        texto: `${pct} % · ${d.ocupados} de ${d.lugares}`,
      }
    })
  const maxIngreso = topeRedondo(Math.max(...m.porDia.map((d) => d.ingresos)))
  const barrasIngresos: Barra[] = m.porDia.map((d) => {
    const f = fechaDe(d.dia)
    return {
      etiqueta: `${diaSemanaCorto(f)} ${diaDelMes(f)}`,
      etiquetaLarga: `${diaSemana(f)} ${diaDelMes(f)}`,
      valor: d.ingresos,
      texto: precio(d.ingresos),
    }
  })

  return (
    <>
      <EncabezadoPanel titulo="Métricas" descripcion={<span className="tabular">{rangoSemana(lunes)}</span>}>
        <NavegacionSemana
          anterior={claveDia(sumarSemanas(lunes, -1))}
          siguiente={claveDia(sumarSemanas(lunes, 1))}
          estaSemana={lunes.getTime() === actual.getTime()}
          base="/admin/metricas"
        />
      </EncabezadoPanel>

      <div className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)]">
        <Metrica
          grande
          etiqueta="Ocupación de la semana"
          valor={`${ocupacion} %`}
          detalle={
            <>
              <span className="tabular">
                {m.actual.ocupados} de {m.actual.lugares} lugares
              </span>{' '}
              · {diferencia(ocupacion, ocupacionAnterior, 'puntos')}
            </>
          }
        />
        <div className="grid grid-cols-2 gap-3">
          <Metrica
            etiqueta="Ingresos aprobados"
            valor={precio(m.actual.ingresos)}
            detalle={`semana anterior: ${precio(m.anterior.ingresos)}`}
          />
          <Metrica
            etiqueta="Cancelaciones tardías"
            valor={m.actual.tardias}
            detalle={`semana anterior: ${m.anterior.tardias}`}
          />
          <Metrica etiqueta="Clases completas" valor={`${m.actual.completas} de ${m.actual.clases}`} />
          <Metrica etiqueta="Personas en lista de espera" valor={m.enEspera} />
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Barras
          titulo="Ocupación por día"
          descripcion="Lugares reservados sobre lugares disponibles. Domingo cerrado."
          datos={barrasOcupacion}
          maximo={100}
          marcas={[
            { valor: 0, texto: '0 %' },
            { valor: 50, texto: '50 %' },
            { valor: 100, texto: '100 %' },
          ]}
          columnaValor="Ocupación"
        />
        <Barras
          titulo="Ingresos por día"
          descripcion="Pagos aprobados: packs y clases sueltas."
          datos={barrasIngresos}
          maximo={maxIngreso}
          marcas={[
            { valor: 0, texto: '$ 0' },
            { valor: maxIngreso / 2, texto: `$ ${compacto.format(maxIngreso / 2)}` },
            { valor: maxIngreso, texto: `$ ${compacto.format(maxIngreso)}` },
          ]}
          columnaValor="Ingresos"
        />
      </div>

      <section aria-labelledby="titulo-tardias" className="mt-8">
        <h2 id="titulo-tardias" className="text-seccion font-semibold">
          Cancelaciones tardías
        </h2>
        <p className="mt-1 mb-3 text-chico text-grafito-2">
          Menos de 12 horas antes de la clase: el crédito no se devuelve y el lugar pasa a la lista de espera.
        </p>
        {m.tardias.length ? (
          <MarcoTabla etiqueta="Cancelaciones tardías">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr>
                  <th className={th}>Persona</th>
                  <th className={th}>Clase</th>
                  <th className={th}>Canceló</th>
                  <th className={`${th} text-right`}>Antes de la clase</th>
                </tr>
              </thead>
              <tbody>
                {m.tardias.map((t) => {
                  const horas = t.canceladaEn
                    ? Math.max(0, Math.round((t.iniciaEn.getTime() - t.canceladaEn.getTime()) / 3_600_000))
                    : null
                  return (
                    <tr key={t.id} className={fila}>
                      <td className={td}>
                        <Link href={`/admin/alumnos/${t.usuarioId}`} className="font-medium hover:underline">
                          {t.nombre}
                        </Link>
                      </td>
                      <td className={td}>
                        {t.tipo}
                        <span className="block text-leyenda text-grafito-2 tabular">
                          {fechaCorta(t.iniciaEn)} · {hora(t.iniciaEn)}
                        </span>
                      </td>
                      <td className={`${td} tabular`}>
                        {t.canceladaEn ? `${fechaCorta(t.canceladaEn)} · ${hora(t.canceladaEn)}` : '—'}
                      </td>
                      <td className={`${td} text-right tabular`}>
                        {horas === null ? '—' : horas < 1 ? 'menos de 1 h' : `${horas} h`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </MarcoTabla>
        ) : (
          <Vacio>Nadie canceló tarde esta semana.</Vacio>
        )}
      </section>
    </>
  )
}
