import { defineConfig, loadEnv } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV ?? 'development', process.cwd())

export default defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS ?? 'http://localhost:3000',
      adminCors: process.env.ADMIN_CORS ?? 'http://localhost:7001',
      authCors:
        process.env.AUTH_CORS ??
        'http://localhost:7001,http://localhost:3000',
      jwtSecret: process.env.JWT_SECRET ?? 'supersecret',
      cookieSecret: process.env.COOKIE_SECRET ?? 'supersecret',
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
    {
      resolve: '@medusajs/medusa/fulfillment',
      options: {
        providers: [
          // Keep the manual provider for the JHB/PTA own-delivery (COD) option.
          { resolve: '@medusajs/fulfillment-manual', id: 'manual' },
          // The Courier Guy (ShipLogic) — live rates + waybill creation.
          {
            resolve: './src/modules/shiplogic',
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
    {
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
    },
  ],
  admin: {
    disable: process.env.DISABLE_MEDUSA_ADMIN === 'true',
    backendUrl:
      process.env.MEDUSA_BACKEND_URL ?? 'http://localhost:9000',
  },
})
