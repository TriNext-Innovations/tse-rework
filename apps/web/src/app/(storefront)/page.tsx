import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'TSE Online — Design POCs' }

const pocs = [
  {
    href: '/one',
    label: 'POC 1',
    title: 'Clean Grid',
    desc: 'Light mode storefront. Sticky search bar, brand categories, product card grid with ZAR pricing. Feels like a modern SA e-commerce competitor.',
    palette: ['#0D9488', '#f0fdfa', '#ffffff'],
    tag: 'Light · Product-focused',
  },
  {
    href: '/two',
    label: 'POC 2',
    title: 'Trust Hero',
    desc: 'Dark, gold-accented design. Compatibility finder front and centre, trust badges, brand strip, and customer reviews. Built to convert.',
    palette: ['#0F172A', '#F59E0B', '#8B5CF6'],
    tag: 'Dark · Conversion-focused',
  },
  {
    href: '/three',
    label: 'POC 3',
    title: 'Search First',
    desc: 'Minimal chrome, big search hero with live dropdown results. Instant gratification — customers land and search immediately.',
    palette: ['#111827', '#0D9488', '#2dd4bf'],
    tag: 'Dark · Search-focused',
  },
  {
    href: '/four',
    label: 'POC 4',
    title: 'Brand Theme',
    desc: 'Full TSE static theme ported to React. Dark navy hero, Bebas Neue typography, blue accent. Faithful to the original brand identity.',
    palette: ['#030509', '#1040b5', '#c8a422'],
    tag: 'Dark · Brand-faithful',
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0F172A] text-white flex flex-col items-center justify-center px-4 py-16 font-sans">
      <div className="mb-10 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-10 h-10 bg-[#0D9488] rounded-xl flex items-center justify-center">
            <span className="text-white font-bold">T</span>
          </div>
          <span className="text-2xl font-bold">TSE Online</span>
        </div>
        <p className="text-gray-400 text-sm uppercase tracking-widest font-medium">Design POC Review</p>
        <h1 className="text-3xl font-bold mt-2">Pick a concept to explore</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl w-full">
        {pocs.map((poc) => (
          <Link key={poc.href} href={poc.href} className="group bg-white/5 hover:bg-white/8 border border-white/10 hover:border-[#0D9488]/50 rounded-2xl p-6 cursor-pointer transition-all hover:shadow-2xl hover:-translate-y-1">
            <div className="flex gap-1.5 mb-4">
              {poc.palette.map((color) => (
                <div key={color} className="w-6 h-6 rounded-full border border-white/10" style={{ backgroundColor: color }} />
              ))}
            </div>
            <span className="text-xs text-gray-500 font-medium">{poc.label}</span>
            <h2 className="text-xl font-bold text-white mt-1 mb-2 group-hover:text-[#0D9488] transition-colors">{poc.title}</h2>
            <p className="text-sm text-gray-400 leading-relaxed mb-4">{poc.desc}</p>
            <span className="text-xs bg-white/5 border border-white/10 text-gray-500 px-3 py-1 rounded-full">{poc.tag}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
