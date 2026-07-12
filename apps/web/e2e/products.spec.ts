import { test, expect } from '@playwright/test'

test.describe('Products page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/products')
    await page.waitForLoadState('networkidle')
  })

  test('renders page heading', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('renders product count', async ({ page }) => {
    await expect(page.getByText(/\d+ products?/).first()).toBeVisible()
  })

  test('renders product cards from the API', async ({ page }) => {
    await expect(page.getByText('HP 123 Black Inkjet').first()).toBeVisible()
  })

  test('renders filter panel with All products on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/products')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: 'All products' }).first()).toBeVisible()
  })

  test('category filter round-trips through the URL', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/products?category=cat_hp')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'All products' }).first().click()
    await expect(page).not.toHaveURL(/category=/)
  })
})
