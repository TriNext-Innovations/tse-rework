# Local order-flow testing

Run a whole order on your own machine: checkout → payment → confirmation →
packed → on its way → delivered (or ready for collection → collected). Nothing
comes from or goes to prod. The catalogue is the repo's seed data
(`migration/seed-data.json`); prices and stock are a May 2026 snapshot, which is
fine for testing process.

| Real thing | Local stand-in |
|---|---|
| Customer + TSE inboxes | `EMAIL_REDIRECT_TO`: every email goes to one address, original recipients in the subject |
| ZeptoMail | Optional: `scripts/local-mail-sink.mjs` writes each email to `.local-mail/*.html` |
| PayFast live | PayFast sandbox, reached through a temporary Cloudflare tunnel |
| The Courier Guy | `TCG_FAKE=true`: books nothing, issues `LOCAL…` tracking numbers |
| Prod catalogue | Seed data + `setup-local.ts` (warehouse, service zone, shipping options) |

Needs Node 20 (`mise exec node@20 -- …`) and Docker.

## 1. Backend env

`apps/backend/.env` (gitignored):

```env
DATABASE_URL=postgresql://postgres:localtest@localhost:5432/tse_medusa
REDIS_URL=redis://localhost:6379
JWT_SECRET=<any random string>
COOKIE_SECRET=<any random string>
STORE_CORS=http://localhost:3000
ADMIN_CORS=http://localhost:9000,http://localhost:3000,<tunnel url>
AUTH_CORS=http://localhost:9000,http://localhost:3000,<tunnel url>
STOREFRONT_URL=http://localhost:3000
MEDUSA_BACKEND_URL=<tunnel url>          # PayFast posts the ITN here
MEILISEARCH_HOST=http://localhost:7700
MEILISEARCH_API_KEY=local-meili-master-key-0123456789

PAYFAST_SANDBOX=true
PAYFAST_MERCHANT_ID=<your sandbox merchant id>
PAYFAST_MERCHANT_KEY=<your sandbox merchant key>
PAYFAST_PASSPHRASE=<your sandbox passphrase>

EMAIL_REDIRECT_TO=info@trinextinnovations.co.za
SALES_EMAIL=info@trinextinnovations.co.za
ZEPTOMAIL_TOKEN=<real token to deliver, or "local" with the sink below>
# ZEPTOMAIL_API_URL=http://127.0.0.1:8025   # uncomment to use the sink

TCG_FAKE=true
TCG_API_KEY=
```

And the root `.env`:

```env
POSTGRES_PASSWORD=localtest
MEILISEARCH_API_KEY=local-meili-master-key-0123456789
```

PayFast's old public sandbox merchant (10000100) rejects every signature, so
use your own sandbox login from sandbox.payfast.co.za. It shows the merchant
id, key and passphrase under Settings.

## 2. Bring it up

```bash
docker run --rm --network host cloudflare/cloudflared:latest tunnel --url http://127.0.0.1:9000
# copy the https://….trycloudflare.com URL into MEDUSA_BACKEND_URL and the CORS lists

./scripts/local-up.sh                      # infra, migrations, seed, setup; prints the publishable key
node scripts/local-mail-sink.mjs           # only if using the sink
cd apps/backend && pnpm dev                # :9000, admin at /app (admin@local.test / localtest123)
cd apps/web && pnpm dev                    # :3000, needs .env.local with the publishable key
```

`apps/web/.env.local`:

```env
NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000
NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=<printed by local-up.sh>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_MEILISEARCH_HOST=http://localhost:7700
NEXT_PUBLIC_MEILISEARCH_SEARCH_KEY=<search key from GET :7700/keys>
```

## 3. Run an order

1. Shop at http://localhost:3000, check out, pay on the PayFast sandbox page.
2. In admin (http://localhost:9000/app) open the order: **Create fulfillment**
   → **Mark as shipped** → **Mark as delivered**.
3. Check the inbox (or `.local-mail/`). Courier order: confirmation, packed,
   on its way (with a `LOCAL…` tracking number), delivered. Collect order:
   confirmation, ready for collection, collected. Each also sends a
   "New order" notice to the sales address.

Region also has Medusa's test payment (`pp_system_default`) enabled locally,
for running the fulfilment steps without a PayFast round trip.

## Tear down

```bash
docker compose -p tse-local -f docker-compose.yml -f docker-compose.local.yml down -v
```
