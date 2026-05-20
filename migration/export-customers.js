#!/usr/bin/env node
/**
 * Exports all WooCommerce customers to migration/raw/customers.json
 *
 * POPIA: written client confirmation received 2026-05-15.
 * Output file is in .gitignore — NEVER commit customers.json.
 * Data must stay on SA infrastructure (Vultr JHB) at all times.
 *
 * Usage:
 *   WC_KEY=ck_xxx WC_SECRET=cs_xxx node migration/export-customers.js
 *
 * Credentials: wp-admin → WooCommerce → Settings → Advanced → REST API
 */

const fs   = require('fs')
const path = require('path')
const https = require('https')

const BASE_URL   = 'https://www.tse.co.za/wp-json/wc/v3/customers?role=all'
const KEY        = process.env.WC_KEY
const SECRET     = process.env.WC_SECRET
const PER_PAGE   = 100
const OUT_FILE   = path.join(__dirname, 'raw', 'customers.json')

if (!KEY || !SECRET) {
  console.error('Error: WC_KEY and WC_SECRET environment variables are required.')
  console.error('  WC_KEY=ck_xxx WC_SECRET=cs_xxx node migration/export-customers.js')
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
          reject(new Error(`HTTP ${res.statusCode}: ${body}`))
          return
        }
        try {
          resolve({ data: JSON.parse(body), headers: res.headers })
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}`))
        }
      })
    }).on('error', reject)
  })
}

async function exportCustomers() {
  const allCustomers = []
  let page = 1
  let totalPages = null

  console.log('Exporting customers from tse.co.za...')

  while (true) {
    const url = `${BASE_URL}&per_page=${PER_PAGE}&page=${page}&orderby=registered_date&order=asc`
    process.stdout.write(`  Page ${page}${totalPages ? `/${totalPages}` : ''}... `)

    const { data, headers } = await get(url)

    if (totalPages === null) {
      totalPages = parseInt(headers['x-wp-totalpages'] || '1', 10)
      const total  = parseInt(headers['x-wp-total'] || '0', 10)
      console.log(`(${total} customers total, ${totalPages} pages)`)
    }

    allCustomers.push(...data)
    console.log(`  ✓ ${data.length} customers fetched (running total: ${allCustomers.length})`)

    if (page >= totalPages || data.length === 0) break
    page++

    // Polite delay between pages
    await new Promise(r => setTimeout(r, 300))
  }

  // Strip fields not needed for migration to reduce file size
  const cleaned = allCustomers.map(c => ({
    id:               c.id,
    email:            c.email,
    first_name:       c.first_name,
    last_name:        c.last_name,
    username:         c.username,
    role:             c.role,
    date_created:     c.date_created,
    date_modified:    c.date_modified,
    last_order_date:  c.last_order_date,
    orders_count:     c.orders_count,
    total_spent:      c.total_spent,
    billing:          c.billing,
    shipping:         c.shipping,
    is_paying_customer: c.is_paying_customer,
  }))

  const output = {
    exported:        new Date().toISOString(),
    popia_consent:   'Written confirmation received from TSE Online 2026-05-15',
    total_customers: cleaned.length,
    customers:       cleaned,
  }

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2))

  console.log()
  console.log(`✓ Exported ${cleaned.length} customers → migration/raw/customers.json`)
  console.log()
  console.log('⚠  POPIA reminder: this file is in .gitignore — never commit it.')
  console.log('   Keep on SA infrastructure only (Vultr JHB).')
}

exportCustomers().catch(err => {
  console.error('Export failed:', err.message)
  process.exit(1)
})
