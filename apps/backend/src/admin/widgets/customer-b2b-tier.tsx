import { defineWidgetConfig } from '@medusajs/admin-sdk'
import { useEffect, useState } from 'react'

const TIER_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Reseller:  { bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
  Wholesale: { bg: '#dcfce7', text: '#166534', border: '#86efac' },
}

const TIER_DISCOUNTS: Record<string, string> = {
  Reseller: '15% off all products',
  Wholesale: '25% off all products',
}

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

  const b2bGroups = groups.filter((g) => g.name === 'Reseller' || g.name === 'Wholesale')
  const isB2B = b2bGroups.length > 0

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">B2B pricing tier</h3>

      {!isB2B && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-block text-[11px] bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full font-medium">
              Standard
            </span>
            <span className="text-xs text-gray-400">No discount applied</span>
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            To assign a B2B tier, go to{' '}
            <strong>Customers → Groups</strong> and add this customer to
            the <strong>Reseller</strong> or <strong>Wholesale</strong> group.
            The discount applies automatically on their next order.
          </p>
        </div>
      )}

      {isB2B && (
        <div className="space-y-2">
          {b2bGroups.map((g) => {
            const colors = TIER_COLORS[g.name] ?? { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' }
            return (
              <div key={g.id}>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="inline-block text-[11px] px-2.5 py-1 rounded-full font-semibold border"
                    style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}
                  >
                    {g.name}
                  </span>
                  <span className="text-xs text-gray-500">{TIER_DISCOUNTS[g.name] ?? 'Discounted pricing'}</span>
                </div>
              </div>
            )
          })}
          <p className="text-[11px] text-gray-400 pt-2 border-t border-gray-100 leading-relaxed">
            Pricing applied via Medusa price lists. To change the tier, manage groups in{' '}
            <strong>Customers → Groups</strong>.
          </p>
        </div>
      )}

      {groups.length > 0 && b2bGroups.length < groups.length && (
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
