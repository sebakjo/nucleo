/**
 * Port fiel de la lógica de reserva del prototipo (/antes, PROBLEMAS 1 y 2): cada navegador tiene
 * su propio localStorage y el cupo se cuenta contra las reservas de ese navegador. Se usa en la
 * simulación de /caso para mostrar qué pasaba con 20 personas reservando a la vez.
 */
type ClasePrototipo = { id: string; cupo: number; ocupados: number }
type ReservaPrototipo = { id: string; claseId: string; nombre: string; cancelada: boolean }

export function crearNavegador() {
  const localStorage = new Map<string, string>()
  const leerReservas = (): ReservaPrototipo[] => JSON.parse(localStorage.get('nucleo_reservas') ?? '[]')
  const guardarReservas = (r: ReservaPrototipo[]) => localStorage.set('nucleo_reservas', JSON.stringify(r))

  function ocupadosDe(clase: ClasePrototipo) {
    const mias = leerReservas().filter((r) => r.claseId === clase.id && !r.cancelada).length
    return clase.ocupados + mias
  }

  function reservar(clase: ClasePrototipo, nombre: string): ReservaPrototipo | null {
    if (ocupadosDe(clase) >= clase.cupo) return null // "Ups, esta clase está completa"
    const reserva = { id: Date.now().toString(), claseId: clase.id, nombre, cancelada: false }
    const reservas = leerReservas()
    reservas.push(reserva)
    guardarReservas(reservas)
    return reserva
  }

  return { reservar }
}
