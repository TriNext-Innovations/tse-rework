# Local order-flow testing

Run a whole order on your own machine: checkout → PayFast sandbox →
confirmation → packed → on its way → delivered (or ready for collection →
collected). Nothing comes from prod and nothing goes to TSE or customers.

```bash
./scripts/local-up.sh      # everything; Ctrl+C stops it
./scripts/local-down.sh    # stop containers (add --wipe to delete the local DB)
```

Needs Docker and mise (the script runs Node 20 through it).

| Real thing | Local stand-in |
|---|---|
| Customer + TSE inboxes | `EMAIL_REDIRECT_TO`: every email goes to one address, original recipients in the subject |
| ZeptoMail | Real token → real delivery to that address. No token → `scripts/local-mail-sink.mjs` writes each email to `.local-mail/*.html` |
| PayFast live | PayFast sandbox, reached through a temporary Cloudflare tunnel the script starts |
| The Courier Guy | `TCG_FAKE=true`: books nothing, issues `LOCAL…` tracking numbers |
| Prod catalogue | `migration/seed-data.json` + `setup-local.ts` (warehouse, service zone, shipping options). Prices are a May 2026 snapshot |

## Secrets

The script builds `apps/backend/.env` on first run, from
`~/.config/tse-local/backend.env` if it exists, otherwise from
`apps/backend/.env.local-test.example`. Fill in, then keep a copy in
`~/.config/tse-local/backend.env` so a fresh clone or worktree picks it up:

- `PAYFAST_MERCHANT_ID` / `_KEY` / `_PASSPHRASE`: TriNext's PayFast sandbox
  (sandbox.payfast.co.za → Settings). The old public merchant 10000100 rejects
  every signature.
- `ZEPTOMAIL_TOKEN`: optional; without it emails land in `.local-mail/`.

The script refuses to run if `EMAIL_REDIRECT_TO` is empty or `DATABASE_URL`
is not localhost.

## Run an order

1. Shop at http://localhost:3000, check out, press **Complete Payment** on the
   PayFast sandbox page.
2. Admin at http://localhost:9000/app (`admin@local.test` / `localtest123`):
   open the order → **Create fulfillment** → **Mark as shipped** → **Mark as
   delivered**.
3. Courier order emails: confirmation, packed, on its way (with a `LOCAL…`
   tracking number), delivered. Collect order: confirmation, ready for
   collection, collected. Each order also sends a "New order" notice.

The region also offers Medusa's test payment (`pp_system_default`), for running
fulfilment steps without a PayFast round trip.

## Gotchas

- The tunnel URL changes on every start; the script rewrites
  `MEDUSA_BACKEND_URL` and the CORS lists each time.
- The local Meilisearch gets a 1 GB cap (`docker-compose.local.yml`); prod's
  256 MB gets it OOM-killed on a many-core machine.
