const ITEMS = [
  { texto: 'Libre', clase: 'border-[1.5px] border-eucalipto bg-eucalipto-tenue' },
  { texto: 'Últimos lugares', clase: 'border-[1.5px] border-ambar bg-ambar-tenue' },
  { texto: 'Completa', clase: 'bg-completa' },
  { texto: 'Tu reserva', clase: 'border-[1.5px] border-rosa-tinta bg-rosa' },
]

export function Leyenda() {
  return (
    <ul
      className="flex flex-wrap items-center gap-x-5 gap-y-2 text-chico text-grafito-2"
      aria-label="Referencias de color"
    >
      {ITEMS.map((i) => (
        <li key={i.texto} className="flex items-center gap-2">
          <span className={`inline-block h-4 w-2 rounded-[2px] ${i.clase}`} aria-hidden="true" />
          {i.texto}
        </li>
      ))}
      <li className="sm:ml-auto">Hora de Buenos Aires</li>
    </ul>
  )
}
