import type { Ejecutor } from '@/db'
import { emails } from '@/db/schema'
import type { EmailEncolado } from './tipos'

/**
 * Encola un email dentro de la transacción en curso. Si la transacción se revierte, el email
 * desaparece con ella; si se confirma, el despachador lo manda después del commit.
 */
export async function encolarEmail(tx: Ejecutor, email: EmailEncolado): Promise<void> {
  await tx
    .insert(emails)
    .values({
      usuarioId: email.usuarioId ?? null,
      para: email.para,
      plantilla: email.plantilla,
      datos: email.datos,
      claveUnica: email.claveUnica ?? null,
    })
    .onConflictDoNothing({ target: emails.claveUnica })
}
