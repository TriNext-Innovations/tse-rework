#!/usr/bin/env bash
# Renews the two live certs (dev.* certs are dead and deliberately excluded), then reloads nginx.
cd /opt/tse-ui || exit 1
exec 9>/tmp/tse-cert-renew.lock; flock -n 9 || exit 0
echo "--- $(date -u +%FT%TZ)"
rc=0
for n in tse.co.za tse-cartridges.co.za; do
  docker run --rm -v tse-ui_certbot_certs:/etc/letsencrypt -v tse-ui_certbot_www:/var/www/certbot \
    tse-certbot:pinned renew --cert-name "$n" --non-interactive -q || { echo "RENEW FAILED: $n"; rc=1; }
done
docker compose exec -T nginx nginx -t </dev/null && docker compose exec -T nginx nginx -s reload </dev/null || rc=1
exit $rc
