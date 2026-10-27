/** Los 6 carriles del estudio, con el tuyo en rosa. */
export function Marca({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 34 20" className={className} aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect
          key={i}
          x={i * 6}
          y={0}
          width={4}
          height={20}
          rx={1.5}
          className={i === 3 ? 'fill-rosa' : 'fill-eucalipto'}
        />
      ))}
    </svg>
  )
}

export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <Marca className="h-5 w-auto" />
      <span className="text-[1.25rem] font-extrabold tracking-[-0.02em]">núcleo</span>
    </span>
  )
}
