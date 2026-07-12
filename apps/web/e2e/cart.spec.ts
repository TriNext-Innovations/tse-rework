import { test, expect } from '@playwright/test'

// Drives the real cart flow against the stateful mock Medusa API: the hero
// add-to-cart creates a cart + line item over HTTP exactly like production.
test.describe('Cart', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  const heroAdd = (page: import('@playwright/test').Page) =>
    page.getByRole('button', { name: /Add to cart — R300/ })

  // Clicks can land before hydration attaches handlers (especially on the CI
  // cold start), so retry the click until the cart badge confirms the add.
  async function addHeroItem(page: import('@playwright/test').Page) {
    await expect(async () => {
      await heroAdd(page).click()
      await expect(page.getByRole('button', { name: 'Cart (1 items)' })).toBeVisible({ timeout: 2000 })
    }).toPass({ timeout: 15000 })
  }

  test('cart badge is hidden at zero', async ({ page }) => {
    const button = page.getByRole('button', { name: 'Cart (0 items)' })
    await expect(button).toBeVisible()
    await expect(button.locator('span')).toHaveCount(0)
  })

  test('hero add-to-cart shows a 1-count badge', async ({ page }) => {
    await addHeroItem(page)
    await expect(page.getByRole('button', { name: 'Cart (1 items)' }).locator('span').last()).toHaveText('1')
  })

  test('drawer lists the added item with subtotal', async ({ page }) => {
    await addHeroItem(page)
    await page.getByRole('button', { name: 'Cart (1 items)' }).click()
    const drawer = page.getByRole('dialog', { name: 'Shopping cart' })
    await expect(drawer.getByText('Canon 737 Black Toner')).toBeVisible()
    await expect(drawer.getByText(/R\s?300/).first()).toBeVisible()
  })

  test('adding the same product twice increments to 2', async ({ page }) => {
    await addHeroItem(page)
    await heroAdd(page).click()
    await expect(page.getByRole('button', { name: 'Cart (2 items)' })).toBeVisible()
  })

  test('removing the item empties the drawer', async ({ page }) => {
    await addHeroItem(page)
    await page.getByRole('button', { name: 'Cart (1 items)' }).click()
    const drawer = page.getByRole('dialog', { name: 'Shopping cart' })
    await drawer.getByRole('button', { name: /Remove/i }).first().click()
    await expect(drawer.getByText('Your cart is empty')).toBeVisible()
  })

  test('cart survives reload (persisted cart id)', async ({ page }) => {
    await addHeroItem(page)
    await page.reload()
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('button', { name: 'Cart (1 items)' })).toBeVisible()
  })
})
