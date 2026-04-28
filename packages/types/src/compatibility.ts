export type PrinterBrand =
  | 'HP'
  | 'Canon'
  | 'Epson'
  | 'Samsung'
  | 'Brother'
  | 'Lexmark'
  | 'Xerox'

export interface CompatibilityEntry {
  id: string
  brand: PrinterBrand
  model: string
  sku: string
  oem: boolean
  createdAt: string
}
