import { Encabezado } from '@/components/sitio/Encabezado'
import { Pie } from '@/components/sitio/Pie'

export default function LayoutSitio({ children }: LayoutProps<'/'>) {
  return (
    <>
      <Encabezado />
      <main id="contenido" className="mx-auto max-w-[1200px] px-4 pt-8 sm:px-8">
        {children}
      </main>
      <Pie />
    </>
  )
}
