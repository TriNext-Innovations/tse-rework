# Domain cutover — moving the storefront to `tse.co.za`

**TL;DR:** `tse.co.za` was registered in **1997** and still ranks; `tse-cartridges.co.za`
was registered in **May 2026** and ranks for nothing. The current plan in
`CLIENT-PENDING.md` #8 redirects the valuable domain into the worthless one. This runbook
does it the other way round. Nothing here is executable until the client signs off #13.

Companion to `PROD-DEPLOY.md` §7a, which covers the *redirect map*. This covers the
*domain move*. Do §7a's work as part of Phase 4 below, not separately.

---

## 1. Why this direction

| | `tse.co.za` | `tse-cartridges.co.za` |
|---|---|---|
| Registered | **1997-06-05** (29 years) | 2026-05-15 (4 months) |
| Ranks for the core query | **Yes** — page one | No — does not appear |
| Indexed URLs | 832 | ~1,090 sitemap, little indexed |
| Backlinks / domain history | Everything | Effectively none |

A cross-domain 301 passes most link equity but not all, takes months to consolidate, and
**domain-history trust does not transfer at all**. Redirecting `tse.co.za` away restarts a
29-year-old domain's reputation from zero.

Moving the *new site* onto `tse.co.za` inverts the cost: the small, new, unranked corpus
does the moving. The legacy redirect map then stops being a cross-domain migration and
becomes a **same-host URL restructure**, which is materially safer.

The one argument for keeping `tse-cartridges.co.za` is keyword-in-domain, which has been
worth essentially nothing for a decade. Everything else in its favour is sunk cost.

**Note on #8:** that decision was recorded 2026-05-15 — the same day
`tse-cartridges.co.za` was registered. It predates the new site having any index history
and predates the revenue analysis in `COMMERCIAL-FINDINGS.md`. It was reasonable then.

### Verified safe: the two URL namespaces do not collide

All 830 legacy URLs were intersected against all 1,089 new-site routes: **zero
collisions**. Legacy uses `/product/` and `/product-category/`; the new site uses
`/products/` and `/cartridges/`. Every legacy URL can 301 and every new URL can serve, on
one host, with no ambiguity.

---

## 2. Current infrastructure

| | |
|---|---|
| `tse.co.za` DNS | **GAM** — `zippy.gam.co.za`, `vinnig.gam.co.za`, `ns3.ns3gamco.com` |
| `tse.co.za` A record | `129.232.138.17` (Xneelo shared hosting, legacy WooCommerce) |
| `tse.co.za` MX | `eu1-smtp-mx1/mx2.titanhq.com` |
| Legacy control panel | konsoleH — `https://secure.konsoleh.co.za`, user `tse.co.za` |
| New site | Vultr JHB VPS behind Cloudflare |

**konsoleH does not control DNS.** It is Xneelo's hosting panel; the nameservers are at
GAM. The A-record flip needs **GAM access, which is not currently in hand** — chase this
first, it is the long pole.

### Email is safe, with one caveat

MX points at TitanHQ, wholly independent of the A record, so flipping A does not touch
mail delivery. But SPF is:

```
v=spf1 mx a ip4:41.0.5.1/24 ip4:41.0.5.0/24 ip4:197.96.139.236 ip4:196.35.198.158 a:spf1.gam.co.za … ?all
```

That bare **`a`** means "whatever `tse.co.za` resolves to is an authorised sender".
Flipping the A record silently de-authorises the Xneelo box and authorises the Vultr one.
DMARC is `p=none` and SPF ends `?all` (neutral), so nothing will bounce — but **if the
legacy WooCommerce still sends order mail during the transition, pin its IP explicitly in
SPF before Phase 4.**

---

## 3. What konsoleH is actually for here

Not DNS. Three things, all worth doing in Phase 1:

1. **Apache access logs** — the real crawled-URL inventory with hit counts, including
   Googlebot. This is a *better* input than a Search Console export, because it catches
   URLs no sitemap lists: vanity URLs, old permalink structures, campaign links, anything
   with an inbound backlink. The current map's 832 URLs came from the sitemap; the logs
   will show what the sitemap misses.
