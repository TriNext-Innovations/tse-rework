# Cutover execution status — 23 September 2026

## Authorisation and scope

Ryno asked to complete the final cutover steps. He is coordinating ZeptoMail DNS
with GAM. No message has been sent on his behalf. The A-record switch remains
with GAM; confirmation of a staffed switch/rollback slot and old-host retention
is still pending. Do not treat the DNS-record paste as confirmation of either.

## Completed on production

- Baseline revision: `926b1462234d31fe752d7d6b9228c23af33e1617`.
- Backup: `/opt/tse-ui/backups/cutover-20260923T091722Z/` (private permissions).
  Database gzip integrity checked; config/environment preserved. TLS private keys
  excluded from the archive due to ownership; existing certificate volumes untouched.
- Rollback images:
  - `tse-cutover-rollback-web:20260923T091722Z`
  - `tse-cutover-rollback-medusa:20260923T091722Z`
- Certbot image pinned for execution by ID:
  `sha256:0107d084c225631fc64a8313e19adb07275f7296fde338f7dfa93986c80b2e3e`.
- Installed the reviewed 921-entry map and disabled final domain config.
- Enabled only `tse-co-za-bootstrap.conf`; full `nginx -t` passed and nginx reloaded.
- External HTTP ACME probe succeeds for both hostnames with `--resolve` to the new IP.
  Probe: `tse-cutover-20260923T091833Z`. Existing public storefront remains HTTP 200.

## Candidate preparation

A build using the existing production source and dependencies completed successfully,
with `NEXT_PUBLIC_SITE_URL=https://tse.co.za`. It is tagged separately as
`tse-cutover-web:20260923`; the build script restores the original `tse-ui-web:latest`
tag on exit. The running container is not replaced by building the image.

Private candidate environment is in the backup directory. It changes only the
public site URL, backend storefront URL and required CORS origins. It preserves
payment credentials, API origin, mail sender and all other values. Do not copy
this private file into Git or WorkDrive.

## Verification results

- Candidate image: `sha256:13f4795046acd6f7b483afb82e2c13f589b5c91e1c9421aa0614790539930961`.
- Eight candidate routes returned 200 in a temporary private container: home,
  products, a product detail, HP category, cart, checkout, sitemap and robots.
  Homepage Open Graph URL, product canonical and sitemap use `https://tse.co.za`.
  The homepage currently has no explicit canonical tag (existing behaviour);
  the first smoke assertion assumed one, then was corrected to test its actual
  metadata plus the product page canonical. No application source changed.
- This validates rendering, NOT a completed order/payment or signed-in session.
- Temporary restore of a fresh custom-format production dump succeeded with
  `pg_restore --exit-on-error`; 154 public tables restored. Isolated container
  was stopped and removed. Dump retained privately beside the backup.
- Existing offsite R2 backup routine exited successfully; its private log is
  `offsite-backup.log` in the backup folder. No remote restore drill performed.
- Original image tag restored; live storefront remains on its original image.
- Prepared `scripts/renew-tse-domain.sh` for the Docker certificate volume.
  Shell syntax passes. Install its twice-daily schedule only after certificate
  issuance and a successful `--dry-run`. The host package cron does not prove
  Docker-volume renewal, so it is not counted as coverage.

## Update — 25 September: canonical host is www (#475)

The candidate image and private candidate environment above were built for the
**apex**. Both must be redone before the window: rebuild the web image with
`NEXT_PUBLIC_SITE_URL=https://www.tse.co.za`, set `STOREFRONT_URL=https://www.tse.co.za`,
and list both `https://www.tse.co.za` and `https://tse.co.za` in `STORE_CORS` and `AUTH_CORS`.
Repeat the eight-route smoke test and confirm canonical, Open Graph and sitemap URLs
use `https://www.tse.co.za`. The final nginx block now serves www and 301s the apex.
The certificate request (`-d tse.co.za -d www.tse.co.za`) and renewal are unchanged.
ZeptoMail DKIM and `bounce-zem` CNAME are published and match (checked 25 September).

**Done 25 September:** www candidate built from `de2786f` as `tse-cutover-web:20260925-www`
(`sha256:47b46982b2446d7c2c8ebcae46d07883219b8baaa44a8623eb0eee3d1d34857e`), built straight
to its own tag so `tse-ui-web:latest` was never touched. Private env
`environment.candidate-www.private` sits beside the 23 September one and differs from live
only in the four URL keys. The apex candidate from 23 September is superseded. Smoke test in
a private container: home, products, product detail, HP laser category, printer page, cart,
checkout, sitemap and robots all 200. Home `og:url`, product canonical and `og:url`, all
1,093 sitemap `<loc>` entries and the robots `Sitemap:` line use `https://www.tse.co.za`.
The bare domain appears nowhere in the homepage HTML. As before, this validates rendering
only, not a completed order.

## Remaining execution sequence

