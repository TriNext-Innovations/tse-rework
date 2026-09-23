#!/usr/bin/env bash
# Run only after the tse.co.za certificate has been issued in the Docker volume.
# Pin CERTBOT_IMAGE to the recorded image digest/ID. Use --dry-run for validation.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${CERTBOT_IMAGE:?Set the verified certbot image digest or ID}"
exec 9>/tmp/tse-domain-cert-renew.lock
flock -n 9 || exit 0
docker run --rm \
  -v tse-ui_certbot_certs:/etc/letsencrypt \
  -v tse-ui_certbot_www:/var/www/certbot \
  "$CERTBOT_IMAGE" renew --cert-name tse.co.za \
  --webroot --webroot-path /var/www/certbot "$@"
docker compose exec -T nginx nginx -t
docker compose exec -T nginx nginx -s reload
