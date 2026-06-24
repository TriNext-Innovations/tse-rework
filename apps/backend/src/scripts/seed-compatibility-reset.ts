import { MedusaContainer } from "@medusajs/framework/types"
import seedCompatibility from "./seed-compatibility"

export default async function seedCompatibilityReset(ctx: { container: MedusaContainer }) {
  process.env.RESET_COMPAT = "true"
  return seedCompatibility(ctx)
}
