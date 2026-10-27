import { eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { clases, emails, instructores, packs, reservas, tiposClase, user } from '@/db/schema'
import { vaciar } from '@/db/seed'
import { moverCredito } from '@/lib/dominio/creditos'

export const MIN = 60 * 1000
export const HORA = 60 * MIN
export const DIA = 24 * HORA
export const en = (base: Date, ms: number) => new Date(base.getTime() + ms)

let tipoId = ''
let instructorId = ''

/** Base vacía con un tipo de clase y una instructora. */
export async function baseLimpia() {
  await vaciar(db)
  const [tipo] = await db
    .insert(tiposClase)
    .values({ slug: 'clasico', nombre: 'Reformer clásico', descripcion: 'test', nivel: 'intermedio' })
    .returning()
  const [inst] = await db.insert(instructores).values({ nombre: 'Lucía Ferreyra' }).returning()
  tipoId = tipo.id
  instructorId = inst.id
}

export async function crearClase(iniciaEn: Date, opciones: { cupo?: number; sandbox?: boolean } = {}) {
  const [c] = await db
    .insert(clases)
    .values({
      tipoClaseId: tipoId,
      instructorId,
      iniciaEn,
      terminaEn: en(iniciaEn, 55 * MIN),
      cupo: opciones.cupo ?? 6,
      sandbox: opciones.sandbox ?? false,
    })
    .returning()
  return c.id
}

let n = 0
export async function crearAlumno(nombre = `Alumno ${++n}`) {
  const id = crypto.randomUUID()
  await db.insert(user).values({ id, name: nombre, email: `${id}@ejemplo.test` })
  return id
}

/** Pack activo con `creditos` créditos (y su movimiento de compra, para que el saldo sea auditable). */
export async function acreditar(
  usuarioId: string,
  creditos: number,
  ahora: Date,
  venceEn = en(ahora, 30 * DIA),
) {
  return db.transaction(async (tx) => {
    const [pack] = await tx
      .insert(packs)
      .values({
        usuarioId,
        nombre: `Pack de ${creditos}`,
        creditosTotales: creditos,
        estado: 'activo',
        compradoEn: ahora,
        venceEn,
      })
      .returning()
    await moverCredito(tx, { usuarioId, packId: pack.id, delta: creditos, motivo: 'compra', ahora })
    return pack.id
  })
}

export async function creditosDe(usuarioId: string) {
  const [f] = await db
    .select({ n: sql<number>`coalesce(sum(${packs.creditosRestantes}), 0)::int` })
    .from(packs)
    .where(eq(packs.usuarioId, usuarioId))
  return f.n
}

export async function reservasDe(claseId: string) {
  return db.select().from(reservas).where(eq(reservas.claseId, claseId))
}

export async function emailsDe(plantilla: string) {
  return db.select().from(emails).where(eq(emails.plantilla, plantilla))
}
