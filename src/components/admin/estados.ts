import type { Tono } from './ui'

export const ESTADO_PAGO: Record<string, { texto: string; tono: Tono }> = {
  aprobado: { texto: 'Aprobado', tono: 'bien' },
  en_proceso: { texto: 'En proceso', tono: 'atencion' },
  pendiente: { texto: 'Sin completar', tono: 'neutro' },
  rechazado: { texto: 'Rechazado', tono: 'error' },
  cancelado: { texto: 'Cancelado', tono: 'neutro' },
  reembolsado: { texto: 'Reembolsado', tono: 'neutro' },
}

export const ESTADO_RESERVA: Record<string, { texto: string; tono: Tono }> = {
  confirmada: { texto: 'Confirmada', tono: 'rosa' },
  asistio: { texto: 'Asistió', tono: 'bien' },
  pendiente_pago: { texto: 'Pago pendiente', tono: 'atencion' },
  cancelada: { texto: 'Canceló a tiempo', tono: 'neutro' },
  cancelada_tarde: { texto: 'Canceló tarde', tono: 'error' },
  vencida: { texto: 'No pagó a tiempo', tono: 'neutro' },
}

export const ESTADO_PACK: Record<string, { texto: string; tono: Tono }> = {
  activo: { texto: 'Vigente', tono: 'bien' },
  vencido: { texto: 'Vencido', tono: 'neutro' },
  pendiente_pago: { texto: 'Esperando el pago', tono: 'atencion' },
  cancelado: { texto: 'Cancelado', tono: 'neutro' },
}

export const MOTIVO_MOVIMIENTO: Record<string, string> = {
  compra: 'Compra',
  reserva: 'Reserva',
  devolucion: 'Devolución por cancelar a tiempo',
  credito_por_cancelacion: 'Crédito por cancelar una clase paga',
  clase_cancelada: 'El estudio canceló la clase',
  pago_tardio: 'Pago acreditado tarde',
  vencimiento: 'Vencimiento',
  ajuste: 'Ajuste del estudio',
}

export const DETALLE_RECHAZO: Record<string, string> = {
  cc_rejected_insufficient_amount: 'fondos insuficientes',
  cc_rejected_bad_filled_security_code: 'código de seguridad incorrecto',
  cc_rejected_bad_filled_date: 'vencimiento incorrecto',
  cc_rejected_bad_filled_card_number: 'número de tarjeta incorrecto',
  cc_rejected_call_for_authorize: 'el banco pidió autorizar',
  cc_rejected_high_risk: 'rechazado por seguridad',
  pending_contingency: 'Mercado Pago lo está revisando',
  pending_review_manual: 'en revisión manual',
}
