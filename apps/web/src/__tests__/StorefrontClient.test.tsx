import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StorefrontClient, {
  type TrendingProduct,
  type CompatModel,
  type HeroProduct,
} from '@/app/(storefront)/StorefrontClient'
import { CartProvider, useCart } from '@/contexts/CartContext'
import { installCartMock } from './helpers/medusaCartMock'
import { useRouter } from 'next/navigation'
import React from 'react'

const mockPush = vi.fn()

const mockProduct: TrendingProduct = {
  id: 'prod_1',
  title: 'HP 123 Black',
  handle: 'hp-123-black',
  variants: [{ sku: 'HP-123-BK', calculated_price: { calculated_amount: 399 } }],
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

// 13 distinct brands; first four (in array order) drive the "popular searches"
// chips, so they're ordered HP, Canon, Brother, Epson to match those assertions.
const mockCompatModels: CompatModel[] = [
  { brand: 'HP', model: 'LaserJet M404', cartridge_count: 5 },
  { brand: 'Canon', model: 'MF273dw', cartridge_count: 4 },
  { brand: 'Brother', model: 'HL-L2375DW', cartridge_count: 4 },
  { brand: 'Epson', model: 'L3250', cartridge_count: 3 },
  { brand: 'Lexmark', model: 'MS431', cartridge_count: 2 },
  { brand: 'Kyocera', model: 'P2040', cartridge_count: 2 },
  { brand: 'Samsung', model: 'M2020', cartridge_count: 2 },
  { brand: 'Ricoh', model: 'SP330', cartridge_count: 1 },
  { brand: 'OKI', model: 'B412', cartridge_count: 1 },
  { brand: 'Xerox', model: 'B210', cartridge_count: 1 },
  { brand: 'Konica Minolta', model: 'B4000', cartridge_count: 1 },
  { brand: 'Pantum', model: 'P2500', cartridge_count: 1 },
  { brand: 'Dell', model: 'E310', cartridge_count: 1 },
]

beforeEach(() => {
  localStorage.clear()
  installCartMock()
  vi.mocked(useRouter).mockReturnValue({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  } as any)
})

const mockHeroProduct: HeroProduct = {
  id: 'prod_hero_737',
  title: 'Canon 737',
  handle: 'canon-ca737',
  sku: 'CAN-737',
  variantId: 'variant_hero_737',
  price: 300,
}

function renderStorefront(products: TrendingProduct[] = [], models: CompatModel[] = mockCompatModels) {
  return render(
    <CartProvider>
      <StorefrontClient trendingProducts={products} compatModels={models} heroProduct={mockHeroProduct} />
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
    expect(screen.getAllByText(/39/)[0]).toBeInTheDocument()
    expect(screen.getAllByText('13')[0]).toBeInTheDocument()
  })

  it('renders the hero "Add to cart" button', () => {
    renderStorefront()
    expect(screen.getByText('Add to cart — R300')).toBeInTheDocument()
  })

  it('adds the resolved hero product variant when hero cart button is clicked', async () => {
    let cartCount = 0
    function Observer() {
      const { count } = useCart()
      cartCount = count
      return null
    }
    render(
      <CartProvider>
        <StorefrontClient trendingProducts={[]} compatModels={[]} heroProduct={mockHeroProduct} />
        <Observer />
      </CartProvider>,
    )
    await userEvent.click(screen.getByText('Add to cart — R300'))
    await waitFor(() => expect(cartCount).toBe(1))
  })

  it('falls back to the product page when no hero product resolved', async () => {
    render(
      <CartProvider>
        <StorefrontClient trendingProducts={[]} compatModels={[]} />
      </CartProvider>,
    )
    await userEvent.click(screen.getByText('Add to cart — R300'))
    expect(mockPush).toHaveBeenCalledWith('/products/canon-ca737')
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
  it('defaults the brand select to the first (alphabetical) brand', () => {
    renderStorefront()
    const select = document.querySelector('select') as HTMLSelectElement
    expect(select.value).toBe('Brother')
  })

  it('renders all 13 brands in the select', () => {
    renderStorefront()
    const select = document.querySelector('select') as HTMLSelectElement
    const options = select.querySelectorAll('option')
    expect(options.length).toBe(13)
  })

  it('changing brand select updates state', async () => {
    renderStorefront()
    const select = document.querySelector('select') as HTMLSelectElement
    await userEvent.selectOptions(select, 'Canon')
    expect(select.value).toBe('Canon')
  })

  it('typing in model input updates state', async () => {
    renderStorefront()
    const input = screen.getByPlaceholderText(/P1102/i)
    await userEvent.type(input, 'M404dn')
    expect((input as HTMLInputElement).value).toBe('M404dn')
  })

  it('"Find cartridges" button navigates with brand and model params', async () => {
    renderStorefront()
    const select = document.querySelector('select') as HTMLSelectElement
    await userEvent.selectOptions(select, 'Canon')
    const input = screen.getByPlaceholderText(/P1102/i)
    await userEvent.type(input, 'MF273dw')
    await userEvent.click(screen.getByText('Find cartridges'))
    expect(mockPush).toHaveBeenCalledWith('/compatibility?model=Canon%20MF273dw')
  })

  it('pressing Enter in model input submits the finder', async () => {
    renderStorefront()
    const input = screen.getByPlaceholderText(/P1102/i)
    await userEvent.type(input, 'M404{Enter}')
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/compatibility'))
  })

  it('popular search chip sets brand+model and navigates', async () => {
    renderStorefront()
    await userEvent.click(screen.getByText('HP LaserJet M404'))
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('/compatibility?model=HP%20LaserJet%20M404'),
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
        <StorefrontClient trendingProducts={[mockProduct]} compatModels={[]} />
        <Observer />
      </CP>,
    )
    const addBtns = screen.getAllByRole('button', { name: /Add HP 123 Black to cart/i })
    await userEvent.click(addBtns[0]!)
    await waitFor(() => expect(cartCount).toBe(1))
  })

  it('clicking product card navigates to /products', async () => {
    renderStorefront([mockProduct])
    const card = document.querySelector('.product-card') as HTMLElement
    await userEvent.click(card)
    expect(mockPush).toHaveBeenCalledWith('/products/hp-123-black')
  })
})

