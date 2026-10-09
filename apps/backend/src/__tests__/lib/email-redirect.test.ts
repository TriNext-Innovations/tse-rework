import { afterEach, describe, expect, it } from 'vitest'
import { applyEmailRedirect } from '../../lib/email'

const base = {
  to: 'customer@example.com',
  cc: ['sales@tse.co.za'],
  subject: 'Your order #12',
  html: '<p>hi</p>',
}

describe('applyEmailRedirect', () => {
  afterEach(() => {
    delete process.env.EMAIL_REDIRECT_TO
  })

  it('leaves the email untouched when EMAIL_REDIRECT_TO is unset', () => {
    expect(applyEmailRedirect(base)).toEqual(base)
  })

  it('sends to the redirect address only, dropping every CC', () => {
    process.env.EMAIL_REDIRECT_TO = 'info@trinextinnovations.co.za'
    const out = applyEmailRedirect(base)
    expect(out.to).toBe('info@trinextinnovations.co.za')
    expect(out.cc).toEqual([])
  })

  it('names the original recipients in the subject', () => {
    process.env.EMAIL_REDIRECT_TO = 'info@trinextinnovations.co.za'
    expect(applyEmailRedirect(base).subject).toBe(
      '[LOCAL → customer@example.com, sales@tse.co.za] Your order #12',
    )
  })
})
