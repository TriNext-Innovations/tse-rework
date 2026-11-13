import { expect, test } from '@playwright/test'
import { addToCart, checkoutToReview, expectSignedIn, openFirstProduct, openHydrated, payAndInterceptPayfast, sendPayfastItn, waitForMail } from './helpers'

// A returning customer: register, sign in, buy, find the order in their
// account, track it, and recover a forgotten password.

test.describe.configure({ mode: 'serial' })

const email = `customer-${Date.now()}@example.com`
const password = 'E2e-password-123'
let orderNo = ''

test('register creates an account and signs the customer in', async ({ page }) => {
  await openHydrated(page, '/account/register')
  await page.getByPlaceholder('Jane', { exact: true }).fill('Erin')
  await page.getByPlaceholder('Smith', { exact: true }).fill('Endtoend')
  await page.getByPlaceholder('jane@example.com').fill(email)
  await page.getByPlaceholder('082 123 4567').fill('0821234567')
  await page.getByPlaceholder('Minimum 8 characters').fill(password)
  await page.locator('input[autocomplete="new-password"]').nth(1).fill(password)
  await page.getByRole('button', { name: /create account/i }).click()
  await expectSignedIn(page)
  await page.goto('/account/profile')
  await expect(page.locator('input[value="Erin"], :text("Erin")').first()).toBeVisible()
})

test('a registered customer can sign in, buy, and see the order in their account', async ({ page }) => {
  await openHydrated(page, '/account/login')
  await page.getByPlaceholder('jane@example.com').fill(email)
  await page.locator('input[autocomplete="current-password"]').fill(password)
  await page.getByRole('button', { name: /sign in/i }).click()
  await expectSignedIn(page)

  await openFirstProduct(page)
  await addToCart(page)
  await checkoutToReview(page, { email })
  const form = await payAndInterceptPayfast(page)
  expect(await sendPayfastItn(form)).toBeLessThan(300)
  await page.goto(form.get('return_url')!)
  await expect(page.getByText(/order received/i).first()).toBeVisible()

  const mail = await waitForMail(new RegExp(`${email.replace(/[.+]/g, '\\$&')}.*Order confirmed — #\\d+`))
  orderNo = /#(\d+)/.exec(mail.subject)?.[1] ?? ''
  expect(orderNo, 'order number in the confirmation subject').not.toBe('')

  await page.goto('/account/orders')
  await expect(page.getByText(new RegExp(`#?${orderNo}\\b`)).first()).toBeVisible({ timeout: 20_000 })
})

test('track my parcel finds the order by number and email', async ({ page }) => {
  test.skip(!orderNo, 'needs the order from the previous test')
  await openHydrated(page, '/track')
  await page.locator('input[name="order_number"]').fill(orderNo)
  await page.locator('input[name="email"]').fill(email)
  await page.getByRole('button', { name: /track my parcel/i }).click()
  await expect(page.getByText(new RegExp(`#?${orderNo}\\b`)).first()).toBeVisible()
  await expect(page.getByText(/not found|couldn.t find|no order/i)).toHaveCount(0)
})

test('track my parcel does not reveal an order to the wrong email', async ({ page }) => {
  test.skip(!orderNo, 'needs the order from the previous test')
  await openHydrated(page, '/track')
  await page.locator('input[name="order_number"]').fill(orderNo)
  await page.locator('input[name="email"]').fill('someone-else@example.com')
  await page.getByRole('button', { name: /track my parcel/i }).click()
  await expect(page.getByText(/E2E Buyer|12 Main Road/)).toHaveCount(0)
})

test('forgot password sends a reset email', async ({ page }) => {
  await openHydrated(page, '/account/forgot-password')
  await page.locator('input[type="email"]').fill(email)
  await page.getByRole('button').filter({ hasText: /reset|send/i }).first().click()
  await waitForMail(/reset|password/i)
})
