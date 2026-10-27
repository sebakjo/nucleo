'use server'

import { and, eq } from 'drizzle-orm'
import { refresh } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { clases, instructores, plantillas, productosPack, reservas, tiposClase, type Rol } from '@/db/schema'
import { ajustarCreditos } from '@/lib/dominio/creditos'
import { capturar, ErrorDominio, MENSAJES, type Resultado } from '@/lib/dominio/errores'
import { guardarPrecioClase } from '@/lib/dominio/precios'
import {
  cancelarClase,
  cancelarReserva,
  marcarAsistencia,
  reprogramarClase,
  type CancelacionHecha,
} from '@/lib/dominio/reservas'
import { generarClases } from '@/lib/dominio/tareas'
import { despacharEmails } from '@/lib/email/despachar'
import { despuesDeResponder } from '@/lib/despues'
import { consumirLimite } from '@/lib/limite'
import { usuarioActual, type UsuarioSesion } from '@/lib/sesion'
import { diaDelMes, diaSemana, hora, instanteLocal } from '@/lib/tiempo'

/** Resultado de los formularios del panel: un mensaje que dice qué pasó. */
export type EstadoPanel = { ok: boolean; mensaje: string } | null

const Id = z.string().uuid()
const DIAS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
const LOS_DIAS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos']

/**
 * Cada acción del panel vuelve a leer la sesión y exige el rol en el servidor: que el botón no
 * aparezca en la interfaz no alcanza.
 */
async function conRol<T>(roles: Rol[], fn: (u: UsuarioSesion) => Promise<T>): Promise<Resultado<T>> {
  const u = await usuarioActual()
  if (!u || !roles.includes(u.rol))
    return { ok: false, codigo: 'NO_AUTORIZADO', mensaje: MENSAJES.NO_AUTORIZADO }
  if (!(await consumirLimite(`panel:${u.id}`, 120, 60))) {
    return { ok: false, codigo: 'LIMITE', mensaje: MENSAJES.LIMITE }
  }
  return capturar(() => fn(u))
}

function comoEstado(r: Resultado<string>): EstadoPanel {
  return r.ok ? { ok: true, mensaje: r.valor } : { ok: false, mensaje: r.mensaje }
}

const invalido = { ok: false, codigo: 'DATOS_INVALIDOS', mensaje: MENSAJES.DATOS_INVALIDOS } as const

export async function cancelarReservaComoAdmin(reservaId: string): Promise<Resultado<CancelacionHecha>> {
  if (!Id.safeParse(reservaId).success) return invalido
  return conRol(['admin'], async (u) => {
    const r = await cancelarReserva(db, { reservaId, actor: { id: u.id, rol: u.rol }, ahora: new Date() })
    despuesDeResponder(() => despacharEmails(db))
    refresh()
    return r
  })
}

export async function cancelarClaseComoAdmin(claseId: string): Promise<Resultado<number>> {
  if (!Id.safeParse(claseId).success) return invalido
  return conRol(['admin'], async () => {
    const n = await cancelarClase(db, { claseId, ahora: new Date() })
    despuesDeResponder(() => despacharEmails(db))
    refresh()
    return n
  })
}

async function mover(claseId: string, iniciaEn: Date): Promise<Resultado<string>> {
  return conRol(['admin'], async () => {
    const r = await reprogramarClase(db, { claseId, iniciaEn, ahora: new Date() })
    despuesDeResponder(() => despacharEmails(db))
    refresh()
    const n = r.avisados
    const aviso =
      n === 0
        ? 'No tenía reservas ni lista de espera.'
        : `Le avisamos por email a ${n === 1 ? '1 persona' : `${n} personas`}.`
    return `Moviste ${r.tipo} al ${diaSemana(r.iniciaEn)} ${diaDelMes(r.iniciaEn)} a las ${hora(r.iniciaEn)}. ${aviso}`
  })
}

/** Arrastrar una clase a otro horario de la agenda. */
export async function moverClase(claseId: string, inicioIso: string): Promise<Resultado<string>> {
  const inicio = z.iso.datetime().safeParse(inicioIso)
  if (!Id.safeParse(claseId).success || !inicio.success) return invalido
  return mover(claseId, new Date(inicio.data))
}

const Mover = z.object({
  claseId: Id,
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
})

