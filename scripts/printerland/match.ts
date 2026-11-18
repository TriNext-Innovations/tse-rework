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
export type Variant = { sku: string; title: string; brand: string; kind?: Kind }
export type Kind = 'laser' | 'inkjet'
export type Model = { brand: string; name: string; slug: string }

// ─── Codes and colours ──────────────────────────────────────────────────────

const COLOURS: Record<string, string[]> = {
  K: ['black'],
  C: ['cyan'],
  M: ['magenta'],
  Y: ['yellow'],
  CLR: ['tri-colour', 'tri-color', 'tricolour', 'tricolor', 'colour', 'color', 'cmy'],
}

// Tolerates a missing field: crawled pages don't always carry every itemprop.
const norm = (s: string | undefined) => (s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

const REQUIRED = ['mpn', 'brand', 'title', 'families'] as const

/**
 * Splits a snapshot into items the matcher can use and items missing a field
 * it needs. In the 27 Oct snapshot 9 Samsung pages had no itemprop="brand".
 * When the title names exactly one of `brands` as a whole word, that brand is
 * used ("… Samsung MLT-D116L …"); otherwise the item is reported, not guessed.
 */
export function usable(
  snapshot: PlCartridge[],
  brands: string[] = [],
): { ok: PlCartridge[]; incomplete: { item: PlCartridge; missing: string[] }[]; inferred: PlCartridge[] } {
  const ok: PlCartridge[] = []
  const incomplete: { item: PlCartridge; missing: string[] }[] = []
  const inferred: PlCartridge[] = []
  const present = (v: unknown) => typeof v === 'string' && v.trim() !== ''
  const escape = (b: string) => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  for (const raw of snapshot) {
    let item = raw
    if (!present(item.brand) && present(item.title)) {
      const named = [...new Set(brands.filter(present))].filter((b) => new RegExp(`\\b${escape(b)}\\b`, 'i').test(item.title))
      if (named.length === 1) {
        item = { ...item, brand: named[0]! }
        inferred.push(item)
      }
    }
    const missing = REQUIRED.filter((k) => (k === 'families' ? !Array.isArray(item.families) : !present(item[k])))
    if (missing.length) incomplete.push({ item, missing })
    else ok.push(item)
  }
  return { ok, incomplete, inferred }
}

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
  if (!norm(pl.brand) || norm(pl.brand) !== norm(v.brand)) return false
  const { code, colour } = splitSku(v.sku)
  if (code.length < 3) return false
  const core = mpnCore(pl.mpn)
  const tokens = new Set((pl.title ?? '').split(/[\s|/,()]+/).map(norm).filter(Boolean))
  const codeHit = core === code || (colour && core === code + colour[0]) || tokens.has(code)
  if (!codeHit) return false
  const plColour = titleColour(pl.title ?? '')
  if (plColour === 'OTHER') return false
  return !colour || !plColour || plColour === colour
}

// ─── Printer families ───────────────────────────────────────────────────────

const TRAILING =
  /\s+(multifunction|mono|colou?r|laser|inkjet|all[- ]in[- ]one|aio|wide format|photo|fax machines?|fax|printer|printers|series|mfp|copier|scanner|label|dot matrix|ink|a[34](\/a[34])?|\d-in-1|consumables|toner|toner cartri\w*|cartri\w*|single function)$/i

/**
 * "HP LaserJet Pro M1130 Multifunction Printer" → "LaserJet Pro M1130". A
 * Brother fax family keeps its clue: "Brother 2840 Fax Machine" → "FAX-2840".
 */
export function familyName(brand: string, family: string): string {
  let s = family.trim()
  if (s.toLowerCase().startsWith(`${brand.toLowerCase()} `)) s = s.slice(brand.length + 1)
  let prev = ''
  while (prev !== s) {
    prev = s
    s = s.replace(TRAILING, '').trim()
  }
  if (norm(brand) === 'BROTHER' && /\bfax\b/i.test(family) && /^\d+$/.test(s)) s = `FAX-${s}`
  return s
}

