import { NextRequest, NextResponse } from 'next/server'
import { fetchProductPage, fetchAllProducts } from '@/lib/woocommerce'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const all = searchParams.get('all') === 'true'

  try {
    if (all) {
      const result = await fetchAllProducts()
      return NextResponse.json(result)
    }

    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const perPage = parseInt(searchParams.get('per_page') ?? '100', 10)
    const result = await fetchProductPage(page, perPage)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
