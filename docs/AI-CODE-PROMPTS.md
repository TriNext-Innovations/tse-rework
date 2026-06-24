# TSE Online — AI Code Generation Prompts

Use these prompts with Claude (or Claude Code in your terminal) to generate each major
component. Paste the prompt, review the output, adjust to fit your file structure, commit.

---

## PROMPT 1 — Monorepo Scaffold Test

```
You are setting up a Turborepo monorepo for a South African e-commerce store called TSE Online
that sells printer cartridges.

Create the full scaffold with:
- apps/web: Next.js 15 with App Router, TypeScript, Tailwind CSS, shadcn/ui
- apps/backend: Medusa.js v2 with TypeScript
- packages/ui: shared component library
- packages/config: shared tailwind.config.ts, tsconfig base, eslint config
- packages/types: shared TypeScript interfaces

Also create:
- turbo.json with build, dev, lint, type-check pipelines
- Root package.json with workspaces
- .env.example with all required environment variables (see ARCHITECTURE.md)
- .gitignore
- README.md with setup instructions

Use pnpm workspaces. Node 20+.

Output the full file tree first, then each file's contents.
```

---

## PROMPT 2 — Design System & Component Library

```
You are building the design system for TSE Online, a South African printer cartridge e-commerce
store. The brand uses a teal-green primary (#0D9488), dark charcoal (#111827) for headings,
mid grey (#374151) for body text, and Inter as the typeface.

Using shadcn/ui and Tailwind CSS, create the following components in packages/ui/src/:

1. Button — variants: primary (teal filled), secondary (outline), ghost, destructive
2. Badge — variants: inStock (green), lowStock (amber), outOfStock (red), compatible, oem
3. ProductCard — shows product image, title, SKU, stock badge, OEM/compatible badge, price,
   and an "Add to Cart" button. Accepts a product object typed from Medusa's Product type.
4. CartDrawer — slide-in panel from the right, shows cart line items with qty controls,
   subtotal, and a "Checkout" CTA. Uses Radix Sheet primitive.
5. CompatibilityBadge — small pill showing "Compatible with HP LaserJet Pro M404n" etc.
6. PricingTierBadge — shows "Reseller Price" or "Wholesale Price" for B2B customers.

All components must be:
- Fully typed with TypeScript
- Accessible (ARIA labels, keyboard navigation)
- Dark-mode ready using Tailwind's dark: variant
- Exported from packages/ui/src/index.ts

Output each component file in full.
```

---

## PROMPT 3 — Cartridge Compatibility Wizard

```
You are building the Cartridge Compatibility Wizard for TSE Online (Next.js 15, App Router,
TypeScript, Tailwind CSS, shadcn/ui).

The wizard lives at /compatibility and works as follows:
  Step 1 — User selects printer brand (HP, Canon, Epson, Samsung, Brother, Lexmark, Xerox)
  Step 2 — User selects printer model (fetched dynamically based on brand from /api/compatibility/models?brand=HP)
  Step 3 — Results show: a list of matching cartridges (OEM and compatible options),
           each with stock status, price, and "Add to Cart" button.

Create:
1. apps/web/src/app/(storefront)/compatibility/page.tsx — Server Component wrapper with metadata
2. apps/web/src/app/(storefront)/compatibility/CompatibilityWizard.tsx — Client Component with
   the 3-step wizard UI using shadcn/ui Select, Card, and Button components
3. apps/backend/src/modules/compatibility/index.ts — Medusa module with:
   - CompatibilityModuleService with methods: getBrands(), getModels(brand), getCartridges(brand, model)
   - The compatibility table schema (see ARCHITECTURE.md)
4. apps/backend/src/api/store/compatibility/route.ts — REST endpoints:
   GET /store/compatibility/brands
   GET /store/compatibility/models?brand=
   GET /store/compatibility/cartridges?brand=&model=

The wizard must be mobile-first, show a progress indicator, and handle loading/error states.

Output all four files in full.
```

---