describe('StorefrontClient — bento grid', () => {
  it('renders "Why generic" section heading', () => {
    renderStorefront()
    expect(screen.getByText(/Same print/)).toBeInTheDocument()
  })

  it('Inkjet bento card navigates to the inkjet-filtered catalogue', async () => {
    renderStorefront()
    await userEvent.click(screen.getByText('Inkjet'))
    expect(mockPush).toHaveBeenCalledWith('/products?type=inkjet')
  })

  it('brand compatibility pills navigate to the brand-filtered catalogue', async () => {
    renderStorefront()
    // Find brand pills in the bento section (not the marquee)
    const allHpButtons = screen.getAllByText('HP')
    // Click the button version (not a span in the marquee)
    const hpPill = allHpButtons.find((el) => el.tagName === 'BUTTON')
    if (hpPill) await userEvent.click(hpPill)
    expect(mockPush).toHaveBeenCalledWith('/products?brand=HP')
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

  it('search button opens the search modal', async () => {
    renderStorefront()
    await userEvent.click(screen.getByRole('button', { name: /Search products/i }))
    expect(screen.getByRole('dialog', { name: /Search/i })).toBeInTheDocument()
  })
})

describe('StorefrontClient — IntersectionObserver', () => {
  it('sets up IntersectionObserver on mount', () => {
    renderStorefront()
    expect(IntersectionObserver).toHaveBeenCalled()
  })

  it('disconnects IntersectionObserver on unmount', () => {
    const disconnect = vi.fn()
    vi.mocked(IntersectionObserver as any).mockImplementation(function () {
      return { observe: vi.fn(), unobserve: vi.fn(), disconnect }
    })
    const { unmount } = renderStorefront()
    unmount()
    expect(disconnect).toHaveBeenCalled()
  })
})
