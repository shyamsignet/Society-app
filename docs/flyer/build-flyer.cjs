#!/usr/bin/env node
// Builds the one-page A4 resident flyer for Sociyo.
//
//   npm run flyer                                   → blank placeholders (fill by hand / in browser)
//   npm run flyer -- --name "Shanti Nagar CHS" --code SHANTI42 --phone "020 1234 5678"
//
// Writes docs/flyer/sociyo-flyer.html (self-contained, editable in a browser, Ctrl+P to print)
// and, when Playwright + Chromium are available, sociyo-flyer.pdf and sociyo-flyer.png.
const fs = require('fs')
const path = require('path')
const QRCode = require('qrcode')

const ROOT = path.join(__dirname, '..', '..')
const OUT = __dirname
const APP_URL = 'https://shyamsignet.github.io/Society-app/'

const args = process.argv.slice(2)
const arg = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : '' }
const fill = { name: arg('name'), code: arg('code'), phone: arg('phone') }
const suffix = arg('out') || ''

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const font = (file) => fs.readFileSync(path.join(ROOT, 'node_modules/@fontsource', file)).toString('base64')

// Lucide icons (ISC licence) read straight from lucide-react so the flyer matches the app.
function icon(name) {
  const src = fs.readFileSync(path.join(ROOT, 'node_modules/lucide-react/dist/esm/icons', `${name}.js`), 'utf8')
  const node = new Function(`return ${src.slice(src.indexOf('['), src.lastIndexOf(']') + 1)}`)()
  const kids = node.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('')
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${kids}</svg>`
}

const logo = fs.readFileSync(path.join(ROOT, 'public/favicon.svg'), 'utf8')

const FEATURES = [
  ['wallet', 'Pay maintenance', 'See your bill, pay by UPI, get receipts'],
  ['wrench', 'Complaints & requests', 'Raise a ticket, track it till it’s fixed'],
  ['qr-code', 'Visitor passes', 'QR / OTP gate pass for guests & deliveries'],
  ['megaphone', 'Notices', 'Urgent alerts and committee announcements'],
  ['calendar-check', 'Book facilities', 'Clubhouse, hall, courts – no double booking'],
  ['message-circle', 'Community feed', 'Posts, lost & found, recommendations'],
  ['party-popper', 'Events & polls', 'RSVP, photos, vote on society decisions'],
  ['siren', 'Emergency SOS', 'One tap to alert security and get help'],
  ['book-user', 'Directory & marketplace', 'Neighbours, staff contacts, buy & sell']
]

const field = (key, label, hint, cls = '') =>
  `<span class="field ${cls}" contenteditable="true" spellcheck="false" data-key="${key}" data-placeholder="${esc(hint)}" aria-label="${esc(label)}">${esc(fill[key])}</span>`

async function main() {
  const qr = await QRCode.toString(APP_URL, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#13254A', light: '#FFFFFF' } })

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Sociyo flyer</title>
<style>
@font-face { font-family: 'Jakarta'; font-weight: 400; src: url(data:font/woff2;base64,${font('plus-jakarta-sans/files/plus-jakarta-sans-latin-400-normal.woff2')}) format('woff2'); }
@font-face { font-family: 'Jakarta'; font-weight: 600; src: url(data:font/woff2;base64,${font('plus-jakarta-sans/files/plus-jakarta-sans-latin-600-normal.woff2')}) format('woff2'); }
@font-face { font-family: 'Jakarta'; font-weight: 800; src: url(data:font/woff2;base64,${font('plus-jakarta-sans/files/plus-jakarta-sans-latin-800-normal.woff2')}) format('woff2'); }
@font-face { font-family: 'NotoDeva'; font-weight: 600; src: url(data:font/woff2;base64,${font('noto-sans-devanagari/files/noto-sans-devanagari-devanagari-600-normal.woff2')}) format('woff2'); }
:root { --navy: #13254A; --navy-2: #0A1A2E; --green: #22C55E; --green-d: #15803D; --ink: #1E293B; --muted: #64748B; --line: #E2E8F0; --tint: #F1F5F9; }
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #CBD5E1; }
body { font-family: 'Jakarta', 'NotoDeva', system-ui, sans-serif; color: var(--ink); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.page { width: 210mm; height: 297mm; margin: 10mm auto; background: #fff; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 4px 24px rgba(0,0,0,.15); }
@media print { html, body { background: #fff; } .page { margin: 0; box-shadow: none; } .hint { display: none; } }
.deva { font-family: 'NotoDeva', 'Jakarta', sans-serif; }

header { flex: none; background: linear-gradient(135deg, var(--navy) 0%, var(--navy-2) 100%); color: #fff; padding: 9mm 14mm 7mm; position: relative; overflow: hidden; }
header::after { content: ''; position: absolute; right: -30mm; top: -30mm; width: 90mm; height: 90mm; border-radius: 50%; background: radial-gradient(circle, rgba(34,197,94,.28), rgba(34,197,94,0) 70%); }
.brand { display: flex; align-items: center; gap: 5mm; position: relative; z-index: 1; }
.brand svg { width: 20mm; height: 20mm; border-radius: 5.5mm; box-shadow: 0 0 0 .4mm rgba(255,255,255,.18); }
.brand h1 { margin: 0; font-size: 18mm; line-height: .9; font-weight: 800; letter-spacing: -.6mm; }
.taglines { position: relative; z-index: 1; margin-top: 4mm; display: flex; flex-wrap: wrap; align-items: baseline; gap: 2mm 6mm; }
.taglines .en { font-size: 8.5mm; font-weight: 800; }
.taglines .en b { color: var(--green); font-weight: 800; }
.taglines .deva { font-size: 5mm; color: #C7D2E6; }
.now { position: relative; z-index: 1; margin-top: 3.5mm; font-size: 4.4mm; color: #DCE4F2; }
.now .field { color: #fff; font-weight: 800; min-width: 70mm; }

main { flex: 1; min-height: 0; padding: 6.5mm 14mm 0; display: flex; flex-direction: column; }
h2 { font-size: 4.2mm; text-transform: uppercase; letter-spacing: .5mm; color: var(--muted); margin: 0 0 3.5mm; font-weight: 800; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; }
.tile { border: .3mm solid var(--line); border-radius: 4mm; padding: 2.8mm 3.6mm 2.6mm; background: #fff; }
.tile .ic { width: 9mm; height: 9mm; border-radius: 3mm; display: grid; place-items: center; background: #EEF2FA; color: var(--navy); margin-bottom: 2mm; }
.tile:nth-child(3n+2) .ic { background: #DCFCE7; color: var(--green-d); }
.tile .ic svg { width: 5.8mm; height: 5.8mm; }
.tile b { display: block; font-size: 4mm; font-weight: 800; color: var(--navy); }
.tile span { display: block; font-size: 3.1mm; line-height: 1.35; color: var(--muted); margin-top: .8mm; }
.langs { margin-top: 3mm; font-size: 3.3mm; color: var(--muted); text-align: center; }
.langs b { color: var(--navy); }

.install { margin-top: 4.5mm; display: grid; grid-template-columns: 1fr 56mm; gap: 6mm; align-items: stretch; }
.steps { display: flex; flex-direction: column; gap: 2.6mm; }
.step { display: flex; gap: 3.5mm; align-items: flex-start; }
.step .n { flex: none; width: 8.5mm; height: 8.5mm; border-radius: 50%; background: var(--green); color: #fff; font-weight: 800; font-size: 4.4mm; display: grid; place-items: center; }
.step b { display: block; font-size: 4.1mm; color: var(--navy); }
.step span { display: block; font-size: 3.25mm; line-height: 1.4; color: var(--muted); margin-top: .5mm; }
.step code { font-family: inherit; font-weight: 800; color: var(--ink); background: var(--tint); padding: 0 1.2mm; border-radius: 1mm; }
.qr { border-radius: 5mm; background: var(--navy); color: #fff; padding: 5mm; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.qr .code { background: #fff; padding: 2.6mm; border-radius: 3mm; width: 40mm; height: 40mm; }
.qr .code svg { width: 100%; height: 100%; display: block; }
.qr b { display: block; margin-top: 3mm; font-size: 3.8mm; }
.qr small { display: block; margin-top: 1mm; font-size: 2.6mm; color: #C7D2E6; white-space: nowrap; }

footer { flex: none; margin: 4.5mm 14mm 7mm; border: .5mm dashed #94A3B8; border-radius: 4mm; padding: 3.5mm 5mm; display: grid; grid-template-columns: 1.15fr 1fr; gap: 3mm 6mm; }
footer label { display: block; font-size: 2.9mm; text-transform: uppercase; letter-spacing: .35mm; color: var(--muted); font-weight: 800; }
footer .field { display: block; margin-top: 1.2mm; font-size: 5.2mm; font-weight: 800; color: var(--navy); min-height: 7.5mm; border-bottom: .35mm dotted #94A3B8; }
footer .code .field { letter-spacing: .8mm; color: var(--green-d); }
footer .wide { grid-column: 1 / -1; font-size: 3.1mm; color: var(--muted); }

.field { outline: none; }
.field:empty::before { content: attr(data-placeholder); color: #94A3B8; font-weight: 600; }
header .field:empty::before { color: #8FA3C7; }
@media print { .field:empty::before { content: ''; } .now .field:empty { display: inline-block; border-bottom: .35mm dotted #8FA3C7; } }
.hint { max-width: 210mm; margin: 0 auto 10mm; font: 13px/1.5 system-ui, sans-serif; color: #334155; text-align: center; }
</style>
</head>
<body>
<div class="page">
  <header>
    <div class="brand">${logo}<h1>Sociyo</h1></div>
    <div class="taglines">
      <span class="en">Your society, <b>sorted.</b></span>
      <span class="deva">सोसायटी, सोपी.</span>
      <span class="deva">सोसाइटी, आसान.</span>
    </div>
    <div class="now">Now live for residents of ${field('name', 'Society name', '[ Your society name ]')}</div>
  </header>

  <main>
    <h2>Everything for your society, in one app</h2>
    <div class="grid">
      ${FEATURES.map(([ic, t, d]) => `<div class="tile"><div class="ic">${icon(ic)}</div><b>${t}</b><span>${d}</span></div>`).join('\n      ')}
    </div>
    <div class="langs">Use it in <b>English</b> · <b class="deva">मराठी</b> · <b class="deva">हिंदी</b> &nbsp;—&nbsp; no app store, works on any Android phone or iPhone</div>

    <div class="install">
      <div>
        <h2>Install in 3 steps</h2>
        <div class="steps">
          <div class="step"><div class="n">1</div><div><b>Scan the QR code</b><span>Opens Sociyo in your browser – use <code>Chrome</code> on Android, <code>Safari</code> on iPhone.</span></div></div>
          <div class="step"><div class="n">2</div><div><b>Add to Home screen</b><span>Android: tap <code>⋮</code> → <code>Add to Home screen</code>. iPhone: tap <code>Share</code> → <code>Add to Home Screen</code>.</span></div></div>
          <div class="step"><div class="n">3</div><div><b>Log in &amp; join your society</b><span>Choose <code>Email</code> (or mobile), enter the code you receive, tap <code>Join my society</code>, type the society code below and pick your flat.</span></div></div>
        </div>
      </div>
      <div class="qr">
        <div class="code">${qr}</div>
        <b>Scan to open Sociyo</b>
        <small>${APP_URL.replace('https://', '')}</small>
      </div>
    </div>
  </main>

  <footer>
    <div><label>Society</label>${field('name', 'Society name', 'Society name')}</div>
    <div class="code"><label>Society code</label>${field('code', 'Society code', 'e.g. ABC123')}</div>
    <div><label>Society office</label>${field('phone', 'Office phone', 'Office phone number')}</div>
    <div><label>Help</label><span class="field" style="font-size:3.6mm;border:0;color:var(--muted);font-weight:600">Ask the society office or committee</span></div>
  </footer>
</div>
<p class="hint">Click the grey placeholders to type your society’s details, then press <b>Ctrl+P</b> (A4, margins: none, background graphics on) to print or save as PDF.</p>
<script>
  // Keep the two "society name" fields in sync while typing.
  document.querySelectorAll('.field[data-key]').forEach((el) => el.addEventListener('input', () => {
    document.querySelectorAll('.field[data-key="' + el.dataset.key + '"]').forEach((o) => { if (o !== el) o.textContent = el.textContent })
  }))
</script>
</body>
</html>
`
  const base = path.join(OUT, `sociyo-flyer${suffix}`)
  fs.writeFileSync(`${base}.html`, html)
  console.log('wrote', path.relative(ROOT, `${base}.html`))

  let chromium
  try { ({ chromium } = require('playwright')) } catch { console.log('Playwright not installed – open the HTML in Chrome and print to PDF instead.'); return }
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 })
  await page.goto('file://' + `${base}.html`)
  await page.evaluate(() => document.fonts.ready)
  await page.pdf({ path: `${base}.pdf`, format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } })
  await page.emulateMedia({ media: 'print' })
  await page.locator('.page').screenshot({ path: `${base}.png` })
  await browser.close()
  console.log('wrote', path.relative(ROOT, `${base}.pdf`), 'and .png')
}

main().catch((e) => { console.error(e); process.exit(1) })
