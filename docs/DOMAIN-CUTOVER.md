# Domain cutover — moving the storefront to `tse.co.za`

**TL;DR:** `tse.co.za` was registered in **1997** and still ranks; `tse-cartridges.co.za`
was registered in **May 2026** and ranks for nothing. The current plan in
`CLIENT-PENDING.md` #8 redirects the valuable domain into the worthless one. This runbook
does it the other way round. Domain direction is approved. Follow the dated
[execution pack](CUTOVER-EXECUTION-2026-09-23.md) for current readiness and sequencing.

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
first, it is the long pole. **Update 23 September:** GAM has accepted Leon’s
authorisation and will execute the switch on Ryno’s request (KGFQ-486959).
A direct login is no longer a prerequisite. TTL 300 and the SPF pin are verified.

### Earlier access assessment — superseded by the execution pack

Everything technical is built and tested. What is left is access, and two of these become
**unrecoverable** if left too long.

| Blocker | Issue | What is lost if it expires first |
|---|---|---|
| GAM DNS | #465 | Nothing permanent — but no TTL drop, no SPF pin and no flip, so the cutover simply cannot happen. |
| konsoleH / Xneelo | #431 | **Unrecoverable.** The URL inventory and `.htaccess` behaviour die with the hosting. Largely mitigated 2026-09-21 by harvesting AWStats instead, but anything not yet extracted is gone when the contract ends. |
| Agency handover | #447 | **Potentially unrecoverable.** If the agency owns Search Console, GA4, Merchant Center or Meta Business Manager, those leave with them. Historical data especially. |

The nginx server block is verified against the full config (`crossplane`, and `nginx -t` on
the box), so the certificate is the only technical item outstanding — and it now follows
the flip rather than preceding it.

### ⚠ Never delegate the nameservers to Xneelo

konsoleH's *Domain Details* page shows a DNS block — `ns1.host-h.net`, `ns2.host-h.net`,
`ns1.dns-h.com`, `ns2.dns-h.com` — under the line *"The following URLs point to your
account once DNS propagation is completed."* That line describes a state that was never
reached, and konsoleH has no way to know it.

**Those nameservers hold a real, authoritative zone for `tse.co.za` that is not in use.**
Verified by querying `129.232.248.30` directly, 2026-09-21:

| Record | Xneelo's shadow zone | The live GamCo zone |
|---|---|---|
| `A` | `129.232.138.17` | `129.232.138.17` — **identical** |
| `MX` | `10 mail.tse.co.za` → `129.232.138.17` | `10/20 eu1-smtp-mx1/mx2.titanhq.com` |
| `SPF` | `v=spf1 mx a include:spf.host-h.net ?all` | the long GamCo record |

konsoleH provisions a zone for every hosting account by default, assuming you will delegate
to it. TSE never did — the registry delegates to GamCo — so it sits there looking correct
and doing nothing.

**Why this is a landmine rather than a curiosity.** Pointing the nameservers at Xneelo is a
natural instinct: the hosting is there, so surely the DNS should be. Do that and the
**website keeps working** — the A record is byte-identical — while **mail dies instantly**,
because MX flips from TitanHQ to a box that does not receive TSE's mail. The visible thing
survives, the invisible thing breaks, and nobody connects the two. That is exactly how
Sōter lost mail for 12 days.

Two consequences for this runbook:

1. **konsoleH's DNS section is inert.** Editing it changes nothing. Do not try.
2. **The narrow A-record path is now evidence-backed, not just preferred.** It never touches
   delegation, so this zone stays dormant. If delegation is ever revisited — to Cloudflare
   or anyone — MX must be recreated *before* the nameservers change, not after.

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

### Phase 0 — Settle #13 ✅ decided
**Confirmed by Ryno 2026-09-16: the storefront moves onto `tse.co.za`.** TSE has given
notice to both their hosting provider and their digital media agency, so this is go.

Leon authorised the GAM request on 22 September (ticket KGFQ-486959).
Ryno reconfirmed on 23 September that the client is waiting for us.
`CLIENT-PENDING.md` now marks #8 superseded and #13 settled.

⚠ The notice starts a clock. If the Xneelo box goes dark before Phase 1 runs, the access
logs, `.htaccess` and legacy sitemap are gone for good — and the sitemap is this plan's
own input. **Phase 1 is now the urgent one, not Phase 4.**

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

### Phase 3 — Issue the certificate (HTTP-01, after the flip)

**Revised 2026-09-21 (Ryno).** Earlier versions pre-issued via DNS-01 so the cert existed
before any traffic moved. That is still the only zero-gap route, but it costs a GAM
round-trip for the `_acme-challenge` TXT, and GAM is the slow part of this project.

HTTP-01 needs the domain pointing at this box anyway, so the cert is issued *after* the A
record moves:

```bash
cd /opt/tse-ui
docker compose exec nginx ls /var/www/certbot            # webroot is mounted
docker run --rm \
  -v tse-ui_certbot_certs:/etc/letsencrypt \
  -v tse-ui_certbot_www:/var/www/certbot \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d tse.co.za -d www.tse.co.za \
  --email ryno@trinextinnovations.co.za --agree-tos --no-eff-email
```

⚠ **The cost is a TLS-error window on `tse.co.za`** between the A record propagating and
the cert being issued. Browsers get a certificate error, not a redirect — this is the one
visibly broken moment in the whole cutover. Two things keep it small:

1. **TTL 300 (#433)** reduces ordinary DNS cache lifetime; it does not bound
   certificate issuance or outage duration. Validation failures can extend the gap.
2. **Do the flip off-peak.** It is a live ecommerce domain that ranks.

The `:80` server block must be enabled *before* the flip so the ACME challenge can be
served — it carries the webroot location. The `:443` block references a cert that does not
exist yet and nginx refuses to start on a missing cert path, so enable the file only once
the cert is in place, or split it.

Gate: `nginx -t` passes with the `tse.co.za` server block enabled.

### Phase 4 — Flip
TTL is **300s**, verified on 23 September after GAM confirmed the change.
Allow at least the previous TTL to elapse after a TTL reduction; two days is not
a DNS requirement. Resolvers can still serve stale answers, so check multiple
resolvers and keep both origins available. Then point `tse.co.za` and
`www.tse.co.za` at the Vultr IP at GAM. Rebuild and deploy the web image with
`NEXT_PUBLIC_SITE_URL=https://tse.co.za`. Enable the redirect server block per
`PROD-DEPLOY.md` §7a step 4.

Rollback is a DNS revert — hence the low TTL. It only helps while something still answers
at the old address, which is what the Xneelo fallback host gives us for free (#473).

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

✅ The sender contradiction is settled: it is **ZeptoMail**, `orders@tse-cartridges.co.za`
with Reply-To `sales@tse.co.za`. Resend was never adopted; `CLIENT-PENDING.md` #10 has been
corrected. Moving the sender to `orders@tse.co.za` is tracked separately (#444) and is
deliberately sequenced *after* the flip so it cannot block it.

### Phase 7 — Decommission Woo
Only after Phase 5 verifies. **Regenerate the map before this point** — once the legacy
site is gone, so is the generator's own input.

---

## 5. Before committing

Confirm `tse.co.za` carries no Google penalty or toxic backlink history. Nothing suggests
it does — it ranks — but it is the one finding that would invalidate the whole direction,
and it needs the legacy domain's Search Console.
