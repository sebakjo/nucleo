/** Errores de negocio: cada uno dice qué pasó y qué puede hacer la persona. */
export const MENSAJES = {
  CLASE_LLENA: 'La clase se llenó mientras elegías. Anotate en la lista de espera o elegí otro horario.',
  CLASE_NO_DISPONIBLE: 'Esta clase ya no está disponible. Elegí otro horario de la semana.',
  CLASE_INICIADA: 'La clase ya empezó. Elegí otro horario de la semana.',
  YA_RESERVADA: 'Ya tenés un lugar en esta clase. Lo ves en Mis reservas.',
  SIN_CREDITOS: 'No tenés créditos vigentes para esta clase. Pagá la clase suelta o comprá un pack.',
  HAY_LUGAR: 'Hay un lugar libre en esta clase: podés reservarlo directamente.',
  YA_EN_LISTA: 'Ya estás en la lista de espera de esta clase.',
  NO_EN_LISTA: 'No estás en la lista de espera de esta clase.',
  NO_CANCELABLE: 'Esta reserva ya no se puede cancelar: la clase empezó o la reserva no está activa.',
  RETENCION_VENCIDA:
    'Pasaron los minutos de reserva y el lugar se liberó. Volvé a reservar si sigue habiendo lugar.',
  PAGO_NO_DISPONIBLE: 'Este pago ya no está disponible. Revisá tus reservas.',
  PAGO_FALLIDO: 'No pudimos conectar con Mercado Pago. Tu lugar sigue guardado unos minutos: probá de nuevo.',
  PAGOS_NO_CONFIGURADOS: 'Los pagos no están disponibles en este momento. Usá un crédito o probá más tarde.',
  NO_AUTORIZADO: 'No tenés permiso para hacer esto.',
  NO_ENCONTRADO: 'No encontramos lo que buscabas. Volvé a los horarios.',
  DATOS_INVALIDOS: 'Revisá los datos: hay campos incompletos o con un formato que no es válido.',
  LIMITE: 'Hiciste muchos intentos seguidos. Esperá un minuto y probá de nuevo.',
} as const

export type CodigoError = keyof typeof MENSAJES

export class ErrorDominio extends Error {
  constructor(readonly codigo: CodigoError) {
    super(MENSAJES[codigo])
    this.name = 'ErrorDominio'
  }
}

export type Resultado<T> = { ok: true; valor: T } | { ok: false; codigo: CodigoError; mensaje: string }

/** Convierte un ErrorDominio en un resultado tipado; cualquier otro error sigue de largo. */
export async function capturar<T>(fn: () => Promise<T>): Promise<Resultado<T>> {
  try {
    return { ok: true, valor: await fn() }
  } catch (e) {
    if (e instanceof ErrorDominio) return { ok: false, codigo: e.codigo, mensaje: e.message }
    throw e
  }
}
