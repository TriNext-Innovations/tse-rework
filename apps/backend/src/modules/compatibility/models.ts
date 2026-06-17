import { model } from "@medusajs/framework/utils"

// All three models in one file — avoids circular imports from hasMany ↔ belongsTo

export const PrinterBrand = model.define("printer_brand", {
  id: model.id().primaryKey(),
  name: model.text(),
  slug: model.text(),
  printer_models: model.hasMany(() => PrinterModel, { mappedBy: "brand" }),
})

export const PrinterModel = model.define("printer_model", {
  id: model.id().primaryKey(),
  name: model.text(),
  slug: model.text(),
  validated: model.boolean().default(false),
  brand: model.belongsTo(() => PrinterBrand, { mappedBy: "printer_models" }),
  compatibilities: model.hasMany(() => CartridgeCompat, { mappedBy: "printer_model" }),
})

export const CartridgeCompat = model.define("cartridge_compat", {
  id: model.id().primaryKey(),
  sku: model.text(),
  source: model.text().default("parsed"),
  printer_model: model.belongsTo(() => PrinterModel, { mappedBy: "compatibilities" }),
})
