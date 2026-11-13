import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { expect, type Page } from '@playwright/test'

export const BACKEND = process.env.E2E_BACKEND_URL ?? 'http://localhost:9000'
const MAIL_DIR = process.env.E2E_MAIL_DIR ?? join(__dirname, '../../../.local-mail')
// Must match PAYFAST_PASSPHRASE in scripts/e2e-fullstack.sh (throwaway).
const PASSPHRASE = 'e2e-passphrase'

/** Emails captured by scripts/local-mail-sink.mjs, as { subject, html }. */
export function mails(): { subject: string; html: string }[] {
  if (!existsSync(MAIL_DIR)) return []
  return readdirSync(MAIL_DIR)
    .filter((f) => f.endsWith('.html'))
    .sort()
    .map((f) => {
      const html = readFileSync(join(MAIL_DIR, f), 'utf8')
      const subject = /subject: (.*?) -->/.exec(html)?.[1] ?? ''
      return { subject, html }
    })
}

export async function waitForMail(pattern: RegExp, timeout = 30_000) {
  let found: { subject: string; html: string } | undefined
  await expect
    .poll(() => (found = mails().find((m) => pattern.test(m.subject))), { timeout, message: `email ${pattern}` })
    .toBeTruthy()
  return found!
}

/** Opens the first product on /products; returns its title. */
export async function openFirstProduct(page: Page) {
  await page.goto('/products')
  const href = await page.locator('a[href^="/products/"]').first().getAttribute('href')
  expect(href, 'a product link on /products').toBeTruthy()
  await page.goto(href!)
  await expect(page.locator('h1')).toBeVisible()
  await page.waitForLoadState('networkidle') // hydrated before anyone clicks
  return (await page.locator('h1').first().innerText()).trim()
}

export async function addToCart(page: Page) {
  await page.getByRole('button', { name: /add to cart/i }).first().click()
  // The cart id is persisted before the drawer opens.
  await expect.poll(() => page.evaluate(() => JSON.stringify(localStorage) + document.cookie)).toMatch(/cart_/)
}

/** Fills the four checkout steps up to the payment button. Returns the review-step total text. */
export async function checkoutToReview(
  page: Page,
  opts: { email: string; delivery?: RegExp } = { email: 'buyer@example.com' },
) {
  await page.goto('/checkout')
  await page.waitForLoadState('networkidle')
  await page.getByPlaceholder('Jane Smith').fill('E2E Buyer')
  await page.getByPlaceholder('jane@example.com').fill(opts.email)
  await page.getByPlaceholder('082 123 4567').fill('0821234567')
  await page.getByRole('button', { name: /continue to address/i }).click()

  await page.getByPlaceholder('Start typing your address…').fill('12 Main Road')
  await page.getByPlaceholder('Randburg').fill('Randburg')
  await page.getByPlaceholder('Johannesburg').fill('Johannesburg')
  await page.locator('select[autocomplete="address-level1"]').selectOption({ label: 'Gauteng' })
  await page.getByPlaceholder('2194').fill('2194')
  await page.getByRole('button', { name: /continue to delivery/i }).click()

  // Shipping options come from the real backend (TCG_FAKE quotes).
  const option = page.getByRole('button', { name: opts.delivery ?? /Courier Guy — Economy/ })
  await expect(option).toBeVisible()
  await option.click()
  await page.getByRole('button', { name: /review order/i }).click()
  await expect(page.getByText(/how would you like to pay/i)).toBeVisible()
}

/** Clicks "Pay via PayFast" and returns the signed form PayFast would have received. */
export async function payAndInterceptPayfast(page: Page): Promise<URLSearchParams> {
  let body: string | null = null
  await page.route(/payfast\.co\.za/, async (route) => {
    body = route.request().postData()
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<p>PayFast (intercepted by E2E)</p>' })
  })
  await page.getByRole('button', { name: /pay online via payfast/i }).click()
  await expect.poll(() => body, { message: 'POST to PayFast' }).not.toBeNull()
  // Let the browser finish landing on the (intercepted) PayFast page, as a real
  // customer would, so the next navigation isn't racing the form submit.
  await page.waitForURL(/payfast\.co\.za/)
  return new URLSearchParams(body!)
}

/**
 * Sends the ITN PayFast sends after a successful payment, signed the way the
 * provider verifies it (MD5 over the raw body + passphrase).
 */
export async function sendPayfastItn(form: URLSearchParams, status: 'COMPLETE' | 'CANCELLED' = 'COMPLETE') {
  const amount = form.get('amount')!
  const itn = new URLSearchParams({
    m_payment_id: form.get('m_payment_id')!,
    pf_payment_id: String(Date.now()),
    payment_status: status,
    item_name: form.get('item_name') ?? 'TSE Online order',
    amount_gross: amount,
    amount_fee: '-11.50',
    amount_net: (Number(amount) - 11.5).toFixed(2),
    name_first: form.get('name_first') ?? '',
    name_last: form.get('name_last') ?? '',
    email_address: form.get('email_address') ?? '',
    merchant_id: form.get('merchant_id')!,
  })
  const raw = itn.toString()
  const signature = createHash('md5').update(`${raw}&passphrase=${encodeURIComponent(PASSPHRASE)}`).digest('hex')
  const res = await fetch(form.get('notify_url')!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `${raw}&signature=${signature}`,
  })
  return res.status
}

/** Waits until the storefront holds a customer session and has left the auth form. */
export async function expectSignedIn(page: Page) {
  await page.waitForFunction(() => !!localStorage.getItem('tse_auth_token'), undefined, { timeout: 20_000 })
  await expect(page).not.toHaveURL(/\/account\/(login|register)/, { timeout: 20_000 })
}

/** Opens a page and waits until it has hydrated, so form handlers are attached. */
export async function openHydrated(page: Page, path: string) {
  await page.goto(path)
  await page.waitForLoadState('networkidle')
}