## PROMPT 4 — PayFast & Ozow Payment Integration

```
You are integrating PayFast and Ozow into a Medusa.js v2 backend for a South African
e-commerce store. The backend runs on Railway, the frontend on Vercel.

Create a custom Medusa payment provider for PayFast:
- File: apps/backend/src/modules/payfast/index.ts
- Implements Medusa's AbstractPaymentProvider interface
- Handles: initiatePayment, authorizePayment, capturePayment, refundPayment, cancelPayment
- PayFast ITN (Instant Transaction Notification) webhook handler at POST /webhooks/payfast
- Signature validation using MD5 hash of form fields + passphrase (SANS PayFast docs spec)
- Supports both sandbox and production modes via PAYFAST_SANDBOX env var

Also create the Ozow provider:
- File: apps/backend/src/modules/ozow/index.ts
- Same interface implementation
- Ozow uses HMAC-SHA512 for hash generation
- Webhook at POST /webhooks/ozow

And the webhook routes:
- apps/backend/src/api/store/webhooks/payfast/route.ts
- apps/backend/src/api/store/webhooks/ozow/route.ts

Include full TypeScript types, error handling, and logging.
Output all files in full.
```

---

## PROMPT 5 — B2B Customer Portal

```
You are building the B2B portal for TSE Online. Business customers get negotiated pricing
and can place bulk orders or submit quote requests.

The B2B module consists of:

Backend (Medusa.js v2):
1. apps/backend/src/modules/b2b/index.ts
   - B2BModuleService: assignPricingTier(customerId, tier), getTier(customerId)
   - Pricing tiers: 'standard' | 'reseller' | 'wholesale'
   - Reseller: 15% below list price. Wholesale: 25% below list price.
   - Auto-apply correct Medusa price list based on customer group at checkout
2. apps/backend/src/api/admin/b2b/route.ts — Admin endpoint to assign tiers

Frontend (Next.js 15):
3. apps/web/src/app/(storefront)/b2b/dashboard/page.tsx
   - Protected route (redirect to /account/login if not authed)
   - Shows: customer's pricing tier badge, order history, quick reorder buttons
4. apps/web/src/app/(storefront)/b2b/quote/page.tsx
   - Quote request form: table of rows (SKU search + qty + note), submit button
   - On submit: POST to /store/b2b/quote, show confirmation
5. apps/backend/src/api/store/b2b/quote/route.ts
   - POST handler saves to quote_request table, sends email via Resend to admin

All pages must be server-rendered where possible, with client components only for
interactive form elements. Use TypeScript throughout.

Output all five files in full.
```

---

## PROMPT 6 — Instagram / Facebook Automation Bot (n8n)

```
You are building an n8n automation workflow for TSE Online that automatically posts new
and restocked products to Instagram and Facebook.

Describe and generate:

1. The n8n workflow JSON (automation/n8n/social-posting-workflow.json) that:
   - Trigger: Webhook from Medusa subscriber when a product is created or stock goes
     from 0 to positive (restocked)
   - Step 1: Fetch full product details from Medusa API (title, description, price, image URL)
   - Step 2: Call Anthropic Claude API (claude-sonnet-4-20250514) to generate a
     South African-friendly Instagram caption. System prompt:
     "You are a social media manager for TSE Online, a SA printer cartridge supplier.
      Write punchy, friendly Instagram captions in South African English. Include relevant
      hashtags. Max 200 words. Always end with a call to action to shop at tseonline.co.za."
   - Step 3: Download product image and compose it with a branded overlay
     (white logo watermark bottom-right, teal price badge bottom-left)
   - Step 4: POST to Instagram via Meta Graph API (/{instagram-business-id}/media then /media_publish)
   - Step 5: POST to Facebook Page via Meta Graph API (/{page-id}/photos)
   - Step 6: Log result to Supabase table `social_posts` (product_id, platform, post_id, caption, posted_at)

2. apps/backend/src/subscribers/product-updated.ts
   - Medusa subscriber listening to product.created and product-variant.updated events
   - On restock (quantity changed from 0 to > 0): POST to n8n webhook with product payload
   - Include retry logic (3 attempts, exponential backoff)

3. A Supabase migration for the social_posts table

Output the n8n workflow JSON and both code files in full.
```

