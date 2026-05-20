#!/usr/bin/env node
/**
 * Exports all WooCommerce orders to migration/raw/orders.json
 *
 * POPIA: written client confirmation received 2026-05-15.
 * Output file is in .gitignore — NEVER commit orders.json.
 * Data must stay on SA infrastructure (Vultr JHB) at all times.
 *
 * NOTE: The store uses guest checkout. All customer PII (name, email,
 * address) lives in order billing fields — not in the /customers endpoint.
 * This export serves as both the order history and the customer data source.
 *
 * Usage:
 *   WC_KEY=ck_xxx WC_SECRET=cs_xxx node migration/export-orders.js
 */

const fs   = require('fs')
const path = require('path')
const https = require('https')

const BASE_URL  = 'https://www.tse.co.za/wp-json/wc/v3/orders'
const KEY       = process.env.WC_KEY
const SECRET    = process.env.WC_SECRET
const PER_PAGE  = 100
const OUT_FILE  = path.join(__dirname, 'raw', 'orders.json')

if (!KEY || !SECRET) {
  console.error('Error: WC_KEY and WC_SECRET environment variables are required.')
  process.exit(1)
}

function get(url) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${KEY}:${SECRET}`).toString('base64')
    https.get(url, { headers: { Authorization: `Basic ${auth}` } }, res => {
      let body = ''
      res.on('data', chunk => body += chunk)
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`))
          return
        }
        resolve({ data: JSON.parse(body), headers: res.headers })
      })
    }).on('error', reject)
  })
}

async function exportOrders() {
  const allOrders = []
  let page = 1
  let totalPages = null
  let totalOrders = null

  console.log('Exporting orders from tse.co.za...')

  while (true) {
    const url = `${BASE_URL}?per_page=${PER_PAGE}&page=${page}&orderby=date&order=asc`
    process.stdout.write(`  Page ${page}${totalPages ? `/${totalPages}` : ''}... `)

    const { data, headers } = await get(url)

    if (totalPages === null) {
      totalPages  = parseInt(headers['x-wp-totalpages'] || '1', 10)
      totalOrders = parseInt(headers['x-wp-total'] || '0', 10)
      console.log(`(${totalOrders} orders total, ${totalPages} pages)`)
    } else {
      process.stdout.write('\n')
    }

    allOrders.push(...data)
    console.log(`  ✓ ${data.length} fetched (running total: ${allOrders.length})`)

    if (page >= totalPages || data.length === 0) break
    page++
    await new Promise(r => setTimeout(r, 300))
  }

  // Derive unique customers from billing data
  const customerMap = {}
  for (const order of allOrders) {
    const email = order.billing?.email?.toLowerCase()
    if (!email) continue
    if (!customerMap[email]) {
      customerMap[email] = {
        email,
        first_name:  order.billing.first_name,
        last_name:   order.billing.last_name,
        phone:       order.billing.phone,
        company:     order.billing.company,
        address:     order.billing,
        first_order: order.date_created,
        last_order:  order.date_created,
        order_count: 0,
        total_spent: 0,
      }
    }
    customerMap[email].last_order  = order.date_created
    customerMap[email].order_count++
    customerMap[email].total_spent += parseFloat(order.total || 0)
  }

  const uniqueCustomers = Object.values(customerMap)
    .sort((a, b) => b.order_count - a.order_count)

  const output = {
    exported:         new Date().toISOString(),
    popia_consent:    'Written confirmation received from TSE Online 2026-05-15',
    total_orders:     allOrders.length,
    unique_customers: uniqueCustomers.length,
    note:             'Store uses guest checkout — customer PII is derived from order billing fields',
    customers:        uniqueCustomers,
    orders:           allOrders,
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2))

  console.log()
  console.log(`✓ ${allOrders.length} orders exported`)
  console.log(`✓ ${uniqueCustomers.length} unique customers derived from billing data`)
  console.log(`→ migration/raw/orders.json`)
  console.log()
  console.log('⚠  POPIA reminder: this file is in .gitignore — never commit it.')
  console.log('   Keep on SA infrastructure only (Vultr JHB).')
}

exportOrders().catch(err => {
  console.error('Export failed:', err.message)
  process.exit(1)
})
