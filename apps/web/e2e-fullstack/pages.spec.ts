import { expect, test } from '@playwright/test'
import { BACKEND, openHydrated, waitForMail } from './helpers'

test('a printer page lists compatible cartridges from the compatibility data', async ({ page }) => {
  await page.goto('/printers')
  const printer = page.locator('a[href^="/printers/"]').first()
  await expect(printer).toBeVisible()
  await page.goto((await printer.getAttribute('href'))!)
  await expect(page.locator('a[href^="/products/"], a[href^="/cartridges/"]').first()).toBeVisible()
})

test('the printer finder suggests a model as you type', async ({ page }) => {
  await openHydrated(page, '/compatibility')
  await page.getByPlaceholder('e.g. Brother DCP-L3520cdw').fill('Brother')
  await expect(page.getByText(/Brother [A-Z]{2,}/).first()).toBeVisible()
})

test('header search finds a seeded product (Meilisearch)', async ({ page }) => {
  await openHydrated(page, '/')
  await page.getByRole('button', { name: /search products/i }).click()
  await page.getByPlaceholder(/search cartridges/i).fill('Canon')
  await expect(page.getByText(/Canon/).nth(1)).toBeVisible()
})

test('a product page shows a price and adds to cart', async ({ page }) => {
  await page.goto('/products')
  const href = await page.locator('a[href^="/products/"]').first().getAttribute('href')
  await page.goto(href!)
  await expect(page.locator('main')).toContainText(/R\s?\d/)
  await expect(page.getByRole('button', { name: /add to cart/i }).first()).toBeEnabled()
})

test('a B2B quote request is confirmed and reaches sales', async ({ page }) => {
  const company = `E2E Supplies ${Date.now()}`
  await openHydrated(page, '/b2b/quote')
  await page.getByPlaceholder('Acme Office Supplies').fill(company)
  await page.getByPlaceholder('Jane Smith').fill('Quinn Quote')
  await page.getByPlaceholder('jane@acme.co.za').fill('quote@example.com')
  await page.getByPlaceholder('011 234 5678').fill('0112345678')
  await page.getByPlaceholder('Randburg, Johannesburg').fill('Randburg')
  await page.getByPlaceholder('CRG-737').first().fill('CRG-737')
  await page.getByPlaceholder('Canon 737 Black Toner').first().fill('Canon 737 Black Toner')
  await page.getByPlaceholder('1', { exact: true }).first().fill('10')
  await page.getByRole('button', { name: /send quote request/i }).click()
  await expect(page).toHaveURL(/\/b2b\/confirmed/, { timeout: 20_000 })
  await waitForMail(/quote/i)
})

test('Google Merchant feed lists products', async ({ request }) => {
  const res = await request.get('/feed/google-merchant.xml')
  expect(res.status()).toBe(200)
  const xml = await res.text()
  expect((xml.match(/<item>/g) ?? []).length).toBeGreaterThan(5)
  expect(xml).toMatch(/<g:price>[\d.]+ ZAR<\/g:price>/)
})

test('storefront and backend health', async ({ request }) => {
  expect((await request.get('/api/health')).status()).toBe(200)
  expect((await request.get(`${BACKEND}/health`)).status()).toBe(200)
})
