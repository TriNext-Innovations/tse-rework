import { NextResponse } from 'next/server'
import { fetchAllProducts } from '@/lib/woocommerce'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

export async function POST() {
  try {
    const result = await fetchAllProducts()

    const outputDir = join(process.cwd(), '..', '..', 'migration', 'raw')
    await mkdir(outputDir, { recursive: true })
    await writeFile(join(outputDir, 'products-without_sku.json'), JSON.stringify(result, null, 2), 'utf-8')

    return NextResponse.json({
      success: true,
      total: result.total,
      missingSkuCount: result.missingSkuCount,
      savedTo: 'migration/raw/products-without_sku.json',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
