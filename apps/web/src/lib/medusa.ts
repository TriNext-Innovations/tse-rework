import Medusa from '@medusajs/js-sdk'

export const medusa = new Medusa({
  baseUrl:
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? 'http://localhost:9000',
  auth: {
    type: 'session',
  },
})
