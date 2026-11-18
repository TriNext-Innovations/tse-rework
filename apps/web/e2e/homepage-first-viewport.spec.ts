import { test, expect, type Page } from '@playwright/test'

// #399: a shopper who lands on the homepage must be able to tell us their
// printer without scrolling. The finder's controls have to sit inside the
// first viewport on a laptop and on a phone.

const VIEWPORTS = [
  { name: 'desktop 1440x900', width: 1440, height: 900 },
  { name: 'mobile 390x844', width: 390, height: 844 },
]

// The hero rises in on a short CSS animation (#500). Measure where things
// come to rest, not where they are mid-flight. The brand ticker loops forever,
// so it is left out.
async function settle(page: Page) {
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  )
}

async function expectInFirstViewport(page: Page, selector: string, height: number) {
  const box = await page.locator(selector).boundingBox()
  expect(box, `${selector} is rendered`).not.toBeNull()
  expect(box!.y, `${selector} top is on screen`).toBeGreaterThanOrEqual(0)
  expect(box!.y + box!.height, `${selector} bottom is above the fold`).toBeLessThanOrEqual(height)
  // On screen is not enough if something sits on top of it (the cookie banner
  // on a first visit): the control itself must be what a tap at its centre
  // hits. Polled, because while a view transition runs the whole page is a
  // snapshot and every hit lands on <html>.
  await expect
    .poll(
      () =>
        page.locator(selector).evaluate((el) => {
          const r = el.getBoundingClientRect()
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
          return hit !== null && (el === hit || el.contains(hit)) ? 'itself' : (hit?.outerHTML.slice(0, 120) ?? 'nothing')
        }),
      { message: `${selector} is not covered` },
    )
    .toBe('itself')
}

for (const vp of VIEWPORTS) {
  test.describe(`Homepage first viewport — ${vp.name} (#399)`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })

    test('the printer finder is the first thing a shopper can use', async ({ page }) => {
      await page.goto('/')
      await settle(page)
      expect(await page.evaluate(() => window.scrollY)).toBe(0)

      await expect(page.getByLabel('Brand')).toBeVisible()
      await expect(page.getByLabel('Printer model')).toBeVisible()
      await expectInFirstViewport(page, '#finder-brand', vp.height)
      await expectInFirstViewport(page, '#finder-model', vp.height)
      await expectInFirstViewport(page, '#finder button:has-text("Find cartridges")', vp.height)
    })

    test('the finder works from where it lands, without scrolling', async ({ page }) => {
      await page.goto('/')
      await page.getByLabel('Printer model').fill('M404dn')
      await page.getByRole('button', { name: 'Find cartridges' }).click()
      await expect(page).toHaveURL(/\/compatibility\?model=/)
    })

    test('the bestseller card is still on the page', async ({ page }) => {
      await page.goto('/')
      const card = page.locator('article', { hasText: 'Bestseller' })
      await expect(card.getByRole('link', { name: 'Details' })).toHaveAttribute('href', '/products/canon-ca737')
    })
  })
}
