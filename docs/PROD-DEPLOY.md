# TSE Online — Production Deploy Runbook

Captures the actual sequence used to bring `dev.tse-cartridges.co.za` live on the Vultr JHB VPS on **2026-05-20**, and the gotchas that cost time on the way. Use this for any future production-class deploy of this stack (staging, prod cutover, disaster-recovery rebuild).

Companion to `BUILD-PLAN.md` (the *plan*); this is the *runbook*.

**Quick reference:** once the server is running, use `make help` from `/opt/tse-ui` to list all ops commands (`make deploy`, `make logs s=medusa`, `make backup`, `make cert-renew`, etc.).

---

## 1. Prerequisites

Before touching the server, confirm all of these. Skipping any one of them turns into a multi-hour debug session.

| # | Requirement | How to verify |
|---|---|---|
| 1 | Linux VPS reachable, Docker + Docker Compose installed | `ssh linuxuser@<host>` then `docker --version && docker compose version` |
| 2 | Project cloned at `/opt/tse-ui` on the box, git remote pointing at GitHub | `cd /opt/tse-ui && git remote -v` |
| 3 | `.env` populated on the server (POSTGRES_PASSWORD, JWT_SECRET, COOKIE_SECRET, MEDUSA_ADMIN_*, OZOW/PayFast/ZeptoMail/Aramex/TCG keys for the env) | `grep -c "=" .env` should match the count in `.env.example` |
| 4 | Both DNS records resolve to the server's public IP | `for h in dev.tse-cartridges.co.za api.dev.tse-cartridges.co.za; do echo "$h -> $(dig +short $h \| tail -1)"; done` |
| 5 | Firewall allows inbound 80 and 443 from `0.0.0.0/0` (certbot validates over plaintext HTTP) | `curl -I http://<server-ip>` from outside the VPS — should reach nginx, not time out |
| 6 | No other process on the host is bound to 80 / 443 / 5432 / 6379 / 9000 / 3000 | `sudo ss -tlnp \| grep -E ':(80\|443\|5432\|6379\|9000\|3000)\s'` |

`POSTGRES_PASSWORD` is what backs `DATABASE_URL` for both Medusa services; don't ad-hoc rotate it without recreating the postgres volume.

---

## 2. First-run deploy sequence

The dependency chain is `postgres → redis → medusa-migrate → medusa → web → nginx`. Compose handles most of this via `depends_on: condition: service_healthy`, but **nginx has a chicken-and-egg with TLS certs** — it won't start without certs, and certbot needs port 80, which nginx normally owns. The sequence below sidesteps that.

```bash
# All commands run from /opt/tse-ui on the VPS
cd /opt/tse-ui
git pull origin main

# 1. Bring up data services + run migrations. medusa-migrate exits 0 when done.
docker compose up -d postgres redis
docker compose up medusa-migrate            # foreground — watch it run all 25 modules

# 2. Bring up the Medusa server. Health check has start_period=300s; first
#    boot takes ~30-90s. nginx is intentionally NOT started yet.
docker compose up -d medusa

# Wait until 'docker compose ps medusa' shows '(healthy)' before continuing.

# 3. Bring up the storefront. Depends on medusa being healthy.
docker compose up -d web

# 4. Issue TLS certs via certbot --standalone (nginx not running yet, so :80 is free).
#    Single command issues a SAN cert covering BOTH domains, stored under live/dev.tse-cartridges.co.za/.
docker run --rm -p 80:80 \
  -v tse-ui_certbot_certs:/etc/letsencrypt \
  -v tse-ui_certbot_www:/var/www/certbot \
  certbot/certbot certonly --standalone \
    --non-interactive --agree-tos --no-eff-email \
    --email ryno@trinextinnovations.co.za \
    -d dev.tse-cartridges.co.za \
    -d api.dev.tse-cartridges.co.za

# Verify the cert covers both names (SAN must list both DNS entries)
sudo openssl x509 \
  -in /var/lib/docker/volumes/tse-ui_certbot_certs/_data/live/dev.tse-cartridges.co.za/cert.pem \
  -noout -text | grep -A1 "Subject Alternative Name"

# 5. Bring up nginx. It now finds the cert and stays running.
docker compose up -d nginx

# 6. Final health check — all services Up, medusa healthy, nginx not restarting.
docker compose ps
```

