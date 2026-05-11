'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const pocs = [
  { href: '/one', label: 'POC 1', sub: 'Clean Grid' },
  { href: '/two', label: 'POC 2', sub: 'Trust Hero' },
  { href: '/three', label: 'POC 3', sub: 'Search First' },
  { href: '/four', label: 'POC 4', sub: 'Brand Theme' },
  { href: '/five', label: 'POC 5', sub: 'Ink Editorial' },
]

export function MockupNav() {
  const pathname = usePathname()

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-[#111827] border border-white/10 rounded-full px-2 py-2 shadow-2xl">
      {pocs.map((poc) => {
        const active = pathname === poc.href
        return (
          <Link
            key={poc.href}
            href={poc.href}
            className={`flex flex-col items-center px-5 py-2 rounded-full text-xs font-medium transition-all duration-200 cursor-pointer ${
              active
                ? 'bg-[#0D9488] text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="font-semibold">{poc.label}</span>
            <span className={`text-[10px] ${active ? 'text-teal-100' : 'text-gray-600'}`}>
              {poc.sub}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
