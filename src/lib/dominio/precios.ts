import { asc, eq } from 'drizzle-orm'
import type { Ejecutor } from '@/db'
import { ajustes, productosPack } from '@/db/schema'

/** Precio por defecto de la clase suelta si nadie lo cambió desde el panel. */
export const PRECIO_CLASE_POR_DEFECTO = 22000

/** El precio lo define el servidor: se lee de la base en cada reserva, nunca del navegador. */
export async function precioClaseSuelta(tx: Ejecutor): Promise<number> {
  const [fila] = await tx.select().from(ajustes).where(eq(ajustes.clave, 'precio_clase'))
  const valor = fila?.valor
  return typeof valor === 'number' && Number.isInteger(valor) && valor > 0 ? valor : PRECIO_CLASE_POR_DEFECTO
}

export async function guardarPrecioClase(tx: Ejecutor, ars: number): Promise<void> {
  await tx
    .insert(ajustes)
    .values({ clave: 'precio_clase', valor: ars })
    .onConflictDoUpdate({ target: ajustes.clave, set: { valor: ars, actualizadoEn: new Date() } })
}

export async function productosActivos(tx: Ejecutor) {
  return tx
    .select()
    .from(productosPack)
    .where(eq(productosPack.activo, true))
    .orderBy(asc(productosPack.orden))
}