Open `https://dev.tse-cartridges.co.za` and `https://api.dev.tse-cartridges.co.za/health` in a browser. Storefront → Next.js page; API health → `OK`.

---

## 3. Gotchas we hit (and you will too)

These are the issues that cost real time on 2026-05-20. Each one is in the code now — but the **why** is worth keeping so the next person doesn't think the fix is wrong and undo it.

### 3.1 `medusa db:migrate` hangs 25 minutes against a Docker-networked Postgres

**Symptom:** `Running migrations...` then 25 minutes of silence, then 25× `KnexTimeoutError: Knex: Timeout acquiring a connection`.

**Cause:** Medusa 2.15.2's `lockKnex` (the connection pool used for the per-module advisory lock during migration) goes through `loadDatabaseConfig` → `getDefaultDriverOptions(clientUrl)`, which infers SSL from the URL hostname:

```js
return clientUrl.match(/localhost|127\.0\.0\.1|ssl_mode=(disable|false)|sslmode=(disable)/i)
  ? localOptions   // ssl: false
  : remoteOptions; // ssl: { rejectUnauthorized: false }
```

A Docker service hostname (`postgres`) doesn't match the regex, so SSL gets forced **on**. The bare `postgres:16-alpine` image doesn't support SSL, so the handshake fails. Knex's `propagateCreateError: false` silences the real error; you only see the timeout. The *main* pg connection uses a different code path and defaults to `ssl: false`, which is why `ensureDbExists` and `ensureMigrationsTable` work fine — making it look like a JS-side hang.

**Fix already in this repo:** `docker-compose.yml` appends `?sslmode=disable` to `DATABASE_URL` for both `medusa-migrate` and `medusa`.

If you ever switch to a managed Postgres (Supabase, RDS, Vultr Managed PG), **remove `?sslmode=disable`** — those providers require TLS. Either set `databaseDriverOptions: { connection: { ssl: { rejectUnauthorized: false } } }` in `apps/backend/medusa-config.ts`, or use `sslmode=require` in the URL.

### 3.2 `medusa start` fails with "Could not find index.html in the admin build directory"

**Symptom:** `medusa` container starts, logs `Error starting server` → `Could not find index.html in the admin build directory. Make sure to run 'medusa build' before starting the server.` `medusa build` *did* run during the Docker build — the file just isn't where the runtime looks for it.

**Cause:** `apps/backend/tsconfig.json` overrides `outDir` to `./dist`. Medusa's build tool honours that override and writes the admin bundle to `dist/public/admin/`. But the admin loader (`@medusajs/medusa/dist/loaders/admin.js:31`) hard-codes its lookup to `${process.cwd()}/public/admin/index.html`. Path mismatch.

**Fix already in this repo:** the Dockerfile lifts the admin output up one level:

```dockerfile
COPY --from=builder /app/apps/backend/dist/public ./apps/backend/public
```

The Medusa-native pattern is `outDir: ".medusa/server"` and running the server from inside that directory. We didn't do that here — the `dist` + admin-copy hack is the pragmatic version. Don't change `tsconfig.outDir` without also undoing the COPY line.

### 3.3 Postgres `max_connections=200` from compose isn't actually applied

**Symptom:** `command: postgres -c max_connections=200` is in `docker-compose.yml` but `SHOW max_connections;` returns `100`.

**Cause:** The postgres container was created before the `command:` was added, and `docker compose up -d` doesn't recreate a container that's already running — even if the config changed. `docker compose restart` doesn't reapply config either.

**Fix:** `docker compose up -d --force-recreate postgres`. The named volume is preserved, so no data loss.

This will bite you again any time you change `command:` or `environment:` on an already-running service. When in doubt, `--force-recreate`.

### 3.4 nginx certs chicken-and-egg

**Symptom:** nginx restarts forever with `cannot load certificate ".../fullchain.pem": no such file or directory`.

**Cause:** Nginx config references `/etc/letsencrypt/live/<domain>/fullchain.pem`. Those files don't exist on a fresh server. You can't run certbot through nginx (webroot mode) because nginx won't start. You can run certbot in `--standalone` mode, but it needs port 80, which nginx normally binds.

**Fix:** Stop nginx → run certbot standalone → start nginx. Covered in step 4 of section 2 above. Don't try to start nginx first.

### 3.5 SAN cert vs separate-cert paths in nginx

**Symptom:** After certbot succeeds, nginx still fails — `cannot load certificate ".../api.dev.tse-cartridges.co.za/fullchain.pem"`.

