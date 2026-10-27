import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/components/layout', () => ({ Navbar: () => null }))

import HelpPage, { metadata } from '@/app/(storefront)/help/page'

function faqJsonLd(container: HTMLElement) {
  const script = container.querySelector('script[type="application/ld+json"]')
  return JSON.parse(script?.textContent ?? '{}')
}

describe('/help (#479)', () => {
  it('marks up every visible question as FAQPage JSON-LD', () => {
    const { container } = render(<HelpPage />)
    const ld = faqJsonLd(container)
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)

    expect(ld['@type']).toBe('FAQPage')
    expect(ld.mainEntity.map((q: { name: string }) => q.name)).toEqual(headings)
    for (const q of ld.mainEntity) expect(q.acceptedAnswer.text.length).toBeGreaterThan(40)
  })

  it('leads with the compatibility question and links out to the pages that own each answer', () => {
    render(<HelpPage />)

    expect(screen.getAllByRole('heading', { level: 2 })[0]?.textContent).toMatch(/fit my printer/i)
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(expect.arrayContaining(['/compatibility', '/legal/returns', '/contact']))
  })

  it('keeps the search snippet short enough to show in full', () => {
    expect((metadata.description as string).length).toBeLessThanOrEqual(155)
  })
})
