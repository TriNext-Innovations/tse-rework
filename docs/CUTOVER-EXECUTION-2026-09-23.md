# TSE cutover execution pack — 23 September 2026

**Destination:** `https://www.tse.co.za` — canonical host is **www** (#475, decided
25 September; the apex 301s to it). **State:** preparation, not yet go-live ready.
Initial preparation made no production changes. Subsequent authorised execution
is tracked in [the status log](CUTOVER-STATUS-2026-09-23.md); consult it before acting.
Owner: Ryno / TriNext. DNS operator: Maurice / GAM, ticket **KGFQ-486959**.
This dated checklist supersedes conflicting historical sequencing in DOMAIN-CUTOVER.md
and PROD-DEPLOY.md. No further client decision on domain direction is needed.

## Verified evidence

| Item | Evidence on 23 September | Result |
|---|---|---|
| Client direction | Ryno confirms the client is waiting for us; Leon's 22 September email authorises GAM to proceed with Ryno's requests | Approved direction |
| DNS operator | Maurice confirms GAM awaits Ryno's request to switch apex and www | No direct login required |
| Apex and www A records | Google public DNS returns `129.232.138.17`, TTL 300 for both | Preparation verified; no switch yet |
| SPF | Public TXT contains `ip4:129.232.138.17` | Old sender remains explicitly authorised |
| Mail routing | MX remains TitanHQ `eu1-smtp-mx1` and `mx2` | Preserve all mail records |
| IPv6 and CAA | No AAAA or CAA answer for apex or www in public checks | No observed competing IPv6 route; recheck at execution |
| New storefront and API | Public HTTPS `/` and API `/health` each return 200 | Healthy baseline |
| Production | `/opt/tse-ui` at `926b146`; services running, application health checks healthy; `nginx -t` passes | Baseline captured |
| Target certificate | `/etc/letsencrypt/live/tse.co.za/fullchain.pem` absent | Certificate gate open |
| Legacy fallback | `http://tse.co.za.dedi585.jnb2.host-h.net/sitemap.xml` returns 200 | URL recovery available, NOT proof of checkout rollback |

Provider correspondence is supplied by Ryno. Do not copy the ticket's personal
login URL/token into Git, WorkDrive or a message draft.

## Preparation validation

- Fresh redirect generator completed successfully: **921/921 URLs mapped**,
  including 25 unlisted vanity paths and 64 old renamed slugs beyond the 832
  sitemap URLs. All targets passed its live-sitemap membership check; no changes
  from the checked-in map. This is not a substitute for HTTP/browser smoke tests.
- GitHub main was independently confirmed at `926b1462234d31fe752d7d6b9228c23af33e1617`,
  matching production.

- HTTP bootstrap passed `nginx -t` in an isolated temporary config using the
  production nginx binary on 23 September. No reload or live config change.
- Final HTTPS block plus redirect map also passed isolated `nginx -t` with dummy
  local upstreams and the existing certificate paths substituted solely for syntax
  validation. This does NOT verify the missing target certificate, real routing,
  checkout or acceptance on the new domain.
- Local Docker verification was unavailable due to daemon permissions; temporary
  validation files on the nginx container were removed after each check.
- Repository whitespace check passed. No application code was changed.

## Remaining gates, in execution order

1. **Agree a supported window with GAM.** Ask Maurice for the earliest slot with
   a named operator available to change AND revert both records. Off-peak is
   preferable only if GAM and TriNext can both respond. Confirm Xneelo termination
   date and keep legacy hosting active through acceptance and rollback retention.
2. **Prepare the exact release.** The current preparation branch is based on
   `2d97609`; production is `926b146`. The branch includes dependency differences
   as well as newer redirect mappings. Do not deploy it wholesale by accident.
   Select and review the cutover changes, record the release SHA and image IDs,
   and run the release checks. No unreviewed merge or dependency upgrade during
   the DNS window. Refresh the redirect map BEFORE changing canonical origin.
3. **Preserve recovery.** Fresh database and files/config backups for both stores;
   verify readability and record restore commands privately. Preserve prior images
   and environment configuration without printing secrets. Verify old Woo remains
   reachable with its original Host/SNI using `curl --resolve`, and confirm admin
   access. A fallback sitemap alone does not establish a working rollback store.