---

## PROMPT 7 — Transactional Email Templates (Resend + React Email)

```
You are building transactional email templates for TSE Online using Resend and React Email.

Create the following templates in apps/web/src/emails/:

1. OrderConfirmation.tsx
   - Shows order number, list of items (image, name, qty, price), subtotal, shipping cost, total
   - Delivery estimate based on province and order time (next-day JHB/PTA if ordered before 12:00)
   - TSE Online branding: teal (#0D9488) header, Inter font, clean minimal layout

2. ShippingUpdate.tsx
   - Shows order number, tracking number (with clickable link to courier tracking page),
     estimated delivery date, delivery address

3. PasswordReset.tsx
   - Simple template with a timed reset link (1 hour expiry) and security warning

4. QuoteReceived.tsx (sent to admin)
   - Shows customer name, company, contact details, and the full quote request item table

Also create apps/backend/src/lib/email.ts:
   - sendOrderConfirmation(order: MedusaOrder): Promise<void>
   - sendShippingUpdate(order, trackingNumber, courierUrl): Promise<void>
   - sendPasswordReset(email, resetUrl): Promise<void>
   - sendQuoteNotification(quote): Promise<void>
   All functions use the Resend SDK and handle errors gracefully.

Output all files in full.
```

---

## PROMPT 8 — Meilisearch Product Search

```
You are integrating Meilisearch into the TSE Online Next.js 15 frontend for fast product search.

Create:

1. apps/backend/src/subscribers/search-sync.ts
   - Medusa subscriber that listens to product.created, product.updated, product.deleted
   - On create/update: upserts document to Meilisearch index 'products' with fields:
     id, handle, title, description, brand, category, variants (sku, price, stock),
     compatibility (array of printer models this product works with)
   - On delete: removes document from index

2. apps/web/src/components/search/SearchModal.tsx (Client Component)
   - Triggered by CMD+K or clicking the search icon in the header
   - Uses instantsearch.js with Meilisearch adapter
   - Shows results as product cards with highlight on matched text
   - Filters panel: brand, category, in-stock-only toggle
   - Recent searches stored in localStorage

3. apps/web/src/lib/meilisearch.ts
   - Initialise Meilisearch client
   - Configure index settings (searchable attributes, filterable attributes, ranking rules)
   - Export typed search helper functions

4. apps/backend/src/scripts/seed-search.ts
   - One-time script to bulk-index all existing products into Meilisearch

Output all four files in full.
```

---

## PROMPT 9 — POPIA Compliance Layer

```
You are adding POPIA (South Africa's data protection law) compliance features to TSE Online.

Create:

1. apps/web/src/components/CookieBanner.tsx (Client Component)
   - First-visit cookie consent banner (bottom of screen)
   - Three categories: Necessary (always on), Analytics (Google Analytics), Marketing (Meta Pixel)
   - Saves consent to localStorage and a cookie named 'tse_cookie_consent'
   - If analytics is accepted, dynamically loads Google Analytics script
   - If marketing is accepted, dynamically loads Meta Pixel script
   - Styled with teal accent, minimal design

2. apps/web/src/app/(legal)/privacy/page.tsx
   - Full POPIA-compliant Privacy Policy as a Server Component
   - Covers: data collected, purpose, third parties (PayFast, Ozow, Meta, Google, Resend),
     retention periods, data subject rights (access, correction, deletion), contact details

3. apps/web/src/app/(legal)/cookies/page.tsx
   - Cookie Policy listing all cookies set, their purpose, and expiry

4. apps/backend/src/api/store/data-requests/route.ts
   - POST /store/data-requests — customer submits a data access or deletion request
   - Saves request to a data_requests table with status 'pending'
   - Sends acknowledgement email to customer and notification to admin via Resend

Include the Supabase migration for the data_requests table.
Output all files in full.
```

