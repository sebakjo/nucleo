/** Mismas medidas que la grilla final, para que no haya saltos cuando llegan los datos. */
export function EsqueletoSemana() {
  return (
    <div className="mt-6" aria-busy="true" aria-label="Cargando los horarios">
      <div className="flex items-end justify-between">
        <div className="h-7 w-40 esqueleto" />
        <div className="h-11 w-48 esqueleto" />
      </div>
      <div className="mt-4 h-5 w-80 max-w-full esqueleto" />
      <div className="mt-4 hidden grid-cols-[4rem_repeat(6,1fr)] gap-1.5 lg:grid">
        {Array.from({ length: 6 * 7 }, (_, i) =>
          i % 7 === 0 ? (
            <div key={i} className="h-6 w-12 esqueleto" />
          ) : (
            <div key={i} className="h-[84px] esqueleto" />
          ),
        )}
      </div>
      <div className="mt-4 space-y-2 lg:hidden">
        <div className="h-11 w-full esqueleto" />
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-[104px] esqueleto" />
        ))}
      </div>
    </div>
  )
}
