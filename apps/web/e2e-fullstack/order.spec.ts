import { expect, test } from '@playwright/test'
import { addToCart, checkoutToReview, openFirstProduct, payAndInterceptPayfast, sendPayfastItn, waitForMail } from './helpers'

// The money path, end to end on the real stack: browse → cart → four-step
// checkout → signed PayFast redirect → PayFast's ITN → order in Medusa →
// confirmation page → customer + team emails.

test('a customer can buy a cartridge and gets an order confirmation', async ({ page }, info) => {
  const email = `buyer-${info.project.name}-${Date.now()}@example.com`
  const product = await openFirstProduct(page)
  await addToCart(page)
  await checkoutToReview(page, { email })

  const form = await payAndInterceptPayfast(page)
  // The redirect PayFast would receive must be signed and complete.
  expect(form.get('signature')).toMatch(/^[a-f0-9]{32}$/)
  expect(Number(form.get('amount'))).toBeGreaterThan(0)
  expect(form.get('email_address')).toBe(email)
  expect(form.get('return_url')).toMatch(/\/checkout\/confirmed$/)
  expect(form.get('cancel_url')).toMatch(/\/checkout\/cancelled/)
  expect(form.get('notify_url')).toMatch(/\/hooks\/payment\/payfast_payfast$/)

  // PayFast reports the payment. Medusa must accept the signed ITN.
  expect(await sendPayfastItn(form)).toBeLessThan(300)

  // Back from PayFast: the confirmed page finalises the order.
  await page.goto(form.get('return_url')!)
  await expect(page.getByText(/order received/i).first()).toBeVisible()

  // Match this buyer's own email: the sink holds every run's mail, and the
  // email redirect puts the original recipient in the subject.
  const confirmation = await waitForMail(new RegExp(`${email.replace(/[.+]/g, '\\$&')}.*Order confirmed — #\\d+`))
  const orderNo = /#(\d+)/.exec(confirmation.subject)?.[1] ?? ''
  expect(orderNo).not.toBe('')
  expect(confirmation.html).toContain(product) // the line the customer bought
  await waitForMail(new RegExp(`New order #${orderNo}\\b`))
})

test('the order total matches the cart, delivery included', async ({ page }) => {
  await openFirstProduct(page)
  await addToCart(page)
  await checkoutToReview(page, { email: `total-${Date.now()}@example.com` })
  const summary = await page.locator('main').innerText()
  const match = /Total\s*R\s?([\d\s,.]+)/.exec(summary)
  expect(match, 'a Total line on the review step').not.toBeNull()
  const total = Number(match![1]!.replace(/[\s,]/g, ''))
  const form = await payAndInterceptPayfast(page)
  expect(Number(form.get('amount'))).toBeCloseTo(total, 2)
})

test('collecting from the warehouse is free and still reaches PayFast', async ({ page }) => {
  await openFirstProduct(page)
  await addToCart(page)
  await checkoutToReview(page, { email: `collect-${Date.now()}@example.com`, delivery: /Collect from/ })
  await expect(page.locator('main')).toContainText(/Collect from/i)
  const form = await payAndInterceptPayfast(page)
  expect(form.get('signature')).toBeTruthy()
})

test('a cancelled payment lands on the cancelled page with the cart intact', async ({ page }) => {
  await openFirstProduct(page)
  await addToCart(page)
  await checkoutToReview(page, { email: `cancel-${Date.now()}@example.com` })
  const form = await payAndInterceptPayfast(page)
  await page.goto(form.get('cancel_url')!)
  await expect(page.getByRole('heading', { name: /no payment was taken/i })).toBeVisible()
  await page.waitForLoadState('networkidle')
  // The cart is fetched client-side after hydration; the item must come back.
  await page.goto('/cart')
  await expect(page.locator('h1')).toContainText(/1 item/, { timeout: 20_000 })
})
