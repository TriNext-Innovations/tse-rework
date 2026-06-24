import { Module } from "@medusajs/framework/utils"
import CompatibilityModuleService from "./service"

export const COMPATIBILITY_MODULE = "compatibility"

export default Module(COMPATIBILITY_MODULE, {
  service: CompatibilityModuleService,
})
