/**
 * Printerland snapshot → TSE import CSV + client review report (#482).
 *
 *   npx tsx scripts/printerland/match.ts [migration/raw/printerland/<date>.json]
 *
 * Needs .cache/printerland/catalog.tsv (export: see catalog.sql). Writes, next
 * to the snapshot:
 *   <date>-import.csv  sku,brand,model_slug,model_name,new_model — one row
 *                      per new pair, loaded by prod/compat-printerland-import.cjs
 *   <date>-review.md   for the client: new printers per cartridge, TSE
 *                      cartridges Printerland has nothing for, and printers
 *                      we list that Printerland doesn't
 *
 * Rules (from the issue):
 *   - Only adds. A pair already in cartridge_compat is skipped, and nothing
 *     existing is changed or removed.
 *   - Printerland lists printer *series* ("M1130"), we list exact models
 *     ("M1132"). A series attaches to every existing model of that series; a
 *     series we have no model for becomes a new model, which the importer
 *     creates with validated=false so a person checks it before it is trusted.
 *   - Printerland sells genuine cartridges only. A printer we list that they
 *     don't is reported, never removed: generics often fit more printers.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(import.meta.dirname, '../..')
const SNAP_DIR = join(ROOT, 'migration/raw/printerland')
const CATALOG = join(ROOT, '.cache/printerland/catalog.tsv')

export type PlCartridge = { mpn: string; brand: string; title: string; families: string[]; url: string }
export type Variant = { sku: string; title: string; brand: string }
export type Model = { brand: string; name: string; slug: string }

// ─── Codes and colours ──────────────────────────────────────────────────────

const COLOURS: Record<string, string[]> = {
  K: ['black'],
  C: ['cyan'],
  M: ['magenta'],
  Y: ['yellow'],
  CLR: ['tri-colour', 'tri-color', 'tricolour', 'tricolor', 'colour', 'color', 'cmy'],
}

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

/** HP-CE250A-K → { code: CE250A, colour: K }; HP-CE285A → { code: CE285A }. */
export function splitSku(sku: string): { code: string; colour?: string } {
  const parts = sku.split('-').slice(1)
  const last = parts[parts.length - 1] ?? ''
  if (parts.length > 1 && COLOURS[last]) return { code: norm(parts.slice(0, -1).join('')), colour: last }
  return { code: norm(parts.join('')) }
}

/** Printerland's part numbers carry a CN + brand prefix: CNHPCE285A → CE285A. */
export function mpnCore(mpn: string): string {
  const m = norm(mpn)
  return /^CN[A-Z]{2}/.test(m) ? m.slice(4) : m
}

/** The colour a Printerland title names, or undefined for mono/unspecified. */
export function titleColour(title: string): string | undefined {
  const t = title.toLowerCase()
  if (/photo\s*black|matte\s*black|light\s*(cyan|magenta)|grey|gray/.test(t)) return 'OTHER'
  if (/tri-?colou?r|\bcmy\b/.test(t)) return 'CLR'
  for (const c of ['K', 'C', 'M', 'Y'] as const) if (COLOURS[c]!.some((w) => new RegExp(`\\b${w}\\b`).test(t))) return c
  return undefined
}

/**
 * Does this Printerland cartridge correspond to this TSE variant? The TSE code
 * must be the cartridge's part number (optionally plus a colour letter, the
 * Brother/Canon habit: TN277C) or a whole token in its title (HP's 85A), and
 * the colours must not disagree.
 */
export function matches(pl: PlCartridge, v: Variant): boolean {
  if (norm(pl.brand) !== norm(v.brand)) return false
  const { code, colour } = splitSku(v.sku)
  if (code.length < 3) return false
  const core = mpnCore(pl.mpn)
  const tokens = new Set(pl.title.split(/[\s|/,()]+/).map(norm).filter(Boolean))
  const codeHit = core === code || (colour && core === code + colour[0]) || tokens.has(code)
  if (!codeHit) return false
  const plColour = titleColour(pl.title)
  if (plColour === 'OTHER') return false
  return !colour || !plColour || plColour === colour
}

