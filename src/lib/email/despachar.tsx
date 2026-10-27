import { render, toPlainText } from '@react-email/render'
import { and, asc, eq, lt, sql } from 'drizzle-orm'
import nodemailer, { type Transporter } from 'nodemailer'
import type { DB } from '@/db'
import { emails } from '@/db/schema'
import { contenidoDe } from './contenido'
import { EmailNucleo } from './EmailNucleo'
import type { DatosPorPlantilla, NombrePlantilla } from './tipos'

export async function renderizarEmail<K extends NombrePlantilla>(plantilla: K, datos: DatosPorPlantilla[K]) {
  const contenido = contenidoDe(plantilla, datos)
  const html = await render(<EmailNucleo contenido={contenido} />)
  return { contenido, html, texto: toPlainText(html) }
}

type Mensaje = { para: string; asunto: string; html: string; texto: string }
type Transporte = { nombre: 'smtp' | 'resend' | 'log'; enviar(m: Mensaje): Promise<void> }

let smtp: Transporter | null = null

/** SMTP (Mailpit en local), Resend en el deploy o, sin credenciales, registro en el log. */
function transporte(): Transporte {
  const desde = process.env.EMAIL_FROM ?? 'Núcleo <hola@nucleo.test>'
  if (process.env.RESEND_API_KEY) {
    return {
      nombre: 'resend',
      async enviar(m) {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ from: desde, to: m.para, subject: m.asunto, html: m.html, text: m.texto }),
          signal: AbortSignal.timeout(10_000),
        })
        if (!res.ok) throw new Error(`Resend respondió ${res.status}: ${await res.text()}`)
      },
    }
  }
  if (process.env.SMTP_URL) {
    smtp ??= nodemailer.createTransport(process.env.SMTP_URL)
    const t = smtp
    return {
      nombre: 'smtp',
      async enviar(m) {
        await t.sendMail({ from: desde, to: m.para, subject: m.asunto, html: m.html, text: m.texto })
      },
    }
  }
  return {
    nombre: 'log',
    async enviar(m) {
      console.info(`[email] para=${m.para} asunto="${m.asunto}"`)
    },
  }
}

const MAX_INTENTOS = 5

/**
 * Despacha los emails pendientes de la outbox. Toma las filas con FOR UPDATE SKIP LOCKED, así dos
 * despachadores a la vez (el `after()` de una acción y el cron) nunca mandan el mismo email.
 */
export async function despacharEmails(db: DB, limite = 25): Promise<{ enviados: number; fallidos: number }> {
  const t = transporte()
  let enviados = 0
  let fallidos = 0
  await db.transaction(async (tx) => {
    const lote = await tx
      .select()
      .from(emails)
      .where(and(eq(emails.estado, 'pendiente'), lt(emails.intentos, MAX_INTENTOS)))
      .orderBy(asc(emails.creadoEn))
      .limit(limite)
      .for('update', { skipLocked: true })
    for (const e of lote) {
      try {
        const { contenido, html, texto } = await renderizarEmail(
          e.plantilla as NombrePlantilla,
          e.datos as never,
        )
        await t.enviar({ para: e.para, asunto: contenido.asunto, html, texto })
        await tx
          .update(emails)
          .set({
            estado: t.nombre === 'log' ? 'registrado' : 'enviado',
            asunto: contenido.asunto,
            enviadoEn: new Date(),
            intentos: sql`${emails.intentos} + 1`,
            error: null,
          })
          .where(eq(emails.id, e.id))
        enviados++
      } catch (err) {
        fallidos++
        const intentos = e.intentos + 1
        await tx
          .update(emails)
          .set({
            intentos,
            estado: intentos >= MAX_INTENTOS ? 'fallido' : 'pendiente',
            error: err instanceof Error ? err.message.slice(0, 500) : String(err),
          })
          .where(eq(emails.id, e.id))
      }
    }
  })
  return { enviados, fallidos }
}
