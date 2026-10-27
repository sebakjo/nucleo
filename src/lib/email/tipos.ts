/**
 * Datos de cada plantilla. Se guardan en la outbox (`emails.datos`) como JSON, por eso las fechas
 * viajan como ISO. Las plantillas (React Email y la vista de WhatsApp) las formatean en la hora de
 * Buenos Aires.
 */
export type DatosClaseEmail = {
  nombre: string
  clase: string
  instructor: string
  iniciaEn: string
}

export type DatosPorPlantilla = {
  reserva_confirmada: DatosClaseEmail & {
    reformer: number
    creditosRestantes: number | null
    limiteCancelacion: string
    pagada: boolean
  }
  reserva_cancelada: DatosClaseEmail & { sinCosto: boolean; creditoDevuelto: boolean }
  recordatorio: DatosClaseEmail & { reformer: number; limiteCancelacion: string }
  espera_promovida: DatosClaseEmail & { reformer: number; creditosRestantes: number }
  espera_oferta: DatosClaseEmail & { claseId: string; venceEn: string; precioArs: number }
  pack_comprado: { nombre: string; pack: string; creditos: number; venceEn: string }
  pago_tardio: DatosClaseEmail & { venceEn: string }
  clase_cancelada: DatosClaseEmail & { creditoDevuelto: boolean }
}

export type NombrePlantilla = keyof DatosPorPlantilla

export type EmailEncolado = {
  [K in NombrePlantilla]: {
    plantilla: K
    datos: DatosPorPlantilla[K]
    para: string
    usuarioId?: string | null
    /** Si se repite, el email no se vuelve a encolar (ej. un recordatorio por reserva). */
    claveUnica?: string
  }
}[NombrePlantilla]