// ─── Printer families ───────────────────────────────────────────────────────

const TRAILING =
  /\s+(multifunction|mono|colou?r|laser|inkjet|all-in-one|aio|wide format|photo|fax machine|fax|printer|printers|series|mfp|copier|scanner|label|dot matrix)$/i

/** "HP LaserJet Pro M1130 Multifunction Printer" → "LaserJet Pro M1130". */
export function familyName(brand: string, family: string): string {
  let s = family.trim()
  if (s.toLowerCase().startsWith(`${brand.toLowerCase()} `)) s = s.slice(brand.length + 1)
  let prev = ''
  while (prev !== s) {
    prev = s
    s = s.replace(TRAILING, '').trim()
  }
  return s
}

/** Tokens that look like model numbers: they contain a digit. */
const modelTokens = (name: string) => name.split(/[\s/]+/).map(norm).filter((t) => /\d/.test(t))

/**
 * Is TSE model `name` a member of Printerland series `family`? Same model token,
 * or the TSE token is the series token plus letters only (M1212 → M1212NF, not
 * M12 → M1212), or the series carries a letter prefix the TSE name dropped
 * (M1217 → 1217).
 */
export function inSeries(family: string, name: string): boolean {
  const fam = modelTokens(family)
  const ours = modelTokens(name)
  return fam.some((f) =>
    ours.some(
      (t) =>
        t === f ||
        (t.startsWith(f) && /^[A-Z]+$/.test(t.slice(f.length))) ||
        (/^\d+$/.test(t) && f.replace(/^[A-Z]+/, '') === t),
    ),
  )
}

// ─── Main ───────────────────────────────────────────────────────────────────

function readCatalog() {
  const sections: Record<string, string[][]> = {}
  let cur = ''
  for (const line of readFileSync(CATALOG, 'utf8').split('\n')) {
    if (line.startsWith('##')) cur = line.slice(2)
    else if (line.trim()) (sections[cur] ??= []).push(line.split('\t'))
  }
  const variants: Variant[] = (sections.VARIANTS ?? []).map(([sku, title, , , brand]) => ({ sku: sku!, title: title!, brand: brand! }))
  const models: Model[] = (sections.MODELS ?? []).map(([brand, name, slug]) => ({ brand: brand!, name: name!, slug: slug! }))
  const compat = (sections.COMPAT ?? []).map(([brand, model, sku, source]) => ({ brand: brand!, model: model!, sku: sku!, source: source! }))
  return { variants, models, compat }
}

export const slugify = (t: string) => t.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const csvCell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)

