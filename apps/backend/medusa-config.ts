import { defineConfig, loadEnv } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV ?? 'development', process.cwd())

// Fail fast rather than silently boot with a forgeable token secret if a
// production deploy is missing JWT/COOKIE secrets (the runner sets
// NODE_ENV=production). Local/dev still falls back to a placeholder.
function requireSecret(name: string, fallback: string): string {
  const value = process.env[name]
  if (process.env.NODE_ENV === 'production' && (!value || value === 'supersecret')) {
    throw new Error(`${name} must be set to a strong value in production`)
  }
  return value ?? fallback
}

// Register the S3 file provider only when R2 is configured. @medusajs/file-s3
// throws at load without credentials ("Access key ID and secret access key are
// required when using access key authentication"), which meant a clean checkout
// could not boot the backend at all until you knew to invent R2 values. Local
// work rarely touches uploads; when R2_* is unset Medusa falls back to its
// default local file provider.
const r2Configured = Boolean(process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY)

// Not registering it is right locally and wrong in production, where images
// are served from R2 — so say so loudly rather than silently losing uploads.
if (!r2Configured && process.env.NODE_ENV === 'production') {
  console.warn(
    '[config] R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY are unset in production — ' +
      'the S3 file provider is NOT registered and product image uploads will fail.'
  )
}
const fileModule = {
  resolve: '@medusajs/medusa/file',
  options: {
    providers: [
      {
        resolve: '@medusajs/file-s3',
        id: 's3',
        options: {
          file_url: process.env.R2_PUBLIC_URL,
          access_key_id: process.env.R2_ACCESS_KEY_ID,
          secret_access_key: process.env.R2_SECRET_ACCESS_KEY,
          region: 'auto',
          bucket: process.env.R2_BUCKET,
          endpoint: process.env.R2_ENDPOINT,
        },
      },
    ],
  },
}

// Register the PayFast payment provider only when configured, so environments
// without PayFast credentials still boot. Enable it on the ZAR region with
// `pnpm --filter @tse/backend payfast:setup` after deploy.
const payfastConfigured = Boolean(process.env.PAYFAST_MERCHANT_ID && process.env.PAYFAST_MERCHANT_KEY)
const paymentModule = {
  resolve: '@medusajs/medusa/payment',
  options: {
    providers: [
      {
        resolve: './src/modules/payfast',
        id: 'payfast',
        options: {
          merchantId: process.env.PAYFAST_MERCHANT_ID,
          merchantKey: process.env.PAYFAST_MERCHANT_KEY,
          passphrase: process.env.PAYFAST_PASSPHRASE,
          // Sandbox unless explicitly disabled — matches PAYFAST_SANDBOX used
          // across the stack (compose defaults it to 'true'). Safe default.
          sandbox: process.env.PAYFAST_SANDBOX !== 'false',
          storefrontUrl: process.env.STOREFRONT_URL,
          backendUrl: process.env.MEDUSA_BACKEND_URL,
        },
      },
    ],
  },
}

export default defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS ?? 'http://localhost:3000',
      adminCors: process.env.ADMIN_CORS ?? 'http://localhost:7001',
      authCors:
        process.env.AUTH_CORS ??
        'http://localhost:7001,http://localhost:3000',
      jwtSecret: requireSecret('JWT_SECRET', 'supersecret'),
      cookieSecret: requireSecret('COOKIE_SECRET', 'supersecret'),
    },
    redisUrl: process.env.REDIS_URL,
    workerMode:
      (process.env.MEDUSA_WORKER_MODE as
        | 'shared'
        | 'worker'
        | 'server'
        | undefined) ?? 'shared',
  },
  modules: [
    ...(payfastConfigured ? [paymentModule] : []),
    {
      resolve: '@medusajs/medusa/fulfillment',
      options: {
        providers: [
          // Keep the manual provider for the JHB/PTA own-delivery (COD) option.
          { resolve: '@medusajs/fulfillment-manual', id: 'manual' },
          // The Courier Guy — live rates + waybill creation (ShipLogic-powered API).
          // NB: `id` stays 'shiplogic' so the persisted provider id
          // (`shiplogic_shiplogic`) on existing shipping options/waybills is unchanged.
          {
            resolve: './src/modules/courier-guy',
            id: 'shiplogic',
            options: {
              apiKey: process.env.TCG_API_KEY,
              baseUrl: process.env.TCG_API_URL || undefined,
              collectionAddress: {
                street_address: process.env.TCG_COLLECTION_STREET ?? '',
                local_area: process.env.TCG_COLLECTION_LOCAL_AREA ?? '',
                city: process.env.TCG_COLLECTION_CITY ?? 'Johannesburg',
                zone: process.env.TCG_COLLECTION_ZONE ?? 'Gauteng',
                country: process.env.TCG_COLLECTION_COUNTRY ?? 'ZA',
                code: process.env.TCG_COLLECTION_CODE ?? '',
                type: 'business',
                company: process.env.TCG_COLLECTION_COMPANY ?? 'TSE Cartridges',
              },
              collectionContact: {
                name: process.env.TCG_COLLECTION_CONTACT_NAME ?? 'TSE Cartridges',
                mobile_number: process.env.TCG_COLLECTION_CONTACT_PHONE ?? '',
                email: process.env.TCG_COLLECTION_CONTACT_EMAIL ?? '',
              },
              defaultParcel: {
                submitted_length_cm: Number(process.env.TCG_DEFAULT_LENGTH_CM ?? 22),
                submitted_width_cm: Number(process.env.TCG_DEFAULT_WIDTH_CM ?? 11),
                submitted_height_cm: Number(process.env.TCG_DEFAULT_HEIGHT_CM ?? 6),
                submitted_weight_kg: Number(process.env.TCG_DEFAULT_WEIGHT_KG ?? 0.5),
                parcel_description: 'Printer consumables',
              },
              rateIsTaxInclusive: process.env.TCG_RATE_TAX_INCLUSIVE !== 'false',
              trackingUrlTemplate:
                process.env.TCG_TRACKING_URL_TEMPLATE ??
                'https://www.thecourierguy.co.za/track?ref={ref}',
            },
          },
        ],
      },
    },
    ...(r2Configured ? [fileModule] : []),
  ],
  admin: {
    disable: process.env.DISABLE_MEDUSA_ADMIN === 'true',
    backendUrl:
      process.env.MEDUSA_BACKEND_URL ?? 'http://localhost:9000',
  },
})
