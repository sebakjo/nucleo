import { and, asc, eq, gt, lte, sql } from 'drizzle-orm'
import type { DB, Ejecutor, Tx } from '@/db'
import { movimientosCredito, packs, type Pack } from '@/db/schema'
import { ErrorDominio } from './errores'
import { vencimientoCreditoDevuelto } from './reglas'

type Motivo = (typeof movimientosCredito.$inferInsert)['motivo']

/**
 * Elige el pack del que sale el crédito: el que vence primero entre los que siguen vigentes cuando
 * empieza la clase. Lo bloquea para que dos reservas simultáneas no usen el mismo crédito.
 */
export async function packParaClase(tx: Tx, usuarioId: string, inicioClase: Date): Promise<Pack | null> {
  const [pack] = await tx
    .select()
    .from(packs)
    .where(
      and(
        eq(packs.usuarioId, usuarioId),
        eq(packs.estado, 'activo'),
        gt(packs.creditosRestantes, 0),
        gt(packs.venceEn, inicioClase),
      ),
    )
    .orderBy(asc(packs.venceEn))
    .limit(1)
    .for('update')
  return pack ?? null
}

export async function moverCredito(
  tx: Tx,
  mov: {
    usuarioId: string
    packId: string
    delta: number
    motivo: Motivo
    reservaId?: string | null
    nota?: string | null
    actorId?: string | null
    ahora: Date
  },
): Promise<void> {
  await tx
    .update(packs)
    .set({ creditosRestantes: sql`${packs.creditosRestantes} + ${mov.delta}` })
    .where(eq(packs.id, mov.packId))
  await tx.insert(movimientosCredito).values({
    usuarioId: mov.usuarioId,
    packId: mov.packId,
    delta: mov.delta,
    motivo: mov.motivo,
    reservaId: mov.reservaId ?? null,
    nota: mov.nota ?? null,
    actorId: mov.actorId ?? null,
    creadoEn: mov.ahora,
  })
}

/** Crea un pack de 1 crédito (cancelación de clase suelta, pago tardío, clase cancelada, ajuste). */
export async function crearCreditoSuelto(
  tx: Tx,
  datos: {
    usuarioId: string
    ahora: Date
    nombre: string
    motivo: Motivo
    reservaId?: string | null
    nota?: string
    actorId?: string
  },
): Promise<Pack> {
  const [pack] = await tx
    .insert(packs)
    .values({
      usuarioId: datos.usuarioId,
      nombre: datos.nombre,
      creditosTotales: 1,
      creditosRestantes: 0,
      estado: 'activo',
      compradoEn: datos.ahora,
      venceEn: vencimientoCreditoDevuelto(datos.ahora),
      creadoEn: datos.ahora,
    })
    .returning()
  await moverCredito(tx, {
    usuarioId: datos.usuarioId,
    packId: pack.id,
    delta: 1,
    motivo: datos.motivo,
    reservaId: datos.reservaId,
    nota: datos.nota,
    actorId: datos.actorId,
    ahora: datos.ahora,
  })
  return { ...pack, creditosRestantes: 1 }
}

/**
 * Devuelve el crédito de una reserva cancelada a tiempo. Si salió de un pack que sigue vigente,
 * vuelve a ese pack; si el pack ya venció (o la clase se pagó suelta), se genera un crédito nuevo
 * con 30 días de validez.
 */
export async function devolverCredito(
  tx: Tx,
  datos: { usuarioId: string; reservaId: string; packId: string | null; ahora: Date; motivo: Motivo },
): Promise<void> {
  if (datos.packId) {
    const [pack] = await tx.select().from(packs).where(eq(packs.id, datos.packId)).for('update')
    if (pack && pack.estado === 'activo' && pack.venceEn && pack.venceEn > datos.ahora) {
      await moverCredito(tx, {
        usuarioId: datos.usuarioId,
        packId: pack.id,
        delta: 1,
        motivo: datos.motivo === 'credito_por_cancelacion' ? 'devolucion' : datos.motivo,
        reservaId: datos.reservaId,
        ahora: datos.ahora,
      })
      return
    }
  }
  await crearCreditoSuelto(tx, {
    usuarioId: datos.usuarioId,
    ahora: datos.ahora,
    nombre: datos.motivo === 'clase_cancelada' ? 'Crédito por clase cancelada' : 'Crédito por cancelación',
    motivo: datos.motivo,
    reservaId: datos.reservaId,
  })
}