function main() {
  const snapPath =
    process.argv[2] ??
    join(SNAP_DIR, readdirSync(SNAP_DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().pop()!)
  if (!existsSync(CATALOG)) throw new Error(`No catalogue at ${CATALOG} — export it first (see catalog.sql)`)

  const snapshot = JSON.parse(readFileSync(snapPath, 'utf8')) as PlCartridge[]
  const { variants, models, compat } = readCatalog()
  const has = new Set(compat.map((c) => `${norm(c.brand)}|${norm(c.model)}|${c.sku}`))
  const ourModelsFor = (sku: string) => compat.filter((c) => c.sku === sku)
  const slugOf = new Map<string, string>()

  type Row = { sku: string; brand: string; existing: string[]; created: string[]; plTitles: string[]; plFamilies: string[] }
  const rows: Row[] = []
  const unmatched: Variant[] = []
  const ambiguous: string[] = []

  for (const v of variants) {
    const hits = snapshot.filter((p) => matches(p, v))
    if (!hits.length) {
      unmatched.push(v)
      continue
    }
    if (new Set(hits.map((h) => mpnCore(h.mpn))).size > 3) {
      ambiguous.push(`${v.sku} matched ${hits.length} Printerland items (${hits.map((h) => h.mpn).join(', ')}) — skipped`)
      continue
    }

    const families = [...new Set(hits.flatMap((h) => h.families.map((f) => familyName(v.brand, f))))]
    const existing = new Set<string>()
    const created = new Set<string>()
    for (const fam of families) {
      const members = models.filter((m) => norm(m.brand) === norm(v.brand) && inSeries(fam, m.name))
      if (members.length) for (const m of members) existing.add(m.name), slugOf.set(`${v.brand}|${m.name}`, m.slug)
      else if (modelTokens(fam).length) created.add(fam)
    }
    const add = (names: Set<string>) => [...names].filter((n) => !has.has(`${norm(v.brand)}|${norm(n)}|${v.sku}`))
    const row = {
      sku: v.sku,
      brand: v.brand,
      existing: add(existing).sort(),
      created: add(created).sort(),
      plTitles: [...new Set(hits.map((h) => h.title))],
      plFamilies: families,
    }
    rows.push(row)
  }

  // ── Import CSV: one row per new pair. Existing models carry their real slug,
  // so the importer attaches to them and never renames or recreates one.
  const importRows = rows.filter((r) => r.existing.length || r.created.length)
  const csv = [
    'sku,brand,model_slug,model_name,new_model',
    ...importRows.flatMap((r) => [
      ...r.existing.map((n) => [r.sku, r.brand, slugOf.get(`${r.brand}|${n}`)!, n, 'false']),
      ...r.created.map((n) => [r.sku, r.brand, slugify(n), n, 'true']),
    ]).map((cells) => cells.map(csvCell).join(',')),
  ].join('\n')
  const base = snapPath.replace(/\.json$/, '')
  writeFileSync(`${base}-import.csv`, `${csv}\n`)

  // ── Review report ─────────────────────────────────────────────────────────
  const newPairs = importRows.reduce((n, r) => n + r.existing.length + r.created.length, 0)
  const newModels = new Set(importRows.flatMap((r) => r.created.map((c) => `${r.brand} ${c}`)))
  const onlyOurs = rows
    .map((r) => {
      const theirs = ourModelsFor(r.sku).filter((c) => !r.plFamilies.some((f) => inSeries(f, c.model)))
      return { sku: r.sku, models: theirs.map((c) => c.model) }
    })
    .filter((r) => r.models.length)

  const md = [
    `# Printer compatibility check — ${base.split('/').pop()}`,
    '',
    `Source: a supplier site that lists genuine cartridges and the printers they fit. Every cartridge we stock was looked up there.`,
    '',
    `- **${variants.length}** cartridges in our store, **${rows.length}** found on the source, **${unmatched.length}** not found.`,
    `- **${newPairs}** new printer ↔ cartridge links to add, **${newModels.size}** of them printers we don't list yet.`,
    `- New printers go in **unconfirmed**: please check the list below before they show as confirmed matches.`,
    '',
    '## 1. New printers per cartridge',
    '',
    '| Cartridge | Printers we already list, now linked | New printers (please check) |',
    '|---|---|---|',
    ...importRows.map((r) => `| ${r.sku} | ${r.existing.join(', ') || '—'} | ${r.created.join(', ') || '—'} |`),
    '',
    '## 2. Printers we list that the source doesn’t',
    '',
    'Not removed. The source lists original cartridges only, and our compatibles often fit more printers. Worth a look where it seems wrong.',
    '',
    '| Cartridge | Printers only we list |',
    '|---|---|',
    ...onlyOurs.map((r) => `| ${r.sku} | ${r.models.join(', ')} |`),
    '',
    '## 3. Our cartridges the source has nothing for',
    '',
    unmatched.map((v) => `${v.sku} (${v.title})`).join(', ') || '—',
    '',
    ...(ambiguous.length ? ['## 4. Skipped — matched too many items to be sure', '', ...ambiguous.map((a) => `- ${a}`), ''] : []),
  ].join('\n')
  writeFileSync(`${base}-review.md`, md)

  console.log(`${variants.length} variants: ${rows.length} matched, ${unmatched.length} unmatched, ${ambiguous.length} ambiguous`)
  console.log(`${newPairs} new compat pairs (${newModels.size} new models) → ${base.replace(`${ROOT}/`, '')}-import.csv`)
  console.log(`Review → ${base.replace(`${ROOT}/`, '')}-review.md`)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
