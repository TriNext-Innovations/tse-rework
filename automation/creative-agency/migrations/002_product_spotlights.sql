-- Product spotlights: an assignment that promotes one real catalogue product.
-- `product` holds the store data (handle, title, sku, price) as read at planning
-- time; the price is re-read before publishing.
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS product jsonb;
CREATE INDEX IF NOT EXISTS assignments_spotlight_idx ON assignments (slot_at) WHERE product IS NOT NULL;
