import http from 'http'
import type { IncomingMessage, ServerResponse } from 'http'

const mockProduct = {
  id: 'prod_01',
  title: 'HP 123 Black Inkjet',
  handle: 'hp-123-black',
  variants: [{ sku: 'HP-123-BK', calculated_price: { calculated_amount: 39900 } }],
  categories: [{ name: 'HP' }],
  images: [],
  metadata: { cartridge_type: 'inkjet' },
}

const mockCategory = { id: 'cat_hp', name: 'HP', handle: 'hp', parent_category: null }

function handler(req: IncomingMessage, res: ServerResponse) {
  const url = req.url ?? ''
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  if (url.includes('/store/regions')) {
    res.end(JSON.stringify({ regions: [{ id: 'reg_01', name: 'South Africa', currency_code: 'zar' }] }))
  } else if (url.includes('/store/product-categories')) {
    res.end(JSON.stringify({ product_categories: [mockCategory] }))
  } else if (url.includes('/store/products')) {
    res.end(JSON.stringify({ products: [mockProduct], count: 1 }))
  } else if (url.includes('/health')) {
    res.end(JSON.stringify({ status: 'ok' }))
  } else {
    res.writeHead(404)
    res.end(JSON.stringify({ error: 'not found' }))
  }
}

let server: http.Server

export default async function globalSetup() {
  server = http.createServer(handler)
  await new Promise<void>((resolve) => server.listen(9001, resolve))
  console.log('Mock Medusa API running on :9001')

  return async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
}
