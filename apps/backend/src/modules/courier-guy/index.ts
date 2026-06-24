import { Module } from '@medusajs/framework/utils'
import CourierGuyFulfillmentService from './service'

export const COURIER_GUY_MODULE = 'courier-guy'

export default Module(COURIER_GUY_MODULE, {
  service: CourierGuyFulfillmentService,
})
