import { hashPassword } from 'better-auth/crypto'
import { and, asc, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import type { DB } from '@/db'
import {
  account,
  ajustes,
  clases,
  emails,
  instructores,
  pagos,
  plantillas,
  productosPack,
  reservas,
  tiposClase,
  user,
} from '@/db/schema'
import { CUENTAS_DEMO, urlApp } from '@/lib/config'
import { ErrorDominio } from '@/lib/dominio/errores'
import { anotarEnEspera } from '@/lib/dominio/lista-espera'
import { aplicarEstadoPago, comprarPack, iniciarPagoReserva } from '@/lib/dominio/pagos'
import { PRECIO_CLASE_POR_DEFECTO } from '@/lib/dominio/precios'
import { limiteCancelacionSinCosto } from '@/lib/dominio/reglas'
import { cancelarReserva, reservarClase } from '@/lib/dominio/reservas'
import { generarClases, liberarReservasVencidas, vencerPacks } from '@/lib/dominio/tareas'
import type { ProveedorPagos } from '@/lib/pagos/proveedor'
import { diaIso, hora, inicioDeSemana, sumarSemanas } from '@/lib/tiempo'

/**
 * Datos de demo: 4 instructores, 4 tipos de clase, plantillas semanales, 3 semanas de clases
 * (la anterior, la actual y la siguiente) y 30 alumnos con historia. La historia se arma llamando
 * a las mismas funciones de dominio que usa la app, con el reloj puesto en el pasado: así cada
 * crédito, movimiento y pago queda consistente, igual que si hubiera pasado de verdad.
 */

const MIN = 60 * 1000
const HORA = 60 * MIN
const DIA = 24 * HORA

/** PRNG determinista (mulberry32): los mismos datos en cada seed, relativos a la fecha de hoy. */
function azar(semilla: number) {
  let a = semilla
  const sig = () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    sig,
    entre: (min: number, max: number) => min + Math.floor(sig() * (max - min + 1)),
    elegir: <T>(xs: readonly T[]) => xs[Math.floor(sig() * xs.length)]!,
    mezclar: <T>(xs: readonly T[]) => {
      const c = [...xs]
      for (let i = c.length - 1; i > 0; i--) {
        const j = Math.floor(sig() * (i + 1))
        ;[c[i], c[j]] = [c[j]!, c[i]!]
      }
      return c
    },
  }
}

const INSTRUCTORES = [
  {
    clave: 'L',
    nombre: 'Lucía Ferreyra',
    bio: 'Formada en el método clásico. Da Reformer clásico y acompaña a quienes vuelven de una lesión.',
  },
  {
    clave: 'T',
    nombre: 'Tomás Aguirre',
    bio: 'Da Fundamentos: si nunca te subiste a un reformer, empezá con él.',
  },
  {
    clave: 'V',
    nombre: 'Valentina Sosa',
    bio: 'Movilidad y respiración. Sus clases del mediodía son las más pedidas.',
  },
  {
    clave: 'M',
    nombre: 'Martín Ibarra',
    bio: 'Reformer power: series cortas, ritmo alto y mucho trabajo de centro.',
  },
] as const

const TIPOS = [
  {
    clave: 'F',
    slug: 'fundamentos',
    nombre: 'Fundamentos',
    nivel: 'inicial',
    duracionMin: 55,
    descripcion: 'Aprendé a usar el reformer desde cero: respiración, control del centro y alineación.',
  },
  {
    clave: 'C',
    slug: 'reformer-clasico',
    nombre: 'Reformer clásico',
    nivel: 'intermedio',
    duracionMin: 55,
    descripcion: 'La secuencia clásica de Pilates en el reformer, con resortes medios y foco en la técnica.',
  },
  {
    clave: 'P',
    slug: 'reformer-power',
    nombre: 'Reformer power',
    nivel: 'avanzado',
    duracionMin: 50,
    descripcion: 'Series intensas y continuas para fuerza y resistencia. Necesitás experiencia previa.',
  },
  {
    clave: 'M',
    slug: 'movilidad',
    nombre: 'Movilidad',
    nivel: 'todos los niveles',
    duracionMin: 55,
    descripcion: 'Estiramiento activo, movilidad de columna y respiración. Ideal para cerrar el día.',
  },
] as const

