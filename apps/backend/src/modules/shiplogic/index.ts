import { ModuleProvider, Modules } from '@medusajs/framework/utils'
import ShipLogicFulfillmentProviderService from './service'

export default ModuleProvider(Modules.FULFILLMENT, {
  services: [ShipLogicFulfillmentProviderService],
})
