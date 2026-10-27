import type { Metadata } from 'next'
import Link from 'next/link'
import concurrencia from '@metricas/concurrencia.json'
import lighthouse from '@metricas/lighthouse.json'
import tests from '@metricas/tests.json'
import { Comparador } from '@/components/caso/Comparador'
import { Simulacion } from '@/components/caso/Simulacion'

export const metadata: Metadata = {
  title: 'De prototipo a producción',
  description:
    'Cómo un prototipo de reservas hecho con IA pasó a producción: sin sobreventa, con pagos reales verificados y una prueba en vivo de 20 reservas simultáneas.',
}

const PROBLEMAS = [
  {
    problema: 'Las reservas se guardaban en el localStorage de cada navegador.',
    solucion: 'Cada reserva vive en PostgreSQL, con una restricción única por alumno y clase.',
    importa: 'El estudio no veía las reservas: cada persona tenía su propia agenda.',
  },
  {
    problema:
      'El cupo se contaba con las reservas de ese navegador; chequear y guardar eran dos pasos sueltos.',
    solucion: 'En una transacción: SELECT … FOR UPDATE sobre la clase, contar y recién ahí insertar.',
    importa: 'Con 20 personas a la vez se vendían 20 lugares de 6. Abajo lo podés ver en vivo.',
  },
  {
    problema: 'El precio salía de un atributo del botón y los cupones estaban en el código.',
    solucion: 'El servidor define el precio al crear el pago. El navegador no manda montos.',
    importa: 'Cualquiera podía pagar lo que quisiera desde las herramientas del navegador.',
  },
  {
    problema: 'Pagar era esperar un segundo y marcar la reserva como pagada.',
    solucion:
      'Mercado Pago Checkout Pro. El webhook valida x-signature, consulta el estado real y es idempotente.',
    importa:
      'Se podían confirmar clases sin cobrar, y una notificación repetida no puede acreditar dos veces.',
  },
  {
    problema: 'Sin cuentas: cualquiera cancelaba cualquier reserva, en cualquier momento.',
    solucion:
      'Roles y autorización en cada acción del servidor. La regla de 12 horas vive en un solo lugar, con tests.',
    importa: 'Cancelar a último momento devolvía el lugar sin costo, y se podían cancelar reservas ajenas.',
  },
  {
    problema: 'Horarios calculados con la zona horaria del navegador.',
    solucion: 'Todo se guarda en UTC y se muestra en hora de Buenos Aires.',
    importa: 'Desde otro país (o con la compu mal configurada) la clase aparecía a otra hora.',
  },
  {
    problema: 'Sin validación, y los nombres se insertaban como HTML.',
    solucion: 'Validación con zod en el servidor; React escapa todo el texto que muestra.',
    importa: 'Un "nombre" con HTML podía ejecutar código en la página del estudio.',
  },
]

const CATEGORIAS = [
  ['rendimiento', 'Rendimiento'],
  ['accesibilidad', 'Accesibilidad'],
  ['buenasPracticas', 'Buenas prácticas'],
  ['seo', 'SEO'],
] as const

type PaginaLighthouse = { ruta: string; nombre: string } & Partial<
  Record<(typeof CATEGORIAS)[number][0], number>
>

