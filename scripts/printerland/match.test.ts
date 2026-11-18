import { test } from 'node:test'
import assert from 'node:assert/strict'
import { familyName, inSeries, isWildcard, matches, mpnCore, splitSku, titleColour, usable, type PlCartridge } from './match'
import { parseProductPage } from './crawl'

const hp85a = {
  mpn: 'CNHPCE285A',
  brand: 'HP',
  title: 'HP CNHPCE285A 85A Black Print Cartridge (1,600 pages)',
  families: ['HP LaserJet Pro M1130 Multifunction Printer', 'HP LaserJet Pro P1102 Printer'],
  url: 'x',
}

test('splits TSE SKUs into code and colour', () => {
  assert.deepEqual(splitSku('HP-CE250A-K'), { code: 'CE250A', colour: 'K' })
  assert.deepEqual(splitSku('HP-CE285A'), { code: 'CE285A' })
  assert.deepEqual(splitSku('HP-123XL-CLR'), { code: '123XL', colour: 'CLR' })
})

test('strips the CN + brand prefix from part numbers', () => {
  assert.equal(mpnCore('CNHPCE285A'), 'CE285A')
  assert.equal(mpnCore('01-09-1850'), '01091850')
})

test('matches on part number or a title token, and respects colour', () => {
  assert.ok(matches(hp85a, { sku: 'HP-CE285A', title: '', brand: 'HP' }))
  assert.ok(matches(hp85a, { sku: 'HP-85A-K', title: '', brand: 'HP' }))
  assert.ok(!matches(hp85a, { sku: 'HP-85A-C', title: '', brand: 'HP' }))
  assert.ok(!matches(hp85a, { sku: 'HP-85A', title: '', brand: 'Canon' }))
  const tn = { mpn: 'CNBRTN277C', brand: 'Brother', title: 'Brother TN277C Cyan Toner', families: [], url: 'x' }
  assert.ok(matches(tn, { sku: 'BRO-TN277-C', title: '', brand: 'Brother' }))
  assert.ok(!matches(tn, { sku: 'BRO-TN277-M', title: '', brand: 'Brother' }))
})

test('photo black is not black', () => {
  assert.equal(titleColour('HP 178XL Photo Black Ink'), 'OTHER')
  const pk = { mpn: 'CNHPCB322HE', brand: 'HP', title: 'HP 178XL Photo Black Ink', families: [], url: 'x' }
  assert.ok(!matches(pk, { sku: 'HP-178XL-K', title: '', brand: 'HP' }))
})

test('reduces a family to the model name', () => {
  assert.equal(familyName('HP', 'HP LaserJet Pro M1130 Multifunction Printer'), 'LaserJet Pro M1130')
  assert.equal(familyName('OKI', 'OKI FAX 4100 Fax Machine'), 'FAX 4100')
})

test('series membership: suffix letters yes, more digits no', () => {
  assert.ok(inSeries('LaserJet Pro M1212', 'LaserJet Pro M1212nf MFP'))
  assert.ok(inSeries('LaserJet Pro M1217', '1217'))
  assert.ok(inSeries('P1102', 'P1102w'))
  assert.ok(!inSeries('M12', 'M1212'))
  assert.ok(!inSeries('P1102', 'P1103'))
  // Our model is the series, the source names one variant: attach, don't duplicate.
  assert.ok(inSeries('i-SENSYS LBP611C', 'LBP611'))
  assert.ok(inSeries('LaserJet Pro M275nw', 'M275'))
  assert.ok(!inSeries('i-SENSYS MF6140', 'MF6'))
  assert.ok(!inSeries('Colour LaserJet Enterprise M555x', 'Enterprise M555dn'))
})

test('parses a product page', () => {
  const html = `<title>HP CNHPCE285A 85A Black Print Cartridge</title>
    <meta itemprop="mpn" content = "CNHPCE285A"><meta itemprop="brand" content = "HP">
    <span class="compatible-item">HP LaserJet Pro M1130,M1212 Printers</span>
    <div class="product-detail-compatible-product-link"> <a href='/a'>HP LaserJet Pro M1130 Multifunction Printer </a> </div>
    <div class="product-detail-compatible-product-link"> <a href='/b'>HP LaserJet Pro M1212 &amp; Co Printer</a> </div>`
  const r = parseProductPage('u', 200, html)
  assert.equal(r.mpn, 'CNHPCE285A')
  assert.equal(r.brand, 'HP')
  assert.deepEqual(r.families, ['HP LaserJet Pro M1130 Multifunction Printer', 'HP LaserJet Pro M1212 & Co Printer'])
  assert.equal(r.worksWith, 'HP LaserJet Pro M1130,M1212 Printers')
})

// Real shape from the 27 Oct snapshot: 9 Samsung items (CNHPSU*/CNHPSV*) whose
// pages carry no itemprop="brand", so `brand` is absent. The old matcher
// called norm(undefined) on them and crashed the whole run.
const noBrand = {
  mpn: 'CNHPSU837A',
  title: 'CNHPSU837A Samsung MLT-D116L High Yield Black Toner Cartridge (3,000 pages)',
  families: ['Samsung Xpress M2625 Printer', 'Samsung Xpress M2675 Multifunction Printer'],
  url: 'x',
} as unknown as PlCartridge

test('an item with no brand never matches and does not throw', () => {
  assert.doesNotThrow(() => matches(noBrand, { sku: 'SAM-MLTD116L', title: '', brand: 'Samsung' }))
  assert.ok(!matches(noBrand, { sku: 'SAM-MLTD116L', title: '', brand: 'Samsung' }))
  assert.ok(!matches(hp85a, { sku: 'HP-CE285A', title: '', brand: undefined as unknown as string }))
})

test('usable() keeps complete items, takes a brand the title names, reports the rest', () => {
  const noBrandNoName = { ...noBrand, mpn: 'CNHPSU819A', title: 'CNHPSU819A Black MLT-D111S Toner Cartridge (1,000 pages)' }
  const noFamilies = { ...hp85a, families: undefined } as unknown as PlCartridge
  const { ok, incomplete, inferred } = usable([hp85a, noBrand, noBrandNoName, noFamilies], ['HP', 'Samsung', ''])
  assert.deepEqual(ok, [hp85a, { ...noBrand, brand: 'Samsung' }])
  assert.equal(inferred.length, 1)
  assert.deepEqual(
    incomplete.map((i) => [i.item.mpn, i.missing]),
    [
      ['CNHPSU819A', ['brand']],
      ['CNHPCE285A', ['families']],
    ],
  )
  // With no brand list nothing is guessed.
  assert.equal(usable([noBrand]).incomplete.length, 1)
  // The inferred item now matches the TSE cartridge it names.
  assert.ok(matches(ok[1]!, { sku: 'SAM-MLTD116L', title: '', brand: 'Samsung' }))
})

test('strips paper-size and n-in-1 tails, and spots series wildcards', () => {
  assert.equal(familyName('Canon', 'Canon i-SENSYS MF651Cdw A4 3-in-1'), 'i-SENSYS MF651Cdw')
  assert.equal(familyName('Brother', 'Brother MFC-J3540DW A4/A3 Colour Multifunction Inkjet Printer ink'), 'MFC-J3540DW')
  assert.ok(isWildcard('LBP61x'))
  assert.ok(isWildcard('i-SENSYS MF64x'))
  assert.ok(!isWildcard('i-SENSYS MF428x'))
  assert.ok(!isWildcard('Colour LaserJet Enterprise M555x'))
})