/** Activa un pack comprado cuando se aprueba su pago: arranca la validez y suma los créditos. */
export async function activarPack(
  tx: Tx,
  packId: string,
  validezDias: number,
  ahora: Date,
): Promise<Pack | null> {
  const [pack] = await tx.select().from(packs).where(eq(packs.id, packId)).for('update')
  if (!pack || pack.estado === 'activo') return null
  await tx
    .update(packs)
    .set({
      estado: 'activo',
      compradoEn: ahora,
      venceEn: new Date(ahora.getTime() + validezDias * 24 * 60 * 60 * 1000),
    })
    .where(eq(packs.id, packId))
  await moverCredito(tx, {
    usuarioId: pack.usuarioId,
    packId,
    delta: pack.creditosTotales,
    motivo: 'compra',
    ahora,
  })
  const [activo] = await tx.select().from(packs).where(eq(packs.id, packId))
  return activo
}

/** Vence los packs cuya fecha pasó: los créditos sin usar se pierden con un movimiento auditable. */
export async function vencerPacks(tx: Tx, ahora: Date): Promise<number> {
  const vencidos = await tx
    .select()
    .from(packs)
    .where(and(eq(packs.estado, 'activo'), lte(packs.venceEn, ahora)))
    .for('update', { skipLocked: true })
  for (const pack of vencidos) {
    if (pack.creditosRestantes > 0) {
      await moverCredito(tx, {
        usuarioId: pack.usuarioId,
        packId: pack.id,
        delta: -pack.creditosRestantes,
        motivo: 'vencimiento',
        ahora,
      })
    }
    await tx.update(packs).set({ estado: 'vencido' }).where(eq(packs.id, pack.id))
  }
  return vencidos.length
}

export type SaldoCreditos = {
  disponibles: number
  proximoVencimiento: Date | null
  packs: { id: string; nombre: string; restantes: number; totales: number; venceEn: Date }[]
}

export async function saldoCreditos(tx: Ejecutor, usuarioId: string, ahora: Date): Promise<SaldoCreditos> {
  const vigentes = await tx
    .select()
    .from(packs)
    .where(and(eq(packs.usuarioId, usuarioId), eq(packs.estado, 'activo'), gt(packs.venceEn, ahora)))
    .orderBy(asc(packs.venceEn))
  const conSaldo = vigentes.filter((p) => p.creditosRestantes > 0)
  return {
    disponibles: conSaldo.reduce((s, p) => s + p.creditosRestantes, 0),
    proximoVencimiento: conSaldo[0]?.venceEn ?? null,
    packs: conSaldo.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      restantes: p.creditosRestantes,
      totales: p.creditosTotales,
      venceEn: p.venceEn!,
    })),
  }
}

/**
 * Ajuste manual desde el panel. Sumar crea un pack "Ajuste del estudio" con 30 días de validez;
 * restar descuenta de los packs vigentes empezando por el que vence primero. Siempre deja un
 * movimiento con quién lo hizo y por qué.
 */
export async function ajustarCreditos(
  db: DB,
  datos: { usuarioId: string; delta: number; nota: string; actorId: string; ahora: Date },
): Promise<void> {
  if (!Number.isInteger(datos.delta) || datos.delta === 0) throw new ErrorDominio('DATOS_INVALIDOS')
  await db.transaction(async (tx) => {
    if (datos.delta > 0) {
      const [pack] = await tx
        .insert(packs)
        .values({
          usuarioId: datos.usuarioId,
          nombre: 'Ajuste del estudio',
          creditosTotales: datos.delta,
          creditosRestantes: 0,
          estado: 'activo',
          compradoEn: datos.ahora,
          venceEn: vencimientoCreditoDevuelto(datos.ahora),
          creadoEn: datos.ahora,
        })
        .returning()
      await moverCredito(tx, { ...datos, packId: pack.id, motivo: 'ajuste' })
      return
    }
    const vigentes = await tx
      .select()
      .from(packs)
      .where(
        and(
          eq(packs.usuarioId, datos.usuarioId),
          eq(packs.estado, 'activo'),
          gt(packs.venceEn, datos.ahora),
          gt(packs.creditosRestantes, 0),
        ),
      )
      .orderBy(asc(packs.venceEn))
      .for('update')
    let falta = -datos.delta
    if (vigentes.reduce((s, p) => s + p.creditosRestantes, 0) < falta) throw new ErrorDominio('SIN_CREDITOS')
    for (const pack of vigentes) {
      if (falta === 0) break
      const sale = Math.min(falta, pack.creditosRestantes)
      await moverCredito(tx, { ...datos, packId: pack.id, delta: -sale, motivo: 'ajuste' })
      falta -= sale
    }
  })
}
