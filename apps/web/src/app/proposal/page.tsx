'use client'

import { useState, useEffect } from 'react'

// ─── DATA ─────────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { id: 'situation', label: 'Situation' },
  { id: 'domain', label: 'Domain' },
  { id: 'packages', label: 'Packages' },
  { id: 'compare', label: 'Compare' },
  { id: 'faq', label: 'FAQ' },
  { id: 'next-steps', label: 'Next Steps' },
]

const PROBLEMS = [
  {
    num: '01',
    title: 'Poor Search Visibility',
    body: 'tse.co.za carries zero keyword signal. Buyers searching "printer cartridges Johannesburg" will never find TSE organically. Google has no idea what this site sells.',
  },
  {
    num: '02',
    title: 'Weak Social Presence',
    body: '804 Facebook likes in 34 years. No automation, no Instagram, no content pipeline. Invisible to the next generation of procurement buyers.',
  },
  {
    num: '03',
    title: 'Friction at Purchase',
    body: 'Every order requires a phone call or WhatsApp. No compatibility filter. Every sale depends on a human touchpoint — a hard ceiling on revenue.',
  },
  {
    num: '04',
    title: 'Overpaying for Less',
    body: '~R12,000/month for a site generating minimal inbound leads. The TriNext Growth package delivers a full commerce platform for R3,500 less.',
  },
  {
    num: '05',
    title: 'No B2B Channel',
    body: 'Corporate offices, schools, and government departments are the highest-margin segment. TSE has no portal, no bulk pricing, no account management for them.',
  },
]

const BUILD_ITEMS = [
  {
    num: '01',
    title: 'Next.js + Medusa.js Headless Stack',
    detail: 'Sub-1s load · 95+ PageSpeed · Built to rank',
    body: 'The same architecture powering the fastest e-commerce brands in the world. Serverless, edge-optimised, handles seasonal traffic spikes without intervention.',
  },
  {
    num: '02',
    title: 'Cartridge Compatibility Wizard',
    detail: 'Select printer → see compatible stock',
    body: 'Customer selects printer brand then model, sees every compatible cartridge TSE carries. Eliminates the #1 reason for phone calls.',
  },
  {
    num: '03',
    title: 'Meilisearch Fast Product Search',
    detail: 'Instant results · Typo-tolerant · Filter by brand',
    body: 'Search results appear as you type. Handles misspellings, filters by brand and cartridge type, and surfaces the right product instantly — no page reload.',
  },
  {
    num: '04',
    title: 'SA-Native Payment Stack',
    detail: 'PayFast · Ozow Instant EFT · COD',
    body: "Cards, instant EFT, and cash-on-delivery for TSE's own JHB/PTA drivers. Built for the SA buyer — not a generic Stripe integration.",
  },
  {
    num: '05',
    title: 'Smart Courier Logic',
    detail: 'Order before noon → next-day JHB/PTA',
    body: "Zone-based routing: TSE's own drivers for JHB/PTA, nationwide courier for other regions. Prepayment enforced automatically for courier orders.",
  },
  {
    num: '06',
    title: 'Social Media Automation Bot',
    detail: 'Instagram · Facebook · AI captions · Auto-post',
    body: 'When a product is added or restocked, the bot generates a SA English caption, applies your branding to the product image, and posts to Instagram and Facebook automatically. Zero effort.',
  },
  {
    num: '07',
    title: 'WhatsApp Business + Cart Recovery',
    detail: 'Abandoned carts · Order updates · Automation',
    body: 'WhatsApp Business integration for order confirmations and marketing. Automated cart abandonment messages bring buyers back — the highest-ROI recovery channel in SA e-commerce.',
  },
  {
    num: '08',
    title: 'Sanity CMS — Owner Edits',
    detail: 'No developer needed for content changes',
    body: 'TSE staff update banners, run promotions, and publish blog posts without touching code. Full content ownership with version history.',
  },
  {
    num: '09',
    title: 'POPIA Compliant by Default',
    detail: 'Cookie consent · Data retention · Secure checkout',
    body: 'Built to the Protection of Personal Information Act from day one. Cookie consent, right-to-erasure flows, and encrypted data handling — not bolted on after the fact.',
  },
  {
    num: '10',
    title: 'B2B Portal',
    detail: 'Basic accounts (all packages) · Advanced + quotes (Scale)',
    body: 'Basic B2B customer accounts on every package. Scale adds an advanced portal with quote request workflows, reseller pricing tiers, and wholesale account management.',
  },
]

