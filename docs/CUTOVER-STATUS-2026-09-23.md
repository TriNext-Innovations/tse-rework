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
6. Run `scripts/renew-tse-domain.sh --dry-run` with the pinned CERTBOT_IMAGE, then
   install a user cron at `17 3,15 * * *` using the absolute script path and
   pinned image value. Keep existing cron entries; log to a private operations log.
7. Recheck ZeptoMail DNS and provider verification before any sender change.

At last check the website A record remains `129.232.138.17`. No DNS switch,
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