**Cause:** `certbot certonly -d X -d Y` issues **one** SAN certificate, stored under `live/<first-domain>/` only. There's no `live/<second-domain>/` directory. The nginx config originally had separate `ssl_certificate` paths for each `server` block.

**Fix already in this repo:** both nginx `server` blocks in `infrastructure/nginx/conf.d/tse.conf` point at the same SAN cert under `live/dev.tse-cartridges.co.za/`. If you ever split the domains onto separate certs, update both `server` blocks.

### 3.6 `web` was "unhealthy" but actually working

**Symptom:** `docker compose ps` shows `web (unhealthy)` but the storefront serves correctly through nginx.

**Cause:** The healthcheck is `wget -qO- http://localhost:3000/api/health || exit 1`. `apps/web` didn't have an `/api/health` route. The badge was wrong; the app was fine.

**Fix already in this repo:** `apps/web/src/app/api/health/route.ts` returns `{ ok: true }`, making the healthcheck pass correctly.

---

## 4. Cert renewal

The Let's Encrypt cert issued on 2026-05-20 **expires 2026-08-18** (90-day lifetime).

### 4.1 Manual renewal (works today)

```bash
cd /opt/tse-ui
make cert-renew
```

Or without make:

```bash
docker compose stop nginx
docker run --rm -p 80:80 \
  -v tse-ui_certbot_certs:/etc/letsencrypt \
  -v tse-ui_certbot_www:/var/www/certbot \
  certbot/certbot renew
docker compose up -d nginx
```

Run on or before **2026-08-04** to leave headroom. Certs are valid 30 days past renewal, so the worst-case downtime if you forget is ~2 weeks of warning emails from Let's Encrypt before they expire.

### 4.2 Automate it

Add a host cron on the VPS that does the above on the first of every odd month:

```bash
sudo crontab -e
```

```
0 3 1 */2 * cd /opt/tse-ui && docker compose stop nginx && docker run --rm -p 80:80 -v tse-ui_certbot_certs:/etc/letsencrypt -v tse-ui_certbot_www:/var/www/certbot certbot/certbot renew --quiet && docker compose up -d nginx >> /var/log/cert-renew.log 2>&1
```

A cleaner long-term solution is a dedicated `certbot` service in compose with the `--webroot` mode (no nginx stop needed) — left for a follow-up PR.

---

## 5. Service map (what runs where)

| Service | Container | Image | Internal port | Exposed port | Health URL |
|---|---|---|---|---|---|
| Postgres | `tse-ui-postgres-1` | `postgres:16-alpine` | 5432 | 5432 | `pg_isready` |
| Redis | `tse-ui-redis-1` | `redis:7-alpine` | 6379 | 6379 | `redis-cli ping` |
| Medusa migrate | `tse-ui-medusa-migrate-1` | built locally | — | — | exit 0 |
| Medusa API + admin | `tse-ui-medusa-1` | built locally | 9000 | 9000 | `GET /health` |
| Next.js storefront | `tse-ui-web-1` | built locally | 3000 | 3000 | `GET /api/health` (todo, see 3.6) |
| nginx reverse proxy | `tse-ui-nginx-1` | `nginx:alpine` | 80 / 443 | 80 / 443 | — |

External routing (production apex, live 2026-07-01):

- `https://tse-cartridges.co.za` → nginx → `web:3000` (storefront)
- `https://api.tse-cartridges.co.za` → nginx → `medusa:9000` (REST API + `/app` admin dashboard)

The `dev.tse-cartridges.co.za` / `api.dev.tse-cartridges.co.za` blocks still exist for
overlap but the app no longer functions there (CORS + baked `NEXT_PUBLIC_*` are apex-only).
See section 9 for the apex cutover. All four hosts are DNS-only (grey) Cloudflare A records
→ the box; the apex must **not** be proxied or certbot standalone (section 9.2) can't validate.

---

## 6. Updating the deployment

For a code-only change (no infra):

```bash
cd /opt/tse-ui
git pull origin main
docker compose build medusa web                 # only rebuild what changed
docker compose up -d medusa-migrate            # foreground — wait for exit 0 if migrations changed
docker compose up -d medusa web
```

If `Dockerfile`, `docker-compose.yml`, `medusa-config.ts`, or any nginx config changed, also `--force-recreate` the affected services so config is reapplied (see 3.3).

