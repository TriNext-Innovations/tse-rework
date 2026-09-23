# TSE domain cutover — release boundary

Prepared 23 September 2026. Source branch: `release/tse-domain-cutover`, based on
production `main` at `926b146`. Merging this branch to `main` **deploys to
production automatically**. The merge is a preparation deploy: DNS remains at
the old WooCommerce host until GAM receives the separate switch instruction.

## Release before the DNS switch

- Ship the current 921-entry legacy URL map and the generator that can refresh
  it while the old sitemap remains available. The map stays inert until the new
  domain block is enabled.
- Ship `tse-co-za.conf.disabled`, the HTTP-only bootstrap template and the
  Docker-volume certificate renewal script. The final TLS block stays disabled
  until a valid certificate exists. The bootstrap already running on production
  continues serving ACME challenges.
- Ship the dated execution pack, status record and corrected client-pending
  notes. The production candidate image, private environment, backups and
  rollback tags remain on the server; no credentials enter Git.
- CI, review and a green preparation deploy gate the DNS switch. Verify the
  existing storefront, API, ACME challenge, server config and image tags after
  this deploy. The deployment rebuilds the existing site with its current
  `.env`; it does not activate the new-domain candidate.

## Coordinated cutover, after the preparation deploy

1. Confirm GAM has an operator to change **and revert** both A records, and the
   old Woo store stays available. Pause/reconcile old orders and record the
   final Woo delta. Ryno gives GAM the timed go-ahead.
2. GAM changes only `tse.co.za` and `www.tse.co.za` A records to
   `139.84.247.189`, TTL 300. MX, NS, SPF and API DNS stay unchanged.
3. Issue the `tse.co.za` + `www.tse.co.za` certificate by HTTP-01 using the
   tested bootstrap. Enable the final nginx block only after cert inspection
   and `nginx -t`. Activate the private candidate environment/image, restart
   only the necessary services, then reload nginx to refresh upstreams.
4. Test public TLS, home/category/product, account/cart/checkout, PayFast URL
   generation and callback, mail, 10 representative legacy redirects, canonical
   URLs and sitemap. Keep GAM reachable for rollback. Reconcile orders on both
   stores through DNS propagation.
5. Validate a certificate renewal dry run and install the Docker-volume renewal
   schedule. Update Search Console and Merchant Center with an accountable
   operator; watch their verification/review status.

A temporary browser certificate error is possible with HTTP-01 between DNS
arrival and certificate activation. TTL 300 does not bound that interval. A
pre-issued DNS-01 certificate would remove this window but requires another
coordinated GAM TXT operation; do not improvise it during the switch.

## Follow-up release and operational work

- Once the new domain passes acceptance, redirect only the **old storefront**
  host to `tse.co.za` in a reviewed nginx change. Preserve
  `api.tse-cartridges.co.za` and PayFast callbacks. Avoid shipping the reverse
  redirect in the preparation deploy.
- Publish and verify ZeptoMail's supplied DKIM TXT and bounce CNAME at GAM.
  Change `EMAIL_FROM` to `orders@tse.co.za` only after the sending domain is
  verified in ZeptoMail and a controlled delivery test passes. Keep the current
  sender through the website switch.
- Monitor orders, payments, 404s, rankings and Merchant Center. Retain the
  old host and backups through the agreed rollback period. Decommission Woo
  only after acceptance, order reconciliation and a separate decision.
- Backmerge the focused release to `develop`. Triage the broader
  `release/2026-09` dependency changes separately; none are required for this
  domain cutover.

## Go/no-go record

Cutover owner: Ryno. DNS operator: Maurice/GAM ticket KGFQ-486959. At the last
check, GAM had completed TTL/SPF preparation but **had not switched either A
record**. ZeptoMail's new records were absent. The readiness and rollback
checks, including what has already run, live in
[CUTOVER-EXECUTION-2026-09-23.md](CUTOVER-EXECUTION-2026-09-23.md) and
[CUTOVER-STATUS-2026-09-23.md](CUTOVER-STATUS-2026-09-23.md).
