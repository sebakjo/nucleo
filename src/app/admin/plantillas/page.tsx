import type { Metadata } from 'next'
import { Suspense } from 'react'
import { cambiarPlantilla } from '@/app/acciones/admin'
import { Interruptor } from '@/components/admin/Acciones'
import { FormularioPlantilla } from '@/components/admin/Formularios'
import { EncabezadoPanel, EsqueletoPanel, fila, MarcoTabla, td, th } from '@/components/admin/ui'
import { catalogo, listarPlantillas } from '@/lib/consultas/admin'
import { exigirRol } from '@/lib/sesion'

export const metadata: Metadata = { title: 'Plantillas' }

const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export default function PaginaPlantillas() {
  return (
    <>
      <EncabezadoPanel
        titulo="Plantillas"
        descripcion="La semana tipo del estudio. Cada plantilla genera sus clases automáticamente, tres semanas hacia adelante."
      />
      <Suspense fallback={<EsqueletoPanel />}>
        <Contenido />
      </Suspense>
    </>
  )
}

async function Contenido() {
  await exigirRol(['admin'], '/admin/plantillas')
  const [lista, { tipos, instructores }] = await Promise.all([listarPlantillas(), catalogo()])
  const activas = lista.filter((p) => p.activa).length

  return (
    <div className="mt-6 grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section aria-labelledby="titulo-semana-tipo">
        <h2 id="titulo-semana-tipo" className="sr-only">
          Semana tipo
        </h2>
        <p className="mb-3 text-chico text-grafito-2 tabular">
          {activas} plantillas activas de {lista.length}
        </p>
        <MarcoTabla etiqueta="Plantillas de la semana">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr>
                <th className={th}>Día</th>
                <th className={th}>Hora</th>
                <th className={th}>Clase</th>
                <th className={th}>Instructor</th>
                <th className={`${th} text-right`}>Lugares</th>
                <th className={`${th} text-right`}>Duración</th>
                <th className={th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((p, i) => {
                const primeraDelDia = i === 0 || lista[i - 1]!.diaSemana !== p.diaSemana
                return (
                  <tr key={p.id} className={primeraDelDia && i > 0 ? 'border-t-2 border-linea' : fila}>
                    <td className={`${td} font-semibold`}>{primeraDelDia ? DIAS[p.diaSemana] : ''}</td>
                    <td className={`${td} font-semibold tabular`}>{p.hora}</td>
                    <td className={td}>{p.tipo}</td>
                    <td className={td}>{p.instructor}</td>
                    <td className={`${td} text-right tabular`}>{p.cupo}</td>
                    <td className={`${td} text-right tabular`}>{p.duracionMin} min</td>
                    <td className="px-3 py-1">
                      <Interruptor
                        accion={cambiarPlantilla.bind(null, p.id)}
                        activo={p.activa}
                        etiqueta={`${DIAS[p.diaSemana]} ${p.hora}, ${p.tipo}: activa`}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </MarcoTabla>
        <p className="mt-3 text-leyenda text-grafito-2">
          Pausar una plantilla deja de generar clases nuevas. Las clases ya generadas siguen en la agenda: si
          hace falta, cancelalas desde ahí.
        </p>
      </section>
      <FormularioPlantilla
        tipos={tipos.map((t) => ({ id: t.id, nombre: t.nombre, duracionMin: t.duracionMin }))}
        instructores={instructores.filter((i) => i.activo).map((i) => ({ id: i.id, nombre: i.nombre }))}
      />
    </div>
  )
}
