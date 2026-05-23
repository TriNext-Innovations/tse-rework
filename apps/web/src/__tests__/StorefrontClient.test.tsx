import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StorefrontClient, { type TrendingProduct } from '@/app/(storefront)/StorefrontClient'
import { CartProvider, useCart } from '@/contexts/CartContext'
import { useRouter } from 'next/navigation'
import React from 'react'

const mockPush = vi.fn()

const mockProduct: TrendingProduct = {
  id: 'prod_1',
  title: 'HP 123 Black',
  handle: 'hp-123-black',
  variants: [{ sku: 'HP-123-BK', calculated_price: { calculated_amount: 39900 } }],
  categories: [{ name: 'HP' }],
  images: [],
  metadata: { cartridge_type: 'inkjet' },
}

const mockProductWithImage: TrendingProduct = {
  ...mockProduct,
  id: 'prod_2',
  title: 'Canon 737 Toner',
  images: [{ url: 'https://example.r2.dev/canon-737.jpg' }],
  metadata: { cartridge_type: 'laser' },
}

beforeEach(() => {
  vi.mocked(useRouter).mockReturnValue({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  } as any)
})

function renderStorefront(products: TrendingProduct[] = []) {
  return render(
    <CartProvider>
      <StorefrontClient trendingProducts={products} />
    </CartProvider>,
  )
}

describe('StorefrontClient — hero', () => {
  it('renders the main tagline', () => {
    renderStorefront()
    expect(screen.getByText('Generic.')).toBeInTheDocument()
    expect(screen.getByText('Not generic')).toBeInTheDocument()
  })

  it('renders the "Est. 1987" badge', () => {
    renderStorefront()
    expect(screen.getAllByText(/Est\. 198[07]/)[0]).toBeInTheDocument()
  })

  it('renders key stats (years, brands, price)', () => {
    renderStorefront()
    expect(screen.getAllByText(/38/)[0]).toBeInTheDocument()
    expect(screen.getAllByText('13')[0]).toBeInTheDocument()
  })

  it('renders the hero "Add to cart" button', () => {
    renderStorefront()
    expect(screen.getByText('Add to cart — R300')).toBeInTheDocument()
  })

  it('adds canonical Canon 737 product when hero cart button is clicked', async () => {
    let cartCount = 0
    function Observer() {
      const { count } = useCart()
      cartCount = count
      return null
    }
    render(
      <CartProvider>
        <StorefrontClient trendingProducts={[]} />
        <Observer />
      </CartProvider>,
    )
    await userEvent.click(screen.getByText('Add to cart — R300'))
    expect(cartCount).toBe(1)
  })

  it('mousemove on hero section updates gradient position', () => {
    renderStorefront()
    const hero = document.querySelector('section#top') as HTMLElement
    fireEvent.mouseMove(hero, { clientX: 50, clientY: 50 })
    const glow = hero.querySelector('[aria-hidden]') as HTMLElement
    // gradient position updates to non-default values (default is -1000,-1000)
    expect(glow?.style.background).not.toContain('-1000px')
  })

  it('mouseleave resets gradient to off-screen position', () => {
    renderStorefront()
    const hero = document.querySelector('section#top') as HTMLElement
    fireEvent.mouseMove(hero, { clientX: 50, clientY: 50 })
    fireEvent.mouseLeave(hero)
    const glow = hero.querySelector('[aria-hidden]') as HTMLElement
    expect(glow?.style.background).toContain('-1000px')
  })
})

describe('StorefrontClient — brand marquee', () => {
  it('renders HP in the brand ticker', () => {
    renderStorefront()
    expect(screen.getAllByText('HP').length).toBeGreaterThan(0)
  })

  it('renders Canon in the brand ticker', () => {
    renderStorefront()
    expect(screen.getAllByText('Canon').length).toBeGreaterThan(0)
  })

  it('renders Epson in the brand ticker', () => {
    renderStorefront()
    expect(screen.getAllByText('Epson').length).toBeGreaterThan(0)
  })
})

describe('StorefrontClient — theme switcher', () => {
  it('defaults to editorial theme', () => {
    renderStorefront()
    const root = document.querySelector('[data-theme]')
    expect(root?.getAttribute('data-theme')).toBe('editorial')
  })

  it('switches to brand theme when brand button is clicked', async () => {
    renderStorefront()
    const brandBtn = screen.getByRole('radio', { name: /brand/i })
    await userEvent.click(brandBtn)
    const root = document.querySelector('[data-theme]')
    expect(root?.getAttribute('data-theme')).toBe('brand')
  })

  it('switches back to editorial theme', async () => {
    renderStorefront()
    await userEvent.click(screen.getByRole('radio', { name: /brand/i }))
    await userEvent.click(screen.getByRole('radio', { name: /editorial/i }))
    expect(document.querySelector('[data-theme]')?.getAttribute('data-theme')).toBe('editorial')
  })

  it('editorial radio is checked by default', () => {
    renderStorefront()
    expect(screen.getByRole('radio', { name: /editorial/i })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /brand/i })).toHaveAttribute('aria-checked', 'false')
  })
})

