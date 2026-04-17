import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'TSE Online — Printer Cartridges South Africa',
}

export default function HomePage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold text-[#111827]">TSE Online</h1>
      <p className="mt-4 text-[#374151]">
        South Africa&apos;s trusted printer cartridge supplier.
      </p>
    </main>
  )
}
