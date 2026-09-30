// The Collect shipping option is admin-configured ("Collect from Kya Sands
// Warehouse", provider manual_manual), so it is recognised by name. Pudo is
// also a manual option, so the provider can't tell them apart.
export function isCollectMethod(name: string | undefined | null): boolean {
  return !!name && /\bcollect/i.test(name)
}

// Kept in step with the storefront's site-config address. Hours follow the
// footer, which is tighter than the contact page (Fri closes at 3pm).
export const COLLECTION_POINT = {
  lines: ['Unit 34, A.P.D. Industrial Park', 'Cnr Bernie &amp; Elsecar Street', 'Kya Sands, Johannesburg, 2163'],
  hours: 'Mon–Thu 8am–4:30pm · Fri 8am–3pm',
}

export const STORE_URL = 'https://www.tse.co.za'