/** La misma acción desde el panel lateral, para quien no arrastra (teclado, lector de pantalla). */
export async function moverClaseDesdeFormulario(_: EstadoPanel, form: FormData): Promise<EstadoPanel> {
  const datos = Mover.safeParse(Object.fromEntries(form))
  if (!datos.success) return { ok: false, mensaje: 'Elegí el día y la hora nuevos.' }
  return comoEstado(await mover(datos.data.claseId, instanteLocal(datos.data.dia, datos.data.hora)))
}

/** Asistencia: la marca el admin o quien da la clase. */
export async function marcarAsistio(reservaId: string, asistio: boolean): Promise<Resultado<null>> {
  if (!Id.safeParse(reservaId).success || typeof asistio !== 'boolean') return invalido
  return conRol(['admin', 'instructor'], async (u) => {
    const [fila] = await db
      .select({ instructorUsuarioId: instructores.usuarioId })
      .from(reservas)
      .innerJoin(clases, eq(clases.id, reservas.claseId))
      .innerJoin(instructores, eq(instructores.id, clases.instructorId))
      .where(eq(reservas.id, reservaId))
    if (!fila) throw new ErrorDominio('NO_ENCONTRADO')
    await marcarAsistencia(db, {
      reservaId,
      asistio,
      actor: { id: u.id, rol: u.rol },
      instructorUsuarioId: fila.instructorUsuarioId,
    })
    refresh()
    return null
  })
}

const NuevaPlantilla = z.object({
  diaSemana: z.coerce.number().int().min(1).max(7),
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  tipoClaseId: Id,
  instructorId: Id,
  cupo: z.coerce.number().int().min(1).max(6),
  duracionMin: z.coerce.number().int().min(30).max(90),
})

const minutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

/** Crea una plantilla semanal y genera sus clases de las próximas 3 semanas. */
export async function crearPlantilla(_: EstadoPanel, form: FormData): Promise<EstadoPanel> {
  const datos = NuevaPlantilla.safeParse(Object.fromEntries(form))
  if (!datos.success) return { ok: false, mensaje: 'Completá día, hora, clase, instructor, cupo y duración.' }
  const p = datos.data
  return comoEstado(
    await conRol(['admin'], async () => {
      const [tipo] = await db.select().from(tiposClase).where(eq(tiposClase.id, p.tipoClaseId))
      const [inst] = await db.select().from(instructores).where(eq(instructores.id, p.instructorId))
      if (!tipo || !inst || !inst.activo) throw new ErrorDominio('DATOS_INVALIDOS')

      // Una sola sala: dos clases no pueden superponerse el mismo día.
      const delDia = await db
        .select({ hora: plantillas.hora, duracionMin: plantillas.duracionMin, tipo: tiposClase.nombre })
        .from(plantillas)
        .innerJoin(tiposClase, eq(tiposClase.id, plantillas.tipoClaseId))
        .where(and(eq(plantillas.diaSemana, p.diaSemana), eq(plantillas.activa, true)))
      const inicio = minutos(p.hora)
      const choca = delDia.find((o) => {
        const otro = minutos(o.hora)
        return inicio < otro + o.duracionMin && otro < inicio + p.duracionMin
      })
      if (choca) {
        throw new ErrorDominio(
          'DATOS_INVALIDOS',
          `El ${DIAS[p.diaSemana]} a las ${choca.hora} ya hay ${choca.tipo}. El estudio tiene una sola sala: elegí otro horario.`,
        )
      }

      const [nueva] = await db.insert(plantillas).values(p).returning({ id: plantillas.id })
      await generarClases(db, new Date())
      const generadas = await db.$count(clases, eq(clases.plantillaId, nueva.id))
      refresh()
      return `Creaste ${tipo.nombre} los ${LOS_DIAS[p.diaSemana]} a las ${p.hora} con ${inst.nombre}. Se generaron ${generadas} ${generadas === 1 ? 'clase' : 'clases'} en las próximas 3 semanas.`
    }),
  )
}

export async function cambiarPlantilla(id: string, activa: boolean): Promise<Resultado<null>> {
  if (!Id.safeParse(id).success || typeof activa !== 'boolean') return invalido
  return conRol(['admin'], async () => {
    await db.update(plantillas).set({ activa }).where(eq(plantillas.id, id))
    if (activa) await generarClases(db, new Date())
    refresh()
    return null
  })
}

const NuevoInstructor = z.object({
  nombre: z.string().trim().min(3).max(60),
  bio: z.string().trim().max(200).optional().default(''),
})