---

## PROMPT 10 — Courier Integration (Courier Guy + Aramex)

```
You are building the SA courier integration for TSE Online's Medusa.js v2 backend.

The business rules are:
- Orders placed before 12:00 SAST, Monday–Friday: next-business-day delivery to JHB/PTA
- All other Gauteng orders: 1–2 business days
- Other provinces: 2–3 business days
- Orders over R1,500: free standard shipping
- Express option available for all zones (same-day JHB CBD only via Courier Guy Express)

Create:

1. apps/backend/src/modules/courier/index.ts
   - CourierService with method: getRates(orderWeight, destinationPostalCode, orderValue)
   - Returns array of ShippingOption: { name, price, estimatedDays, carrierId }
   - Integrates with Courier Guy API (REST, API key auth) for rate calculation
   - Falls back to flat-rate table if API is unavailable

2. apps/backend/src/modules/courier/zones.ts
   - Postal code to zone mapping for SA provinces
   - Helper: getZone(postalCode): 'jhb_pta' | 'gauteng' | 'national'
   - Helper: isNextDayCutoffMet(): boolean (checks current SAST time < 12:00)

3. apps/backend/src/api/store/shipping-options/route.ts
   - GET /store/shipping-options?postalCode=&weight=&orderValue=
   - Returns available shipping options for the given parameters

4. A flat-rate fallback table as a TypeScript const in courier/rates.ts

Output all files in full.
```

---

## PROMPT 11 — Admin Dashboard Extensions

```
You are extending the Medusa.js v2 admin dashboard for TSE Online with custom widgets.

Create the following Medusa admin extensions:

1. apps/backend/src/admin/widgets/compatibility-widget.tsx
   - Shows on the product detail page in the Medusa admin
   - Lists all printer models this product is compatible with
   - Allows admin to add/remove compatibility entries via inline form

2. apps/backend/src/admin/widgets/b2b-tier-widget.tsx
   - Shows on the customer detail page
   - Displays current pricing tier (standard/reseller/wholesale)
   - Dropdown to change tier, with confirmation dialog

3. apps/backend/src/admin/widgets/social-posts-widget.tsx
   - Shows on the product detail page
   - Lists recent Instagram/Facebook posts for this product from the social_posts table
   - "Post Now" button that triggers the n8n webhook immediately

4. apps/backend/src/admin/routes/quotes/page.tsx
   - Custom admin route at /quotes
   - Table of all quote requests with status filter
   - Click a row to view full quote details and enter a quoted price
   - "Send Quote" button triggers a quote email to the customer via Resend

Output all files in full.
```

---

## PROMPT 12 — Performance & SEO

```
You are optimising TSE Online (Next.js 15) for Core Web Vitals and SEO.

Create:

1. apps/web/src/app/(storefront)/products/[handle]/page.tsx
   - Full Server Component implementation
   - generateMetadata() function with: title, description, openGraph (with product image),
     twitter card, canonical URL, JSON-LD structured data (Product schema with offers, availability)
   - generateStaticParams() pre-generates paths for all products

2. apps/web/src/app/sitemap.ts
   - Dynamic sitemap including all product pages, category pages, compatibility wizard,
     legal pages. Fetches product handles from Medusa at build time.

3. apps/web/src/app/robots.ts
   - Standard robots.txt allowing all crawlers, pointing to sitemap

4. apps/web/next.config.ts
   - Image optimisation: domains whitelist for Supabase storage CDN
   - Bundle analyser (ANALYZE=true)
   - Security headers: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
   - Compression enabled
   - SA-specific: output: 'standalone' for Railway deployment if needed

5. apps/web/src/components/layout/Header.tsx
   - Full navigation header: logo, category nav, search trigger (CMD+K),
     cart icon with item count badge, account icon
   - Sticky with blur backdrop on scroll
   - Mobile: hamburger menu with slide-in nav drawer

Output all files in full.
```
