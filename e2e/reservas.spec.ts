import { readFileSync } from 'node:fs'
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

    const descarga = page.waitForEvent('download')
    await page.getByRole('link', { name: 'Agregar al calendario' }).click()
    const ics = readFileSync((await (await descarga).path())!, 'utf8')
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toMatch(/SUMMARY:Movilidad en Núcleo/)
    expect(ics).toMatch(/DTSTART:\d{8}T170000Z/) // 14:00 en Buenos Aires

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

test('admin: descarga los pagos en CSV, y sin sesión no se puede', async ({ page }) => {
  expect((await page.request.get('/admin/pagos/exportar')).status()).toBe(401)

  await entrarComo(page, 'admin')
  await page.goto('/admin/pagos?estado=aprobado')
  const descarga = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Descargar CSV' }).click()
  const archivo = await descarga
  expect(archivo.suggestedFilename()).toMatch(/^nucleo-pagos-aprobado-\d{4}-\d{2}-\d{2}\.csv$/)
  const contenido = readFileSync((await archivo.path())!, 'utf8')
  expect(contenido.startsWith('\uFEFF')).toBe(true) // BOM: Excel muestra bien los acentos
  const [encabezado, ...filas] = contenido.slice(1).trimEnd().split('\r\n')
  expect(encabezado).toBe(
    'Fecha;Persona;Email;Tipo;Concepto;Monto (ARS);Estado;Detalle;Aprobado;Medio;Operación',
  )
  expect(filas.length).toBeGreaterThan(0)
  expect(filas.every((f) => f.includes(';Aprobado;'))).toBe(true)
})

test('admin: arrastra una clase a otro horario de la agenda', async ({ page }) => {
  await entrarComo(page, 'admin')
  await page.goto(`/admin?semana=${datos().semanaMover}`)
  const clase = page.getByRole('link', { name: /, 16:00, Movilidad con Lucía Ferreyra, 0 de 6/ })
  const destino = page.locator('[data-destino][title$="a las 16:00"]').first()
  const titulo = (await destino.getAttribute('title'))!
  const [, dia, numero] = titulo.match(/al (\S+) (\d+) a las/)!

  await clase.dragTo(destino)
  await expect(page.getByRole('status').filter({ hasText: 'Moviste' })).toHaveText(
    `Moviste Movilidad al ${dia} ${numero} a las 16:00. No tenía reservas ni lista de espera.`,
  )
  await expect(
    page.getByRole('link', { name: new RegExp(`^${dia} ${numero}, 16:00, Movilidad con Lucía Ferreyra`) }),
  ).toBeVisible()
})