const PACKAGES = [
  {
    name: 'Launch',
    price: 'R5,500',
    period: '/mo',
    tagline: 'A professional website — better than what you have today',
    features: [
      'Website redesign (not a template)',
      'Basic product catalogue & pricing',
      'Contact form + WhatsApp ordering',
      'Google Business Profile setup',
      'SEO foundations & metadata',
      'Mobile-responsive design',
      'Hosting managed for you',
      '1 retained dev hour/month',
      '24hr business-hours support',
    ],
    cta: 'Start with Launch',
    recommended: false,
    savings: 'Saves ~R6,500/mo vs current spend',
  },
  {
    name: 'Growth',
    price: 'R8,500',
    period: '/mo',
    tagline: 'Full commerce platform + social automation that runs 24/7',
    features: [
      'Everything in Launch',
      'Custom Next.js + Medusa.js store',
      'Full product catalogue & variants',
      'Cartridge compatibility wizard',
      'Meilisearch fast product search',
      'PayFast + Ozow Instant EFT',
      'SA courier logic (next-day JHB/PTA)',
      'Sanity CMS — owner edits content',
      'POPIA compliance & cookie consent',
      'Basic B2B customer accounts',
      'Instagram + Facebook auto-posting bot',
      'AI-generated captions in SA English',
      'WhatsApp Business + cart recovery',
      'Meta Pixel + conversion tracking',
      'Monthly analytics report',
      '6 retained dev hours/month',
      '8hr business-hours support response',
    ],
    cta: 'Choose Growth',
    recommended: true,
    badge: 'Most Popular',
    savings: 'Saves ~R3,500/mo vs current spend',
  },
  {
    name: 'Scale',
    price: 'R13,500',
    period: '/mo',
    tagline: 'Growth + paid ads, advanced B2B & priority support',
    features: [
      'Everything in Growth',
      'Google Ads campaign creation & management',
      'Competitor price monitoring & alerts',
      'Advanced B2B portal + quote requests',
      'B2B pricing tiers (reseller & wholesale)',
      '12 retained dev hours/month',
      'Dedicated Slack channel',
      '2hr business-hours response time',
      'After-hours emergency support',
      'Quarterly strategy review call',
    ],
    cta: "Let's Scale",
    recommended: false,
  },
]

const COMPARE_ROWS = [
  { feature: 'Website Performance', current: 'Slow, poor UX', growth: 'Sub-1s Next.js (95+ PageSpeed)' },
  { feature: 'SEO Signal', current: 'Zero keyword targeting', growth: 'Domain + content + schema markup' },
  { feature: 'Online Ordering', current: 'Call / WhatsApp only', growth: 'Full self-serve e-commerce' },
  { feature: 'Payment Options', current: 'Manual EFT / COD', growth: 'PayFast + Ozow Instant EFT + COD' },
  { feature: 'Product Discovery', current: 'No compatibility filter', growth: 'Compatibility wizard + Meilisearch search' },
  { feature: 'Social Media', current: '804 FB likes, manual posting', growth: 'Instagram + Facebook bot — posts automatically' },
  { feature: 'WhatsApp', current: 'Manual ordering only', growth: 'Business integration + cart recovery' },
  { feature: 'Content Management', current: 'Developer required', growth: 'Sanity CMS (self-service)' },
  { feature: 'B2B', current: 'None', growth: 'Basic B2B accounts included' },
  { feature: 'Legal Compliance', current: 'POPIA status unknown', growth: 'POPIA compliant from day one' },
  { feature: 'Monthly Cost', current: '~R12,000', growth: 'R8,500', highlight: true },
]

