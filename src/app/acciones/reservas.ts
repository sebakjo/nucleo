'use server'

import { refresh } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { capturar, ErrorDominio, MENSAJES, type Resultado } from '@/lib/dominio/errores'
import { anotarEnEspera, salirDeEspera } from '@/lib/dominio/lista-espera'
import { comprarPack, iniciarPagoReserva } from '@/lib/dominio/pagos'
import { cancelarReserva, reservarClase, type CancelacionHecha } from '@/lib/dominio/reservas'
import { despacharEmails } from '@/lib/email/despachar'
import { despuesDeResponder } from '@/lib/despues'
import { consumirLimite } from '@/lib/limite'
import { proveedorPagos } from '@/lib/pagos'
import { usuarioActual, type UsuarioSesion } from '@/lib/sesion'

const Id = z.string().uuid()

/**
 * Acciones del alumno. Cada una vuelve a leer la sesión (no confía en el cliente), valida la
 * entrada, aplica un límite de intentos y llama al dominio. Los errores de negocio vuelven como
 * resultado con un mensaje que dice qué pasó y qué hacer.
 */
async function conUsuario<T>(
  limite: { clave: string; max: number; ventanaSeg: number },
  fn: (u: UsuarioSesion) => Promise<T>,
): Promise<Resultado<T>> {
  const u = await usuarioActual()
  if (!u) return { ok: false, codigo: 'NO_AUTORIZADO', mensaje: 'Entrá con tu cuenta para continuar.' }
  if (!(await consumirLimite(`${limite.clave}:${u.id}`, limite.max, limite.ventanaSeg))) {
    return { ok: false, codigo: 'LIMITE', mensaje: MENSAJES.LIMITE }
  }
  return capturar(() => fn(u))
}

/** Un error de red con el proveedor no es un 500: el lugar sigue retenido y se puede reintentar. */
async function conProveedor<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (e instanceof ErrorDominio) throw e
    console.error('[pagos]', e)
    throw new ErrorDominio('PAGO_FALLIDO')
  }
}

function invalido<T>(): Resultado<T> {
  return { ok: false, codigo: 'DATOS_INVALIDOS', mensaje: MENSAJES.DATOS_INVALIDOS }
}

export type ReservaConfirmada = {
  tipo: 'confirmada'
  reservaId: string
  reformer: number
  creditosRestantes: number | null
}
export type ReservaAPagar = { tipo: 'pago'; urlPago: string }

export async function reservar(
  claseId: string,
  medio: 'credito' | 'pago',
): Promise<Resultado<ReservaConfirmada | ReservaAPagar>> {
  if (!Id.safeParse(claseId).success || !['credito', 'pago'].includes(medio)) return invalido()
  return conUsuario({ clave: 'reservar', max: 15, ventanaSeg: 60 }, async (u) => {
    const ahora = new Date()
    const hecha = await reservarClase(db, { usuarioId: u.id, claseId, medio, ahora })
    if (hecha.estado === 'confirmada') {
      despuesDeResponder(() => despacharEmails(db))
      refresh()
      return {
        tipo: 'confirmada',
        reservaId: hecha.reservaId,
        reformer: hecha.reformer,
        creditosRestantes: hecha.creditosRestantes,
      }
    }
    const { urlPago } = await conProveedor(() =>
      iniciarPagoReserva(db, proveedorPagos(), { reservaId: hecha.reservaId, usuarioId: u.id, ahora }),
    )
    return { tipo: 'pago', urlPago }
  })
}

export async function pagarReserva(reservaId: string): Promise<Resultado<ReservaAPagar>> {
  if (!Id.safeParse(reservaId).success) return invalido()
  return conUsuario({ clave: 'pagar', max: 15, ventanaSeg: 60 }, async (u) => {
    const { urlPago } = await conProveedor(() =>
      iniciarPagoReserva(db, proveedorPagos(), { reservaId, usuarioId: u.id, ahora: new Date() }),
    )
    return { tipo: 'pago', urlPago }
  })
}

export async function anotarme(claseId: string): Promise<Resultado<{ puesto: number }>> {
  if (!Id.safeParse(claseId).success) return invalido()
  return conUsuario({ clave: 'espera', max: 15, ventanaSeg: 60 }, async (u) => {
    const r = await anotarEnEspera(db, { usuarioId: u.id, claseId, ahora: new Date() })
    refresh()
    return { puesto: r.puesto }
  })
}

export async function salirDeLaLista(entradaId: string): Promise<Resultado<null>> {
  if (!Id.safeParse(entradaId).success) return invalido()
  return conUsuario({ clave: 'espera', max: 15, ventanaSeg: 60 }, async (u) => {
    await salirDeEspera(db, { usuarioId: u.id, entradaId, ahora: new Date() })
    despuesDeResponder(() => despacharEmails(db))
    refresh()
    return null
  })
}

export async function cancelar(reservaId: string): Promise<Resultado<CancelacionHecha>> {
  if (!Id.safeParse(reservaId).success) return invalido()
  return conUsuario({ clave: 'cancelar', max: 15, ventanaSeg: 60 }, async (u) => {
    const r = await cancelarReserva(db, { reservaId, actor: { id: u.id, rol: u.rol }, ahora: new Date() })
    despuesDeResponder(() => despacharEmails(db))
    refresh()
    return r
  })
}

export async function comprar(productoId: string): Promise<Resultado<ReservaAPagar>> {
  if (!Id.safeParse(productoId).success) return invalido()
  return conUsuario({ clave: 'pagar', max: 10, ventanaSeg: 60 }, async (u) => {
    const { urlPago } = await conProveedor(() =>
      comprarPack(db, proveedorPagos(), { productoId, usuarioId: u.id, ahora: new Date() }),
    )
    return { tipo: 'pago', urlPago }
  })
}