/** New names follow our catalogue's spelling: "Colour LaserJet", "i-SENSYS". */
export function houseName(brand: string, name: string): string {
  if (norm(brand) === 'HP') return name.replace(/\bcolou?r\s+laserjet\b/i, 'Colour LaserJet').replace(/\blaserjet\b/i, 'LaserJet')
  if (norm(brand) === 'CANON') return name.replace(/\bi-?sensys\b/i, 'i-SENSYS')
  return name
}

/**
 * A series wildcard, not a printer: "LBP61x", "MF63x" (one or two digits then
 * x). Real models with an x suffix have more digits (MF428x, M555x).
 */
export const isWildcard = (family: string) => /(^|\s)[A-Z-]*\d{1,2}x$/i.test(family.trim())

/** Words that say nothing about which printer line this is. */
const GENERIC = new Set(['PRO', 'MFP', 'SERIES', 'COLOR', 'COLOUR', 'ENTERPRISE', 'MONO', 'PLUS', 'ALL', 'IN', 'ONE', 'FLOW', 'A'])

/**
 * Tokens that look like model numbers: they contain a digit. A short letter
 * word right before one is its prefix written apart: "LBP 3010" → LBP3010
 * (so it is not our MF3010), "MG 5740" → MG5740.
 */
export const modelTokens = (name: string) => {
  const words = name.split(/[\s/]+/).map(norm).filter(Boolean)
  return words.flatMap((w, i) => {
    if (!/\d/.test(w)) return []
    const prev = words[i - 1]
    return prev && /^[A-Z]{1,4}$/.test(prev) && !GENERIC.has(prev) ? [prev + w] : [w]
  })
}

/** The printer line a name carries ("LaserJet", "MG", "i-SENSYS"), if any. */
export function productLine(name: string): string | undefined {
  return name
    .split(/[\s/]+/)
    .map(norm)
    .find((w) => w.length >= 2 && !/\d/.test(w) && !GENERIC.has(w))
}

type Tok = { pre: string; core: string; suf: string }
/** MFCJ3540DW → { pre: MFCJ, core: 3540, suf: DW }. */
export const parseToken = (t: string): Tok | undefined => {
  const m = /^([A-Z]*?)(\d+)([A-Z]*)$/.exec(t)
  return m ? { pre: m[1]!, core: m[2]!, suf: m[3]! } : undefined
}

export type Fit = 'strong' | 'weak' | null

/**
 * Do two model tokens name the same printer (or one its series)? Same digit
 * core, letter prefixes that agree (equal, or one ends the other: MFCJ / J,
 * HLL / L), and suffixes where one extends the other (M1212 / M1212NF;
 * M555X ≠ M555DN). Strong when the prefixes agree; weak when one side has no
 * prefix at all (our 2035 / their P2035) or both are bare numbers.
 * `anySuffix` drops the suffix rule (for near-duplicate warnings).
 */
export function tokenFit(a: string, b: string, anySuffix = false): Fit {
  if (a === b) return /^\d+$/.test(a) ? 'weak' : 'strong'
  const x = parseToken(a)
  const y = parseToken(b)
  if (!x || !y || x.core !== y.core) return null
  if (!anySuffix && !(x.suf.startsWith(y.suf) || y.suf.startsWith(x.suf))) return null
  if (!x.pre || !y.pre) return 'weak'
  return x.pre === y.pre || x.pre.endsWith(y.pre) || y.pre.endsWith(x.pre) ? 'strong' : null
}

/**
 * How well does TSE model `name` fit source series `family`? The best token
 * fit; a weak fit becomes strong when our product line appears in the family
 * and is refused when it doesn't (our "OfficeJet 100" is not "LaserJet Pro 100
 * Color MFP M175"). A weak fit on a name with no product line ("1210") stays
 * weak: the caller must back it with printer-type evidence.
 */
export function seriesFit(family: string, name: string, anySuffix = false): Fit {
  const fits = modelTokens(family).flatMap((f) => modelTokens(name).map((t) => tokenFit(f, t, anySuffix)))
  if (fits.includes('strong')) return 'strong'
  if (!fits.includes('weak')) return null
  const line = productLine(name)
  if (!line) return 'weak'
  return norm(family).includes(line) ? 'strong' : null
}

