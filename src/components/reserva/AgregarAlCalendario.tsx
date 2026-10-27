/** Descarga la clase como .ics: el calendario del teléfono o de la compu la abre directo. */
export function AgregarAlCalendario({
  reservaId,
  className = '',
}: {
  reservaId: string
  className?: string
}) {
  return (
    <a
      href={`/api/reservas/${reservaId}/calendario`}
      download
      className={`inline-flex min-h-6 items-center text-chico font-medium text-eucalipto underline-offset-2 hover:underline ${className}`}
    >
      Agregar al calendario
    </a>
  )
}
