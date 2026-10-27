import { readFileSync } from 'node:fs'
import { expect, type Page } from '@playwright/test'

export type DatosE2E = {
  claseCredito: string
  clasePago: string
  claseCancelar: string
  claseLlena: string
  semanaLlena: string
  claseMover: string
  semanaMover: string
}

export const datos = (): DatosE2E => JSON.parse(readFileSync('e2e/.datos.json', 'utf8'))

/** Entra con los botones de cuenta demo, como lo haría alguien que prueba el portafolio. */
export async function entrarComo(page: Page, rol: 'alumno' | 'admin') {
  await page.goto('/entrar')
  await page.getByRole('button', { name: `Entrar como ${rol} demo` }).click()
  await expect(page).toHaveURL(rol === 'admin' ? /\/admin/ : /localhost:\d+\/$/)
}
