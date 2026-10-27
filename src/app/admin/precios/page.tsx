import type { Metadata } from 'next'
import { Suspense } from 'react'
import { FormularioPrecios } from '@/components/admin/Formularios'
import { EncabezadoPanel, EsqueletoPanel } from '@/components/admin/ui'
import { db } from '@/db'
import { productos } from '@/lib/consultas/admin'
import { precioClaseSuelta } from '@/lib/dominio/precios'
import { exigirRol } from '@/lib/sesion'

export const metadata: Metadata = { title: 'Precios' }

export default function PaginaPrecios() {
  return (
    <>
      <EncabezadoPanel
        titulo="Precios"
        descripcion="Los precios viven en el servidor: el navegador nunca los decide. Un cambio aplica a las compras que empiecen desde ahora."
      />
      <Suspense fallback={<EsqueletoPanel />}>
        <Contenido />
      </Suspense>
    </>
  )
}

async function Contenido() {
  await exigirRol(['admin'], '/admin/precios')
  const [clase, lista] = await Promise.all([precioClaseSuelta(db), productos()])
  const clave = [clase, ...lista.map((p) => `${p.precioArs}${p.activo}`)].join('-')
  return (
    <div className="mt-6 max-w-2xl">
      <FormularioPrecios key={clave} precioClase={clase} productos={lista} />
    </div>
  )
}