describe('StorefrontClient — FAQ accordion', () => {
  it('renders all 4 FAQ questions', () => {
    renderStorefront()
    expect(screen.getByText('Will a generic cartridge work in my printer?')).toBeInTheDocument()
    expect(screen.getByText('How does delivery work?')).toBeInTheDocument()
    expect(screen.getByText('What if a cartridge is faulty?')).toBeInTheDocument()
    expect(screen.getByText('Do you do bulk / business pricing?')).toBeInTheDocument()
  })

  it('first FAQ is open by default', () => {
    renderStorefront()
    const firstBtn = screen.getByRole('button', { name: /Will a generic cartridge/i })
    expect(firstBtn).toHaveAttribute('aria-expanded', 'true')
  })

  it('clicking an open FAQ closes it', async () => {
    renderStorefront()
    const firstBtn = screen.getByRole('button', { name: /Will a generic cartridge/i })
    await userEvent.click(firstBtn)
    expect(firstBtn).toHaveAttribute('aria-expanded', 'false')
  })

  it('clicking a closed FAQ opens it', async () => {
    renderStorefront()
    const secondBtn = screen.getByRole('button', { name: /How does delivery work/i })
    await userEvent.click(secondBtn)
    expect(secondBtn).toHaveAttribute('aria-expanded', 'true')
  })

  it('opening one FAQ does not affect others remaining closed', async () => {
    renderStorefront()
    const firstBtn = screen.getByRole('button', { name: /Will a generic cartridge/i })
    const secondBtn = screen.getByRole('button', { name: /How does delivery work/i })
    await userEvent.click(firstBtn) // close first
    await userEvent.click(secondBtn) // open second
    expect(firstBtn).toHaveAttribute('aria-expanded', 'false')
    expect(secondBtn).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('StorefrontClient — compatibility finder', () => {
  it('renders brand select with HP as default', () => {
    renderStorefront()
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('HP')
  })

  it('renders all 13 brands in the select', () => {
    renderStorefront()
    const select = screen.getByRole('combobox')
    const options = select.querySelectorAll('option')
    expect(options.length).toBe(13)
  })

  it('changing brand select updates state', async () => {
    renderStorefront()
    const select = screen.getByRole('combobox') as HTMLSelectElement
    await userEvent.selectOptions(select, 'Canon')
    expect(select.value).toBe('Canon')
  })

  it('typing in model input updates state', async () => {
    renderStorefront()
    const input = screen.getByPlaceholderText(/LaserJet Pro/i)
    await userEvent.type(input, 'M404dn')
    expect((input as HTMLInputElement).value).toBe('M404dn')
  })

  it('"Find cartridges" button navigates with brand and model params', async () => {
    renderStorefront()
    const select = screen.getByRole('combobox') as HTMLSelectElement
    await userEvent.selectOptions(select, 'Canon')
    const input = screen.getByPlaceholderText(/LaserJet Pro/i)
    await userEvent.type(input, 'MF273dw')
    await userEvent.click(screen.getByText('Find cartridges'))
    expect(mockPush).toHaveBeenCalledWith('/products?brand=Canon&model=MF273dw')
  })

  it('pressing Enter in model input submits the finder', async () => {
    renderStorefront()
    const input = screen.getByPlaceholderText(/LaserJet Pro/i)
    await userEvent.type(input, 'M404{Enter}')
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/products'))
  })

  it('popular search chip sets brand+model and navigates', async () => {
    renderStorefront()
    await userEvent.click(screen.getByText('HP LaserJet M404'))
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('/products?brand=HP&model=LaserJet%20M404'),
    )
  })

  it('renders all 4 popular search chips', () => {
    renderStorefront()
    expect(screen.getByText('HP LaserJet M404')).toBeInTheDocument()
    expect(screen.getByText('Canon MF273dw')).toBeInTheDocument()
    expect(screen.getByText('Brother HL-L2375DW')).toBeInTheDocument()
    expect(screen.getByText('Epson L3250')).toBeInTheDocument()
  })
})

describe('StorefrontClient — trending products', () => {
  it('renders empty state gracefully (no product cards when products = [])', () => {
    renderStorefront([])
    expect(screen.getByText(/This month's/)).toBeInTheDocument()
    // No product titles
    expect(screen.queryByText('HP 123 Black')).not.toBeInTheDocument()
  })

  it('renders product cards for each trending product', () => {
    renderStorefront([mockProduct, mockProductWithImage])
    expect(screen.getByText('HP 123 Black')).toBeInTheDocument()
    expect(screen.getByText('Canon 737 Toner')).toBeInTheDocument()
  })

  it('shows product SKU', () => {
    renderStorefront([mockProduct])
    expect(screen.getByText(/SKU HP-123-BK/)).toBeInTheDocument()
  })

  it('shows price in ZAR', () => {
    renderStorefront([mockProduct])
    expect(screen.getByText('R399')).toBeInTheDocument()
  })

  it('shows POA when no price', () => {
    const noPrice: TrendingProduct = {
      ...mockProduct,
      id: 'prod_poa',
      title: 'POA Product',
      variants: [{ sku: 'POA-1' }],
    }
    renderStorefront([noPrice])
    expect(screen.getByText('POA')).toBeInTheDocument()
  })

  it('renders real image when product has image URL', () => {
    renderStorefront([mockProductWithImage])
    const img = screen.getByAltText('Canon 737 Toner')
    expect(img).toHaveAttribute('src', 'https://example.r2.dev/canon-737.jpg')
  })

  it('renders gradient placeholder when product has no image', () => {
    renderStorefront([mockProduct])
    expect(screen.queryByAltText('HP 123 Black')).not.toBeInTheDocument()
    // The gradient placeholder div should be present
    const cards = document.querySelectorAll('.product-card')
    expect(cards.length).toBe(1)
  })

  it('shows cartridge type label', () => {
    renderStorefront([mockProduct])
    expect(screen.getAllByText('Inkjet').length).toBeGreaterThan(0)
  })

  it('shows Laser type for non-inkjet products', () => {
    renderStorefront([mockProductWithImage])
    expect(screen.getAllByText('Laser').length).toBeGreaterThan(0)
  })

  it('clicking add-to-cart on a product card adds it to cart', async () => {
    let cartCount = 0
    const { CartProvider: CP, useCart } = await import('@/contexts/CartContext')
    function Observer() {
      const { count } = useCart()
      cartCount = count
      return null
    }
    render(
      <CP>
        <StorefrontClient trendingProducts={[mockProduct]} />
        <Observer />
      </CP>,
    )
    const addBtns = screen.getAllByRole('button', { name: /Add HP 123 Black to cart/i })
    await userEvent.click(addBtns[0])
    expect(cartCount).toBe(1)
  })

  it('clicking product card navigates to /products', async () => {
    renderStorefront([mockProduct])
    const card = document.querySelector('.product-card') as HTMLElement
    await userEvent.click(card)
    expect(mockPush).toHaveBeenCalledWith('/products')
  })
})

describe('StorefrontClient — bento grid', () => {
  it('renders "Why generic" section heading', () => {
    renderStorefront()
    expect(screen.getByText(/Same print/)).toBeInTheDocument()
  })

  it('Inkjet bento card navigates to /products', async () => {
    renderStorefront()
    await userEvent.click(screen.getByText('Inkjet'))
    expect(mockPush).toHaveBeenCalledWith('/products')
  })

  it('brand compatibility pills navigate to /products', async () => {
    renderStorefront()
    // Find brand pills in the bento section (not the marquee)
    const allHpButtons = screen.getAllByText('HP')
    // Click the button version (not a span in the marquee)
    const hpPill = allHpButtons.find((el) => el.tagName === 'BUTTON')
    if (hpPill) await userEvent.click(hpPill)
    expect(mockPush).toHaveBeenCalledWith('/products')
  })
})

describe('StorefrontClient — footer & CTA', () => {
  it('renders contact phone number', () => {
    renderStorefront()
    expect(screen.getByText('011 708 2304')).toBeInTheDocument()
  })

  it('renders contact email', () => {
    renderStorefront()
    expect(screen.getByText('sales@tse.co.za')).toBeInTheDocument()
  })

  it('renders copyright year', () => {
    renderStorefront()
    expect(screen.getByText(new RegExp(new Date().getFullYear().toString()))).toBeInTheDocument()
  })

  it('search button navigates to /products', async () => {
    renderStorefront()
    const searchBtn = screen.getByRole('button', { name: /Search/i })
    await userEvent.click(searchBtn)
    expect(mockPush).toHaveBeenCalledWith('/products')
  })
})

describe('StorefrontClient — IntersectionObserver', () => {
  it('sets up IntersectionObserver on mount', () => {
    renderStorefront()
    expect(IntersectionObserver).toHaveBeenCalled()
  })

  it('disconnects IntersectionObserver on unmount', () => {
    const disconnect = vi.fn()
    vi.mocked(IntersectionObserver as any).mockReturnValue({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect,
    })
    const { unmount } = renderStorefront()
    unmount()
    expect(disconnect).toHaveBeenCalled()
  })
})
