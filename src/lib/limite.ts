import { sql } from 'drizzle-orm'
import { db as dbPorDefecto, type DB } from '@/db'

/**
 * Rate limit de ventana fija guardado en Postgres: vale igual con varias instancias del servidor.
 * Devuelve true si la acción está permitida (y la cuenta), false si se pasó del límite.
 */
export async function consumirLimite(
  clave: string,
  max: number,
  ventanaSeg: number,
  db: DB = dbPorDefecto,
): Promise<boolean> {
  const res = await db.execute<{ conteo: number }>(sql`
    insert into limites (clave, ventana_inicio, conteo) values (${clave}, now(), 1)
    on conflict (clave) do update set
      conteo = case when limites.ventana_inicio < now() - make_interval(secs => ${ventanaSeg})
        then 1 else limites.conteo + 1 end,
      ventana_inicio = case when limites.ventana_inicio < now() - make_interval(secs => ${ventanaSeg})
        then now() else limites.ventana_inicio end
    returning conteo`)
  return Number(res.rows[0]?.conteo ?? 0) <= max
}

/** Cuántos usos quedan en la ventana actual, sin consumir ninguno. */
export async function usosRestantes(
  clave: string,
  max: number,
  ventanaSeg: number,
  db: DB = dbPorDefecto,
): Promise<number> {
  const res = await db.execute<{ conteo: number }>(sql`
    select case when ventana_inicio < now() - make_interval(secs => ${ventanaSeg}) then 0 else conteo end as conteo
    from limites where clave = ${clave}`)
  return Math.max(0, max - Number(res.rows[0]?.conteo ?? 0))
}