const HORAS = ['07:00', '08:15', '12:30', '18:00', '19:15', '20:30'] as const
/** Grilla semanal: tipo + instructor por horario (lunes a viernes), sábado aparte. */
const GRILLA: Record<number, string[]> = {
  1: ['FT', 'CL', 'MV', 'CL', 'PM', 'FT'],
  2: ['PM', 'MV', 'CL', 'FT', 'CL', 'MV'],
  3: ['FT', 'CL', 'MV', 'PM', 'CL', 'FT'],
  4: ['PM', 'MV', 'CL', 'CL', 'PM', 'MV'],
  5: ['FT', 'CL', 'MV', 'PM', 'CL', 'MV'],
}
const SABADO: [string, string][] = [
  ['09:30', 'CL'],
  ['10:45', 'MV'],
]

const ALUMNOS = [
  'Martina Ríos',
  'Paula Navarro',
  'Juan Pérez',
  'Camila Ortiz',
  'Agustina López',
  'Federico Díaz',
  'Lucas Romero',
  'Florencia Castro',
  'Valeria Gómez',
  'Julieta Herrera',
  'Mariano Suárez',
  'Rocío Medina',
  'Belén Acosta',
  'Nicolás Molina',
  'Carolina Rojas',
  'Gonzalo Vega',
  'Milagros Ponce',
  'Ignacio Torres',
  'Antonella Ruiz',
  'Daniela Silva',
  'Ezequiel Cabrera',
  'Lorena Giménez',
  'Pilar Domínguez',
  'Santiago Ledesma',
  'Celeste Ferrari',
  'Andrés Morales',
  'Micaela Quiroga',
  'Bruno Peralta',
  'Laura Sánchez',
] as const

export const PRODUCTOS = [
  { nombre: 'Pack de 4 clases', creditos: 4, precioArs: 76000, orden: 1 },
  { nombre: 'Pack de 8 clases', creditos: 8, precioArs: 136000, orden: 2 },
  { nombre: 'Pack de 12 clases', creditos: 12, precioArs: 186000, orden: 3 },
] as const

function emailDe(nombre: string) {
  return nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, '.') + '@ejemplo.test'
}

/** Proveedor de pagos del seed: no sale a la red, los pagos se aprueban "a mano" con el reloj del seed. */
const proveedorSeed: ProveedorPagos = {
  nombre: 'simulado',
  async crearPreferencia(p) {
    return { preferenciaId: `seed-${p.pagoId}`, urlPago: `${urlApp()}/pago-simulado/${p.pagoId}` }
  },
  async obtenerPago() {
    return null
  },
}

let contadorPagos = 0
async function resolverPago(
  db: DB,
  pagoId: string,
  estado: 'aprobado' | 'rechazado' | 'en_proceso',
  ahora: Date,
) {
  const [pago] = await db.select().from(pagos).where(eq(pagos.id, pagoId))
  contadorPagos++
  await aplicarEstadoPago(
    db,
    {
      id: `${Math.floor(ahora.getTime() / 1000)}${String(contadorPagos).padStart(4, '0')}`,
      estado,
      detalle:
        estado === 'aprobado'
          ? 'accredited'
          : estado === 'rechazado'
            ? 'cc_rejected_other_reason'
            : 'pending_review_manual',
      referenciaExterna: pagoId,
      monto: pago!.montoArs,
      moneda: 'ARS',
      datos: { origen: 'seed' },
    },
    ahora,
  )
}

export async function vaciar(db: DB) {
  const tablas = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public'`,
  )
  const nombres = tablas.rows.map((t) => `"${t.tablename}"`).join(', ')
  if (nombres) await db.execute(sql.raw(`truncate ${nombres} restart identity cascade`))
}

