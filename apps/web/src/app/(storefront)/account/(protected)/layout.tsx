'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Navbar } from '@/components/layout'
import { useAuth } from '@/contexts/AuthContext'

const NAV = [
  { label: 'Orders', href: '/account/orders', icon: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0' },
  { label: 'Addresses', href: '/account/addresses', icon: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 7v6M9 10h6' },
  { label: 'Profile', href: '/account/profile', icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
]

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const { customer, loading, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && !customer) router.replace('/account/login')
  }, [loading, customer, router])

  if (loading || !customer) {
    return (
      <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[var(--line-5)] border-t-[var(--ink)] rounded-full animate-spin" />
      </div>
    )
  }

  const displayName = [customer.first_name, customer.last_name].filter(Boolean).join(' ') || customer.email

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <style>{`
        .font-display { font-family: var(--font-fraunces), Georgia, serif; font-optical-sizing: auto; }
        .font-display-italic { font-family: var(--font-fraunces), Georgia, serif; font-style: italic; }
      `}</style>
      <Navbar />

      <div className="mx-auto max-w-6xl px-4 sm:px-8 lg:px-12 pt-32 pb-16">
        <div className="mb-8 flex items-center gap-2 text-xs text-[var(--muted)]">
          <Link href="/" className="hover:text-[var(--ink)] transition-colors">Home</Link>
          <span>/</span>
          <span className="text-[var(--ink)]">Account</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 lg:gap-10">
          {/* Sidebar */}
          <aside className="lg:col-span-1">
            <div className="bg-[var(--surface)] rounded-[20px] p-5">
              <div className="mb-5 pb-5 border-b border-[var(--line-2)]">
                <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)] mb-1">Signed in as</div>
                <div className="font-medium text-sm truncate">{displayName}</div>
                <div className="text-xs text-[var(--muted)] truncate">{customer.email}</div>
                {customer.groups && customer.groups.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {customer.groups.map((g) => (
                      <span key={g.id} className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.15em] px-2 py-0.5 rounded-full bg-[#dfe344]/20 text-[var(--ink)]">
                        {g.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <nav className="space-y-0.5">
                {NAV.map(({ label, href, icon }) => {
                  const active = pathname === href || pathname?.startsWith(href + '/')
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                        active
                          ? 'bg-[var(--paper)] text-[var(--ink)] font-medium'
                          : 'text-[var(--ink-2)] hover:bg-[var(--paper)] hover:text-[var(--ink)]'
                      }`}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {icon.split('M').filter(Boolean).map((d, i) => (
                          <path key={i} d={`M${d}`} />
                        ))}
                      </svg>
                      {label}
                    </Link>
                  )
                })}
                <button
                  onClick={() => { logout(); router.push('/') }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-[var(--muted)] hover:bg-red-50 hover:text-red-600 transition-colors mt-2 pt-4 border-t border-[var(--line-2)] cursor-pointer"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                  </svg>
                  Sign out
                </button>
              </nav>
            </div>
          </aside>

          {/* Content */}
          <main className="lg:col-span-3">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
