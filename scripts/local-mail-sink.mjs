// Local stand-in for ZeptoMail (#528). Point the backend at it with
//   ZEPTOMAIL_API_URL=http://127.0.0.1:8025  ZEPTOMAIL_TOKEN=local
// and every email is written to .local-mail/<n>-<subject>.html instead of sent.
import { createServer } from 'node:http'
import { mkdirSync, writeFileSync } from 'node:fs'

const dir = new URL('../.local-mail/', import.meta.url)
mkdirSync(dir, { recursive: true })
let n = 0

createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', () => {
    const mail = JSON.parse(body || '{}')
    const to = (mail.to ?? []).map((t) => t.email_address?.address).join(', ')
    const slug = String(mail.subject ?? 'no-subject').replace(/[^\w]+/g, '-').slice(0, 60)
    const file = new URL(`${String(++n).padStart(3, '0')}-${slug}.html`, dir)
    writeFileSync(file, `<!-- to: ${to} | subject: ${mail.subject} -->\n${mail.htmlbody ?? ''}`)
    console.log(`[mail-sink] ${to} | ${mail.subject}`)
    res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"data":[]}')
  })
}).listen(8025, '127.0.0.1', () => console.log('[mail-sink] listening on 127.0.0.1:8025'))
