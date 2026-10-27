import { expect, test } from '@playwright/test'
import { datos, entrarComo } from './ayudas'

test.describe('alumno', () => {
  test.beforeEach(async ({ page }) => entrarComo(page, 'alumno'))

  test('reserva con un crédito y el carril se llena', async ({ page }) => {
    await page.goto(`/clase/${datos().claseCredito}`)
    await page.getByRole('radio', { name: /Usar 1 crédito/ }).check()
    await page.getByRole('button', { name: 'Reservar', exact: true }).click()
    await expect(page.getByText(/Reservaste el .+ 14:00 con Lucía\./)).toBeVisible()
    await expect(page.getByText(/Te quedan? \d+ créditos?\./)).toBeVisible()
    await page.goto('/mis-reservas')
    await expect(
      page
        .getByRole('region', { name: /próximas/i })
        .getByText('Movilidad')
        .first(),
    ).toBeVisible()
  })

  test('paga la clase suelta con el pago simulado y queda confirmada', async ({ page }) => {
    await page.goto(`/clase/${datos().clasePago}`)
    await page.getByRole('radio', { name: /Pagar la clase suelta/ }).check()
    await page.getByRole('button', { name: /^Pagar \$/ }).click()
    await expect(page).toHaveURL(/\/pago-simulado\//)
    await page.getByRole('button', { name: 'Aprobar el pago' }).click()
    await expect(page).toHaveURL(/\/pago\/[^?]+/)
    await expect(page.getByRole('heading', { name: 'Pagaste y reservaste' })).toBeVisible()
  })

  test('cancela con más de 12 horas y recupera el crédito', async ({ page }) => {
    await page.goto(`/clase/${datos().claseCancelar}`)
    await page.getByRole('button', { name: 'Cancelar reserva' }).click()
    const dialogo = page.getByRole('alertdialog')
    await expect(dialogo).toContainText('te devolvemos el crédito')
    await dialogo.getByRole('button', { name: 'Cancelar reserva' }).click()
    await expect(page.getByText(/Cancelaste tu clase del .+\. Te devolvimos el crédito\./)).toBeVisible()
  })
})

test('lista de espera: cuando se libera un lugar, pasa a la primera persona', async ({ page, browser }) => {
  const d = datos()
  await entrarComo(page, 'alumno')
  await page.goto(`/clase/${d.claseLlena}`)
  await page.getByRole('button', { name: 'Anotarme en la lista de espera' }).click()
  await expect(page.getByText('Sos el puesto 1.')).toBeVisible()

  const contexto = await browser.newContext()
  const admin = await contexto.newPage()
  await entrarComo(admin, 'admin')
  await admin.goto(`/admin?semana=${d.semanaLlena}&clase=${d.claseLlena}`)
  const cajon = admin.getByRole('dialog')
  await expect(cajon.getByText('6 de 6')).toBeVisible()
  await cajon.getByRole('button', { name: 'Cancelar', exact: true }).first().click()
  const confirmar = admin.getByRole('alertdialog')
  await expect(confirmar).toContainText('El lugar pasa a la primera persona de la lista de espera.')
  await confirmar.getByRole('button', { name: 'Cancelar reserva' }).click()
  await expect(admin.getByRole('status').getByText(/Cancelaste la reserva de/)).toBeVisible()
  await contexto.close()

  await page.goto(`/clase/${d.claseLlena}`)
  await expect(page.getByText(/Ya tenés el reformer \d en esta clase/)).toBeVisible()
})

test('admin: una plantilla nueva genera clases que aparecen en los horarios', async ({ page }) => {
  await entrarComo(page, 'admin')
  await page.goto('/admin/plantillas')
  await page.getByLabel('Día').selectOption({ label: 'Sábado' })
  await page.getByLabel('Hora').selectOption('12:00')
  await page.getByLabel('Clase').selectOption({ label: 'Movilidad' })
  await page.getByLabel('Instructor').selectOption({ label: 'Valentina Sosa' })
  await page.getByRole('button', { name: 'Crear plantilla y generar clases' }).click()
  await expect(
    page.getByText(
      /Creaste Movilidad los sábados a las 12:00 con Valentina Sosa\. Se generaron [1-3] clases?/,
    ),
  ).toBeVisible()

  await page.goto('/')
  await page.getByRole('link', { name: 'Semana siguiente' }).click()
  await expect(
    page.getByRole('link', { name: /sábado \d+, 12:00, Movilidad con Valentina Sosa, 0 de 6/ }),
  ).toBeVisible()
})
