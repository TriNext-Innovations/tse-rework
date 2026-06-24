import { test, expect } from '@playwright/test'

test.describe('Cart', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('cart button shows 0-count badge initially (no badge)', async ({ page }) => {
    const badge = page.locator('[aria-label*="Cart"] span').first()
    await expect(badge).not.toBeVisible()
  })

  test('cart drawer opens when cart button is clicked', async ({ page }) => {
    await page.getByRole('button', { name: /Cart/i }).click()
    await expect(page.getByRole('heading', { name: 'Cart' })).toBeVisible()
  })

  test('cart shows empty state initially', async ({ page }) => {
    await page.getByRole('button', { name: /Cart/i }).click()
    await expect(page.getByText('Your cart is empty')).toBeVisible()
  })

  test('closing cart with backdrop click hides drawer', async ({ page }) => {
    await page.getByRole('button', { name: /Cart/i }).click()
    // Click outside the drawer (the backdrop)
    await page.mouse.click(100, 400)
    await expect(page.getByText('Your cart is empty')).not.toBeVisible()
  })

  test('adds item from homepage hero and shows badge', async ({ page }) => {
    const addBtn = page.getByText('Add to cart — R300')
    await addBtn.click()
    await expect(page.locator('[aria-label*="Cart"] span').first()).toBeVisible()
    await expect(page.locator('[aria-label*="Cart"] span').first()).toHaveText('1')
  })

  test('cart drawer shows item after adding', async ({ page }) => {
    await page.getByText('Add to cart — R300').click()
    await page.getByRole('button', { name: /Cart \(1 items\)/i }).click()
    await expect(page.getByText('Canon 737 Black Toner')).toBeVisible()
  })

  test('cart shows subtotal after adding item', async ({ page }) => {
    await page.getByText('Add to cart — R300').click()
    await page.getByRole('button', { name: /Cart/i }).click()
    await expect(page.getByText('Subtotal')).toBeVisible()
    await expect(page.getByText(/R300/)).toBeVisible()
  })

  test('removing item from cart clears the badge', async ({ page }) => {
    await page.getByText('Add to cart — R300').click()
    await page.getByRole('button', { name: /Cart/i }).click()
    await page.getByRole('button', { name: /Remove item/i }).first().click()
    await expect(page.getByText('Your cart is empty')).toBeVisible()
  })

  test('adding same product twice increments quantity', async ({ page }) => {
    await page.getByText('Add to cart — R300').click()
    await page.getByText('Add to cart — R300').click()
    await expect(page.locator('[aria-label*="Cart"] span').first()).toHaveText('2')
  })

  test('cart screenshot with item matches baseline', async ({ page }) => {
    await page.getByText('Add to cart — R300').click()
    await page.getByRole('button', { name: /Cart/i }).click()
    await expect(page.locator('[role="complementary"], .fixed.inset-0')).toHaveScreenshot(
      'cart-with-item.png',
      { maxDiffPixelRatio: 0.02, animations: 'disabled' },
    )
  })
})
