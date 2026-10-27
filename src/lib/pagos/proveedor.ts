import type { EstadoPago } from '@/db/schema'

/** Lo que el proveedor dice de un pago cuando se lo consultamos (nunca lo que dice el navegador). */
export type PagoExterno = {
  id: string
  estado: EstadoPago
  detalle: string
  referenciaExterna: string | null
  monto: number
  moneda: string
  datos: unknown
}

export type NuevaPreferencia = {
  pagoId: string
  titulo: string
  montoArs: number
  email: string
  /** Hasta cuándo se puede pagar (la retención de 10 minutos, en las clases sueltas). */
  vence: Date | null
  /** Sin pagos pendientes en efectivo: para una clase con lugar retenido, aprobado o rechazado. */
  modoBinario: boolean
  urlRetorno: string
  urlNotificacion: string
}

export interface ProveedorPagos {
  nombre: 'mercadopago' | 'simulado'
  crearPreferencia(p: NuevaPreferencia): Promise<{ preferenciaId: string; urlPago: string }>
  obtenerPago(id: string): Promise<PagoExterno | null>
}

/** Estados de Mercado Pago → estados propios. */
export function estadoDesdeMercadoPago(status: string): EstadoPago {
  switch (status) {
    case 'approved':
      return 'aprobado'
    case 'authorized':
    case 'in_process':
    case 'in_mediation':
      return 'en_proceso'
    case 'rejected':
      return 'rechazado'
    case 'cancelled':
      return 'cancelado'
    case 'refunded':
    case 'charged_back':
      return 'reembolsado'
    default:
      return 'pendiente'
  }
}
