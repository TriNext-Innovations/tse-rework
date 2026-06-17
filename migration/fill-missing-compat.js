#!/usr/bin/env node
/**
 * Fills in the "Compatible Printer Models" column for all MISSING rows
 * in migration/raw/client-review.csv using data gathered from internet research.
 *
 * Run: node migration/fill-missing-compat.js
 */

const fs = require('fs')
const path = require('path')

const CSV_PATH = path.join(__dirname, 'raw', 'client-review.csv')

// Map: exact Product Name → compatible printer models string
const COMPAT_MAP = {
  // ── Brother ──────────────────────────────────────────────────────────────────
  'Generic Brother LC-472 XL':
    'MFC-J5340DW / J5345DW / J5740DW / J6540DW / J6940DW / J2340DW / J3540DW / J3940DW',
  'Generic Brother LC-3719XL':
    'MFC-J3530DW / J2730DW',
  'Generic Brother LC-77':
    'MFC-J280W / J425W / J430W / J435W / J625DW / J825DW / J835DW / J5910DW / J6510DW / J6710DW / J6910DW',
  'Generic Brother LC-39':
    'DCP-J125 / J315W / J515W / MFC-J220 / J265W / J410 / J415W',
  'Generic Brother LC-38/67':
    'DCP-145C / 165C / 185C / 195C / 375CW / 385C / 395CN / J125 / J140W / MFC-250C / 255CW / 290C / 295CN / 490CN / 490CW / 5490CN / 5890CN / 5895CW / 6490CN / 6490CW / 670CD / 670CDW / 790CW / 795CW / 990CW / J220 / J265W / J410 / J415W / J615W / J630W',
  'Generic Brother LC-675 XL':
    'MFC-J2320 / J2720',
  'Generic Brother LC-565 XL':
    'MFC-J2310 / J2510 / J3520 / J3720',
  'Generic Brother LC-535 XL':
    'DCP-J100 / J105 / MFC-J200',
  'Generic Brother LC-569 XL B':
    'MFC-J2310 / J2510 / J3520 / J3720',
  'Generic Brother LC-679 XL Black':
    'MFC-J2320 / J2720',
  'Generic Brother LC-539 XL Black':
    'DCP-J100 / J105 / MFC-J200',

  // ── Canon ────────────────────────────────────────────────────────────────────
  'Canon CLI 471 XL':
    'PIXMA MG5740 / MG6840 / TS5040 / TS6040 / TS8040 / TS9040',
  'Canon PGI-1400 XL':
    'MAXIFY MB2040 / MB2140 / MB2340 / MB2740',
  'Canon PGI-2400 XL':
    'MAXIFY IB4040 / IB4140 / MB5040 / MB5140 / MB5340 / MB5440',
  'Canon CLI-451XL':
    'PIXMA MG5440 / MG5540 / MG5640 / MG6440 / MG6640 / iP7240 / iP8740 / iX6840',
  'Canon CLI-426':
    'PIXMA IP4840 / IP4940 / IX6540 / MG5140 / MG5240 / MG5340 / MG6140 / MG6240 / MG8140 / MX884',
  'GI-490 Yellow (70ml)':
    'PIXMA G1400 / G1410 / G1411 / G2400 / G2410 / G2411 / G3400 / G3410 / G3411 / G4400 / G4410 / G4411',
  'GI-490 Magenta (70ml)':
    'PIXMA G1400 / G1410 / G1411 / G2400 / G2410 / G2411 / G3400 / G3410 / G3411 / G4400 / G4410 / G4411',
  'GI-490 Cyan (70ml)':
    'PIXMA G1400 / G1410 / G1411 / G2400 / G2410 / G2411 / G3400 / G3410 / G3411 / G4400 / G4410 / G4411',
  'GI-490 Black (135ml)':
    'PIXMA G1400 / G1410 / G1411 / G2400 / G2410 / G2411 / G3400 / G3410 / G3411 / G4400 / G4410 / G4411',
  'Canon PGI 470 XL Black':
    'PIXMA MG5740 / MG6840 / TS5040 / TS6040 / TS8040 / TS9040',
  'Canon PGI-450XL Black':
    'PIXMA MG5440 / MG5540 / MG5640 / MG6340 / MG6440 / iP7240 / iP8740 / iX6840',
  'Canon PGI-425 Black':
    'PIXMA IP4840 / IP4940 / IX6540 / MG5140 / MG5240 / MG5340 / MG6140 / MG6240 / MG8140 / MX884',

  // ── Epson ────────────────────────────────────────────────────────────────────
  'Epson T6644 Yellow':
    'EcoTank L100 / L110 / L120 / L130 / L200 / L210 / L220 / L300 / L310 / L350 / L355 / L360 / L365 / L380 / L550 / L555 / L1300',
  'Epson T6643 Magenta':
    'EcoTank L100 / L110 / L120 / L130 / L200 / L210 / L220 / L300 / L310 / L350 / L355 / L360 / L365 / L380 / L550 / L555 / L1300',
  'Epson T6642 Cyan':
    'EcoTank L100 / L110 / L120 / L130 / L200 / L210 / L220 / L300 / L310 / L350 / L355 / L360 / L365 / L380 / L550 / L555 / L1300',
  'Epson T6641 Black':
    'EcoTank L100 / L110 / L120 / L130 / L200 / L210 / L220 / L300 / L310 / L350 / L355 / L360 / L365 / L380 / L550 / L555 / L1300',
  'Epson T0796 Photo Magenta':
    'Stylus Photo 1400 / 1410 / 1500W / P50 / PX650 / PX660 / PX700W / PX710W / PX730WD / PX800FW / PX810FW / PX820FWD / PX830FWD',
  'Epson T0795 Photo Cyan':
    'Stylus Photo 1400 / 1410 / 1500W / P50 / PX650 / PX660 / PX700W / PX710W / PX730WD / PX800FW / PX810FW / PX820FWD / PX830FWD',
  'Epson T0794 Yellow':
    'Stylus Photo 1400 / 1410 / 1500W / P50 / PX650 / PX660 / PX700W / PX710W / PX730WD / PX800FW / PX810FW / PX820FWD / PX830FWD',
  'Epson T0793 Magenta':
    'Stylus Photo 1400 / 1410 / 1500W / P50 / PX650 / PX660 / PX700W / PX710W / PX730WD / PX800FW / PX810FW / PX820FWD / PX830FWD',
  'Epson T0792 Cyan':
    'Stylus Photo 1400 / 1410 / 1500W / P50 / PX650 / PX660 / PX700W / PX710W / PX730WD / PX800FW / PX810FW / PX820FWD / PX830FWD',
  'Epson T0791 Black':
    'Stylus Photo 1400 / 1410 / 1500W / P50 / PX650 / PX660 / PX700W / PX710W / PX730WD / PX800FW / PX810FW / PX820FWD / PX830FWD',
  'Epson T7024 Yellow':
    'WorkForce Pro WP-4015 / WP-4020 / WP-4025 / WP-4095 / WP-4515 / WP-4520 / WP-4525 / WP-4530 / WP-4535 / WP-4540 / WP-4545 / WP-4590 / WP-4595',
  'Epson T7023 Magenta':
    'WorkForce Pro WP-4015 / WP-4020 / WP-4025 / WP-4095 / WP-4515 / WP-4520 / WP-4525 / WP-4530 / WP-4535 / WP-4540 / WP-4545 / WP-4590 / WP-4595',
  'Epson T7022 Cyan':
    'WorkForce Pro WP-4015 / WP-4020 / WP-4025 / WP-4095 / WP-4515 / WP-4520 / WP-4525 / WP-4530 / WP-4535 / WP-4540 / WP-4545 / WP-4590 / WP-4595',
  'Epson T7021 Black':
    'WorkForce Pro WP-4015 / WP-4020 / WP-4025 / WP-4095 / WP-4515 / WP-4520 / WP-4525 / WP-4530 / WP-4535 / WP-4540 / WP-4545 / WP-4590 / WP-4595',
  'Epson T1294 Yellow':
    'Stylus SX230 / SX235W / SX420W / SX425W / SX430W / SX435W / SX445W / SX525WD / SX535WD / SX620FW / Stylus Office BX305F / BX320FW / BX525WD / BX535WD / BX625FWD / BX630FW / BX635FWD / WorkForce WF-3010 / WF-3520 / WF-3530 / WF-3540 / WF-7015 / WF-7515 / WF-7525',
  'Epson T1293 Magenta':
    'Stylus SX230 / SX235W / SX420W / SX425W / SX430W / SX435W / SX445W / SX525WD / SX535WD / SX620FW / Stylus Office BX305F / BX320FW / BX525WD / BX535WD / BX625FWD / BX630FW / BX635FWD / WorkForce WF-3010 / WF-3520 / WF-3530 / WF-3540 / WF-7015 / WF-7515 / WF-7525',
  'Epson T1292 Cyan':
    'Stylus SX230 / SX235W / SX420W / SX425W / SX430W / SX435W / SX445W / SX525WD / SX535WD / SX620FW / Stylus Office BX305F / BX320FW / BX525WD / BX535WD / BX625FWD / BX630FW / BX635FWD / WorkForce WF-3010 / WF-3520 / WF-3530 / WF-3540 / WF-7015 / WF-7515 / WF-7525',
  'Epson T1291 Black':
    'Stylus SX230 / SX235W / SX420W / SX425W / SX430W / SX435W / SX445W / SX525WD / SX535WD / SX620FW / Stylus Office BX305F / BX320FW / BX525WD / BX535WD / BX625FWD / BX630FW / BX635FWD / WorkForce WF-3010 / WF-3520 / WF-3530 / WF-3540 / WF-7015 / WF-7515 / WF-7525',
  'Epson T0924 Yellow':
    'Stylus C51 / C91 / CX4300 / T26 / T27 / TX106 / TX109 / TX117 / TX119',
  'Epson T0923 Magenta':
    'Stylus C51 / C91 / CX4300 / T26 / T27 / TX106 / TX109 / TX117 / TX119',
  'Epson T0922 Cyan':
    'Stylus C51 / C91 / CX4300 / T26 / T27 / TX106 / TX109 / TX117 / TX119',
  'Epson T0921 Black':
    'Stylus C51 / C91 / CX4300 / T26 / T27 / TX106 / TX109 / TX117 / TX119',

  // ── HP ───────────────────────────────────────────────────────────────────────
  'HP 903 XL':
    'OfficeJet 6950 / 6960 / 6961 / 6963 / 6964 / 6965 / 6966 / 6968 / 6970 / 6971 / 6974 / 6975 / 6976 / 6978 / 6979',
  'HP 935 XL':
    'OfficeJet Pro 6230 / 6830 / 6835 / 6836 / OfficeJet 6220 / 6800 / 6812 / 6815 / 6820 / 6822 / 6825',
  'HP 933 XL':
    'OfficeJet 6100 / 6600 / 6700 / 7110 / 7510 / 7610 / 7612 / 7620',
  'HP 655':
    'DeskJet 3525 / 4615 / 4625 / 5525 / 6520 / 6525',
  'HP 951 XL':
    'OfficeJet Pro 8100 / 8110 / 8600 / 8610 / 8615 / 8620 / 8625 / 8630 / 8640 / 8660 / 251DW / 276DW',
  'HP 178 XL':
    'Photosmart 5510 / 5514 / 5515 / 5520 / 5521 / 6510 / 6512 / 6515 / 6520 / 6521 / 7510 / 7515 / C5300 / C5380 / C5383 / C6300 / C6380 / D5460 / D5463',
  'HP 177':
    'Photosmart 3210 / 3213 / 3308 / 3310 / 3313 / 8230 / 8238 / 8250 / 8253 / C5140 / C5150 / C5180',
  'HP 920 XL':
    'OfficeJet 6000 / 6500 / 6500A / 7000 / 7500 / 7500A',
  'HP 650 XL':
    'DeskJet 1015 / 1515 / 2515 / 2545 / 2645 / 3515 / 2548 / 3548 / 4518 / 2648 / 4648 / 4645',
  'HP 122 XL':
    'DeskJet 1000 / 1010 / 1011 / 1015 / 1050 / 1055 / 1510 / 1512 / 2050 / 2510 / 2514 / 2540 / 2545 / 3050 / 3054 / 3510 / 3512 / ENVY 4500 / 4502 / 4504 / 5530 / 5534 / OfficeJet 2620 / 2622 / 4630 / 4632',
  'HP 121 XL':
    'DeskJet D2563 / D2660 / F2423 / F2480 / F4580 / Photosmart C4680 / C4780',
  'HP 123':
    'DeskJet 1110 / 1111 / 1115 / 2130 / 2132 / 2133 / 2134 / 2620 / 2622 / 2623 / 2624 / 2628 / 2655 / 3630 / 3632 / 3637 / 3638 / ENVY 5020 / 5055',
  'HP 934 XL BLACK':
    'OfficeJet Pro 6230 / 6830 / 6835 / 6836 / OfficeJet 6220 / 6800 / 6812 / 6815 / 6820 / 6822 / 6825',
  'HP 932 XL Black':
    'OfficeJet 6100 / 6600 / 6700 / 7110 / 7510 / 7610 / 7612 / 7620',
  'HP 950 XL Black':
    'OfficeJet Pro 8100 / 8110 / 8600 / 8610 / 8615 / 8620 / 8625 / 8630 / 8640 / 8660 / 251DW / 276DW',
  'HP 177 Magenta Light':
    'Photosmart 3210 / 3213 / 3308 / 3310 / 3313 / 8230 / 8238 / 8250 / 8253 / C5140 / C5150 / C5180',
  'HP 177 Cyan Light':
    'Photosmart 3210 / 3213 / 3308 / 3310 / 3313 / 8230 / 8238 / 8250 / 8253 / C5140 / C5150 / C5180',
  'HP 901 XL Black':
    'OfficeJet 4500 / G510a / G510g / G510n / J4500 / J4524 / J4540 / J4550 / J4580 / J4640 / J4680',
  'HP 901 3-Colour':
    'OfficeJet 4500 / G510a / G510g / G510n / J4500 / J4524 / J4540 / J4550 / J4580 / J4640 / J4680',
  'HP 141 XL 3-Colour':
    'Photosmart C4200 / C4280 / C4380 / C4400 / C4450 / C4470 / C4480 / C4485 / C4488 / C4493',
  'HP 140 XL Black':
    'Photosmart C4200 / C4280 / C4380 / C4400 / C4450 / C4470 / C4480 / C4485 / C4488 / C4493',
  'HP 136 3-Colour':
    'DeskJet 5443 / D4163 / OfficeJet 6313 / Photosmart 2573 / C3183 / C4183 / D5163 / PSC 1513',
  'HP 132 Black':
    'DeskJet D4145 / D4155 / D4160 / D4163 / D4168 / 5943 / 6983 / Photosmart 2575 / 8050 / C4180 / D5063 / OfficeJet 6310',
  'HP 134 3-Colour':
    'DeskJet 460C / 460CB / 5743 / 5943 / 6543 / 6843 / 6943 / 6983 / OfficeJet 100 / 150 / 6213 / 7213 / 7313 / 7413 / Photosmart 325 / 335 / 375 / 385 / 428 / 475 / 2573 / 2613 / 2713 / 8053',
  'HP 131 Black':
    'DeskJet D4145 / D4155 / D4160 / D4163 / D4168 / 5943 / 6983 / Photosmart 2575 / 8050 / C4180 / D5063 / OfficeJet 6310',
  'HP 130 Black':
    'DeskJet D4145 / D4155 / D4160 / D4163 / D4168 / 5943 / 6983 / Photosmart 2575 / 8050 / C4180 / D5063 / OfficeJet 6310',
  'HP 28 3-Colour':
    'DeskJet 3320 / 3420 / 3550 / 3650 / 3740 / 3840 / 5650 / 5652 / 5850 / PSC 1110 / 1210 / 1315 / OfficeJet 5605 / 5610',
  'HP 27 Black':
    'DeskJet 3320 / 3420 / 3550 / 3650 / 3740 / 3840 / 5650 / 5652 / 5850 / PSC 1110 / 1210 / 1315 / OfficeJet 5605 / 5610',
  'HP 57 3-Colour':
    'DeskJet 3320 / 3420 / 3550 / 3650 / 3740 / 3840 / 5650 / 5652 / 5850 / PSC 1110 / 1210 / 1315 / OfficeJet 5605 / 5610',
  'HP 56 Black':
    'DeskJet 3320 / 3420 / 3550 / 3650 / 3740 / 3840 / 5650 / 5652 / 5850 / PSC 1110 / 1210 / 1315 / OfficeJet 5605 / 5610',
  'HP 22 XL 3-Colour':
    'DeskJet 3320 / 3420 / 3550 / 3650 / 3740 / 3840 / PSC 1100 / 1110 / 1210 / 1315',
  'HP 21 XL Black':
    'DeskJet 3320 / 3420 / 3550 / 3650 / 3740 / 3840 / PSC 1100 / 1110 / 1210 / 1315',
  'HP 129 Black':
    'DeskJet D4145 / D4155 / D4160 / D4163 / D4168 / 5943 / 6983 / Photosmart 2575 / 8050 / C4180 / D5063 / OfficeJet 6310',
  'HP 17 3-Colour':
    'DeskJet 816 / 825 / 827 / 840 / 841 / 842 / 843 / 845 / 848',
  'HP 23 3-Colour':
    'DeskJet 782C / 810 / 812 / 815 / 830 / PSC 500 / OfficeJet v30 / v40 / v45',
  'HP 78 3-Colour':
    'DeskJet 920 / 930 / 932 / 940 / 955 / 960 / 980 / 3820 / 9300 / OfficeJet g55 / g85 / k80 / v40 / PSC 750 / 950',
  'HP - 123 Toets':
    'DeskJet 1110 / 1115 / 2130 / 2132 / 2133 / 3630 / 3632 / 3637 / 3638 / ENVY 5020 / 5055',

  // ── Lexmark ───────────────────────────────────────────────────────────────────
  'Lexmark Nr.35 Colour':
    'X2500 / X2530 / X2550 / X3330 / X3350 / X3550 / X4550 / X5250 / X5340 / X5410 / X5470 / Z815 / Z845',
  'Lexmark Nr. 34 Black':
    'X2500 / X2530 / X2550 / X3330 / X3350 / X3550 / X4550 / X5250 / X5340 / X5410 / X5470 / Z815 / Z845',
  'Lexmark Nr.37 XL Colour':
    'X3650 / X4650 / X5650 / X5650es / X6650 / X6675 / Z2400 / Z2420',
  'Lexmark Nr.36 XL Black':
    'X3650 / X4650 / X5650 / X5650es / X6650 / X6675 / Z2400 / Z2420',
  'Lexmark Nr.26 Colour':
    'i3 / X1100 / X1110 / X1130 / X1150 / X1185 / X1290 / X2230 / X2240 / X2250 / X72 / X74 / Z600 / Z605 / Z615 / Z640 / Z645',
  'Lexmark Nr.16 Black':
    'i3 / X1100 / X1110 / X1130 / X1150 / X1185 / X1290 / X2230 / X2240 / X2250 / X72 / X74 / Z600 / Z605 / Z615 / Z640 / Z645',
  'Lexmark Nr.15 Colour':
    'X2600 / X2630 / X2650 / X2670 / Z2300 / Z2320',
  'Lexmark Nr. 14 Black':
    'X2600 / X2630 / X2650 / X2670 / Z2300 / Z2320',

  // ── Samsung ───────────────────────────────────────────────────────────────────
  'Samsung  M43 Black':
    'SF-370 / SF-371 / SF-375TP',
  'Samsung  M40 Black':
    'SF-335 / SF-345T / SF-360 / SF-365',
}

// ── CSV parser / writer ────────────────────────────────────────────────────────

function parseCSVLine(line) {
  const fields = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

function csvField(value) {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return `"${value}"`
}

// ── Main ───────────────────────────────────────────────────────────────────────

const raw = fs.readFileSync(CSV_PATH, 'utf-8')
const lines = raw.split('\n')

let updated = 0
let notFound = []

const output = lines.map((line, idx) => {
  if (idx === 0 || !line.trim()) return line

  const fields = parseCSVLine(line)
  if (fields.length < 5) return line

  const productName = fields[0]
  const status = fields[4]

  if (status !== 'MISSING — please fill in') return line

  const printers = COMPAT_MAP[productName]
  if (!printers) {
    notFound.push(productName)
    return line
  }

  fields[3] = printers
  fields[4] = 'RESEARCHED — needs confirmation'
  updated++
  return fields.map(csvField).join(',')
})

fs.writeFileSync(CSV_PATH, output.join('\n'), 'utf-8')

console.log(`\nDone. Updated ${updated} rows.`)
if (notFound.length) {
  console.warn(`\n⚠ No data found for ${notFound.length} products:`)
  notFound.forEach((n) => console.warn(`  • ${n}`))
}
