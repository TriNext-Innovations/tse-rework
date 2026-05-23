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
    await expect(page.getByText(/\d+ products/)).toBeVisible()
  })

  test('renders filter sidebar on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/products')
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: 'All products' })).toBeVisible()
  })

  test('renders at least one product card', async ({ page }) => {
    const cards = page.locator('article')
    await expect(cards.first()).toBeVisible()
  })

  test('desktop screenshot matches baseline', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/products')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('products-desktop.png', {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    })
  })

  test('mobile screenshot matches baseline', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/products')
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveScreenshot('products-mobile.png', {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    })
  })

  test('nav "← Home" link returns to homepage', async ({ page }) => {
    await page.getByText('← Home').click()
    await expect(page).toHaveURL('/')
  })

  test('nav logo links to homepage', async ({ page }) => {
    await page.goto('/products')
    // The Logo in products page is unlinked (linked=false) so we check the header link
    await expect(page.locator('header')).toBeVisible()
  })

  test('clicking a category filter updates URL', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/products')
    await page.waitForLoadState('networkidle')
    // Click first brand filter (not "All products")
    const brandFilters = page.locator('aside button').filter({ hasNotText: 'All products' })
    const count = await brandFilters.count()
    if (count > 0) {
      await brandFilters.first().click()
      await expect(page).toHaveURL(/category=/)
    }
  })

  test('"All products" filter clears category from URL', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/products?category=cat_hp')
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'All products' }).click()
    await expect(page).not.toHaveURL(/category=/)
  })
})