export default function PaginaCaso() {
  const paginas = lighthouse.paginas as PaginaLighthouse[]
  return (
    <article className="pb-8">
      <header className="max-w-[46rem]">
        <h1 className="text-[1.875rem] leading-[2.125rem] font-bold tracking-[-0.02em] sm:text-titular">
          De prototipo a producción
        </h1>
        <p className="mt-4 text-subtitulo text-grafito-2">
          Núcleo es un estudio de pilates reformer con seis lugares por clase. Tenía un prototipo de reservas
          hecho con IA que se veía bien y vendía lugares que no existían. Esta es la versión que puede cobrar
          de verdad.
        </p>
        <p className="mt-3 text-chico text-grafito-2">
          El estudio es ficticio. Podés abrir{' '}
          <a href="/antes" className="font-medium text-eucalipto underline">
            el prototipo original
          </a>{' '}
          y{' '}
          <Link href="/entrar" className="font-medium text-eucalipto underline">
            probar la versión nueva
          </Link>{' '}
          con las cuentas de demostración.
        </p>
      </header>

      <section aria-label="Antes y después" className="mt-8">
        <Comparador />
      </section>

      <section aria-labelledby="titulo-problemas" className="mt-14">
        <h2 id="titulo-problemas" className="text-titulo font-bold">
          Qué se arregló
        </h2>
        <p className="mt-1 max-w-[60ch] text-grafito-2">
          Los siete problemas están marcados con un comentario PROBLEMA en el código del prototipo.
        </p>
        <table className="mt-5 w-full border-collapse text-chico max-md:block">
          <thead className="max-md:hidden">
            <tr className="border-b border-grafito/30 text-left">
              <th scope="col" className="w-8 py-2 pr-2 font-semibold text-grafito-2">
                <span className="sr-only">Número</span>
              </th>
              <th scope="col" className="py-2 pr-6 font-semibold text-grafito-2">
                En el prototipo
              </th>
              <th scope="col" className="py-2 pr-6 font-semibold text-grafito-2">
                En producción
              </th>
              <th scope="col" className="py-2 font-semibold text-grafito-2">
                Por qué importa
              </th>
            </tr>
          </thead>
          <tbody className="max-md:block">
            {PROBLEMAS.map((p, i) => (
              <tr key={i} className="border-b border-linea align-top max-md:grid max-md:gap-2 max-md:py-4">
                <td className="py-3 pr-2 font-semibold text-grafito-2 tabular max-md:py-0">{i + 1}</td>
                <td className="py-3 pr-6 font-medium max-md:py-0">{p.problema}</td>
                <td className="py-3 pr-6 max-md:py-0">
                  <span className="text-leyenda font-semibold text-grafito-2 md:hidden">En producción: </span>
                  {p.solucion}
                </td>
                <td className="py-3 text-grafito-2 max-md:py-0">
                  <span className="text-leyenda font-semibold md:hidden">Por qué importa: </span>
                  {p.importa}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="titulo-prueba" className="mt-14">
        <h2 id="titulo-prueba" className="text-titulo font-bold">
          La prueba: 20 personas, 6 reformers
        </h2>
        <p className="mt-1 mb-6 max-w-[62ch] text-grafito-2">
          El botón corre las dos versiones en el servidor, sobre una clase aislada que se reinicia en cada
          corrida: el código de reserva del prototipo y el de producción contra PostgreSQL, con 20 conexiones
          a la vez.
        </p>
        <Simulacion />
      </section>

      <section aria-labelledby="titulo-numeros" className="mt-14">
        <h2 id="titulo-numeros" className="text-titulo font-bold">
          Números medidos
        </h2>
        <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="min-w-0">
            <h3 className="text-subtitulo font-semibold">Lighthouse</h3>
            <p className="text-chico text-grafito-2">{lighthouse.herramienta}.</p>
            {paginas.length ? (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[520px] text-chico">
                  <thead>
                    <tr className="border-b border-grafito/30 text-left">
                      <th scope="col" className="py-2 pr-4 font-semibold text-grafito-2">
                        Página
                      </th>
                      {CATEGORIAS.map(([, nombre]) => (
                        <th
                          key={nombre}
                          scope="col"
                          className="py-2 pr-2 text-right font-semibold text-grafito-2"
                        >
                          {nombre}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginas.map((p) => (
                      <tr key={p.ruta} className="border-b border-linea">
                        <th scope="row" className="py-2.5 pr-4 text-left font-medium">
                          {p.nombre}
                          <span className="block text-leyenda font-normal text-grafito-2">{p.ruta}</span>
                        </th>
                        {CATEGORIAS.map(([clave]) => (
                          <td key={clave} className="py-2.5 pr-2 text-right text-dato font-semibold tabular">
                            {p[clave] ?? '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-3 text-chico text-grafito-2">Se miden al publicar el proyecto.</p>
            )}
          </div>
          <dl className="grid content-start gap-5">
            <div>
              <dt className="text-chico text-grafito-2">
                Concurrencia, en el test de integración contra PostgreSQL
              </dt>
              <dd className="mt-1">
                <span className="text-dato font-semibold tabular">
                  {concurrencia.intentos} intentos, {concurrencia.confirmadas} confirmadas
                </span>
                <span className="block text-chico text-grafito-2">
                  {concurrencia.rechazadasPorCupo} rechazadas por cupo, reformers{' '}
                  {concurrencia.reformers.join(', ')}, en {concurrencia.duracionMs} ms.
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-chico text-grafito-2">Tests automáticos</dt>
              <dd className="mt-1">
                <span className="text-dato font-semibold tabular">
                  {tests.vitest ?? '—'} de reglas e integración · {tests.playwright ?? '—'} de punta a punta
                </span>
                <span className="block text-chico text-grafito-2">
                  Vitest contra PostgreSQL real y Playwright. Corren en cada push en GitHub Actions.
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </article>
  )
}
