import { Logo } from './Logo'

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-brand-border bg-brand-bg/95 backdrop-blur supports-[backdrop-filter]:bg-brand-bg/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo width={100} variant="color" />

        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          <a href="/shop"         className="text-brand-text-muted transition-colors hover:text-brand-primary">Shop</a>
          <a href="/find-your-cartridge" className="text-brand-text-muted transition-colors hover:text-brand-primary">Find Your Cartridge</a>
          <a href="/about"        className="text-brand-text-muted transition-colors hover:text-brand-primary">About</a>
          <a href="/contact"      className="text-brand-text-muted transition-colors hover:text-brand-primary">Contact</a>
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="/cart"
            className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-brand-surface transition-colors"
            aria-label="Cart"
          >
            <CartIcon />
          </a>
        </div>
      </div>
    </header>
  )
}

function CartIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8"  cy="21" r="1" /><circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  )
}
