import { writeFileSync } from 'node:fs'
import { entornoE2E } from '../playwright.config'

/**
 * Antes de los e2e: migra y resiembra la base de tests y arma clases propias para cada recorrido,
 * así los tests no dependen de qué día de la semana se corren.
 */
export default async function preparar() {
  Object.assign(process.env, { DATABASE_URL: entornoE2E.DATABASE_URL, APP_ENV: 'test' })
  if (!entornoE2E.DATABASE_URL) throw new Error('Falta DATABASE_URL_TEST para los e2e')

  const { migrate } = await import('drizzle-orm/node-postgres/migrator')
  const { db, pool } = await import('../src/db')
  const { eq } = await import('drizzle-orm')
  const { clases, instructores, tiposClase, user } = await import('../src/db/schema')
  const { sembrar, vaciar } = await import('../src/db/seed')
  const { ajustarCreditos } = await import('../src/lib/dominio/creditos')
  const { reservarClase } = await import('../src/lib/dominio/reservas')
  const { CUENTAS_DEMO } = await import('../src/lib/config')
  const { claveDia, inicioDeSemana, instanteDePlantilla, diaIso } = await import('../src/lib/tiempo')

  await migrate(db, { migrationsFolder: 'drizzle' })
  await vaciar(db)
  const ahora = new Date()
  await sembrar(db, { ahora, contrasena: entornoE2E.DEMO_PASSWORD })

  const [movilidad] = await db.select().from(tiposClase).where(eq(tiposClase.slug, 'movilidad'))
  const [lucia] = await db.select().from(instructores).where(eq(instructores.nombre, 'Lucía Ferreyra'))
  const [sofia] = await db.select().from(user).where(eq(user.email, CUENTAS_DEMO.alumno.email))
  const [admin] = await db.select().from(user).where(eq(user.email, CUENTAS_DEMO.admin.email))
  const otros = await db.select().from(user).where(eq(user.role, 'alumno')).limit(8)
  const alumnos = otros.filter((u) => u.id !== sofia.id).slice(0, 6)

  /** Clase a `dias` días, a una hora de la siesta que la grilla real no usa. */
  async function clase(dias: number, hhmm: string) {
    const dia = new Date(ahora.getTime() + dias * 86_400_000)
    const inicio = instanteDePlantilla(inicioDeSemana(dia), diaIso(dia), hhmm)
    const [c] = await db
      .insert(clases)
      .values({
        tipoClaseId: movilidad.id,
        instructorId: lucia.id,
        iniciaEn: inicio,
        terminaEn: new Date(inicio.getTime() + 55 * 60_000),
        cupo: 6,
      })
      .returning()
    return c
  }

  // Sofía necesita créditos de sobra para todos los recorridos.
  await ajustarCreditos(db, { usuarioId: sofia.id, delta: 6, nota: 'e2e', actorId: admin.id, ahora })

  const claseCredito = await clase(3, '14:00')
  const clasePago = await clase(3, '15:00')
  const claseCancelar = await clase(5, '14:00')
  await reservarClase(db, { usuarioId: sofia.id, claseId: claseCancelar.id, medio: 'credito', ahora })

  // Para arrastrar en la agenda: sola en su fila de las 16:00, así el resto de la fila son destinos libres.
  const claseMover = await clase(3, '16:00')

  const claseLlena = await clase(4, '14:00')
  for (const a of alumnos) {
    await ajustarCreditos(db, { usuarioId: a.id, delta: 1, nota: 'e2e', actorId: admin.id, ahora })
    await reservarClase(db, { usuarioId: a.id, claseId: claseLlena.id, medio: 'credito', ahora })
  }

  writeFileSync(
    'e2e/.datos.json',
    JSON.stringify(
      {
        claseCredito: claseCredito.id,
        clasePago: clasePago.id,
        claseCancelar: claseCancelar.id,
        claseLlena: claseLlena.id,
        semanaLlena: claveDia(inicioDeSemana(claseLlena.iniciaEn)),
        claseMover: claseMover.id,
        semanaMover: claveDia(inicioDeSemana(claseMover.iniciaEn)),
      },
      null,
      2,
    ),
  )
  await pool.end()
}
