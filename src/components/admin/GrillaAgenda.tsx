import Link from 'next/link'
import { Carriles } from '@/components/Carriles'
import type { ClaseAgenda } from '@/lib/consultas/admin'
import { estadoDeCupo } from '@/lib/dominio/reglas'
import { claveDia, diaDelMes, diaIso, diaSemana, diaSemanaCorto, hora } from '@/lib/tiempo'
import { iniciales } from './ui'

type Props = { clases: ClaseAgenda[]; ahora: Date; lunes: Date; semana: string; seleccionada: string | null }

function estado(c: ClaseAgenda, ahora: Date) {
  if (c.estado === 'cancelada') return 'cancelada'
  if (c.iniciaEn <= ahora) return 'pasada'
  return estadoDeCupo(c.reformers.length, c.cupo)
}

const FONDO = {
  libre: 'bg-superficie border-linea hover:border-eucalipto',
  ultimos: 'bg-ambar-tenue border-ambar/70 hover:border-ambar-tinta',
  completa: 'bg-completa border-completa text-sobre-completa',
  pasada: 'bg-superficie/60 border-linea text-grafito-2',
  cancelada: 'bg-transparent border-dashed border-linea text-grafito-2',
} as const

function etiqueta(c: ClaseAgenda) {
  const i = c.iniciaEn
  const base = `${diaSemana(i)} ${diaDelMes(i)}, ${hora(i)}, ${c.tipo} con ${c.instructor}`
  if (c.estado === 'cancelada') return `${base}, cancelada`
  const espera = c.enEspera ? `, ${c.enEspera} en lista de espera` : ''
  return `${base}, ${c.reformers.length} de ${c.cupo} lugares ocupados${espera}`
}

function Bloque({
  c,
  ahora,
  href,
  activa,
  conHora,
}: {
  c: ClaseAgenda
  ahora: Date
  href: string
  activa: boolean
  conHora?: boolean
}) {
  const e = estado(c, ahora)
  const sec = e === 'completa' ? 'text-sobre-completa/75' : 'text-grafito-2'
  return (
    <Link
      href={href}
      scroll={false}
      prefetch={false}
      aria-label={etiqueta(c)}
      aria-current={activa ? 'true' : undefined}
      className={`flex h-16 flex-col justify-between rounded-bloque border px-2 py-1.5 transition-colors ${FONDO[e]} ${
        activa ? 'outline-2 outline-offset-1 outline-eucalipto' : ''
      } ${e === 'pasada' ? 'grayscale' : ''}`}
    >
      <span className="flex items-baseline justify-between gap-1.5">
        <span
          className={`min-w-0 truncate text-leyenda font-semibold ${e === 'cancelada' ? 'line-through' : ''}`}
        >
          {conHora && <span className="mr-1.5 tabular">{hora(c.iniciaEn)}</span>}
          {c.tipo}
        </span>
        <span className="shrink-0 text-leyenda font-semibold tabular">
          {e === 'cancelada' ? '—' : `${c.reformers.length}/${c.cupo}`}
        </span>
      </span>
      <span className="flex items-end justify-between gap-1.5">
        <Carriles cupo={c.cupo} ocupados={e === 'cancelada' ? [] : c.reformers} tamano="chico" />
        <span className={`truncate text-leyenda ${sec}`}>
          {c.enEspera > 0 && e !== 'cancelada' ? `+${c.enEspera} esp. · ` : ''}
          <span title={c.instructor}>{iniciales(c.instructor)}</span>
        </span>
      </span>
    </Link>
  )
}

/** Agenda densa: horarios en filas, días en columnas; en móvil, lista por día. */
export function GrillaAgenda({ clases, ahora, lunes, semana, seleccionada }: Props) {
  const hayDomingo = clases.some((c) => diaIso(c.iniciaEn) === 7)
  const dias = Array.from({ length: hayDomingo ? 7 : 6 }, (_, i) => {
    const medio = new Date(lunes.getTime() + i * 86_400_000 + 12 * 3_600_000)
    return { clave: claveDia(medio), fecha: medio }
  })
  const porDia = new Map<string, ClaseAgenda[]>()
  for (const c of clases) {
    const k = claveDia(c.iniciaEn)
    porDia.set(k, [...(porDia.get(k) ?? []), c])
  }
  const horarios = [...new Set(clases.map((c) => hora(c.iniciaEn)))].sort()
  const hoy = claveDia(ahora)
  const href = (id: string) => `/admin?semana=${semana}&clase=${id}`

  return (
    <>
      <table className="hidden w-full table-fixed border-separate border-spacing-1 md:table">
        <caption className="sr-only">Agenda de la semana. Elegí una clase para ver quién viene.</caption>
        <thead>
          <tr>
            <th scope="col" className="w-14">
              <span className="sr-only">Horario</span>
            </th>
            {dias.map((d) => (
              <th
                key={d.clave}
                scope="col"
                className={`pb-1 text-left text-chico font-semibold ${d.clave === hoy ? 'text-eucalipto' : 'text-grafito-2'}`}
              >
                {diaSemanaCorto(d.fecha)} <span className="tabular">{diaDelMes(d.fecha)}</span>
                {d.clave === hoy && <span className="ml-1 font-normal">· hoy</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {horarios.map((h) => (
            <tr key={h}>
              <th scope="row" className="pt-1.5 pr-1 text-left align-top text-chico font-semibold tabular">
                {h}
              </th>
              {dias.map((d) => {
                const c = porDia.get(d.clave)?.find((x) => hora(x.iniciaEn) === h)
                return (
                  <td key={d.clave} className="align-top">
                    {c && <Bloque c={c} ahora={ahora} href={href(c.id)} activa={c.id === seleccionada} />}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid gap-6 md:hidden">
        {dias.map((d) => {
          const delDia = porDia.get(d.clave) ?? []
          if (!delDia.length) return null
          return (
            <section key={d.clave} aria-label={`${diaSemana(d.fecha)} ${diaDelMes(d.fecha)}`}>
              <h3
                className={`text-chico font-semibold ${d.clave === hoy ? 'text-eucalipto' : 'text-grafito-2'}`}
              >
                {diaSemana(d.fecha)} <span className="tabular">{diaDelMes(d.fecha)}</span>
                {d.clave === hoy && ' · hoy'}
              </h3>
              <ul className="mt-2 grid gap-1.5">
                {delDia.map((c) => (
                  <li key={c.id}>
                    <Bloque c={c} ahora={ahora} href={href(c.id)} activa={c.id === seleccionada} conHora />
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </>
  )
}
