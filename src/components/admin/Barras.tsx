/**
 * Barras de una sola serie (sin leyenda: el título la nombra). Barras finas con el extremo de datos
 * redondeado, grilla tenue y el valor en un tooltip al pasar el mouse o con el foco del teclado.
 * Debajo, la misma información como tabla.
 */
export type Barra = { etiqueta: string; etiquetaLarga: string; valor: number; texto: string; vacio?: boolean }

export function Barras({
  titulo,
  descripcion,
  datos,
  maximo,
  marcas,
  columnaValor,
}: {
  titulo: string
  descripcion: string
  datos: Barra[]
  maximo: number
  marcas: { valor: number; texto: string }[]
  columnaValor: string
}) {
  const alto = (v: number) => `${maximo > 0 ? Math.max(0, Math.min(1, v / maximo)) * 100 : 0}%`
  const id = titulo.toLowerCase().replace(/[^a-z]+/g, '-')
  return (
    <figure
      className="min-w-0 rounded-bloque border border-linea bg-superficie p-4 sm:p-5"
      aria-labelledby={`${id}-t`}
    >
      <figcaption>
        <p id={`${id}-t`} className="text-subtitulo font-semibold">
          {titulo}
        </p>
        <p className="text-chico text-grafito-2">{descripcion}</p>
      </figcaption>
      <div className="mt-7 grid grid-cols-[auto_1fr] gap-x-2">
        <div className="relative h-44 w-12 text-right text-leyenda text-grafito-2 tabular" aria-hidden="true">
          {marcas.map((m) => (
            <span
              key={m.valor}
              className="absolute right-0 -translate-y-1/2"
              style={{ bottom: alto(m.valor) }}
            >
              {m.texto}
            </span>
          ))}
        </div>
        <div className="relative h-44">
          {marcas.map((m) => (
            <div
              key={m.valor}
              aria-hidden="true"
              className={`absolute inset-x-0 border-t ${m.valor === 0 ? 'border-grafito-2/60' : 'border-linea'}`}
              style={{ bottom: alto(m.valor) }}
            />
          ))}
          <ul
            className="absolute inset-0 flex items-end justify-around gap-1"
            role="list"
            aria-label={titulo}
          >
            {datos.map((d) => (
              <li
                key={d.etiqueta}
                className="group relative flex h-full w-full max-w-16 items-end justify-center"
              >
                <span
                  tabIndex={0}
                  aria-label={`${d.etiquetaLarga}: ${d.texto}`}
                  className="flex h-full w-full items-end justify-center rounded-[4px] focus-visible:outline-offset-0"
                >
                  <span
                    className={`block w-full max-w-6 rounded-t-[4px] ${d.vacio ? 'bg-transparent' : 'bg-eucalipto group-hover:bg-eucalipto-hover'}`}
                    style={{ height: d.valor > 0 ? alto(d.valor) : '0' }}
                  />
                </span>
                <span
                  role="tooltip"
                  className="pointer-events-none absolute bottom-full z-10 mb-1 hidden rounded-[4px] border border-linea bg-superficie px-2 py-1 text-center text-leyenda whitespace-nowrap text-grafito group-focus-within:block group-hover:block"
                  style={{ bottom: alto(d.valor) }}
                >
                  <span className="block text-grafito-2">{d.etiquetaLarga}</span>
                  <span className="font-semibold tabular">{d.texto}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div />
        <div className="mt-1.5 flex justify-around gap-1 text-leyenda text-grafito-2" aria-hidden="true">
          {datos.map((d) => (
            <span key={d.etiqueta} className="w-full max-w-16 text-center">
              {d.etiqueta}
            </span>
          ))}
        </div>
      </div>
      <details className="mt-4 text-chico">
        <summary className="cursor-pointer text-grafito-2 hover:text-grafito">Ver como tabla</summary>
        <table className="mt-2 w-full">
          <thead>
            <tr>
              <th className="py-1 text-left text-leyenda font-semibold text-grafito-2">Día</th>
              <th className="py-1 text-right text-leyenda font-semibold text-grafito-2">{columnaValor}</th>
            </tr>
          </thead>
          <tbody>
            {datos.map((d) => (
              <tr key={d.etiqueta} className="border-t border-linea">
                <td className="py-1">{d.etiquetaLarga}</td>
                <td className="py-1 text-right tabular">{d.texto}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
