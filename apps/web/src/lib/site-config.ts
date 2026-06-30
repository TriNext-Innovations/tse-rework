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
    location: 'Kya Sands, Johannesburg',
  },
  // Sales landline
  phone: {
    display: '011 708 2304',
    displayExt: '011 708 2304/5',
    tel: 'tel:+27117082304',
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