const FAQS = [
  {
    q: 'Is there a once-off build fee?',
    a: 'Yes — R18,000 once-off, paid in three milestones: 40% at kick-off (R7,200), 30% at mid-point (R5,400), and 30% at go-live (R5,400). The monthly retainer only starts from your go-live date.',
  },
  {
    q: 'Why not just use Shopify?',
    a: "Shopify charges R1,150–3,000/month in platform fees plus up to 2% of every transaction. On R200k monthly revenue that's R4,000–7,000 going to Shopify every month, forever. Our platform has zero transaction fees and no license — TSE owns it outright.",
  },
  {
    q: 'How long until we go live?',
    a: 'Typically 8–10 weeks from kick-off. Week 1–2 is design, Week 3–8 is development and content migration, Week 9–10 is testing and go-live.',
  },
  {
    q: 'Will changing the domain hurt current rankings?',
    a: 'No. We set up a permanent 301 redirect from tse.co.za → tse-cartridges.co.za. Google transfers all ranking signals. You lose zero traffic — and gain keyword authority.',
  },
  {
    q: 'Who owns the website and code?',
    a: "TSE owns everything — all custom code, credentials, and accounts from day one. If you ever cancel, we hand over the full codebase and all credentials within 5 business days. Nothing breaks; the store keeps running.",
  },
  {
    q: 'What if we cancel?',
    a: "You keep everything. We hand over all credentials, the full codebase, and documentation within 5 business days. The store keeps running — we're your service provider, not a gatekeeper.",
  },
  {
    q: 'Can we start on Launch and upgrade to Growth later?',
    a: 'Yes, at any time with 30 days notice. The platform is identical across all packages — upgrading just activates more services. No rebuild needed and no second setup fee.',
  },
  {
    q: "Does the platform support TSE's quality generic positioning?",
    a: 'Absolutely. Every product badge, description, and trust signal is built around "Quality Generic" — never OEM or Genuine. The TSE guarantee ("Works as good, or even better than the original products") becomes a core part of the conversion story.',
  },
]

const NEXT_STEPS = [
  { step: '01', title: 'Approve Proposal', desc: 'Sign off on the Growth package. We send a formal SoW and invoice.', timeline: 'This week' },
  { step: '02', title: 'Register Domain', desc: 'Register tse-cartridges.co.za for R89. We handle DNS and redirect from tse.co.za.', timeline: 'Day 1' },
  { step: '03', title: 'Kick-off Call', desc: '30 min to align on brand, tone, and must-have features before design starts.', timeline: 'Week 1' },
  { step: '04', title: 'Design Sprint', desc: 'Homepage, product pages, CMS templates. TSE reviews and approves before we build.', timeline: 'Week 1–2' },
  { step: '05', title: 'Build & Migrate', desc: 'Full platform build, product catalogue migration, payment + courier integration.', timeline: 'Week 3–8' },
  { step: '06', title: 'Launch', desc: 'Go-live, domain cutover, post-launch monitoring. CMS training for TSE staff.', timeline: 'Week 9–10' },
]

// ─── PAGE ──────────────────────────────────────────────────────────────────────

