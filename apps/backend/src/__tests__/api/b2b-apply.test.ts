import { describe, it, expect } from 'vitest'
import { applicationEmails, readApplication } from '../../api/store/b2b/apply/route'
import { escapeHtml } from '../../lib/html'

const applicant = { id: 'cus_01TEST', email: 'jane@acme.co.za' }

const complete = {
  company_name: 'Acme Office Supplies',
  contact_name: 'Jane Smith',
  phone: '011 234 5678',
  business_type: 'IT Reseller',
  monthly_volume: 'R2 000 – R5 000',
  message: 'We run 14 HP LaserJets.',
}

describe('readApplication', () => {
  it('accepts a complete application, trimmed', () => {
    expect(readApplication({ ...complete, company_name: '  Acme Office Supplies  ' })).toEqual(complete)
  })

  it.each(['company_name', 'contact_name', 'phone'] as const)('rejects an application without %s', (field) => {
    expect(readApplication({ ...complete, [field]: '   ' })).toBeNull()
  })

  it('collapses line breaks in single-line fields, so none reach the email subject', () => {
    const app = readApplication({ ...complete, company_name: 'Acme\r\nBcc: someone@else.com' })
    expect(app?.company_name).toBe('Acme Bcc: someone@else.com')
  })

  it('keeps the message multi-line but bounded', () => {
    const app = readApplication({ ...complete, message: 'line one\nline two' + 'x'.repeat(5000) })
    expect(app?.message.startsWith('line one\nline two')).toBe(true)
    expect(app?.message.length).toBe(2000)
  })
})

describe('applicationEmails', () => {
  it('names the customer account so sales can find it and approve it', () => {
    const { sales } = applicationEmails(applicant, readApplication(complete)!)
    expect(sales.html).toContain('jane@acme.co.za')
    expect(sales.html).toContain('cus_01TEST')
    expect(sales.subject).toBe('🏢 New B2B Application — Acme Office Supplies')
  })

  it('escapes everything the shopper typed', () => {
    const hostile = readApplication({
      ...complete,
      contact_name: '<a href="https://phish.example">Claim your refund</a>',
      company_name: '<img src=x onerror=alert(1)>',
    })!
    const { sales, acknowledgement } = applicationEmails(applicant, hostile)
    for (const html of [sales.html, acknowledgement.html]) {
      expect(html).not.toContain('<a href="https://phish.example">')
      expect(html).not.toContain('<img src=x')
    }
    expect(acknowledgement.html).toContain(escapeHtml('<a href="https://phish.example">Claim your refund</a>'))
  })
})

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<b>"Tom" & 'Jerry'</b>`)).toBe('&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;')
  })

  it('renders null and undefined as empty text', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })
})
