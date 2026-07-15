import { ModuleProvider, Modules } from '@medusajs/framework/utils'
import CourierGuyFulfillmentProviderService from './service'

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [CourierGuyFulfillmentProviderService],
})