If schema-impacting migrations were added, **always** run `medusa-migrate` to exit 0 before bringing the live `medusa` container back up. The compose `depends_on: service_completed_successfully` enforces this when starting from scratch but doesn't help on a rolling update.

### 6.1 Break-glass: deploying manually when GitHub Actions is down

Normal deploys run from `.github/workflows/deploy.yml` on push to `main`. When
Actions is unavailable (it was down for hours on 2026-08-06 and the deploy
never got a runner), use:

```bash
cd /opt/tse-ui
git fetch origin && git checkout origin/main -- scripts/     # get the scripts first
./scripts/prod-deploy.sh --check-only                        # rehearsal: touches NOTHING live
./scripts/prod-deploy.sh                                     # the real thing
```

`--check-only` runs preflight, backup, checkout, build and the boot smoke test,
then stops. It is safe to run at any time, including while the site is serving
traffic, and is the fastest way to answer "would this deploy work?".

**Do not hand-run the deploy steps, and never pipe a script into
`ssh 'bash -s'`.** Bash then reads the script from stdin, and the first command
that consumes stdin — `docker compose run` without `-T` — swallows the rest of
the script. The deploy stops silently *mid-way* and still exits 0. That is how
2026-08-06's first attempt built images and ran migrations but never swapped a
container, while reporting success. Put the script on the box and run it as a
file.

**What makes this safer than the CI deploy:** it boots the newly built backend
image and requires `/health` *before* any live container is swapped. Nothing in
CI does this. `docker build` exit 0 proves nothing about boot, because medusa
compiles `src/api/**` at **runtime** — see 3.x below. If the smoke test fails,
the script exits non-zero having touched nothing.

Rollback is automatic on any failure after the first container swap (it retags
the `tse-rollback-*` images saved at the start of the run). To roll back by
hand later:

```bash
cd /opt/tse-ui
for s in medusa web; do docker tag tse-rollback-$s:latest tse-ui-$s:latest; done
docker compose up -d --no-build && docker compose exec -T nginx nginx -s reload
```

### 6.2 A green build does not mean a working image

Medusa compiles `src/api/**` **at runtime, on boot** — not during
`medusa build`. So a broken import in an API route produces:

| check | result |
|---|---|
| `tsc --noEmit` | ✅ passes |
| `medusa build` | ✅ passes |
| `docker build` | ✅ **image builds green** |
| `docker run` | ❌ crash loop |

On 2026-08-06 the backend Dockerfile copied `/app/node_modules` but not
`/app/packages`. The `@tse/*` entries are pnpm workspace symlinks into
`packages/`, so they dangled in the runtime image and the container crash-looped
on `Cannot find module '@tse/types'`. Production API was 502 for ~3 minutes.

The only honest check is starting the container:

```bash
SMOKE_DATABASE_URL=... SMOKE_REDIS_URL=... \
  ./scripts/smoke-backend-image.sh <image> --network tse-ui_default
```

Adding a workspace package? Make sure the runtime image actually contains it.

---

## 7. Disaster recovery

The two stateful pieces are:

1. **`postgres_data` volume** — all customer / order / catalogue data.

   **Automated (live since 2026-07-01):** `/home/linuxuser/backup-db.sh` runs nightly via the
   `linuxuser` crontab (`30 2 * * *`). It `pg_dump`s `tse_medusa` → gzip in
   `/home/linuxuser/backups/` (14-day local retention) and uploads to Cloudflare R2 bucket
   `tse-products` under `db-backups/` (30-day retention) via `rclone` (uses the `R2_*` vars
   from `.env`; no `rclone.conf` — flags passed on the CLI). Log: `/home/linuxuser/backups/backup.log`.

   Manual one-off dump:
   ```bash
   docker exec tse-ui-postgres-1 pg_dump -U postgres -d tse_medusa --no-owner --clean | gzip > tse_medusa_$(date +%F).sql.gz
   ```

2. **`certbot_certs` volume** — TLS certs. Can be reissued from scratch on a new host as long as DNS still resolves (see section 2 step 4); not strictly backup-critical.

Redis and Next.js / Medusa containers are stateless: rebuild from git + image and the data volumes are enough to restore.

---

## 8. Reference — service environment

Each service's required env vars (already in `.env.example`):