/** Is TSE model `name` a member of source series `family`? */
export const inSeries = (family: string, name: string) => seriesFit(family, name) !== null

/**
 * A name too bare to create a printer from: no product line, and no model
 * token with a two-letter prefix ("2840", "Pro P1100"). HP's one-letter
 * prefixes (M, P) run across LaserJet lines, so they count as bare for HP.
 */
export function isBare(brand: string, name: string): boolean {
  if (productLine(name)) return false
  const minPre = norm(brand) === 'HP' ? 2 : 1
  return !modelTokens(name).some((t) => (parseToken(t)?.pre ?? t.replace(/\d.*/, '')).length >= minPre)
}

// ─── Catalogue ──────────────────────────────────────────────────────────────

export const kindOf = (cartridgeType: string | undefined): Kind | undefined =>
  /^laser/i.test(cartridgeType ?? '') ? 'laser' : /^ink/i.test(cartridgeType ?? '') ? 'inkjet' : undefined

export function parseCatalog(text: string) {
  const sections: Record<string, string[][]> = {}
  let cur = ''
  for (const line of text.split('\n')) {
    if (line.startsWith('##')) cur = line.slice(2)
    else if (line.trim()) (sections[cur] ??= []).push(line.split('\t'))
  }
  const variants: Variant[] = (sections.VARIANTS ?? []).map(([sku, title, , , brand, type]) => ({
    sku: sku!,
    title: title!,
    brand: brand!,
    kind: kindOf(type),
  }))
  const models: Model[] = (sections.MODELS ?? []).map(([brand, name, slug]) => ({ brand: brand!, name: name!, slug: slug! }))
  const compat = (sections.COMPAT ?? []).map(([brand, model, sku, source]) => ({ brand: brand!, model: model!, sku: sku!, source: source! }))
  // The printer types already linked to each of our models, from its cartridges.
  const kindBySku = new Map(variants.map((v) => [v.sku, v.kind]))
  const modelKinds = new Map<string, Set<Kind>>()
  for (const c of compat) {
    const k = kindBySku.get(c.sku)
    if (k) (modelKinds.get(`${norm(c.brand)}|${c.model}`) ?? modelKinds.set(`${norm(c.brand)}|${c.model}`, new Set()).get(`${norm(c.brand)}|${c.model}`)!).add(k)
  }
  return { variants, models, compat, modelKinds }
}

export const slugify = (t: string) => t.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const csvCell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)

/** Supplier part codes (CNHPSU819A) are left out of anything client-facing. */
const clean = (title: string) => title.replace(/\bCN[A-Z0-9]{4,}\b/g, '').replace(/\s+-\s*$/, '').replace(/\s+/g, ' ').trim()

// ─── Matching ───────────────────────────────────────────────────────────────

type Candidate = { brand: string; name: string; skus: Set<string>; kinds: Set<Kind> }

/**
 * Links every matched cartridge's source families to our models, or collects
 * them as new printers. Pure: takes the parsed catalogue and the hits.
 */
