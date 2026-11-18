/**
 * Safety checks on a match.ts import CSV before it goes near prod (#482).
 *
 *   npx tsx scripts/printerland/check-import.ts [migration/raw/printerland/<date>-import.csv]
 *
 * Reads the CSV and .cache/printerland/catalog.tsv (the same prod export
 * match.ts used) and checks that the import only adds:
 *   - no row renames an existing model (CSV name ≠ our name for that slug)
 *   - no row claims a new model whose slug we already have, or an existing
 *     model whose slug we don't
 *   - no pair we already have, no duplicate pair, no unknown SKU or brand
 * Also warns on new models that share a model number with one of ours (likely
 * the same printer under another name), and prints a sample of 20 rows.
 * Exits 1 if any hard check fails.
 */

import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { slugify } from './match'

const ROOT = join(import.meta.dirname, '../..')
const SNAP_DIR = join(ROOT, 'migration/raw/printerland')
const CATALOG = join(ROOT, '.cache/printerland/catalog.tsv')

const key = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

function parseCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"' && q && line[i + 1] === '"') ((cur += '"'), i++)
    else if (ch === '"') q = !q
    else if (ch === ',' && !q) (out.push(cur), (cur = ''))
    else cur += ch
  }
  out.push(cur)
  return out.map((f) => f.trim())
}

function main() {
  const csvPath =
    process.argv[2] ??
    join(
      SNAP_DIR,
      readdirSync(SNAP_DIR)
        .filter((f) => f.endsWith('-import.csv'))
        .sort()
        .pop()!,
    )

  const sections: Record<string, string[][]> = {}
  let cur = ''
  for (const line of readFileSync(CATALOG, 'utf8').split('\n')) {
    if (line.startsWith('##')) cur = line.slice(2)
    else if (line.trim()) (sections[cur] ??= []).push(line.split('\t'))
  }
  const skus = new Set((sections.VARIANTS ?? []).map((r) => r[0]!))
  const brands = new Set((sections.MODELS ?? []).map((r) => slugify(r[0]!)))
  const modelBySlug = new Map((sections.MODELS ?? []).map(([b, name, slug]) => [`${slugify(b!)}|${slug}`, name!]))
  const slugByName = new Map((sections.MODELS ?? []).map(([b, name, slug]) => [`${slugify(b!)}|${name}`, slug!]))
  // Near-duplicates: a new model whose model number (a token with a digit) is
  // also one of ours, e.g. new "i-SENSYS LBP611C" next to our "LBP611C".
  const tokens = (name: string) =>
    name
      .split(/[\s/]+/)
      .map(key)
      .filter((t) => /\d/.test(t))
  const modelByToken = new Map<string, string>()
  for (const [b, name] of sections.MODELS ?? []) for (const t of tokens(name!)) modelByToken.set(`${slugify(b!)}|${t}`, name!)
  const pairs = new Set(
    (sections.COMPAT ?? []).map(([b, model, sku]) => `${slugify(b!)}|${slugByName.get(`${slugify(b!)}|${model}`)}|${sku}`),
  )

  const lines = readFileSync(csvPath, 'utf8').split('\n').filter(Boolean)
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
  }
  const nearDup: string[] = []
  const seen = new Set<string>()
  const newModels = new Set<string>()
  const rows = lines.map(parseCsvLine)

  for (const [sku, brand, slug, name, isNew] of rows as string[][]) {
    const b = slugify(brand!)
    const id = `${b}|${slug}`
    const ours = modelBySlug.get(id)
    if (!brands.has(b)) fail['brand not in our catalogue']!.push(`${sku} → ${brand}`)
    if (!skus.has(sku!)) fail['SKU not in our catalogue']!.push(sku!)
    if (isNew === 'true') {
      if (ours !== undefined) fail['new model whose slug already exists']!.push(`${brand} ${name} (ours: ${ours})`)
      else {
        newModels.add(id)
        // Same number, or one is the other plus letters only (LBP611 / LBP611C).
        const twin = tokens(name!)
          .flatMap((t) => [t, t.replace(/[A-Z]+$/, '')])
          .map(
            (t) =>
              modelByToken.get(`${b}|${t}`) ??
              [...modelByToken].find(
                ([k]) => k.startsWith(`${b}|${t}`) && /^[A-Z]+$/.test(k.slice(b.length + 1 + t.length)),
              )?.[1],
          )
          .find(Boolean)
        if (twin && !nearDup.some((d) => d.startsWith(`${brand} "${name}"`))) nearDup.push(`${brand} "${name}" ~ ours "${twin}"`)
      }
    } else {
      if (ours === undefined) fail['existing model that is not in our catalogue']!.push(`${brand} ${name} (${slug})`)
      else if (ours !== name) fail['renames an existing model']!.push(`${brand} ${slug}: "${ours}" → "${name}"`)
    }
    if (pairs.has(`${id}|${sku}`)) fail['pair already in cartridge_compat']!.push(`${sku} ↔ ${brand} ${name}`)
    if (seen.has(`${id}|${sku}`)) fail['duplicate pair in the CSV']!.push(`${sku} ↔ ${brand} ${name}`)
    seen.add(`${id}|${sku}`)
  }

  const attach = rows.filter((r) => r[4] === 'false').length
  console.log(`CSV: ${csvPath.replace(`${ROOT}/`, '')}`)
  console.log(`Rows (new compat pairs): ${rows.length} — ${attach} on existing models, ${rows.length - attach} on new models`)
  console.log(`New printer models: ${newModels.size} (created validated=false)`)
  console.log(`SKUs touched: ${new Set(rows.map((r) => r[0])).size}`)
  let bad = 0
  for (const [check, hits] of Object.entries(fail)) {
    bad += hits.length
    console.log(`${hits.length ? 'FAIL' : 'ok  '} ${check}: ${hits.length}`)
    for (const h of hits.slice(0, 10)) console.log(`       ${h}`)
  }
  console.log(`warn near-duplicate new models (same model number as one of ours, give or take suffix letters): ${nearDup.length}`)
  for (const d of nearDup) console.log(`       ${d}`)

  const step = Math.max(1, Math.floor(rows.length / 20))
  console.log('\nSample (every %dth row):', step)
  console.log('sku,brand,model_slug,model_name,new_model')
  for (let i = 0; i < rows.length && i / step < 20; i += step) console.log(rows[i]!.join(','))

  process.exit(bad ? 1 : 0)
}

main()
