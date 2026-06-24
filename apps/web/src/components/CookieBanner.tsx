'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'tse_cookie_consent'

export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true)
    } catch {
      // localStorage unavailable (SSR guard)
    }
  }, [])

  function accept(level: 'all' | 'necessary') {
    try {
      localStorage.setItem(STORAGE_KEY, level)
    } catch {}
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-[100] max-w-2xl mx-auto"
    >
      <div className="bg-[#111827] text-white rounded-2xl shadow-2xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm leading-relaxed text-white/90">
            We use cookies to make the site work and to understand how you use it. By continuing you agree to our{' '}
            <Link href="/legal/cookies" className="underline underline-offset-2 hover:text-[#dfe344] transition-colors">
              cookie policy
            </Link>
            {' '}and{' '}
            <Link href="/legal/privacy" className="underline underline-offset-2 hover:text-[#dfe344] transition-colors">
              privacy policy
            </Link>
            .
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => accept('necessary')}
            className="text-xs px-3 py-2 rounded-full border border-white/20 hover:border-white/50 text-white/70 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            Necessary only
          </button>
          <button
            onClick={() => accept('all')}
            className="text-xs px-4 py-2 rounded-full bg-[#dfe344] text-[#111827] font-semibold hover:bg-[#e8ec62] transition-colors cursor-pointer whitespace-nowrap"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  )
}
