import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkImport } from './check-import'

const catalog = [
  '##VARIANTS',
  'HP-21XL-K\tt\th\tv\tHP\tinkjet',
  'HP-CB540A-K\tt\th\tv\tHP\tlaser',
  'HP-CE505A\tt\th\tv\tHP\tlaser',
  '##MODELS',
  'HP\t1210\t1210\tf',
  'HP\tP2035\tp2035\tf',
  '##COMPAT',
  'HP\t1210\tHP-21XL-K\tparsed',
  'HP\tP2035\tHP-CE505A\tparsed',
].join('\n')
const csv = (...rows: string[]) => ['sku,brand,model_slug,model_name,new_model', ...rows].join('\n')

test('a clean CSV passes', () => {
  const r = checkImport(csv('HP-CB540A-K,HP,colour-laserjet-cp1215,Colour LaserJet CP1215,true'), catalog)
  assert.equal(Object.values(r.fail).flat().length, 0)
  assert.equal(r.newModels, 1)
})

test('flags a printer-type clash, a rename and an existing pair', () => {
  const r = checkImport(
    csv('HP-CB540A-K,HP,1210,1210,false', 'HP-CB540A-K,HP,p2035,LaserJet P2035,false', 'HP-CE505A,HP,p2035,P2035,false'),
    catalog,
  )
  assert.equal(r.fail['printer type clash (laser vs inkjet)']!.length, 1)
  assert.equal(r.fail['renames an existing model']!.length, 1)
  assert.equal(r.fail['pair already in cartridge_compat']!.length, 1)
})

test('warns on a new model that is ours under another spelling', () => {
  const r = checkImport(csv('HP-CB540A-K,HP,2035,2035,true', 'HP-CB540A-K,HP,m653dn,M653dn,true', 'HP-CB540A-K,HP,m653x,M653x,true'), catalog)
  assert.deepEqual(r.nearDup, ['HP "2035" ~ ours "P2035"', 'HP "M653dn" ~ new "M653x"'])
})