1. Confirm GAM's staffed switch/rollback availability and old hosting retention.
   Confirm old Woo backup/admin access and checkout pause/order reconciliation.
2. On the coordinated go-ahead, GAM switches apex and www to `139.84.247.189`.
   TTL remains 300; preserve MX, NS and existing SPF while adding ZeptoMail records.
3. Issue the certificate with the recorded image ID and tested webroot. Enable
   the final TLS block only after issuance. Test and reload nginx.
4. Activate the candidate environment and image; recreate backend/web and reload
   nginx to refresh upstreams. Test both new-domain hosts through public TLS,
   cart/account/payment routes, legacy redirects, mail and metadata.
5. Redirect only the old storefront hostname(s) after acceptance; preserve the API.
6. *(Done differently: `scripts/renew-certs.sh`, see the 29 Sep entry.)* Run a renewal dry-run with the pinned CERTBOT_IMAGE, then
   install a user cron at `17 3,15 * * *` using the absolute script path and
   pinned image value. Keep existing cron entries; log to a private operations log.
7. Recheck ZeptoMail DNS and provider verification before any sender change.

*(Superseded 28 Sep: see "Executed" below.)* At last check the website A record remains `129.232.138.17`. No DNS switch,
certificate issuance, application activation or email sender change has occurred.

## ZeptoMail — supplied by Ryno, not yet published at time of check

GAM should add these records without replacing MX or the existing apex SPF TXT:

- TXT `232347._domainkey.tse.co.za` (relative host `232347._domainkey` if the
  DNS editor appends `tse.co.za` automatically):

```text
k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAte21l7jGH5FDmbSzUaz+nnScDrdEq7FSHIoZC3ROmUkRfJopHYlxYUOQ9xueKy3wWwt/iX0gGJo53dlfQmw3/60lsNtvoKVnqB0RxNR8IFR+HQFt95+z1dP4Pek6elskUYKGovqwZi+vYIZvIomCswriT0hzY+A4Uu+Z9lctpOzl5WfZnWha1BItr3lnXpS8qx2obv0K8jBkjQMmnwTTge37yKz+yGlXw8zJsMBzDtN/6FKCQedQI31rz+zF8Pe2lvaW/7Bwpv4zlFlY1hL3i0qmKyNZxL/zuchIh6Zw4vPlClC3X+5V/k5fVbH6ALZMcI9mtjLKdoC/q5eOwSbCDwIDAQAB
```

- CNAME `bounce-zem.tse.co.za` (relative host `bounce-zem`) →
  `cluster89.zeptomail.com`.

Public checks returned NXDOMAIN for both records. Recheck against the exact values,
then confirm domain verification in ZeptoMail before changing the application sender.
The existing sender remains usable while this is pending. No unrequested mail test
or third-party message has been sent.

---

## Executed — 28 and 29 September 2026

**28 Sep, 10:59 UTC: www.tse.co.za live** (#442, closed).
- GAM moved apex + www to `139.84.247.189`. The cert for `tse.co.za` + `www` was issued by HTTP-01 (expires 2026-12-27).
- The bootstrap conf was renamed `.off.20260928T105616Z`. `tse-co-za.conf` was enabled; it has been tracked under that name in git since 29 Sep.
- The www-candidate environment and image were activated.
- Rollback files: `backups/cutover-20260923T091722Z/.env.pre-golive.20260928T105616Z` and image `tse-ui-web:pre-golive-20260928T105616Z`.
- Verified: www 200; apex and http 301 in one hop; legacy URLs 301 in one hop to 200; API CORS allows www. Ryno completed a real PayFast order, a password reset, mobile checkout, the quote form, and mail send and receive.
- **Averted:** the `tse-cartridges.co.za` + `api` cert was 24h from expiry with an unrenewable standalone authenticator. It was re-issued by webroot to 2026-12-27.

**29 Sep: follow-through.**
- #484 is deployed: the ACME webroot is on the old-domain vhosts, and `scripts/renew-certs.sh` is in the repo.
- A renewal dry run passed for both certs. The cron was installed: `17 3,15 * * *`, logging to `~/logs/cert-renew.log`.
- #488 is deployed: `tse-cartridges.co.za` → 301 → `https://www.tse.co.za` (#438, closed).
- **Incident, 06:09:27–06:12:10 UTC (2m45s):** the #484 deploy stopped `web` early. The cause was a bare `docker compose up nginx`, with nginx `depends_on` web, while web waited on a migration run. #489 fixed it (`--no-deps`), and #491 made deploys scoped (web / backend / nginx), so they now take ~3 min instead of 12½. See `PROD-DEPLOY.md` §6.
- No 5xx since the flip apart from that window.

**Still open:** Search Console change of address (#443) and Merchant Center (#448), both waiting on the agency handover (#447); the PayFast dashboard fallback URLs (#449); the sender move to `orders@tse.co.za` (#444, deferred); canonicals on the homepage and listing pages (#492); retiring the Woo site (#445, milestone #11).