| Service | Required env |
|---|---|
| `medusa-migrate`, `medusa` | `DATABASE_URL` (with `?sslmode=disable`), `REDIS_URL`, `JWT_SECRET`, `COOKIE_SECRET` |
| `medusa` only | `MEDUSA_ADMIN_EMAIL`, `MEDUSA_ADMIN_PASSWORD`, `MEDUSA_BACKEND_URL`, CORS triplet, `ZEPTOMAIL_TOKEN`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `PAYFAST_*`, `OZOW_*`, `TCG_API_KEY`, `ARAMEX_*` |
| `web` | `NEXT_PUBLIC_MEDUSA_URL`, `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SANITY_*`, `NEXT_PUBLIC_SITE_URL` |

`STORE_CORS` must include the storefront origin `https://tse-cartridges.co.za`. `AUTH_CORS`
must include both the storefront and the admin origins (`https://tse-cartridges.co.za,https://api.tse-cartridges.co.za`).
`ADMIN_CORS` matters only for cross-origin admin calls — the admin dashboard is served from the
same origin as the API (`api.tse-cartridges.co.za/app` → `api.tse-cartridges.co.za/*`), so admin
login/usage is same-origin and doesn't hit CORS regardless of `ADMIN_CORS`.

---

## 9. Production apex domain cutover (2026-07-01)

Moved production from the `dev.tse-cartridges.co.za` label to the real apex
`tse-cartridges.co.za` (+ `api.tse-cartridges.co.za`). The old Woo site stays on `tse.co.za`
(different domain) — parallel run, no conflict. Dev is kept in nginx for overlap but is
functionally decommissioned (env is apex-only).

### 9.1 DNS (Cloudflare)
- `tse-cartridges.co.za` → **A `139.84.247.189`, DNS-only (grey)** — replaced two old proxied
  AWS parking A records (`13.248.243.5`, `76.223.105.230`).
- `api.tse-cartridges.co.za` → **A `139.84.247.189`, DNS-only** (new).
- DNS-only is mandatory: certbot standalone validates over plaintext :80, which Cloudflare's
  proxy would intercept.

### 9.2 TLS cert
One SAN cert covering both apex names, issued exactly like section 2 step 4:
```bash
docker compose stop nginx
docker run --rm -p 80:80 -v tse-ui_certbot_certs:/etc/letsencrypt -v tse-ui_certbot_www:/var/www/certbot \
  certbot/certbot certonly --standalone --non-interactive --agree-tos --no-eff-email \
  --email ryno@trinextinnovations.co.za -d tse-cartridges.co.za -d api.tse-cartridges.co.za
docker compose up -d nginx     # NB: waits on medusa health — give it a long timeout, don't kill it mid-way
```
Stored at `live/tse-cartridges.co.za/` (SAN under the first `-d` name, per gotcha 3.5), expires **2026-09-29**.
The existing certbot renewal cron in `/etc/cron.d/certbot` renews all certs automatically.

### 9.3 nginx
Two new `server` blocks added to `infrastructure/nginx/conf.d/tse.conf` (apex storefront +
apex API), both referencing `live/tse-cartridges.co.za/`. The file is bind-mounted, so apply
with `docker exec tse-ui-nginx-1 nginx -t && docker exec tse-ui-nginx-1 nginx -s reload`
(zero downtime). **It is git-tracked** — the change must also land on `main` (PR #184 → develop → #185 → main)
or the next deploy's `git reset --hard origin/main` reverts it.

### 9.4 App env + web rebuild
Update on the box `.env`: `MEDUSA_BACKEND_URL`, `NEXT_PUBLIC_MEDUSA_BACKEND_URL` → apex;
`STORE_CORS`, `AUTH_CORS`, `STOREFRONT_URL`, `NEXT_PUBLIC_SITE_URL`, `PAYFAST_NOTIFY_URL`,
`OZOW_NOTIFY_URL` → apex. `NEXT_PUBLIC_MEDUSA_URL=http://medusa:9000` stays internal.
**`NEXT_PUBLIC_*` are baked at build time → `docker compose build web` then force-recreate;**
a plain recreate keeps the old baked URL. Medusa only needs a recreate for the runtime CORS/URL vars.

### 9.5 External config still owed
- **PayFast merchant dashboard** — return/notify/cancel URLs updated to the apex.
- **ZeptoMail** — sending domain `tse-cartridges.co.za` DKIM/SPF verified in the ZeptoMail console.
- Once apex is proven, add a 301 `dev.*` → apex and retire the dev blocks.
