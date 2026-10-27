import Link from 'next/link'
import { Logo } from '@/components/Logo'

export default function NoEncontrada() {
  return (
    <main
      id="contenido"
      className="mx-auto flex min-h-[70dvh] max-w-[1200px] flex-col justify-center px-4 sm:px-8"
    >
      <Link href="/" aria-label="Núcleo, ir a los horarios">
        <Logo />
      </Link>
      <h1 className="mt-8 text-titulo font-bold">No encontramos esta página</h1>
      <p className="mt-2 max-w-[50ch] text-grafito-2">
        Puede que la clase ya no exista o que el enlace tenga un error. Desde los horarios ves todas las
        clases de la semana.
      </p>
      <div className="mt-6">
        <Link href="/" className="boton boton-principal">
          Ver los horarios
        </Link>
      </div>
    </main>
  )
}