2. **The existing `.htaccess`** — if the legacy site already 301s old URLs, those chains
   must be *composed into* the new map, not replaced by it. Miss this and we break
   redirects that work today.
3. **DB export** and a rollback path (keep Woo reachable on a temporary hostname).

---

## 4. Phases

Each phase has a gate. Do not start one until the previous is verified.

### Phase 0 — Settle #13
Client signs off in writing. Supersede `CLIENT-PENDING.md` #8 rather than editing it, so
the reversal is on record. **Blocks everything below.**

### Phase 1 — Harvest the real URL inventory (konsoleH)
Pull access logs and `.htaccess`. Rebuild the map from what was actually crawled, not just
what the sitemap lists:

```bash
npx tsx scripts/build-legacy-redirects.ts
```

Gate: the regenerated map covers every URL in the logs with ≥1 Googlebot hit.

### Phase 2 — Make the apex configurable ✅ done
`NEXT_PUBLIC_SITE_URL` now drives every canonical, OG url, JSON-LD `@id`, sitemap entry,
robots directive, Merchant feed link and the legal-page prose, via
`apps/web/src/lib/site-url.ts`. Previously the apex was hardcoded in 13 files.

⚠ **`NEXT_PUBLIC_*` is inlined at BUILD time.** Changing the value requires rebuilding the
web image — restarting the container will not pick it up.

Only an `https://` value is honoured; the `http://localhost:3000` dev default is ignored,
so a dev value can never leak into a production build's canonicals. Unset falls back to
`https://tse-cartridges.co.za`, i.e. the domain we are already on.

### Phase 3 — Pre-issue the certificate
Do **not** use the `--standalone` flow from `PROD-DEPLOY.md` §7a here. Use a **DNS-01**
challenge, which works while `tse.co.za` still points at Xneelo:

```bash
docker run --rm -it \
  -v tse-ui_certbot_certs:/etc/letsencrypt \
  certbot/certbot certonly --manual --preferred-challenges dns \
  -d tse.co.za -d www.tse.co.za \
  --email ryno@trinextinnovations.co.za --agree-tos --no-eff-email
# publish the _acme-challenge TXT it prints, at GAM, then continue
```

This removes the chicken-and-egg entirely: the cert exists **before** any traffic moves, so
the flip is zero-downtime. Gate: `nginx -t` passes with the `tse.co.za` server block
enabled.

### Phase 4 — Flip
Lower the A-record TTL to 300s **a day ahead**, then point `tse.co.za` and
`www.tse.co.za` at the Vultr IP at GAM. Rebuild and deploy the web image with
`NEXT_PUBLIC_SITE_URL=https://tse.co.za`. Enable the redirect server block per
`PROD-DEPLOY.md` §7a step 5.

Rollback is a DNS revert — hence the low TTL.

### Phase 5 — Reverse the old redirect
`tse-cartridges.co.za` now 301s to `tse.co.za`, path-preserving. Both domains stay
registered indefinitely; equity flows through a 301 only while it answers.

### Phase 6 — Re-verify third parties
The only phase with real business risk.

- **Google Merchant Center** — verified on `tse-cartridges.co.za`, products live in
  Shopping since 2026-08-19 after an approval that took weeks. A domain change means
  re-verification and re-review, with a plausible gap in listings. **Do not sequence this
  into a peak trading week.**
- **Search Console** — add `tse.co.za` as a domain property, submit the sitemap, and use
  the Change of Address tool for `tse-cartridges.co.za`.
- **PayFast** — return / notify / cancel URLs (still outstanding from `CLIENT-PENDING` #6).
- **GA4**, and the transactional sending domain.

⚠ `CLIENT-PENDING.md` #10 says the sender is Resend (`sales@tse.co.za`) while issue #192
says ZeptoMail (`orders@tse-cartridges.co.za`). **These contradict each other — establish
which is live before this phase**, since the DKIM/SPF work differs.

### Phase 7 — Decommission Woo
Only after Phase 5 verifies. **Regenerate the map before this point** — once the legacy
site is gone, so is the generator's own input.

---

## 5. Before committing

Confirm `tse.co.za` carries no Google penalty or toxic backlink history. Nothing suggests
it does — it ranks — but it is the one finding that would invalidate the whole direction,
and it needs the legacy domain's Search Console.
