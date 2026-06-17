import '@testing-library/jest-dom'
import { vi, beforeEach } from 'vitest'
import React from 'react'

// ── Next.js navigation ──────────────────────────────────────────────────────
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  usePathname: vi.fn(() => '/'),
  useParams: vi.fn(() => ({})),
}))

// ── Next.js Image → plain <img> ──────────────────────────────────────────────
vi.mock('next/image', () => ({
  default: ({ src, alt, width, height, className }: any) =>
    React.createElement('img', { src, alt, width, height, className }),
}))

// ── Next.js Link → plain <a> ─────────────────────────────────────────────────
vi.mock('next/link', () => ({
  default: ({ children, href, className, 'aria-label': ariaLabel, ...rest }: any) =>
    React.createElement('a', { href, className, 'aria-label': ariaLabel, ...rest }, children),
}))

// ── next/dynamic → stub that sets lottieRef when rendered ────────────────────
vi.mock('next/dynamic', () => ({
  default: (_factory: () => Promise<any>, _opts?: any) => {
    function MockDynamic({ lottieRef }: any) {
      if (lottieRef && typeof lottieRef === 'object') {
        lottieRef.current = { goToAndPlay: vi.fn(), stop: vi.fn(), play: vi.fn() }
      }
      return null
    }
    MockDynamic.displayName = 'MockDynamic'
    return MockDynamic
  },
}))

// ── Auth context → default unauthenticated state ─────────────────────────────
// Page/component tests render <Navbar>, which calls useAuth(); without a real
// AuthProvider it throws. Provide a passthrough provider + default state.
vi.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: any) => children,
  useAuth: vi.fn(() => ({
    customer: null,
    token: null,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshCustomer: vi.fn(),
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
  })),
}))

// ── IntersectionObserver ──────────────────────────────────────────────────────
vi.stubGlobal(
  'IntersectionObserver',
  vi.fn(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })),
)

// ── Element.getBoundingClientRect ─────────────────────────────────────────────
Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
  configurable: true,
  value: vi.fn(() => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0 })),
})

// ── Reset call history + persisted state between tests ───────────────────────
beforeEach(() => {
  vi.clearAllMocks()
  // CartContext persists to localStorage['tse_cart']; clear it so cart state
  // doesn't leak between tests.
  localStorage.clear()
})
