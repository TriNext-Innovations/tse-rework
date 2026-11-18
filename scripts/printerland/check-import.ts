/**
 * Safety checks on a match.ts import CSV before it goes near prod (#482).
 *
 *   npx tsx scripts/printerland/check-import.ts [migration/raw/printerland/<date>-import.csv]
 *
 * Reads the CSV and .cache/printerland/catalog.tsv (the same prod export
 * match.ts used) and checks that the import only adds, and adds sense:
 *   - no row renames an existing model (CSV name ≠ our name for that slug)
 *   - no row claims a new model whose slug we already have, or an existing
 *     model whose slug we don't
 *   - no pair we already have, no duplicate pair, no unknown SKU or brand
 *   - no printer-type clash: a laser cartridge on a model whose cartridges
 *     are all inkjet (or the reverse), or a new model given both kinds
 * Warns on near-duplicates: a new model with the same digit core and
 * agreeing letter prefix as one of ours or another new one, whatever the
 * suffix (so M653dn / M653x is listed for a person to judge). Prints a
 * sample of 20 rows. Exits 1 if any hard check fails.
 */

import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { modelTokens, parseCatalog, slugify, tokenFit, type Kind } from './match'

const ROOT = join(import.meta.dirname, '../..')
const SNAP_DIR = join(ROOT, 'migration/raw/printerland')
const CATALOG = join(ROOT, '.cache/printerland/catalog.tsv')

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"' && q && line[i + 1] === '"') (cur += '"'), i++
    else if (ch === '"') q = !q
    else if (ch === ',' && !q) out.push(cur), (cur = '')
    else cur += ch
  }
  out.push(cur)
  return out.map((f) => f.trim())
}

/** Same digit core and agreeing prefix in any model token, suffix aside. */
const nearDuplicate = (a: string, b: string) => modelTokens(a).some((x) => modelTokens(b).some((y) => tokenFit(x, y, true) !== null))

export function checkImport(csvText: string, catalogText: string) {
  const { variants, models, compat, modelKinds } = parseCatalog(catalogText)
  const skus = new Set(variants.map((v) => v.sku))
  const kindOf = new Map(variants.map((v) => [v.sku, v.kind]))
  const brands = new Set(models.map((m) => slugify(m.brand)))
  const modelBySlug = new Map(models.map((m) => [`${slugify(m.brand)}|${m.slug}`, m.name]))
  const slugByName = new Map(models.map((m) => [`${slugify(m.brand)}|${m.name}`, m.slug]))
  const pairs = new Set(compat.map((c) => `${slugify(c.brand)}|${slugByName.get(`${slugify(c.brand)}|${c.model}`)}|${c.sku}`))
  const kindsOf = (brand: string, name: string) => modelKinds.get(`${brand.toUpperCase().replace(/[^A-Z0-9]/g, '')}|${name}`) ?? new Set<Kind>()

  const lines = csvText.split('\n').filter(Boolean)
  const header = lines.shift()
  const fail: Record<string, string[]> = {
    'bad header': header === 'sku,brand,model_slug,model_name,new_model' ? [] : [header ?? '(empty)'],
    'renames an existing model': [],
    'new model whose slug already exists': [],
    'existing model that is not in our catalogue': [],
    'pair already in cartridge_compat': [],
    'duplicate pair in the CSV': [],
    'SKU not in our catalogue': [],
    'brand not in our catalogue': [],
    'printer type clash (laser vs inkjet)': [],
  }
  const seen = new Set<string>()
  const newModels = new Map<string, { brand: string; name: string; kinds: Set<Kind> }>()
  const rows = lines.map(parseCsvLine)

  for (const [sku, brand, slug, name, isNew] of rows as string[][]) {
    const b = slugify(brand!)
    const id = `${b}|${slug}`
    const ours = modelBySlug.get(id)
    const k = kindOf.get(sku!)
    if (!brands.has(b)) fail['brand not in our catalogue']!.push(`${sku} → ${brand}`)
    if (!skus.has(sku!)) fail['SKU not in our catalogue']!.push(sku!)
    if (isNew === 'true') {
      if (ours !== undefined) fail['new model whose slug already exists']!.push(`${brand} ${name} (ours: ${ours})`)
      else {
        const m = newModels.get(id) ?? newModels.set(id, { brand: brand!, name: name!, kinds: new Set() }).get(id)!
        if (k) m.kinds.add(k)
      }
    } else if (ours === undefined) fail['existing model that is not in our catalogue']!.push(`${brand} ${name} (${slug})`)
    else {
      if (ours !== name) fail['renames an existing model']!.push(`${brand} ${slug}: "${ours}" → "${name}"`)
      const kinds = kindsOf(brand!, ours)
      if (k && kinds.size && !kinds.has(k)) fail['printer type clash (laser vs inkjet)']!.push(`${sku} (${k}) → ${brand} ${name} (${[...kinds].join('/')})`)
    }
    if (pairs.has(`${id}|${sku}`)) fail['pair already in cartridge_compat']!.push(`${sku} ↔ ${brand} ${name}`)
    if (seen.has(`${id}|${sku}`)) fail['duplicate pair in the CSV']!.push(`${sku} ↔ ${brand} ${name}`)
    seen.add(`${id}|${sku}`)
  }
  for (const m of newModels.values())
    if (m.kinds.size > 1) fail['printer type clash (laser vs inkjet)']!.push(`new ${m.brand} ${m.name} gets laser and inkjet cartridges`)

  const nearDup: string[] = []
  const fresh = [...newModels.values()]
  for (const [i, m] of fresh.entries()) {
    for (const o of models) if (slugify(o.brand) === slugify(m.brand) && nearDuplicate(m.name, o.name)) nearDup.push(`${m.brand} "${m.name}" ~ ours "${o.name}"`)
    for (const o of fresh.slice(i + 1)) if (slugify(o.brand) === slugify(m.brand) && nearDuplicate(m.name, o.name)) nearDup.push(`${m.brand} "${m.name}" ~ new "${o.name}"`)
  }
  return { rows, newModels: newModels.size, attach: rows.filter((r) => r[4] === 'false').length, fail, nearDup }
}

function main() {
  const csvPath = process.argv[2] ?? join(SNAP_DIR, readdirSync(SNAP_DIR).filter((f) => f.endsWith('-import.csv')).sort().pop()!)
  const { rows, newModels, attach, fail, nearDup } = checkImport(readFileSync(csvPath, 'utf8'), readFileSync(CATALOG, 'utf8'))

  console.log(`CSV: ${csvPath.replace(`${ROOT}/`, '')}`)
  console.log(`Rows (new compat pairs): ${rows.length} — ${attach} on existing models, ${rows.length - attach} on new models`)
  console.log(`New printer models: ${newModels} (created validated=false)`)
  console.log(`SKUs touched: ${new Set(rows.map((r) => r[0])).size}`)
  let bad = 0
  for (const [check, hits] of Object.entries(fail)) {
    bad += hits.length
    console.log(`${hits.length ? 'FAIL' : 'ok  '} ${check}: ${hits.length}`)
    for (const h of hits.slice(0, 10)) console.log(`       ${h}`)
  }
  console.log(`warn near-duplicate new models (same digit core and prefix, any suffix): ${nearDup.length}`)
  for (const d of nearDup) console.log(`       ${d}`)

  const step = Math.max(1, Math.floor(rows.length / 20))
  console.log(`\nSample (every ${step}th row):`)
  console.log('sku,brand,model_slug,model_name,new_model')
  for (let i = 0; i < rows.length && i / step < 20; i += step) console.log(rows[i]!.join(','))

  process.exit(bad ? 1 : 0)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
