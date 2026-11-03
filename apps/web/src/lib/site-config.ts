// Single source of truth for TSE business + contact details.
// Change a phone number, email, or company string here — not in a dozen
// components. Values that are genuinely commerce data (delivery promises etc.)
// should be surfaced from the Medusa backend rather than added here.
//
// Phone numbers are stored once in both their `tel:`/`wa.me` href form and
// their human display form so the two can never drift apart.

export const siteConfig = {
  company: {
    legalName: 'TSE — Technical Systems Engineering',
    tradingName: 'TSE Cartridges',
    // How the storefront brands itself: page titles, OpenGraph siteName, and the
    // `name` on the business entity in structured-data.ts all read from here.
    brandName: 'TSE Online',
    location: 'Kya Sands, Johannesburg',
  },
  // The trading address, as printed on the contact page. Kept here rather than
  // inline so the visible copy and the JSON-LD can never disagree.
  address: {
    street: 'Unit 34, A.P.D. Industrial Park, Cnr Bernie & Elsecar Street',
    suburb: 'Kya Sands',
    city: 'Johannesburg',
    region: 'Gauteng',
    postalCode: '2163',
    country: 'South Africa',
    countryCode: 'ZA',
  },
  // Counter hours. Split week: Friday closes early. Read by the footer, the
  // contact page and the JSON-LD, so the three can never disagree.
  openingHours: [
    { days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'], opens: '08:00', closes: '16:30', label: 'Mon–Thu', display: '8am–4:30pm' },
    { days: ['Friday'], opens: '08:00', closes: '15:00', label: 'Fri', display: '8am–3pm' },
  ],
  // Sales landline
  phone: {
    display: '011 708 2304',
    displayExt: '011 708 2304/5',
    tel: 'tel:+27117082304',
    e164: '+27117082304',
  },
  // Mobile / WhatsApp
  whatsapp: {
    display: '079 873 3558',
    tel: 'tel:+27798733558',
    href: 'https://wa.me/27798733558',
  },
  email: {
    sales: 'sales@tse.co.za',
    mailto: 'mailto:sales@tse.co.za',
  },
} as const