type Evento = { t: number; orden: number; correr: () => Promise<void> }

export async function sembrar(
  db: DB,
  opciones: { ahora?: Date; contrasena: string; log?: (m: string) => void },
) {
  const ahora = opciones.ahora ?? new Date()
  const log = opciones.log ?? (() => {})
  const r = azar(20261027)

  // --- Catálogo -----------------------------------------------------------------------------
  await db.insert(ajustes).values({ clave: 'precio_clase', valor: PRECIO_CLASE_POR_DEFECTO })
  const productos = await db
    .insert(productosPack)
    .values(PRODUCTOS.map((p) => ({ ...p, validezDias: 30 })))
    .returning()
  const producto = (creditos: number) => productos.find((p) => p.creditos === creditos)!

  // --- Usuarios -------------------------------------------------------------------------------
  const hash = await hashPassword(opciones.contrasena)
  const creados = new Date(ahora.getTime() - 90 * DIA)
  async function crearUsuario(nombre: string, email: string, rol: 'alumno' | 'instructor' | 'admin') {
    const id = crypto.randomUUID()
    await db
      .insert(user)
      .values({
        id,
        name: nombre,
        email,
        emailVerified: true,
        role: rol,
        createdAt: creados,
        updatedAt: creados,
      })
    await db.insert(account).values({
      id: crypto.randomUUID(),
      accountId: id,
      providerId: 'credential',
      userId: id,
      password: hash,
      createdAt: creados,
      updatedAt: creados,
    })
    return id
  }

  await crearUsuario(CUENTAS_DEMO.admin.nombre, CUENTAS_DEMO.admin.email, 'admin')
  const sofia = await crearUsuario(CUENTAS_DEMO.alumno.nombre, CUENTAS_DEMO.alumno.email, 'alumno')
  const alumnos = [sofia]
  for (const nombre of ALUMNOS) alumnos.push(await crearUsuario(nombre, emailDe(nombre), 'alumno'))

  const idsInstructor: Record<string, string> = {}
  for (const i of INSTRUCTORES) {
    const usuarioId =
      i.clave === 'L' ? await crearUsuario(i.nombre, CUENTAS_DEMO.instructor.email, 'instructor') : null
    const [fila] = await db
      .insert(instructores)
      .values({ nombre: i.nombre, bio: i.bio, usuarioId })
      .returning()
    idsInstructor[i.clave] = fila.id
  }
  const idsTipo: Record<string, string> = {}
  for (const t of TIPOS) {
    const [fila] = await db
      .insert(tiposClase)
      .values({
        slug: t.slug,
        nombre: t.nombre,
        nivel: t.nivel,
        duracionMin: t.duracionMin,
        descripcion: t.descripcion,
      })
      .returning()
    idsTipo[t.clave] = fila.id
  }
  const duracion = Object.fromEntries(TIPOS.map((t) => [t.clave, t.duracionMin]))

  // --- Plantillas y clases --------------------------------------------------------------------
  const filas: (typeof plantillas.$inferInsert)[] = []
  for (const [dia, celdas] of Object.entries(GRILLA)) {
    celdas.forEach((celda, i) =>
      filas.push({
        diaSemana: Number(dia),
        hora: HORAS[i]!,
        tipoClaseId: idsTipo[celda[0]!]!,
        instructorId: idsInstructor[celda[1]!]!,
        duracionMin: duracion[celda[0]!],
        creadaEn: creados,
      }),
    )
  }
  for (const [h, celda] of SABADO) {
    filas.push({
      diaSemana: 6,
      hora: h,
      tipoClaseId: idsTipo[celda[0]!]!,
      instructorId: idsInstructor[celda[1]!]!,
      duracionMin: duracion[celda[0]!],
      creadaEn: creados,
    })
  }
  await db.insert(plantillas).values(filas)
  const lunesActual = inicioDeSemana(ahora)
  const { creadas } = await generarClases(db, ahora, { desde: sumarSemanas(lunesActual, -1), semanas: 3 })
  log(`${creadas} clases en 3 semanas`)

  const todas = await db
    .select({
      id: clases.id,
      iniciaEn: clases.iniciaEn,
      tipo: tiposClase.slug,
      instructor: instructores.nombre,
    })
    .from(clases)
    .innerJoin(tiposClase, eq(tiposClase.id, clases.tipoClaseId))
    .innerJoin(instructores, eq(instructores.id, clases.instructorId))
    .orderBy(asc(clases.iniciaEn))

  // --- Historia como eventos en orden cronológico ---------------------------------------------
  const eventos: Evento[] = []
  let orden = 0
  const en = (t: number, correr: () => Promise<void>) => eventos.push({ t, orden: orden++, correr })
  const ignorarNegocio = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
    } catch (e) {
      if (!(e instanceof ErrorDominio)) throw e
    }
  }

  // Packs: la mayoría tiene uno vigente; algunos uno vencido; otros pagan clase suelta.
  const sinPack = new Set(alumnos.slice(26))
  const conPackVencido = new Set(alumnos.slice(22, 26))
  for (const [i, alumno] of alumnos.entries()) {
    if (alumno === sofia) continue
    if (conPackVencido.has(alumno)) {
      const t = ahora.getTime() - r.entre(34, 40) * DIA
      en(t, async () => {
        const { pagoId } = await comprarPack(db, proveedorSeed, {
          productoId: producto(4).id,
          usuarioId: alumno,
          ahora: new Date(t),
        })
        await resolverPago(db, pagoId, 'aprobado', new Date(t + 2 * MIN))
      })
      continue
    }
    if (sinPack.has(alumno)) continue
    const creditos = r.elegir([4, 8, 8, 12])
    const t = ahora.getTime() - r.entre(9, 22) * DIA - r.entre(0, 10) * HORA
    en(t, async () => {
      const { pagoId } = await comprarPack(db, proveedorSeed, {
        productoId: producto(creditos).id,
        usuarioId: alumno,
        ahora: new Date(t),
      })
      await resolverPago(db, pagoId, 'aprobado', new Date(t + 3 * MIN))
    })
    // Algunos intentos de compra rechazados o en proceso, para que el panel de pagos muestre de todo.
    if (i % 9 === 4) {
      const t2 = t - 2 * HORA
      en(t2, async () => {
        const { pagoId } = await comprarPack(db, proveedorSeed, {
          productoId: producto(creditos).id,
          usuarioId: alumno,
          ahora: new Date(t2),
        })
        await resolverPago(db, pagoId, 'rechazado', new Date(t2 + MIN))
      })
    }
    if (i === 13) {
      const t3 = ahora.getTime() - 5 * HORA
      en(t3, async () => {
        const { pagoId } = await comprarPack(db, proveedorSeed, {
          productoId: producto(4).id,
          usuarioId: alumno,
          ahora: new Date(t3),
        })
        await resolverPago(db, pagoId, 'en_proceso', new Date(t3 + MIN))
      })
    }
  }

  // Sofía (alumna demo): pack de 8 que vence en ~12 días y le deja 2 créditos; un pack viejo vencido.
  const tViejo = ahora.getTime() - 46 * DIA
  en(tViejo, async () => {
    const { pagoId } = await comprarPack(db, proveedorSeed, {
      productoId: producto(4).id,
      usuarioId: sofia,
      ahora: new Date(tViejo),
    })
    await resolverPago(db, pagoId, 'aprobado', new Date(tViejo + MIN))
  })
  const tPack = ahora.getTime() - 18 * DIA
  en(tPack, async () => {
    const { pagoId } = await comprarPack(db, proveedorSeed, {
      productoId: producto(8).id,
      usuarioId: sofia,
      ahora: new Date(tPack),
    })
    await resolverPago(db, pagoId, 'aprobado', new Date(tPack + MIN))
  })

  // Clases de Sofía: identificadas por día y hora para que la historia se lea bien en "Mis reservas".
  const claseEn = (semana: number, dia: number, h: string) =>
    todas.find(
      (c) =>
        c.iniciaEn >= sumarSemanas(lunesActual, semana) &&
        c.iniciaEn < sumarSemanas(lunesActual, semana + 1) &&
        diaIso(c.iniciaEn) === dia &&
        hora(c.iniciaEn) === h,
    )
  const reservasSofia = new Set<string>()
  const reservarSofia = (c: (typeof todas)[number] | undefined, cancelar?: 'tarde') => {
    if (!c) return
    reservasSofia.add(c.id)
    const t = c.iniciaEn.getTime() - r.entre(2, 4) * DIA
    if (t >= ahora.getTime()) return
    en(t, () =>
      ignorarNegocio(async () => {
        const hecha = await reservarClase(db, {
          usuarioId: sofia,
          claseId: c.id,
          medio: 'credito',
          ahora: new Date(t),
        })
        if (cancelar === 'tarde') {
          const tc = c.iniciaEn.getTime() - 5 * HORA
          if (tc < ahora.getTime()) {
            en(tc, () =>
              ignorarNegocio(() =>
                cancelarReserva(db, {
                  reservaId: hecha.reservaId,
                  actor: { id: sofia, rol: 'alumno' },
                  ahora: new Date(tc),
                }),
              ),
            )
          }
        }
      }),
    )
  }
  reservarSofia(claseEn(-1, 1, '18:00'))
  reservarSofia(claseEn(-1, 3, '19:15'))
  reservarSofia(claseEn(-1, 4, '12:30'), 'tarde')
  reservarSofia(claseEn(-1, 6, '09:30'))
  reservarSofia(claseEn(0, 1, '18:00'))
  reservarSofia(claseEn(1, 2, '19:15'))

  // Ocupación del resto: los horarios de la mañana temprano y de la tarde se llenan más.
  const popularidad = (c: (typeof todas)[number]) => {
    const h = hora(c.iniciaEn)
    const dia = diaIso(c.iniciaEn)
    if (dia === 6 && h === '09:30') return 6
    if (h === '18:00' || h === '19:15') return r.entre(4, 6)
    if (h === '07:00') return r.entre(3, 6)
    if (h === '12:30') return r.entre(2, 5)
    return r.entre(1, 4)
  }
  // El jueves 18:00 de esta semana con Lucía queda con lugar: es el ejemplo del recorrido demo.
  const juevesDemo = claseEn(0, 4, '18:00')

  for (const c of todas) {
    let objetivo = popularidad(c)
    if (c.id === juevesDemo?.id) objetivo = 3
    const yaSofia = reservasSofia.has(c.id) ? 1 : 0
    const candidatos = r
      .mezclar(alumnos.filter((a) => a !== sofia))
      .slice(0, objetivo - yaSofia + (objetivo >= 6 ? r.entre(1, 3) : 0))
    // Las reservas de clases futuras se hicieron en los últimos días; las de clases pasadas, antes de la clase.
    const t0 =
      c.iniciaEn > ahora
        ? ahora.getTime() - r.entre(60, 5 * 24 * 60) * MIN - candidatos.length * 7 * MIN
        : c.iniciaEn.getTime() - r.entre(14, 6 * 24) * HORA - candidatos.length * 7 * MIN
    for (const [k, alumno] of candidatos.entries()) {
      const esExtra = k >= objetivo - yaSofia
      const t = t0 + k * 7 * MIN
      if (t >= ahora.getTime() - 10 * MIN) continue
      en(t, async () => {
        if (esExtra) {
          // La clase ya está llena: se anotan en la lista de espera.
          await ignorarNegocio(() =>
            anotarEnEspera(db, { usuarioId: alumno, claseId: c.id, ahora: new Date(t) }),
          )
          return
        }
        try {
          const hecha = await reservarClase(db, {
            usuarioId: alumno,
            claseId: c.id,
            medio: 'credito',
            ahora: new Date(t),
          })
          // Cancelaciones: algunas a tiempo, algunas tarde.
          const tirada = r.sig()
          const limite = limiteCancelacionSinCosto(c.iniciaEn).getTime()
          const tc =
            tirada < 0.06 ? t + r.entre(1, 20) * HORA : tirada < 0.1 ? limite + r.entre(1, 8) * HORA : null
          if (tc !== null && tc < c.iniciaEn.getTime() && tc < ahora.getTime()) {
            en(tc, () =>
              ignorarNegocio(() =>
                cancelarReserva(db, {
                  reservaId: hecha.reservaId,
                  actor: { id: alumno, rol: 'alumno' },
                  ahora: new Date(tc),
                }),
              ),
            )
          }
        } catch (e) {
          if (!(e instanceof ErrorDominio)) throw e
          if (e.codigo !== 'SIN_CREDITOS') return
          // Sin créditos vigentes: paga la clase suelta (casi siempre se aprueba).
          await ignorarNegocio(async () => {
            const hecha = await reservarClase(db, {
              usuarioId: alumno,
              claseId: c.id,
              medio: 'pago',
              ahora: new Date(t),
            })
            const { pagoId } = await iniciarPagoReserva(db, proveedorSeed, {
              reservaId: hecha.reservaId,
              usuarioId: alumno,
              ahora: new Date(t + MIN),
            })
            await resolverPago(db, pagoId, r.sig() < 0.9 ? 'aprobado' : 'rechazado', new Date(t + 3 * MIN))
          })
        }
      })
    }
  }

  // Sofía en la lista de espera de una clase llena de esta semana (si todavía no empezó).
  const llenaFutura = todas.find(
    (c) =>
      c.iniciaEn > new Date(ahora.getTime() + DIA) &&
      hora(c.iniciaEn) === '19:15' &&
      !reservasSofia.has(c.id),
  )
  if (llenaFutura) {
    const t = ahora.getTime() - 30 * MIN
    en(t, async () => {
      // Se asegura de que esté llena antes de anotarla (otros alumnos con crédito completan el cupo).
      for (const alumno of alumnos.slice(1, 12)) {
        await ignorarNegocio(() =>
          reservarClase(db, {
            usuarioId: alumno,
            claseId: llenaFutura.id,
            medio: 'credito',
            ahora: new Date(t),
          }),
        )
      }
      await ignorarNegocio(() =>
        anotarEnEspera(db, { usuarioId: sofia, claseId: llenaFutura.id, ahora: new Date(t + MIN) }),
      )
    })
  }

  eventos.sort((a, b) => a.t - b.t || a.orden - b.orden)
  // Los eventos pueden agregar otros (cancelaciones) más adelante en el tiempo: se procesan en orden.
  while (eventos.length) {
    const e = eventos.shift()!
    await e.correr()
    eventos.sort((a, b) => a.t - b.t || a.orden - b.orden)
  }

  // Asistencia: casi todas las reservas confirmadas de clases que ya terminaron quedan como "asistió".
  const pasadas = await db
    .select({ id: reservas.id })
    .from(reservas)
    .innerJoin(clases, eq(clases.id, reservas.claseId))
    .where(and(eq(reservas.estado, 'confirmada'), lt(clases.terminaEn, ahora)))
  const asistieron = pasadas.filter(() => r.sig() < 0.93).map((p) => p.id)
  if (asistieron.length)
    await db.update(reservas).set({ estado: 'asistio' }).where(inArray(reservas.id, asistieron))

  await vencerPacks(db, ahora)
  await liberarReservasVencidas(db, ahora)
  // La historia generó cientos de emails en la outbox: no se mandan.
  await db.delete(emails).where(gte(emails.creadoEn, new Date(0)))

  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(reservas)
  log(`${alumnos.length} alumnos, ${n} reservas`)
  return { sofia }
}