export async function crearInstructor(_: EstadoPanel, form: FormData): Promise<EstadoPanel> {
  const datos = NuevoInstructor.safeParse(Object.fromEntries(form))
  if (!datos.success) return { ok: false, mensaje: 'Escribí nombre y apellido (al menos 3 letras).' }
  return comoEstado(
    await conRol(['admin'], async () => {
      await db.insert(instructores).values({ nombre: datos.data.nombre, bio: datos.data.bio })
      refresh()
      return `Sumaste a ${datos.data.nombre}. Ya podés asignarle plantillas.`
    }),
  )
}

export async function cambiarInstructor(id: string, activo: boolean): Promise<Resultado<null>> {
  if (!Id.safeParse(id).success || typeof activo !== 'boolean') return invalido
  return conRol(['admin'], async () => {
    if (!activo) {
      const conPlantillas = await db.$count(
        plantillas,
        and(eq(plantillas.instructorId, id), eq(plantillas.activa, true)),
      )
      if (conPlantillas > 0) {
        throw new ErrorDominio(
          'DATOS_INVALIDOS',
          `Tiene ${conPlantillas} ${conPlantillas === 1 ? 'plantilla activa' : 'plantillas activas'}. Pausalas antes de darle de baja.`,
        )
      }
    }
    await db.update(instructores).set({ activo }).where(eq(instructores.id, id))
    refresh()
    return null
  })
}

const Ajuste = z.object({
  usuarioId: z.string().min(1).max(64),
  delta: z.coerce
    .number()
    .int()
    .min(-20)
    .max(20)
    .refine((n) => n !== 0),
  nota: z.string().trim().min(3).max(140),
})

export async function ajustarCreditosDeAlumno(_: EstadoPanel, form: FormData): Promise<EstadoPanel> {
  const datos = Ajuste.safeParse(Object.fromEntries(form))
  if (!datos.success) {
    return { ok: false, mensaje: 'Indicá cuántos créditos sumar o restar (entre −20 y 20) y el motivo.' }
  }
  const { usuarioId, delta, nota } = datos.data
  return comoEstado(
    await conRol(['admin'], async (u) => {
      await ajustarCreditos(db, { usuarioId, delta, nota, actorId: u.id, ahora: new Date() })
      refresh()
      const n = Math.abs(delta)
      return delta > 0
        ? `Sumaste ${n} ${n === 1 ? 'crédito' : 'créditos'}, válidos por 30 días.`
        : `Restaste ${n} ${n === 1 ? 'crédito' : 'créditos'}.`
    }),
  )
}

const Monto = z.coerce.number().int().min(1000).max(2_000_000)

/** Precios: los define el servidor y el panel es el único lugar donde se cambian. */
export async function guardarPrecios(_: EstadoPanel, form: FormData): Promise<EstadoPanel> {
  const clase = Monto.safeParse(form.get('precioClase'))
  if (!clase.success)
    return { ok: false, mensaje: 'El precio de la clase suelta tiene que estar entre $ 1.000 y $ 2.000.000.' }
  return comoEstado(
    await conRol(['admin'], async () => {
      const productos = await db.select().from(productosPack)
      const cambios: { id: string; precioArs: number; activo: boolean }[] = []
      for (const p of productos) {
        const precio = Monto.safeParse(form.get(`precio-${p.id}`))
        if (!precio.success) {
          throw new ErrorDominio(
            'DATOS_INVALIDOS',
            `Revisá el precio del ${p.nombre}: tiene que estar entre $ 1.000 y $ 2.000.000.`,
          )
        }
        cambios.push({ id: p.id, precioArs: precio.data, activo: form.get(`activo-${p.id}`) === 'on' })
      }
      if (!cambios.some((c) => c.activo)) {
        throw new ErrorDominio('DATOS_INVALIDOS', 'Dejá al menos un pack a la venta.')
      }
      await db.transaction(async (tx) => {
        await guardarPrecioClase(tx, clase.data)
        for (const c of cambios) {
          await tx
            .update(productosPack)
            .set({ precioArs: c.precioArs, activo: c.activo })
            .where(eq(productosPack.id, c.id))
        }
      })
      refresh()
      return 'Guardaste los precios. Se aplican a las próximas compras; los pagos ya iniciados mantienen su precio.'
    }),
  )
}