export default function ProposalPage() {
  const [activeSection, setActiveSection] = useState('situation')
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [navScrolled, setNavScrolled] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      setNavScrolled(window.scrollY > 10)
      const total = document.documentElement.scrollHeight - window.innerHeight
      setScrollProgress(total > 0 ? window.scrollY / total : 0)
      const ids = NAV_LINKS.map(l => l.id)
      for (const id of [...ids].reverse()) {
        const el = document.getElementById(id)
        if (el && window.scrollY >= el.offsetTop - 120) {
          setActiveSection(id)
          break
        }
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollTo = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: '#06080F', color: '#fff' }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&display=swap');
        .ds  { font-family: 'DM Serif Display', Georgia, serif; }
        .dsi { font-family: 'DM Serif Display', Georgia, serif; font-style: italic; }
        ::selection { background: rgba(13,148,136,0.25); }
        html { scroll-behavior: smooth; }
      `}</style>

      {/* ── SCROLL PROGRESS ───────────────────────────────────────────────── */}
      <div className="fixed top-0 left-0 right-0 z-[100] h-[2px]">
        <div className="h-full bg-[#0D9488]" style={{ width: `${scrollProgress * 100}%`, transition: 'width 100ms linear' }} />
      </div>

      {/* ── NAV ───────────────────────────────────────────────────────────── */}
      <nav className={`fixed top-[2px] left-0 right-0 z-50 transition-all duration-300 ${navScrolled ? 'bg-[#06080F]/92 backdrop-blur-xl border-b border-white/10' : ''}`}>
        <div className="max-w-7xl mx-auto px-8 h-14 flex items-center justify-between">
          <div className="text-sm tracking-tight font-semibold">
            <span className="text-white">TriNext</span>
            <span className="mx-2" style={{ color: 'rgba(255,255,255,0.25)' }}>×</span>
            <span className="text-[#0D9488]">TSE</span>
            <span className="hidden md:inline ml-4 text-[10px] font-normal tracking-[0.2em] uppercase" style={{ color: 'rgba(255,255,255,0.35)' }}>Confidential</span>
          </div>
          <div className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map(({ id, label }) => (
              <button key={id} onClick={() => scrollTo(id)} className="relative text-[10px] tracking-[0.15em] uppercase font-semibold pb-0.5 group">
                <span style={{ color: activeSection === id ? '#fff' : 'rgba(255,255,255,0.5)' }}>{label}</span>
                <span className="absolute -bottom-0.5 left-0 h-px bg-[#0D9488] transition-all duration-300" style={{ width: activeSection === id ? '100%' : '0' }} />
              </button>
            ))}
            <button onClick={() => scrollTo('next-steps')} className="ml-2 text-[10px] font-bold tracking-[0.15em] uppercase px-5 py-2.5 bg-[#0D9488] text-white hover:bg-[#0f766e] transition-colors">
              Let's Go
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO / SITUATION ──────────────────────────────────────────────── */}
      <section id="situation" className="relative min-h-screen flex flex-col justify-center px-8 lg:px-16 pt-28 pb-20 overflow-hidden">
        {/* Decorative background year */}
        <div className="ds absolute right-0 top-1/2 -translate-y-[45%] leading-none select-none pointer-events-none" style={{ fontSize: 'clamp(8rem, 22vw, 22rem)', fontWeight: 700, color: 'rgba(255,255,255,0.018)' }}>
          1992
        </div>
        <div className="absolute left-8 lg:left-16 top-0 bottom-0 w-px" style={{ background: 'rgba(255,255,255,0.05)' }} />

        <div className="relative z-10 max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-4 mb-14">
            <div className="h-px w-10 bg-[#0D9488]" />
            <span className="text-[#0D9488] text-[10px] tracking-[0.28em] uppercase font-bold">Confidential Proposal · April 2026</span>
          </div>

          <div className="grid lg:grid-cols-[1fr_340px] gap-12 lg:gap-24 items-end">
            {/* Headline */}
            <div>
              <h1 className="dsi leading-[0.9] tracking-tight text-white mb-8" style={{ fontSize: 'clamp(3rem, 8vw, 6.5rem)' }}>
                TSE Online —<br />
                <span className="text-[#0D9488]">from invisible</span>
                <br />to unstoppable.
              </h1>
              <p className="text-lg leading-relaxed max-w-[500px] mb-10" style={{ color: 'rgba(255,255,255,0.72)' }}>
                TSE has built a 34-year reputation supplying quality generic cartridges across South Africa.
                TriNext builds the digital engine that puts that reputation in front of every buyer searching online.
              </p>
              <div className="flex flex-wrap gap-2">
                {['Prepared by TriNext Innovations', 'April 2026', '🔒 Confidential'].map(tag => (
                  <span key={tag} className="text-[11px] px-3 py-1.5 tracking-wider" style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Situation ledger */}
            <div>
              <p className="text-[10px] tracking-[0.25em] uppercase mb-6 font-bold" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Current Situation
              </p>
              <div>
                {[
                  { label: 'Founded', value: '1992', note: '34 years in operation' },
                  { label: 'Website', value: 'tse.co.za', note: 'Poor UX, weak SEO' },
                  { label: 'Social', value: '804 likes', note: 'Facebook only, no automation' },
                  { label: 'Ordering', value: 'Call / WhatsApp', note: 'No self-serve channel' },
                  { label: 'Monthly spend', value: '~R12,000', note: '' },
                ].map(({ label, value, note }) => (
                  <div key={label} className="py-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</span>
                      <span className="text-sm font-medium text-white">{value}</span>
                    </div>
                    {note && <p className="text-[10px] mt-1 text-right" style={{ color: 'rgba(255,255,255,0.45)' }}>{note}</p>}
                  </div>
                ))}
              </div>

              <div className="mt-5 pt-5" style={{ borderTop: '1px solid rgba(13,148,136,0.3)' }}>
                <div className="flex items-baseline justify-between mb-4">
                  <span className="text-[10px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)' }}>TriNext Growth</span>
                  <span className="text-[#0D9488] text-2xl font-bold">R8,500<span className="text-sm font-normal" style={{ color: 'rgba(255,255,255,0.4)' }}>/mo</span></span>
                </div>
                <div className="pl-4 py-2.5" style={{ borderLeft: '3px solid #0D9488', background: 'rgba(13,148,136,0.07)' }}>
                  <p className="text-sm font-semibold text-[#0D9488]">Saves R3,500/month</p>
                  <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>= R42,000 in year one — on a better platform</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── THE PROBLEM ───────────────────────────────────────────────────── */}
      <section className="py-24 px-8 lg:px-16" style={{ background: '#F8F9FA' }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-[280px_1fr] gap-16">
            <div className="lg:sticky lg:top-24 lg:self-start">
              <div className="h-px w-10 mb-6" style={{ background: '#0D9488' }} />
              <h2 className="ds text-4xl leading-tight mb-4" style={{ color: '#06080F' }}>
                The six problems holding TSE back
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: '#64748B' }}>
                A 34-year business with the stock, the reputation, and the reach — missing a digital foundation.
              </p>
            </div>

            <div style={{ borderTop: '1px solid #E2E8F0' }}>
              {PROBLEMS.map(({ num, title, body }) => (
                <div key={num} className="grid gap-0 py-8" style={{ gridTemplateColumns: '52px 1fr', borderBottom: '1px solid #F1F5F9' }}>
                  <span className="font-mono text-xs font-bold pt-0.5" style={{ color: '#0D9488' }}>{num}</span>
                  <div>
                    <h3 className="font-semibold mb-2" style={{ color: '#0F172A' }}>{title}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: '#475569' }}>{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Opportunity */}
          <div className="mt-12 p-10" style={{ background: '#06080F', display: 'grid', gridTemplateColumns: '52px 1fr' }}>
            <span className="font-mono text-xs font-bold pt-1" style={{ color: '#0D9488' }}>06</span>
            <div>
              <h3 className="ds text-2xl mb-3" style={{ color: '#0D9488' }}>The Opportunity</h3>
              <p className="text-sm leading-relaxed max-w-2xl" style={{ color: 'rgba(255,255,255,0.75)' }}>
                TSE has a 34-year reputation, a broad product range, a physical distribution advantage in JHB/PTA,
                and a guarantee that outperforms OEM:{' '}
                <em style={{ color: '#fff' }}>&ldquo;Works as good, or even better than the original.&rdquo;</em>{' '}
                It just needs a digital engine to match.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── DOMAIN STRATEGY ───────────────────────────────────────────────── */}
      <section id="domain" className="py-24 px-8 lg:px-16" style={{ background: '#06080F' }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-3">
            <div className="h-px w-10" style={{ background: '#0D9488' }} />
            <span className="text-[10px] tracking-[0.28em] uppercase font-bold" style={{ color: '#0D9488' }}>Domain Strategy</span>
          </div>
          <p className="text-base mb-14" style={{ color: 'rgba(255,255,255,0.6)' }}>
            The cheapest SEO improvement in this proposal — one R89 decision.
          </p>

          <div className="grid lg:grid-cols-2 gap-px mb-14" style={{ background: 'rgba(255,255,255,0.08)' }}>
            {/* Current */}
            <div className="p-10 lg:p-14" style={{ background: '#06080F' }}>
              <div className="flex items-center gap-2 mb-8">
                <span className="w-2 h-2 rounded-full" style={{ background: 'rgba(239,68,68,0.7)' }} />
                <span className="text-[10px] uppercase tracking-[0.25em] font-bold" style={{ color: 'rgba(239,68,68,0.8)' }}>Current</span>
              </div>
              <div className="font-mono leading-tight mb-8 break-all line-through" style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)', color: 'rgba(255,255,255,0.35)', textDecorationColor: 'rgba(239,68,68,0.5)' }}>
                tse.co.za
              </div>
              <ul className="space-y-4">
                {[
                  'Acronym — means nothing to Google',
                  'Zero keyword signal for cartridge searches',
                  'Buyers never type "TSE" — they type "printer cartridges"',
                  'Invisible in organic search results',
                ].map(item => (
                  <li key={item} className="flex gap-3 text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    <span className="shrink-0 mt-0.5" style={{ color: 'rgba(239,68,68,0.7)' }}>—</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommended */}
            <div className="p-10 lg:p-14 relative" style={{ background: '#06080F', borderTop: '2px solid #0D9488' }}>
              <div className="absolute top-5 right-6 text-[9px] font-bold tracking-[0.2em] uppercase px-2 py-1" style={{ color: '#0D9488', border: '1px solid rgba(13,148,136,0.4)' }}>
                Recommended
              </div>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#0D9488]" />
                  <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-[#0D9488]">Recommended</span>
                </div>
                <span className="text-sm font-bold text-[#0D9488]">R89 once-off</span>
              </div>
              <div className="font-mono leading-tight mb-8 break-all text-white" style={{ fontSize: 'clamp(1.8rem, 4vw, 3rem)' }}>
                tse-cartridges.co.za
              </div>
              <ul className="space-y-4">
                {[
                  '"cartridges" — the exact word buyers type into Google',
                  'Domain keyword match is a confirmed Google ranking signal',
                  'Keeps the TSE brand — adds search intent',
                  'tse.co.za redirects automatically — zero traffic lost',
                ].map(item => (
                  <li key={item} className="flex gap-3 text-sm" style={{ color: 'rgba(255,255,255,0.75)' }}>
                    <span className="shrink-0 mt-0.5 text-[#0D9488]">→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* SEO explainer */}
          <div className="pl-8 py-1" style={{ borderLeft: '2px solid rgba(13,148,136,0.4)' }}>
            <p className="text-[10px] uppercase tracking-[0.2em] mb-3 font-bold" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Why this matters to Google
            </p>
            <p className="text-sm leading-relaxed max-w-3xl mb-3" style={{ color: 'rgba(255,255,255,0.72)' }}>
              Google uses domain keywords as a relevancy signal.{' '}
              <code className="px-1.5 py-0.5 text-xs" style={{ background: 'rgba(255,255,255,0.08)', color: '#fff' }}>
                tse-cartridges.co.za
              </code>{' '}
              immediately tells Google this site sells cartridges. Combined with quality content and technical SEO,
              this compounds with every page published.
            </p>
            <p className="text-sm leading-relaxed max-w-3xl" style={{ color: 'rgba(255,255,255,0.65)' }}>
              The 301 redirect from tse.co.za transfers 100% of existing link equity. No ranking
              penalty — only gains. R89 is the cheapest SEO win in this entire proposal.
            </p>
          </div>
        </div>
      </section>

      {/* ── WHAT WE BUILD ─────────────────────────────────────────────────── */}
      <section className="py-24 px-8 lg:px-16" style={{ background: '#0A0E1A' }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-3">
            <div className="h-px w-10 bg-[#0D9488]" />
            <span className="text-[10px] tracking-[0.28em] uppercase font-bold text-[#0D9488]">The Platform</span>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-14">
            <h2 className="ds text-4xl lg:text-5xl text-white leading-tight max-w-lg">
              Production-grade commerce, purpose-built for a SA cartridge supplier.
            </h2>
            <p className="text-sm max-w-[200px] lg:text-right leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Not a template.<br />Not a Shopify store.<br />Built from the ground up.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-px" style={{ background: 'rgba(255,255,255,0.07)' }}>
            {BUILD_ITEMS.map(({ num, title, detail, body }) => (
              <div key={num} className="p-8" style={{ background: '#0A0E1A' }}>
                <div className="flex gap-5">
                  <span className="font-mono text-xs shrink-0 mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>{num}</span>
                  <div>
                    <h3 className="font-semibold text-white text-sm mb-1">{title}</h3>
                    <div className="text-xs mb-3 text-[#0D9488]">{detail}</div>
                    <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>{body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 pt-8 flex items-center gap-3 flex-wrap" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
            <span className="text-[10px] uppercase tracking-[0.2em]" style={{ color: 'rgba(255,255,255,0.4)' }}>Stack</span>
            <div className="h-3 w-px" style={{ background: 'rgba(255,255,255,0.12)' }} />
            {['Next.js 15', 'Medusa.js', 'Meilisearch', 'Supabase', 'Sanity CMS', 'n8n', 'Vercel', 'PayFast', 'Ozow', 'TypeScript'].map(tech => (
              <span key={tech} className="text-xs px-3 py-1" style={{ color: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.12)' }}>
                {tech}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── PACKAGES ──────────────────────────────────────────────────────── */}
      <section id="packages" className="py-24 px-8 lg:px-16" style={{ background: '#06080F' }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-3">
            <div className="h-px w-10 bg-[#0D9488]" />
            <span className="text-[10px] tracking-[0.28em] uppercase font-bold text-[#0D9488]">Packages & Pricing</span>
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-12">
            <h2 className="ds text-4xl lg:text-5xl text-white">Three tiers.<br />One obvious choice.</h2>
            <p className="text-sm leading-relaxed max-w-[240px] lg:text-right" style={{ color: 'rgba(255,255,255,0.5)' }}>
              All prices exclude VAT.<br />R18,000 once-off build fee — paid<br />40% / 30% / 30% across milestones.
            </p>
          </div>

          <div className="grid lg:grid-cols-3" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            {PACKAGES.map(({ name, price, period, tagline, features, cta, recommended, badge, savings }) => (
              <div key={name} className="relative flex flex-col p-8 lg:p-10" style={{ borderRight: '1px solid rgba(255,255,255,0.1)', ...(recommended ? { borderTop: '2px solid #0D9488' } : {}) }}>
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: recommended ? '#0D9488' : 'rgba(255,255,255,0.4)' }}>
                      {name}
                    </span>
                    {badge && (
                      <span className="text-[9px] font-bold tracking-wider px-2 py-0.5" style={{ color: '#0D9488', border: '1px solid rgba(13,148,136,0.35)' }}>
                        {badge.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1.5 mb-2">
                    <span className="text-4xl font-bold text-white">{price}</span>
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>{period}</span>
                  </div>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{tagline}</p>
                  {savings && (
                    <div className="mt-4 pl-3 py-1.5" style={{ borderLeft: '2px solid #0D9488' }}>
                      <p className="text-xs font-semibold text-[#0D9488]">{savings}</p>
                    </div>
                  )}
                </div>

                <ul className="space-y-3 flex-1 mb-8">
                  {features.map(f => (
                    <li key={f} className="flex gap-3 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      <span className="shrink-0 text-xs mt-0.5" style={{ color: recommended ? '#0D9488' : 'rgba(255,255,255,0.3)' }}>→</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => scrollTo('next-steps')}
                  className="w-full py-3.5 text-sm font-semibold transition-colors"
                  style={recommended ? { background: '#0D9488', color: '#fff' } : { background: 'transparent', color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.18)' }}
                  onMouseEnter={e => { if (!recommended) { (e.currentTarget as HTMLButtonElement).style.color = '#fff'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.4)' } else { (e.currentTarget as HTMLButtonElement).style.background = '#0f766e' } }}
                  onMouseLeave={e => { if (!recommended) { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.65)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.18)' } else { (e.currentTarget as HTMLButtonElement).style.background = '#0D9488' } }}
                >
                  {cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPARE ───────────────────────────────────────────────────────── */}
      <section id="compare" className="py-24 px-8 lg:px-16" style={{ background: '#F8F9FA' }}>
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-4 mb-3">
            <div className="h-px w-10 bg-[#0D9488]" />
            <span className="text-[10px] tracking-[0.28em] uppercase font-bold text-[#0D9488]">Side by Side</span>
          </div>
          <h2 className="ds text-4xl mb-12" style={{ color: '#06080F' }}>Current state vs TriNext Growth</h2>

          <div style={{ border: '1px solid #E2E8F0', overflow: 'hidden' }}>
            <div className="grid grid-cols-3" style={{ background: '#06080F' }}>
              <div className="px-6 py-4 text-[10px] uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.45)' }}>Feature</div>
              <div className="px-6 py-4 text-[10px] uppercase tracking-[0.15em]" style={{ color: 'rgba(255,255,255,0.45)' }}>tse.co.za today</div>
              <div className="px-6 py-4 text-[10px] uppercase tracking-[0.15em] text-[#0D9488]">TriNext Growth</div>
            </div>
            {COMPARE_ROWS.map(({ feature, current, growth, highlight }, i) => (
              <div key={feature} className="grid grid-cols-3" style={{ borderTop: '1px solid #F1F5F9', background: highlight ? 'rgba(13,148,136,0.06)' : i % 2 === 1 ? '#FAFAFA' : '#fff' }}>
                <div className="px-6 py-4 text-sm" style={{ fontWeight: highlight ? 700 : 500, color: highlight ? '#0F172A' : '#334155' }}>
                  {feature}
                </div>
                <div className="px-6 py-4 text-sm" style={{ color: highlight ? '#DC2626' : '#94A3B8', fontWeight: highlight ? 700 : 400 }}>
                  {highlight && '⚠ '}{current}
                </div>
                <div className="px-6 py-4 text-sm text-[#0D9488]" style={{ fontWeight: highlight ? 700 : 600 }}>
                  {highlight && '✓ '}{growth}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-24 px-8 lg:px-16" style={{ background: '#06080F' }}>
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-3">
            <div className="h-px w-10 bg-[#0D9488]" />
            <span className="text-[10px] tracking-[0.28em] uppercase font-bold text-[#0D9488]">FAQ</span>
          </div>
          <h2 className="ds text-4xl text-white mb-12">Everything you&apos;ll want to know before signing.</h2>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            {FAQS.map(({ q, a }, i) => (
              <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-start justify-between py-6 text-left gap-8 group">
                  <div className="flex gap-6 items-baseline">
                    <span className="font-mono text-xs shrink-0" style={{ color: openFaq === i ? '#0D9488' : 'rgba(255,255,255,0.25)' }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-sm leading-relaxed font-medium" style={{ color: openFaq === i ? '#fff' : 'rgba(255,255,255,0.82)' }}>
                      {q}
                    </span>
                  </div>
                  <span className="text-lg shrink-0 mt-0.5" style={{ color: openFaq === i ? '#0D9488' : 'rgba(255,255,255,0.35)', transform: openFaq === i ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s, color 0.2s', display: 'inline-block' }}>
                    +
                  </span>
                </button>
                {openFaq === i && (
                  <div className="pb-6 pl-12 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── NEXT STEPS + CTA ──────────────────────────────────────────────── */}
      <section id="next-steps" className="py-24 px-8 lg:px-16" style={{ background: '#0A0E1A' }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-3">
            <div className="h-px w-10 bg-[#0D9488]" />
            <span className="text-[10px] tracking-[0.28em] uppercase font-bold text-[#0D9488]">Next Steps</span>
          </div>
          <h2 className="ds text-4xl text-white mb-14">Six steps from approval to live platform.</h2>

          <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-px mb-24" style={{ background: 'rgba(255,255,255,0.07)' }}>
            {NEXT_STEPS.map(({ step, title, desc, timeline }) => (
              <div key={step} className="p-6" style={{ background: '#0A0E1A' }}>
                <div className="font-mono text-xs mb-3 text-[#0D9488]">{step}</div>
                <div className="text-[10px] uppercase tracking-widest mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>{timeline}</div>
                <h3 className="text-xs font-semibold text-white mb-2">{title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.6)' }}>{desc}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="grid lg:grid-cols-2 gap-16 pt-16 items-start" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <h2 className="dsi text-5xl lg:text-6xl text-white leading-[0.92] mb-6">
                Ready to move<br />forward?
              </h2>
              <p className="text-lg leading-relaxed max-w-md mb-10" style={{ color: 'rgba(255,255,255,0.7)' }}>
                Let&apos;s turn TSE&apos;s 34-year reputation into South Africa&apos;s best-known cartridge brand online.
              </p>
              <div className="flex flex-wrap gap-4">
                <a href="mailto:ryno@trinextinnovations.co.za?subject=TSE%20Proposal%20%E2%80%94%20Let's%20Go" className="px-8 py-4 text-sm font-semibold bg-[#0D9488] text-white hover:bg-[#0f766e] transition-colors">
                  Email TriNext to Proceed
                </a>
                <div>
                  <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.45)' }}>
                    Want to see what we&apos;ve already built?
                  </p>
                  <a href="/one" className="inline-flex items-center gap-3 px-8 py-4 text-sm font-semibold transition-colors" style={{ border: '1px solid rgba(13,148,136,0.4)', color: '#0D9488' }}
                     onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(13,148,136,0.08)' }}
                     onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
                  >
                    Have a look — tell us what you like
                    <span>→</span>
                  </a>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] mb-6 font-bold" style={{ color: 'rgba(255,255,255,0.45)' }}>
                TSE Contact Details
              </p>
              <div>
                {[
                  { label: 'Phone', value: '079 873 3558 / 011 708 2304/5' },
                  { label: 'Email', value: 'sales@tse.co.za' },
                  { label: 'Address', value: 'Unit 34 A.P.D. Industrial Park, Kya Sands, Johannesburg' },
                  { label: 'Hours', value: 'Mon–Thu 8am–5pm · Fri 8am–4pm' },
                ].map(({ label, value }) => (
                  <div key={label} className="py-4" style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <span className="text-[10px] uppercase tracking-wider pt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</span>
                    <span className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>{value}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] mt-8 leading-relaxed" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Prepared by TriNext Innovations · Ryno Botes · April 2026 · Confidential
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
