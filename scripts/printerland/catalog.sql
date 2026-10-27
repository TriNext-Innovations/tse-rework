-- TSE catalogue export for scripts/printerland/match.ts (#482). Read-only.
--
--   B=$(base64 -w0 scripts/printerland/catalog.sql)
--   ssh linuxuser@<tse-prod> "cd /opt/tse-ui && echo $B | base64 -d | \
--     docker compose exec -T postgres psql -U postgres -d tse_medusa -AtF'	' -f -" \
--     > .cache/printerland/catalog.tsv
--
-- (The SQL travels as an argument because `docker compose exec -T` would
-- otherwise swallow ssh's stdin.)

\echo ##VARIANTS
SELECT v.sku, p.title, p.handle, coalesce(v.title, ''), coalesce(p.metadata->>'brand', ''), coalesce(p.metadata->>'cartridge_type', '')
  FROM product_variant v JOIN product p ON p.id = v.product_id
 WHERE v.deleted_at IS NULL AND p.deleted_at IS NULL AND p.status = 'published' AND v.sku IS NOT NULL;
\echo ##MODELS
SELECT b.name, m.name, m.slug, m.validated
  FROM printer_model m JOIN printer_brand b ON b.id = m.brand_id
 WHERE m.deleted_at IS NULL;
\echo ##COMPAT
SELECT b.name, m.name, c.sku, c.source
  FROM cartridge_compat c
  JOIN printer_model m ON m.id = c.printer_model_id
  JOIN printer_brand b ON b.id = m.brand_id
 WHERE c.deleted_at IS NULL;
