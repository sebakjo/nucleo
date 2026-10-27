import Link from 'next/link'
import { Marca } from '@/components/Logo'

export function Pie() {
  return (
    <footer className="mt-20 border-t border-linea">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 py-8 text-chico text-grafito-2 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="flex items-center gap-2">
          <Marca className="h-3.5 w-auto" />
          Núcleo, pilates reformer en Buenos Aires. Horarios en hora de Buenos Aires.
        </p>
        <p className="flex gap-5">
          <Link href="/caso" className="hover:text-grafito hover:underline">
            Cómo se hizo
          </Link>
          <a href="/antes" className="hover:text-grafito hover:underline">
            El prototipo de antes
          </a>
        </p>
      </div>
    </footer>
  )
}
