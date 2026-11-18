import { test, expect } from '@playwright/test'

// #451 — a Photosmart 3210 takes six cartridges: HP 177 Black/Cyan/Magenta/
// Yellow (four variants of one product) and the Light Cyan / Light Magenta
// standalone products. The finder shows three cards; it must say six, and the
// collapsed card must show its colours rather than one variant's SKU.

test.describe('collapsed colour cards (#451)', () => {
  test('the finder counts cartridges and names the colours on the HP 177 card', async ({ page }) => {
    await page.goto('/compatibility?model=HP%20Photosmart%203210')

    await expect(page.getByText(/6 cartridges compatible with/)).toBeVisible()
    await expect(page.getByText(/across 3 products/)).toBeVisible()

    const card = page.locator('a[href="/products/hp-177"]')
    await expect(card).toContainText('4 colours')
    await expect(card).not.toContainText('HP-177-K')
    await expect(card.locator('[data-swatch]')).toHaveCount(4)

    // Single-variant cards still show their SKU.
    await expect(page.locator('a[href="/products/hp-177-cyan-light"]')).toContainText('SKU HP-177CYANLIGHT')
  })

  test('the printer page counts cartridges and sends a multi-colour card to the selector', async ({ page }) => {
    await page.goto('/printers/hp-photosmart-3210')

    await expect(page.getByText('6 generic cartridges in the TSE range fit the HP Photosmart 3210, across 3 products.')).toBeVisible()

    const card = page.locator('[data-product-card]', { hasText: /^HP 177/ }).filter({ hasText: '4 colours' })
    await expect(card).toHaveCount(1)
    // Cheapest colour, flagged as "from" because black costs more.
    await expect(card).toContainText(/from\s*R180/)
    // No one-tap add that would silently pick a colour.
    await expect(card.getByRole('button', { name: /add .* to cart/i })).toHaveCount(0)
    await expect(card.locator('[data-choose-variant]')).toHaveAttribute('href', '/products/hp-177')

    // A single-cartridge card keeps its quick-add.
    const light = page.locator('[data-product-card]', { hasText: 'HP 177 Cyan Light' })
    await expect(light.getByRole('button', { name: /add .* to cart/i })).toBeVisible()
  })
})
