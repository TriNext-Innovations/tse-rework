import { MedusaService } from "@medusajs/framework/utils"
import { PrinterBrand, PrinterModel, CartridgeCompat } from "./models"

class CompatibilityModuleService extends MedusaService({
  PrinterBrand,
  PrinterModel,
  CartridgeCompat,
}) {
  // Find all SKUs compatible with printers matching the query string.
  // Uses $ilike for case-insensitive partial match on model name.
  async findByModel(query: string): Promise<Array<{
    sku: string
    brand: string
    model: string
  }>> {
    if (!query || query.trim().length < 2) return []

    const q = query.trim()

    const models = await this.listPrinterModels(
      { name: { $ilike: `%${q}%` } } as any,
      { select: ["id", "name"], take: 50 }
    )

    if (!models.length) {
      // Fall back to brand-level search
      const brands = await this.listPrinterBrands(
        { name: { $ilike: `%${q}%` } } as any,
        { select: ["id", "name"] }
      )
      if ((brands as any).length) {
        // Return all models for matching brands
        const brandModels = await this.listPrinterModels(
          { brand_id: { $in: (brands as any).map((b: any) => b.id) } } as any,
          { select: ["id", "name"], take: 50 }
        )
        return this._compatForModels(brandModels as any, brands as any)
      }
      return []
    }

    const brandIds = [...new Set((models as any).map((m: any) => m.brand_id))]
    const brands = await this.listPrinterBrands(
      { id: { $in: brandIds } } as any,
      { select: ["id", "name"] }
    )
    return this._compatForModels(models as any, brands as any)
  }

  // Find all printer models compatible with a given cartridge SKU.
  async findBySku(sku: string): Promise<Array<{
    brand: string
    model: string
    printer_model_id: string
  }>> {
    if (!sku) return []

    const compats = await this.listCartridgeCompats(
      { sku } as any,
      { select: ["printer_model_id"], take: 100 }
    )

    if (!(compats as any).length) return []

    const modelIds = [...new Set((compats as any).map((c: any) => c.printer_model_id))]
    const models = await this.listPrinterModels(
      { id: { $in: modelIds } } as any,
      { select: ["id", "name", "brand_id"], take: 100 }
    )

    const brandIds = [...new Set((models as any).map((m: any) => m.brand_id))]
    const brands = await this.listPrinterBrands(
      { id: { $in: brandIds } } as any,
      { select: ["id", "name"] }
    )
    const brandMap = new Map((brands as any).map((b: any) => [b.id, b.name]))

    return (models as any).map((m: any) => ({
      brand: brandMap.get(m.brand_id) ?? "",
      model: m.name,
      printer_model_id: m.id,
    }))
  }

  // Shared: get all compat SKUs for a set of models and join with brands.
  private async _compatForModels(
    models: Array<{ id: string; name: string; brand_id?: string }>,
    brands: Array<{ id: string; name: string }>
  ) {
    const modelIds = models.map((m) => m.id)
    const compats = await this.listCartridgeCompats(
      { printer_model_id: { $in: modelIds } } as any,
      { select: ["sku", "printer_model_id"], take: 500 }
    )

    const brandMap = new Map(brands.map((b) => [b.id, b.name]))
    const modelMap = new Map(models.map((m) => [m.id, m]))

    return (compats as any).map((cc: any) => {
      const m = modelMap.get(cc.printer_model_id)
      return {
        sku: cc.sku,
        brand: brandMap.get(m?.brand_id ?? "") ?? "",
        model: m?.name ?? "",
      }
    })
  }
}

export default CompatibilityModuleService
