import { test } from 'node:test'
import assert from 'node:assert/strict'
import { familyName, inSeries, matches, mpnCore, splitSku, titleColour } from './match'
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
