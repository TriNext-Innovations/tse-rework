import { defineWidgetConfig } from '@medusajs/admin-sdk'
import { useEffect, useState } from 'react'
import { B2B_GROUP_NAME, B2B_TIERS, formatRand } from '@tse/types'

type CustomerGroup = { id: string; name: string }

// Medusa v2 detail widgets receive the entity directly as `data`
// (DetailWidgetProps<AdminCustomer> = { data: AdminCustomer }), so groups are
// on data.groups — NOT data.customer.groups.
type CustomerData = {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  groups?: CustomerGroup[]
}

function bandLabel(tier: (typeof B2B_TIERS)[number]): string {
  return tier.maxRand === null
    ? `${formatRand(tier.minRand)} and up`
    : `${formatRand(tier.minRand)} – ${formatRand(tier.maxRand - 1)}`
}

const CustomerB2BTierWidget = ({ data }: { data: CustomerData }) => {
  const [groups, setGroups] = useState<CustomerGroup[]>(data?.groups ?? [])

  // Fallback: if groups weren't included in the injected payload, fetch them.
  useEffect(() => {
    if (Array.isArray(data?.groups) || !data?.id) return
    fetch(`/admin/customers/${data.id}?fields=id,groups.id,groups.name`, { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setGroups((d as { customer?: { groups?: CustomerGroup[] } })?.customer?.groups ?? []))
      .catch(() => {})
  }, [data?.id, data?.groups])

  const b2bGroup = groups.find((g) => g.name === B2B_GROUP_NAME)
  const isB2B = Boolean(b2bGroup)

  // Legacy groups from the retired flat-price-list model. Surfaced explicitly so
  // staff don't assume an old "Wholesale" badge still buys a discount — it
  // doesn't; only membership of B2B_GROUP_NAME does.
  const legacyGroups = groups.filter((g) => g.name === 'Reseller' || g.name === 'Wholesale')

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">B2B account</h3>

      {!isB2B && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-block text-[11px] bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full font-medium">
              Not approved
            </span>
            <span className="text-xs text-gray-400">Pays list price</span>
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            To approve this customer for B2B pricing, add them to the{' '}
            <strong>{B2B_GROUP_NAME}</strong> group under <strong>Groups</strong> on this page.
            The threshold discounts below then apply automatically to every order they place
            while signed in.
          </p>
        </div>
      )}

      {isB2B && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span
              className="inline-block text-[11px] px-2.5 py-1 rounded-full font-semibold border"
              style={{ background: '#dcfce7', color: '#166534', borderColor: '#86efac' }}
            >
              {B2B_GROUP_NAME}
            </span>
            <span className="text-xs text-gray-500">Threshold discounts active</span>
          </div>

          <table className="w-full text-[11px] mb-2">
            <thead>
              <tr className="text-gray-400 text-left">
                <th className="font-normal pb-1">Order goods total</th>
                <th className="font-normal pb-1 text-right">Discount</th>
              </tr>
            </thead>
            <tbody className="text-gray-600">
              <tr className="border-t border-gray-100">
                <td className="py-1">Under {formatRand(B2B_TIERS[0]!.minRand)}</td>
                <td className="py-1 text-right text-gray-400">none</td>
              </tr>
              {B2B_TIERS.map((tier) => (
                <tr key={tier.code} className="border-t border-gray-100">
                  <td className="py-1">{bandLabel(tier)}</td>
                  <td className="py-1 text-right font-semibold text-gray-900">{tier.percent}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="text-[11px] text-gray-400 pt-2 border-t border-gray-100 leading-relaxed">
            Applied by the automatic promotions {B2B_TIERS.map((t) => t.code).join(' / ')}. Bands are
            mutually exclusive — the order gets one rate, never both. Measured on goods incl VAT,
            excl shipping, before discount. To revoke, remove them from the group.
          </p>
        </div>
      )}

      {legacyGroups.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-[11px] text-amber-700 leading-relaxed">
            <strong>Legacy group:</strong> {legacyGroups.map((g) => g.name).join(', ')}. The flat
            Reseller/Wholesale price lists are retired and grant no discount. Move this customer to{' '}
            <strong>{B2B_GROUP_NAME}</strong> and remove the old group.
          </p>
        </div>
      )}

      {groups.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-[10px] uppercase tracking-wider text-gray-300 mb-1">All groups</div>
          <div className="flex flex-wrap gap-1">
            {groups.map((g) => (
              <span key={g.id} className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {g.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export const config = defineWidgetConfig({
  zone: 'customer.details.side.before',
})

export default CustomerB2BTierWidget
