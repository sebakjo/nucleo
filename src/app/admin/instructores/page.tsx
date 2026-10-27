import type { Metadata } from 'next'
import { connection } from 'next/server'
import { Suspense } from 'react'
import { cambiarInstructor } from '@/app/acciones/admin'
import { Interruptor } from '@/components/admin/Acciones'
import { FormularioInstructor } from '@/components/admin/Formularios'
import { EncabezadoPanel, EsqueletoPanel, iniciales } from '@/components/admin/ui'
import { listarInstructores } from '@/lib/consultas/admin'
import { exigirRol } from '@/lib/sesion'

export const metadata: Metadata = { title: 'Instructores' }

export default function PaginaInstructores() {
  return (
    <>
      <EncabezadoPanel
        titulo="Instructores"
        descripcion="Quién da cada clase. Sin fotos: cada persona se muestra con sus iniciales."
      />
      <Suspense fallback={<EsqueletoPanel />}>
        <Contenido />
      </Suspense>
    </>
  )
}

async function Contenido() {
  await exigirRol(['admin'], '/admin/instructores')
  await connection()
  const lista = await listarInstructores(new Date())
  return (
    <div className="mt-6 grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
      <ul className="divide-y divide-linea rounded-bloque border border-linea bg-superficie">
        {lista.map((i) => (
          <li key={i.id} className="flex flex-wrap items-start gap-4 px-4 py-4 sm:flex-nowrap sm:px-5">
            <span
              aria-hidden="true"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-eucalipto-tenue text-chico font-bold text-eucalipto"
            >
              {iniciales(i.nombre)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{i.nombre}</p>
              {i.bio && <p className="mt-0.5 text-chico text-grafito-2">{i.bio}</p>}
              <p className="mt-2 text-leyenda text-grafito-2 tabular">
                {i.plantillas} {i.plantillas === 1 ? 'plantilla activa' : 'plantillas activas'} · {i.proximas}{' '}
                {i.proximas === 1 ? 'clase próxima' : 'clases próximas'}
                {i.conCuenta && ' · ve su lista desde su cuenta'}
              </p>
            </div>
            <Interruptor
              accion={cambiarInstructor.bind(null, i.id)}
              activo={i.activo}
              etiqueta={`${i.nombre}: activo`}
              textos={['Activo', 'De baja']}
            />
          </li>
        ))}
      </ul>
      <FormularioInstructor />
    </div>
  )
}
