import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Navbar, Footer } from '@/components/layout'
import { siteConfig } from '@/lib/site-config'

export const metadata: Metadata = {
  title: 'Page not found',
  // A 404 should never earn an index entry — it would bleed crawl budget away
  // from real product pages. `follow` stays on so the recovery links below
  // still pass crawlers back into the catalogue.
  robots: { index: false, follow: true },
}

// Deliberately short: a 404 offers a way out, not a second navigation menu.
// These are the brands with the deepest catalogue coverage.
const BRAND_SHORTCUTS = ['HP', 'Canon', 'Epson', 'Brother', 'Samsung', 'Kyocera']

// The CMYK rule echoes the misregistration in the photograph and the logo's
// own colour separation. Ordered key → yellow → cyan → magenta.
const CMYK_RULE = [
  'var(--ink)',
  'var(--lime)',
  'var(--cyan)',
  'var(--glow)',
]

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  )
}

export default function NotFound() {
  return (
    <div className="storefront text-[var(--ink)] bg-[var(--paper)] min-h-screen flex flex-col overflow-x-hidden">
      <Navbar />

      <main className="flex-1">
        {/* pt-32 clears the fixed floating navbar (top-4, ~72px tall). Every
              other page uses the same figure — see contact, legal and products. */}
          <section className="mx-auto max-w-7xl px-5 sm:px-8 pt-32 pb-16 sm:pb-24">
          <div className="grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-16 items-center">
            {/* The photograph carries the joke, so it leads on every breakpoint.
                It stays on a white card in dark mode too — it reads as a sheet
                of paper lit on a dark desk rather than a blown-out panel. */}
            <figure className="relative rounded-[24px] overflow-hidden bg-white border border-[var(--ink)]/10 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.45)]">
              <Image
                src="/404-toner.webp"
                alt="A sheet of paper half-ejected from a laser printer, printed with the number 404 — the first digit crisp black, the last fading out as the toner runs dry."
                width={1600}
                height={1018}
                priority
                sizes="(min-width: 1024px) 55vw, 100vw"
                className="w-full h-auto select-none"
              />
            </figure>

            <div>
              <div className="flex items-center gap-3">
                <span className="flex" aria-hidden="true">
                  {CMYK_RULE.map((c) => (
                    <span
                      key={c}
                      className="block w-6 h-[3px] rounded-full mr-1 last:mr-0"
                      style={{ background: c }}
                    />
                  ))}
                </span>
                <p className="text-xs sm:text-sm font-medium tracking-[0.12em] uppercase text-[var(--muted)]">
                  Error 404 — page not found
                </p>
              </div>

              <h1 className="mt-5 font-display font-light text-[2.75rem] sm:text-6xl lg:text-7xl leading-[0.95] tracking-[-0.04em] text-[var(--ink)]">
                This page ran out of{' '}
                <span className="italic">toner</span>.
              </h1>

              <p className="mt-6 max-w-md text-base sm:text-lg leading-relaxed text-[var(--ink-3)]">
                The page you were after isn&apos;t here — it may have moved, or
                the link may be an old one. Empty cartridges happen to be our
                speciality, though. They have been since 1987.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-x-7 gap-y-4">
                <Link
                  href="/compatibility"
                  className="group inline-flex items-center gap-2 bg-[var(--magenta)] text-[var(--on-accent)] hover:opacity-90 transition-opacity duration-200 rounded-full pl-6 pr-2 py-2.5 text-sm font-semibold cursor-pointer shadow-[0_8px_24px_-8px_rgba(65,224,245,0.55)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
                >
                  Find my cartridge
                  <span className="inline-flex items-center justify-center w-9 h-9 bg-white/25 rounded-full transition-transform duration-300 group-hover:rotate-45 motion-reduce:transition-none motion-reduce:group-hover:rotate-0">
                    <ArrowIcon />
                  </span>
                </Link>

                <Link
                  href="/"
                  className="inline-flex items-center gap-2 text-sm font-medium text-[var(--ink)] hover:text-[var(--magenta)] transition-colors duration-200 cursor-pointer underline underline-offset-[6px] decoration-1 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--ink)] rounded-sm"
                >
                  Back to the shop
                </Link>
              </div>

              <div className="mt-10 pt-8 border-t border-[var(--ink)]/10">
                <p className="text-sm text-[var(--muted)]">
                  Or jump straight to a brand
                </p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {BRAND_SHORTCUTS.map((brand) => (
                    <li key={brand}>
                      <Link
                        href={`/products?brand=${encodeURIComponent(brand)}`}
                        className="inline-flex text-sm px-3.5 py-1.5 rounded-full border border-[var(--ink)]/15 text-[var(--ink-2)] hover:border-[var(--magenta)] hover:text-[var(--magenta)] transition-colors duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ink)]"
                      >
                        {brand}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Recovery strip. A dead link is the moment someone is most likely
              to leave, so the fastest human route out sits right under it. */}
          {/* `panel-dark` re-pins the light palette, so this card is #111827 in
              both themes — which sits almost on top of the dark-theme page
              background (#12151a). The white hairline border is what keeps it
              readable as a distinct surface in dark mode. */}
          <div className="panel-dark mt-14 sm:mt-20 relative overflow-hidden rounded-[24px] border border-white/10 bg-[var(--ink)] text-[var(--paper)] px-7 py-8 sm:px-10 sm:py-9">
            <div
              className="absolute -bottom-20 -right-12 w-48 h-48 rounded-full bg-[var(--glow)] opacity-20 blur-3xl"
              aria-hidden="true"
            />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-display font-light text-2xl sm:text-3xl tracking-[-0.02em]">
                  Still stuck? Talk to a human.
                </h2>
                <p className="mt-2 text-sm text-[var(--paper)]/70">
                  Tell us the printer model and we&apos;ll find the cartridge for
                  you — {siteConfig.company.location}, weekdays.
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <a
                  href={siteConfig.phone.tel}
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--magenta)] hover:text-[var(--on-accent)] transition-colors duration-300 px-5 py-2.5 text-sm font-medium cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--paper)]"
                >
                  <PhoneIcon />
                  {siteConfig.phone.display}
                </a>
                <a
                  href={siteConfig.whatsapp.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--paper)]/25 hover:border-[var(--magenta)] hover:text-[var(--magenta)] transition-colors duration-300 px-5 py-2.5 text-sm font-medium cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--paper)]"
                >
                  <ChatIcon />
                  WhatsApp
                </a>
                <a
                  href={siteConfig.email.mailto}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--paper)]/25 hover:border-[var(--magenta)] hover:text-[var(--magenta)] transition-colors duration-300 px-5 py-2.5 text-sm font-medium cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--paper)]"
                >
                  <MailIcon />
                  {siteConfig.email.sales}
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
