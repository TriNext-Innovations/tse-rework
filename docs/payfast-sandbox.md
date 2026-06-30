# PayFast provider — sandbox verification runbook

Validates the Medusa PayFast payment provider (#130, branch
`feat/medusa-central-payfast-provider`) end-to-end before it can replace the
legacy storefront flow. **Do this in a sandbox / dev environment, never prod.**

The provider is feature-flagged: with `NEXT_PUBLIC_PAYFAST_PROVIDER=false` (the
default) checkout uses the existing `/api/payfast/initiate` path, so merging this
branch does **not** change production behaviour until the flag is flipped.

---

## 0. Why you need a public tunnel

PayFast's servers POST the ITN to `notify_url`, which the provider sets to
`${MEDUSA_BACKEND_URL}/hooks/payment/payfast_payfast` (the route resolves the
provider as `pp_{path}`, and this provider registers as `pp_payfast_payfast`).
**`localhost` is unreachable from PayFast** — so the backend must be exposed
publicly during testing:

```bash
# e.g. cloudflared or ngrok pointing at the Medusa backend (port 9000)
cloudflared tunnel --url http://localhost:9000
# → https://<random>.trycloudflare.com
```

Set `MEDUSA_BACKEND_URL` to that public URL so `notify_url` is reachable.

---

## 1. Backend env (`apps/backend/.env`)

```ini
PAYFAST_MERCHANT_ID=10000100          # PayFast sandbox merchant id
PAYFAST_MERCHANT_KEY=46f0cd694581a    # PayFast sandbox merchant key
PAYFAST_PASSPHRASE=                   # leave blank unless set in the sandbox dashboard
PAYFAST_LIVE=false                    # → provider runs in sandbox mode (sandbox.payfast.co.za)
MEDUSA_BACKEND_URL=https://<your-tunnel>   # so notify_url is publicly reachable
STOREFRONT_URL=http://localhost:3000       # return/cancel URLs
TSE_NOTIFY_EMAIL=you@example.com           # team notification (#135)
```

`payfastConfigured` in `medusa-config.ts` only registers the provider when
`PAYFAST_MERCHANT_ID` + `PAYFAST_MERCHANT_KEY` are set.

## 2. Storefront env (`apps/web/.env.local`)

```ini
NEXT_PUBLIC_PAYFAST_PROVIDER=true     # route checkout through the Medusa provider
NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000   # storefront → Medusa (direct, local)
```

## 3. Start + enable on the region

```bash
docker compose up postgres redis meilisearch -d
pnpm dev                                                 # web + medusa
pnpm --filter @tse/backend payfast:setup                 # link provider → ZAR region
```

If `payfast:setup` logs a link error, enable it manually:
**Medusa Admin → Settings → Regions → ZAR → Payment Providers → enable `payfast`.**

---

## 4. Drive a payment

1. Storefront → add a product → checkout → contact + address → pick delivery → Review.
2. **Pay online via PayFast** → you should land on `sandbox.payfast.co.za`.
3. Complete the sandbox payment (sandbox auto-approves; no real card).
4. You're redirected back to `/checkout/confirmed`, which polls `completeCart`
   and shows **"Order #… confirmed"** once the ITN authorises the session.
5. The ITN also fires the backend subscriber → order confirmation + team emails.

---

## 5. The four things to confirm (these are the unknowns)

| # | Check | Where | If wrong |
|---|-------|-------|----------|
| 1 | **ITN reaches the backend** and authorises | Medusa logs show `getWebhookActionAndData` / a `WebhookReceived` event; payment session → `authorized` | tunnel/`notify_url` wrong, or provider not on region |
| 2 | **Signature verifies** | no `action: 'failed'` in logs for a genuine ITN | uses `rawData` (field order) — if it still fails, log the raw body vs the rebuilt string in `verifyRawSignature` |
| 3 | **Charged amount = cart total** | PayFast page shows the right Rand amount | `amountDivisor` in `medusa-config.ts` provider options (default 100 — this deploy stores cents) |
| 4 | **Cart completes → order** | order appears in Admin with correct lines/total | `completeCart` poll on the confirmed page, and/or `subscribers/payment-captured.ts` event name (`payment.captured` vs `payment.authorized`) |

## 6. Provider-id sanity

`setup-payfast.ts` and `lib/checkout-cart.ts` assume the provider id
`pp_payfast_payfast` (`pp_<config-id>_<identifier>`). Confirm via
`GET /store/payment-providers?region_id=<zar>` or Admin; fix the constant if it
differs.

---

## 7. After it passes — production cutover (separate PR)

1. Set `NEXT_PUBLIC_PAYFAST_PROVIDER=true` in prod web env; real `PAYFAST_*` +
   `PAYFAST_LIVE=true` in backend; run `payfast:setup` on prod.
2. Delete the legacy path: `apps/web/src/app/api/payfast/{initiate,itn}`,
   `apps/backend/src/api/store/payfast/{pending,capture}`, `lib/payfast-order.ts`.
3. Remove `notifyTeam`/`notifyCustomer` + `RESEND_*` from the storefront (emails
   are backend-owned now — #135).
4. Keep the CSP `form-action` allowance for `payfast.io` (see project notes).
