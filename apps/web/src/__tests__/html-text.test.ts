import { describe, it, expect } from 'vitest'
import { htmlToParagraphs, htmlToPlainText } from '@/lib/html-text'

// Shape of a real legacy WooCommerce description as stored in Medusa.
const WOO_DESCRIPTION = `<h2>Canon 737 cartridge</h2>
<p>Looking to optimize your printing experience? Look no further than the Canon 737 cartridge.</p>
<p>Curious about other options? Browse through <a href="https://www.tse.co.za/shop/">our shop</a> to discover more &amp; find the perfect fit.</p>`

describe('htmlToParagraphs', () => {
  it('drops headings and strips tags into clean paragraphs', () => {
    const paras = htmlToParagraphs(WOO_DESCRIPTION)
    expect(paras).toEqual([
      'Looking to optimize your printing experience? Look no further than the Canon 737 cartridge.',
      'Curious about other options? Browse through our shop to discover more & find the perfect fit.',
    ])
  })

  it('leaves no raw tags or old-site URLs behind', () => {
    const joined = htmlToParagraphs(WOO_DESCRIPTION).join(' ')
    expect(joined).not.toMatch(/<|>|tse\.co\.za/)
  })

  it('passes plain text through unchanged as a single paragraph', () => {
    expect(htmlToParagraphs('A quality generic cartridge.')).toEqual(['A quality generic cartridge.'])
  })

  it('returns an empty list for empty input', () => {
    expect(htmlToParagraphs('')).toEqual([])
  })

  it('handles <br> and decodes common entities', () => {
    expect(htmlToParagraphs('Line one<br/>Line &#8211; two&nbsp;!')).toEqual(['Line one', 'Line – two !'])
  })
})

describe('htmlToPlainText', () => {
  it('joins paragraphs with spaces for meta descriptions', () => {
    expect(htmlToPlainText('<p>One.</p><p>Two.</p>')).toBe('One. Two.')
  })
})