4. **Control orders across propagation.** Agree a brief pause on legacy checkout
   immediately before switching. Record the last Woo order and export the final
   delta privately. Monitor both stores while DNS propagates. Never overwrite
   Medusa with an older DB after it has accepted new orders. Record and reconcile
   any order/payment created on either side before rollback or decommission.
5. **Prepare nginx and TLS** as below. HTTP-only bootstrap is staged disabled;
   install and test it in the approved preparation window. Confirm external port
   80 reaches its challenge directory for both hostnames using a probe file.
   Do not enable the final TLS block before its certificate exists.
6. **Prepare application settings and rebuild.** `NEXT_PUBLIC_SITE_URL=https://www.tse.co.za`
   must be baked into the web image. Backend `STOREFRONT_URL=https://www.tse.co.za`
   controls PayFast return/cancel links. Add BOTH `https://www.tse.co.za` and `https://tse.co.za` to `STORE_CORS` and
   `AUTH_CORS`, retaining required existing origins during transition; preserve
   admin origins. Keep the existing API hostname, `MEDUSA_BACKEND_URL`, payment
   credentials, database and ZeptoMail sender unchanged. Inventory other URL settings
   using an explicit allowlist; never dump the environment. Build before the window;
   activate the candidate with the certificate switch, not hours beforehand.
7. **Confirm external account access.** Search Console and Merchant Center owners
   must be available for verification, sitemap/feed domain updates and follow-up.
   Merchant re-review can affect listings. Retain API/payment callback routes and
   analytics IDs. Do not bundle an email-sender migration into this change.

**Earliest window:** next mutually staffed slot after these gates pass. No extra
48-hour wait is required merely for TTL: GAM changed it on 22 September and the
old 1000-second TTL has elapsed. TTL is a cache lifetime, not a guaranteed outage
bound. Planning allowance: 3–5 focused hours for remaining preparation/rehearsal,
then a 60–90 minute staffed window, excluding access/provider delays. This is an
operational estimate, not a new client quote.

## Certificate approach and bootstrap

The recorded choice is HTTP-01 after the DNS switch. This can produce a browser
certificate error from first traffic arrival until issuance and nginx reload succeed.
Five-minute TTL DOES NOT guarantee recovery within five minutes. If that interruption
is unacceptable, request a DNS-01 TXT operation from GAM and issue the certificate
before switching; this needs another coordinated provider step, not different nameservers.

Staged file: `infrastructure/nginx/conf.d/tse-co-za-bootstrap.conf.disabled`.
It serves only the ACME challenge over HTTP and responds 503 elsewhere. It does
not expose a plaintext checkout. Use the actual production compose files and
project name verified on the host; commands below assume the existing `/opt/tse-ui` setup.

Approved preparation window, before DNS:

```bash
cd /opt/tse-ui
cp infrastructure/nginx/conf.d/tse-co-za-bootstrap.conf.disabled \
   infrastructure/nginx/conf.d/tse-co-za-bootstrap.conf
docker compose exec -T nginx nginx -t
# Stop if the check fails. Reload only after success.
docker compose exec -T nginx nginx -s reload
```

Write a harmless unique probe into `tse-ui_certbot_www` using an approved helper
container. Fetch it externally through port 80 with BOTH hostnames:

```bash
curl --fail --resolve tse.co.za:80:139.84.247.189 \
  http://tse.co.za/.well-known/acme-challenge/CUTOVER_PROBE
curl --fail --resolve www.tse.co.za:80:139.84.247.189 \
  http://www.tse.co.za/.well-known/acme-challenge/CUTOVER_PROBE
```

Check firewall reachability from outside the host; no blanket firewall changes.
Pre-pull and pin the approved certbot image, verify volume names, and preserve
existing certificates. After GAM switches BOTH names and public resolution is
observed at the new IP, issue the certificate using the verified image:

```bash
# CERTBOT_IMAGE must be the recorded approved tag/digest, not an unpinned latest.
: "${CERTBOT_IMAGE:?Set the verified certbot image tag or digest}"
docker run --rm \
  -v tse-ui_certbot_certs:/etc/letsencrypt \
  -v tse-ui_certbot_www:/var/www/certbot \
  "$CERTBOT_IMAGE" certonly --webroot -w /var/www/certbot \
  -d tse.co.za -d www.tse.co.za \
  --email ryno@trinextinnovations.co.za --agree-tos --no-eff-email
```

