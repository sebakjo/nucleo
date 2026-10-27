import type { Metadata } from 'next'
import Link from 'next/link'
import { Suspense } from 'react'
import { AtajosAgenda } from '@/components/admin/AtajosAgenda'
import { CajonClase } from '@/components/admin/CajonClase'
import { DetalleClase } from '@/components/admin/DetalleClase'
import { GrillaAgenda } from '@/components/admin/GrillaAgenda'
import { Metrica, porcentaje } from '@/components/admin/Metrica'
import { EncabezadoPanel, EsqueletoPanel, Vacio } from '@/components/admin/ui'
import { NavegacionSemana } from '@/components/horarios/NavegacionSemana'
import { agendaSemana, detalleClaseAdmin, metricasSemana } from '@/lib/consultas/admin'
import { precio } from '@/lib/dinero'
import { exigirRol } from '@/lib/sesion'
import {
  claveDia,
  diaSemana,
  diaDelMes,
  hora,
  inicioDeSemana,
  rangoSemana,
  semanaDesdeClave,
  sumarSemanas,
} from '@/lib/tiempo'

export const metadata: Metadata = { title: 'Agenda' }

export default function PaginaAgenda({ searchParams }: PageProps<'/admin'>) {
  return (
    <Suspense fallback={<EsqueletoPanel />}>
      <Agenda searchParams={searchParams} />
    </Suspense>
  )
}

const Tecla = ({ children }: { children: string }) => (
  <kbd className="rounded-[4px] border border-linea bg-superficie px-1.5 py-0.5 font-sans text-leyenda font-semibold">
    {children}
  </kbd>
)

async function Agenda({ searchParams }: { searchParams: PageProps<'/admin'>['searchParams'] }) {
  const sp = await searchParams
  await exigirRol(['admin'], '/admin')
  const ahora = new Date()
  const actual = inicioDeSemana(ahora)
  const lunes = semanaDesdeClave(typeof sp.semana === 'string' ? sp.semana : null) ?? actual
  const semana = claveDia(lunes)
  const claseId = typeof sp.clase === 'string' ? sp.clase : null
  const [clases, m, detalle] = await Promise.all([
    agendaSemana(lunes, ahora),
    metricasSemana(lunes),
    claseId ? detalleClaseAdmin(claseId, ahora) : null,
  ])
  const anterior = `/admin?semana=${claveDia(sumarSemanas(lunes, -1))}`
  const siguiente = `/admin?semana=${claveDia(sumarSemanas(lunes, 1))}`
  const ocupacion = porcentaje(m.actual.ocupados, m.actual.lugares)

  return (
    <>
      <EncabezadoPanel titulo="Agenda" descripcion={<span className="tabular">{rangoSemana(lunes)}</span>}>
        <NavegacionSemana
          anterior={claveDia(sumarSemanas(lunes, -1))}
          siguiente={claveDia(sumarSemanas(lunes, 1))}
          estaSemana={lunes.getTime() === actual.getTime()}
          base="/admin"
        />
      </EncabezadoPanel>
      <AtajosAgenda anterior={anterior} siguiente={siguiente} actual="/admin" />

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metrica
          etiqueta="Ocupación"
          valor={`${ocupacion} %`}
          detalle={`${m.actual.ocupados} de ${m.actual.lugares} lugares`}
        />
        <Metrica
          etiqueta="Ingresos de la semana"
          valor={precio(m.actual.ingresos)}
          detalle={m.actual.pagos === 1 ? '1 pago aprobado' : `${m.actual.pagos} pagos aprobados`}
        />
        <Metrica
          etiqueta="Cancelaciones tardías"
          valor={m.actual.tardias}
          detalle="El crédito no se devuelve"
        />
        <Metrica
          etiqueta="En lista de espera"
          valor={m.enEspera}
          detalle={m.actual.completas === 1 ? '1 clase completa' : `${m.actual.completas} clases completas`}
        />
      </div>

      <div className="mt-6">
        {clases.length ? (
          <GrillaAgenda
            clases={clases}
            ahora={ahora}
            lunes={lunes}
            semana={semana}
            seleccionada={detalle?.clase.id ?? null}
          />
        ) : (
          <Vacio>
            No hay clases esta semana. Se generan desde las{' '}
            <Link href="/admin/plantillas" className="font-medium text-eucalipto hover:underline">
              plantillas
            </Link>
            .
          </Vacio>
        )}
      </div>

      <p className="mt-4 hidden flex-wrap items-center gap-x-4 gap-y-2 text-leyenda text-grafito-2 md:flex">
        <span>
          <Tecla>j</Tecla> semana anterior
        </span>
        <span>
          <Tecla>k</Tecla> siguiente
        </span>
        <span>
          <Tecla>t</Tecla> esta semana
        </span>
        <span className="ml-auto">
          <Link href="/admin/metricas" className="font-medium text-eucalipto hover:underline">
            Ver métricas de la semana
          </Link>
        </span>
      </p>

      {detalle && (
        <CajonClase
          key={detalle.clase.id}
          titulo={`${diaSemana(detalle.clase.iniciaEn)} ${diaDelMes(detalle.clase.iniciaEn)} · ${hora(detalle.clase.iniciaEn)}`}
          descripcion={`${detalle.clase.tipo} con ${detalle.clase.instructor}`}
          cerrar={`/admin?semana=${semana}`}
        >
          <DetalleClase detalle={detalle} ahora={ahora} />
        </CajonClase>
      )}
    </>
  )
}
