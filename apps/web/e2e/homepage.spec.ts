import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('renders hero tagline', async ({ page }) => {
    await expect(page.getByText('Generic.', { exact: true })).toBeVisible()
    await expect(page.getByText('Not generic')).toBeVisible()
  })

  test('renders navigation', async ({ page }) => {
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible()
  })

  test('renders FAQ section', async ({ page }) => {
    await expect(page.getByText('Will a generic cartridge work in my printer?')).toBeVisible()
  })

  test('FAQ accordion toggles on click', async ({ page }) => {
    const firstFaq = page.getByRole('button', { name: /Will a generic cartridge/i })
    await firstFaq.scrollIntoViewIfNeeded()
    // Open by default (openFaq = 0); clicking closes it.
    await expect(firstFaq).toHaveAttribute('aria-expanded', 'true')
    await firstFaq.click()
    await expect(firstFaq).toHaveAttribute('aria-expanded', 'false')
  })

  test('cart button is visible with zero-count label', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Cart (0 items)' })).toBeVisible()
  })

  test('opening cart shows empty drawer, X closes it', async ({ page }) => {
    await page.getByRole('button', { name: 'Cart (0 items)' }).click()
    const drawer = page.getByRole('dialog', { name: 'Shopping cart' })
    await expect(drawer.getByText('Your cart is empty')).toBeVisible()
    await drawer.getByRole('button', { name: 'Close cart' }).click()
    await expect(drawer.getByText('Your cart is empty')).not.toBeVisible()
  })

  test('finder navigates to compatibility on submit', async ({ page }) => {
    await page.locator('#finder').scrollIntoViewIfNeeded()
    await page.fill('input[placeholder*="P1102"]', 'M404dn')
    await page.getByText('Find cartridges', { exact: true }).click()
    await expect(page).toHaveURL(/\/compatibility\?model=/)
  })

  test('popular search chip navigates to compatibility', async ({ page }) => {
    await page.locator('#finder').scrollIntoViewIfNeeded()
    await page.getByRole('button', { name: 'Canon PIXMA MX494' }).click()
    await expect(page).toHaveURL(/\/compatibility\?model=Canon/)
  })
})