Verify the certificate SANs, expiry and paths. Disable the bootstrap by renaming
its enabled `.conf` file back out of nginx's glob; then enable the final
`tse-co-za.conf.disabled` as `tse-co-za.conf`. Keep a config backup. Test with
`nginx -t`; if it fails, restore the prior files before any reload. Activate the
prepared application settings/images and reload nginx after container replacement
to refresh upstream addresses. Verify via `curl --resolve` with normal TLS validation;
never count `curl -k` as acceptance. Verify an actual renewal schedule and run a
certbot renewal dry-run after validation succeeds. The webroot location alone is
not scheduled renewal.

## Acceptance checklist

- [ ] Apex and www resolve to `139.84.247.189` through authoritative/public checks.
- [ ] Valid TLS for both names; apex and all `http://` URLs 301 to `https://www` in one hop.
- [ ] Home, category, product, search/printer finder, account, cart and checkout work
      through public nginx. Test guest and signed-in flows, not only `/health`.
- [ ] New checkout's PayFast form has `https://www.tse.co.za` return/cancel URLs and the
      unchanged API `/hooks/payment/payfast_payfast` callback. Any real payment/refund
      test needs a specifically authorised amount and operator.
- [ ] Check at least 10 legacy paths across exact products, renamed products,
      categories and vanity URLs. Each mapped www HTTPS URL makes one hop to its
      final route; final response 200; no loops or redirect-to-404. Check query strings.
- [ ] Canonicals, sitemap, robots, structured data and Merchant feed use the target.
- [ ] Preserve `api.tse-cartridges.co.za` and existing payment callbacks. Reverse only
      the old storefront hosts to the new host after acceptance, preserving paths.
      Stage/review that nginx change separately; no wildcard API redirect.
- [ ] Mail DNS unchanged from baseline; client confirms a send and receive test.
- [ ] Order notifications and password-reset links work; existing sender unchanged.
- [ ] Search Console ownership, sitemap submission and Merchant domain/feed update
      have an accountable operator; analytics verified with an actual consented hit.
- [ ] Certificate renewal verified; nginx/application logs and error monitoring checked.

## Stop and rollback

Nominate Ryno as the go/no-go owner. If certificate issuance or critical checkout
fails, pause and decide promptly; suggested checkpoint is 10 minutes after first
new-origin traffic, not a claim that recovery takes 10 minutes. Stop immediately
for mail disruption, payment misrouting or data loss. Have GAM standing by.

1. Ask GAM to revert BOTH A records to **129.232.138.17**, TTL **300**. Preserve
   MX, TXT/SPF, NS and other records. Resolver caches mean rollback is not instant.
2. Keep the new host available to cached clients where safe; disable faulty checkout
   and reconcile any new orders/payments before reopening the legacy checkout.
3. Restore prior web/backend configuration and image versions if the candidate caused
   the failure. Validate nginx and reload after replacing containers. Remove any old
   storefront → new storefront redirect that would defeat rollback.
4. Restore the old store's checkout only after the order ledger is reconciled.
   Do not restore databases blindly. Retain evidence and create scoped repair work.

Watch through the staffed window, again the next business morning, and daily for
7 days: errors, 404s, checkout/payment outcomes, search indexing and Merchant status.
Do not cancel Xneelo or delete Woo until backups, order reconciliation, migration
acceptance and the agreed rollback retention period are confirmed.

## GAM message — draft only, not sent

Subject: RE: [KGFQ-486959] TSE cutover — agree execution window

Hi Maurice,

Thank you. We have verified the 300-second TTL and SPF update.

Please confirm your earliest staffed slot for the website switch, preferably
outside trading hours, with someone available to revert promptly if necessary.
We will confirm readiness and give the final go-ahead in this ticket before any change.

At the agreed time, on our go-ahead, change only:

| Name | Type | Current value | New value | TTL |
|---|---|---|---|---|
| tse.co.za | A | 129.232.138.17 | 139.84.247.189 | 300 |
| www.tse.co.za | A | 129.232.138.17 | 139.84.247.189 | 300 |

Please leave nameservers, MX, TXT/SPF and all other records unchanged.
Please confirm immediately when both changes are applied. If we request rollback,
restore both A records to 129.232.138.17 with TTL 300.

Regards,
Ryno

## Handoff

Prepared locally on `prep/tse-domain-cutover`. Not pushed, deployed or sent.
Remaining release evidence must be attached before marking this ready. GAM's
acknowledgement proves DNS coordination; it does not prove technical acceptance.
