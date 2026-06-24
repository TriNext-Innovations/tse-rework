import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('renders hero tagline', async ({ page }) => {
    await expect(page.getByText('Generic.')).toBeVisible()
    await expect(page.getByText('Not generic')).toBeVisible()
  })

  test('renders navigation links', async ({ page }) => {
    await expect(page.getByRole('link', { name: /Shop/i }).first()).toBeVisible()
  })

  test('renders brand marquee', async ({ page }) => {
    await expect(page.getByText('HP').first()).toBeVisible()
    await expect(page.getByText('Canon').first()).toBeVisible()
  })

  test('renders FAQ section', async ({ page }) => {
    await expect(page.getByText('Will a generic cartridge work in my printer?')).toBeVisible()
  })

  test('FAQ accordion toggles on click', async ({ page }) => {
    const firstFaq = page.getByRole('button', { name: /Will a generic cartridge/i })
    await firstFaq.click()
    // After clicking open FAQ, it should close
    await expect(firstFaq).toHaveAttribute('aria-expanded', 'false')
  })

  test('theme switcher changes data-theme attribute', async ({ page }) => {
    const brandBtn = page.getByRole('radio', { name: /brand/i })
    await brandBtn.click()
    const root = page.locator('[data-theme]').first()
    await expect(root).toHaveAttribute('data-theme', 'brand')
  })

  test('cart button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Cart/i })).toBeVisible()
  })

  test('opening cart shows empty cart message', async ({ page }) => {
    await page.getByRole('button', { name: /Cart/i }).click()
    await expect(page.getByText('Your cart is empty')).toBeVisible()
  })

  test('closing cart with X button hides drawer', async ({ page }) => {
    await page.getByRole('button', { name: /Cart/i }).click()
    await page.getByRole('button', { name: /Close cart/i }).click()
    await expect(page.getByText('Your cart is empty')).not.toBeVisible()
  })

  test('desktop screenshot matches baseline', async ({ page }) => {
    await page.waitForLoadState('networkidle')
    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(page).toHaveScreenshot('homepage-desktop.png', {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    })
  })

  test('mobile screenshot matches baseline', async ({ page }) => {
    await page.waitForLoadState('networkidle')
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page).toHaveScreenshot('homepage-mobile.png', {
      maxDiffPixelRatio: 0.02,
      animations: 'disabled',
    })
  })

  test('finder section is visible', async ({ page }) => {
    await page.locator('#finder').scrollIntoViewIfNeeded()
    await expect(page.getByText("Tell us your printer.")).toBeVisible()
  })

  test('finder navigates on submit', async ({ page }) => {
    await page.locator('#finder').scrollIntoViewIfNeeded()
    await page.fill('input[placeholder*="LaserJet"]', 'M404dn')
    await page.getByText('Find cartridges').click()
    await expect(page).toHaveURL(/\/products/)
  })

  test('popular search chip navigates to products', async ({ page }) => {
    await page.locator('#finder').scrollIntoViewIfNeeded()
    await page.getByText('HP LaserJet M404').click()
    await expect(page).toHaveURL(/\/products\?brand=HP/)
  })
})
