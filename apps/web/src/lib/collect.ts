import { siteConfig } from '@/lib/site-config'

// "Collect from Kya Sands Warehouse" is an admin-configured manual shipping
// option, so the storefront only knows it by name. Pudo is also a manual
// option, so the provider can't be used to tell them apart.
export function isCollectOption(option: { name: string } | null | undefined): boolean {
  return !!option && /\bcollect/i.test(option.name)
}

// Collect goes last: it is the only R0 option, and listed first it reads as
// "free delivery" to a shopper skimming for the cheapest line.
export function sortCollectLast<T extends { name: string }>(options: T[]): T[] {
  return [...options].sort((a, b) => Number(isCollectOption(a)) - Number(isCollectOption(b)))
}

export const collectionPoint = {
  lines: [
    siteConfig.address.street,
    `${siteConfig.address.suburb}, ${siteConfig.address.city}, ${siteConfig.address.postalCode}`,
  ],
  hours: siteConfig.collectionHours,
}

// A collect order from outside Gauteng is almost always a mistake.
export function isOutsideCollectionProvince(province: string): boolean {
  return province.trim() !== '' && province.trim() !== siteConfig.address.region
}