export function plan(
  catalog: ReturnType<typeof parseCatalog>,
  hitsBySku: Map<string, PlCartridge[]>,
) {
  const { variants, models, compat, modelKinds } = catalog
  const has = new Set(compat.map((c) => `${norm(c.brand)}|${norm(c.model)}|${c.sku}`))
  const kindsOf = (brand: string, model: string) => modelKinds.get(`${norm(brand)}|${model}`) ?? new Set<Kind>()
  // A weak (bare-number) fit needs evidence. 'same': the source lists a
  // cartridge we already link to this model under the very same printer.
  // 'other': it lists one under a different printer with the same short name
  // — our "3015" carries CE255X, filed under "HP 3015 Mono Printer", so
  // Q2612A's "HP 3015 All In One Printer" is another machine. Otherwise the
  // printer type (laser/inkjet) of our model's cartridges has to agree.
  const skusOf = new Map<string, string[]>()
  for (const c of compat) (skusOf.get(`${norm(c.brand)}|${c.model}`) ?? skusOf.set(`${norm(c.brand)}|${c.model}`, []).get(`${norm(c.brand)}|${c.model}`)!).push(c.sku)
  const sourceEvidence = (brand: string, model: string, fam: string, raws: Set<string>): 'same' | 'other' | undefined => {
    const theirs = (skusOf.get(`${norm(brand)}|${model}`) ?? []).flatMap((sku) => (hitsBySku.get(sku) ?? []).flatMap((h) => h.families))
    if (theirs.some((f) => raws.has(f))) return 'same'
    if (theirs.some((f) => familyName(brand, f) === fam)) return 'other'
    return undefined
  }

  const attach = new Map<string, Set<Model>>() // sku → our models
  const candidates = new Map<string, Candidate>() // brand|name → new printer
  const wildcards = new Set<string>()
  const refused: { sku: string; model: string; family: string; why: string }[] = []

  for (const v of variants) {
    const hits = hitsBySku.get(v.sku)
    if (!hits) continue
    const rawOf = new Map<string, Set<string>>()
    for (const raw of hits.flatMap((h) => h.families)) {
      const name = familyName(v.brand, raw)
      ;(rawOf.get(name) ?? rawOf.set(name, new Set()).get(name)!).add(raw)
    }
    for (const [fam, raws] of rawOf) {
      let fits = models
        .filter((m) => norm(m.brand) === norm(v.brand))
        .map((m) => ({ m, fit: seriesFit(fam, m.name), kinds: kindsOf(v.brand, m.name), seen: sourceEvidence(v.brand, m.name, fam, raws) }))
        .filter((x) => x.fit)
      // A model that carries the family's exact number outranks one that only
      // fits by a dropped prefix: source "3015" is our 3015, not our P3015.
      const exact = (n: string) => modelTokens(fam).some((f) => modelTokens(n).includes(f))
      if (fits.some((x) => exact(x.m.name))) fits = fits.filter((x) => x.fit === 'strong' || exact(x.m.name))
      const members: Model[] = []
      for (const { m, fit, kinds, seen } of fits) {
        const clash = !!(v.kind && kinds.size && !kinds.has(v.kind))
        if (fit === 'strong' && !clash) members.push(m)
        else if (fit === 'weak' && !clash && (seen === 'same' || (!seen && v.kind && kinds.has(v.kind)))) members.push(m)
        else
          refused.push({
            sku: v.sku,
            model: m.name,
            family: houseName(v.brand, fam),
            why: clash
              ? `printer type disagrees (${v.kind} cartridge, ${[...kinds].join('/')} printer)`
              : seen === 'other'
                ? 'same number, but the source lists our other cartridges for this printer under a different machine'
                : 'number matches but nothing confirms the printer type',
          })
      }
      if (members.length) {
        const set = attach.get(v.sku) ?? attach.set(v.sku, new Set()).get(v.sku)!
        for (const m of members) set.add(m)
      } else if (fits.length) {
        // Looks like one of ours but couldn't be confirmed: never create a twin.
      } else if (isWildcard(fam)) wildcards.add(`${v.brand} ${fam}`)
      else if (modelTokens(fam).length) {
        const name = houseName(v.brand, fam)
        const c = candidates.get(`${v.brand}|${name}`) ?? candidates.set(`${v.brand}|${name}`, { brand: v.brand, name, skus: new Set(), kinds: new Set() }).get(`${v.brand}|${name}`)!
        c.skus.add(v.sku)
        if (v.kind) c.kinds.add(v.kind)
      }
    }
  }

  // New printers that are the same machine (M1319 / M1319f, "MFP M631dn" /
  // M631) fold into one: union them, then name the group by its best member —
  // a name with a product line first, then the series (shortest suffix).
  const list = [...candidates.values()]
  const parent = list.map((_, i) => i)
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i]!)))
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!
      const b = list[j]!
      if (norm(a.brand) !== norm(b.brand)) continue
      const fit = seriesFit(a.name, b.name)
      const kindsAgree = [...a.kinds].every((k) => !b.kinds.size || b.kinds.has(k))
      if ((fit === 'strong' || (fit === 'weak' && a.kinds.size && kindsAgree)) && kindsAgree) parent[root(j)] = root(i)
    }
  const groups = new Map<number, Candidate[]>()
  for (let i = 0; i < list.length; i++) (groups.get(root(i)) ?? groups.set(root(i), []).get(root(i))!).push(list[i]!)

  const created = new Map<string, Set<string>>() // sku → new printer names
  const bare: Candidate[] = []
  const suffixLen = (n: string) => Math.min(...modelTokens(n).map((t) => parseToken(t)?.suf.length ?? 9))
  for (const group of groups.values()) {
    const named = group.filter((c) => !isBare(c.brand, c.name))
    if (!named.length) {
      bare.push(...group)
      continue
    }
    const best = named.sort(
      (a, b) => Number(!productLine(a.name)) - Number(!productLine(b.name)) || suffixLen(a.name) - suffixLen(b.name) || a.name.length - b.name.length,
    )[0]!
    for (const c of group) for (const sku of c.skus) (created.get(sku) ?? created.set(sku, new Set()).get(sku)!).add(best.name)
  }

  const brandOf = new Map(variants.map((v) => [v.sku, v.brand]))
  const rows = [...hitsBySku.keys()].map((sku) => {
    const brand = brandOf.get(sku)!
    const fresh = (names: string[]) => names.filter((n) => !has.has(`${norm(brand)}|${norm(n)}|${sku}`))
    const ours = [...(attach.get(sku) ?? [])]
    return {
      sku,
      brand,
      existing: fresh(ours.map((m) => m.name)).sort(),
      slugs: new Map(ours.map((m) => [m.name, m.slug])),
      created: [...(created.get(sku) ?? [])].sort(),
    }
  })
  return { rows, wildcards, bare, refused }
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const snapPath =
    process.argv[2] ??
    join(SNAP_DIR, readdirSync(SNAP_DIR).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().pop()!)
  if (!existsSync(CATALOG)) throw new Error(`No catalogue at ${CATALOG} — export it first (see catalog.sql)`)

  const catalog = parseCatalog(readFileSync(CATALOG, 'utf8'))
  const { variants, compat } = catalog
  const { ok: snapshot, incomplete, inferred } = usable(
    JSON.parse(readFileSync(snapPath, 'utf8')) as PlCartridge[],
    [...new Set(variants.map((v) => v.brand))],
  )

  const hitsBySku = new Map<string, PlCartridge[]>()
  const unmatched: Variant[] = []
  const ambiguous: string[] = []
  for (const v of variants) {
    const hits = snapshot.filter((p) => matches(p, v))
    if (!hits.length) unmatched.push(v)
    else if (new Set(hits.map((h) => mpnCore(h.mpn))).size > 3)
      ambiguous.push(`${v.sku} matched ${hits.length} source items (${[...new Set(hits.map((h) => mpnCore(h.mpn)))].join(', ')}) — skipped`)
    else hitsBySku.set(v.sku, hits)
  }
  const { rows, wildcards, bare, refused } = plan(catalog, hitsBySku)

  // ── Import CSV: one row per new pair. Existing models carry their real slug,
  // so the importer attaches to them and never renames or recreates one.
  const importRows = rows.filter((r) => r.existing.length || r.created.length)
  const csv = [
    'sku,brand,model_slug,model_name,new_model',
    ...importRows
      .flatMap((r) => [
        ...r.existing.map((n) => [r.sku, r.brand, r.slugs.get(n)!, n, 'false']),
        ...r.created.map((n) => [r.sku, r.brand, slugify(n), n, 'true']),
      ])
      .map((cells) => cells.map(csvCell).join(',')),
  ].join('\n')
  const base = snapPath.replace(/\.json$/, '')
  writeFileSync(`${base}-import.csv`, `${csv}\n`)

  // ── Review report ─────────────────────────────────────────────────────────
  const newPairs = importRows.reduce((n, r) => n + r.existing.length + r.created.length, 0)
  const newModels = new Set(importRows.flatMap((r) => r.created.map((c) => `${r.brand} ${c}`)))
  const families = new Map([...hitsBySku].map(([sku, hits]) => [sku, hits.flatMap((h) => h.families)]))
  const onlyOurs = rows
    .map((r) => ({
      sku: r.sku,
      models: compat.filter((c) => c.sku === r.sku && !families.get(r.sku)!.some((f) => inSeries(familyName(r.brand, f), c.model))).map((c) => c.model),
    }))
    .filter((r) => r.models.length)

  const sections: [string, string[]][] = [
    [
      'New printers per cartridge',
      [
        '| Cartridge | Printers we already list, now linked | New printers (please check) |',
        '|---|---|---|',
        ...importRows.map((r) => `| ${r.sku} | ${r.existing.join(', ') || '—'} | ${r.created.join(', ') || '—'} |`),
      ],
    ],
    [
      'Printers we list that the source doesn’t',
      [
        'Not removed. The source lists original cartridges only, and our compatibles often fit more printers. Worth a look where it seems wrong.',
        '',
        '| Cartridge | Printers only we list |',
        '|---|---|',
        ...onlyOurs.map((r) => `| ${r.sku} | ${r.models.join(', ')} |`),
      ],
    ],
    ['Our cartridges the source has nothing for', [unmatched.map((v) => `${v.sku} (${v.title})`).join(', ') || '—']],
  ]
  if (refused.length)
    sections.push([
      'Possible links not made — please confirm',
      [
        'The model number fits one of our printers, but the printer type disagrees or nothing confirms it, so no link and no new printer was added.',
        '',
        '| Cartridge | Our printer | Source printer | Why not |',
        '|---|---|---|---|',
        ...refused.map((r) => `| ${r.sku} | ${r.model} | ${r.family} | ${r.why} |`),
      ],
    ])
  if (bare.length)
    sections.push([
      'Printers not added — name too short to identify',
      [
        'The source names these by number only. Please give each its full name (for example "LaserJet P2035") and we will add it.',
        '',
        '| Source name | Cartridges |',
        '|---|---|',
        ...bare.map((c) => `| ${c.brand} ${c.name} | ${[...c.skus].join(', ')} |`),
      ],
    ])
  if (wildcards.size)
    sections.push(['Series names not added as printers', ['The source names these as a range, not one printer, so no printer was created for them.', '', [...wildcards].sort().join(', ')]])
  if (ambiguous.length) sections.push(['Skipped — matched too many items to be sure', ambiguous.map((a) => `- ${a}`)])
  if (incomplete.length)
    sections.push([
      'Source items left out — page was missing details',
      incomplete.map(({ item, missing }) => `- ${clean(item.title ?? '?')} (no ${missing.join(', ')})`),
    ])

  const md = [
    `# Printer compatibility check — ${base.split('/').pop()}`,
    '',
    `Source: a supplier site that lists genuine cartridges and the printers they fit. Every cartridge we stock was looked up there.`,
    '',
    `- **${variants.length}** cartridges in our store, **${hitsBySku.size}** found on the source, **${unmatched.length}** not found.`,
    `- **${newPairs}** new printer ↔ cartridge links to add, **${newModels.size}** of them printers we don't list yet.`,
    `- Everything here goes live on the store as soon as it is imported. Please check the new printers below first.`,
    '',
    ...sections.flatMap(([title, body], i) => [`## ${i + 1}. ${title}`, '', ...body, '']),
  ].join('\n')
  writeFileSync(`${base}-review.md`, md)

  if (inferred.length) console.log(`${inferred.length} snapshot items had no brand; taken from the title`)
  if (incomplete.length) console.log(`${incomplete.length} snapshot items skipped for missing fields`)
  console.log(`${variants.length} variants: ${hitsBySku.size} matched, ${unmatched.length} unmatched, ${ambiguous.length} ambiguous`)
  console.log(`${refused.length} possible links refused, ${bare.length} bare-number printers left for a person to name`)
  console.log(`${newPairs} new compat pairs (${newModels.size} new models) → ${base.replace(`${ROOT}/`, '')}-import.csv`)
  console.log(`Review → ${base.replace(`${ROOT}/`, '')}-review.md`)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
