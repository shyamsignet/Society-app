#!/usr/bin/env node
// Builds the bilingual (English | मराठी) "Maintenance billing – Chairman's guide" image and PDF.
//   node docs/guides/build-billing-guide.cjs   (needs Playwright + Chromium for PNG/PDF)
const fs = require('fs'), path = require('path')
const ROOT = path.join(__dirname, '..', '..')
const font = (f) => fs.readFileSync(path.join(ROOT, 'node_modules/@fontsource', f)).toString('base64')
const icon = fs.readFileSync(path.join(ROOT, 'public/favicon.svg'), 'utf8')

const STEPS = [
  ['Open billing', 'Open <b>Profile → Admin dashboard → Maintenance billing</b>.',
   'बिलिंग उघडा', '<b>प्रोफाइल → ॲडमिन डॅशबोर्ड → देखभाल शुल्क बिलिंग</b> उघडा.'],
  ['Set the charges (once)', '<b>Charges</b> tab: enter <b>Rate per sq.ft (₹)</b> or a fixed amount per flat, <b>fixed monthly charges</b> such as Sinking Fund or water, the <b>due day of month</b> and the <b>late fee</b>. Tap <b>Save</b>.',
   'शुल्क ठरवा (एकदाच)', '<b>शुल्क</b> टॅब: <b>प्रति चौ.फूट दर (₹)</b> किंवा प्रत्येक सदनिकेसाठी ठराविक रक्कम, सिंकिंग फंड, पाणी यांसारखे <b>ठराविक मासिक शुल्क</b>, <b>महिन्याचा देय दिवस</b> आणि <b>विलंब शुल्क</b> भरा. <b>जतन करा</b> दाबा.'],
  ['Add the society account', 'On the same tab add the <b>Society UPI ID</b>, <b>payee name (as per bank)</b> and bank details. Residents pay straight into this account.',
   'सोसायटीचे खाते जोडा', 'त्याच टॅबवर <b>सोसायटीचा UPI ID</b>, <b>प्राप्तकर्त्याचे नाव (बँकेनुसार)</b> आणि बँक तपशील भरा. रहिवासी थेट या खात्यात पैसे भरतात.'],
  ['Extra charges for one flat', '<b>Flat-specific</b> tab: add a charge for a particular flat only, e.g. a second parking slot.',
   'एका सदनिकेसाठी अतिरिक्त शुल्क', '<b>सदनिकानिहाय</b> टॅब: फक्त एखाद्या सदनिकेसाठी शुल्क जोडा, उदा. दुसरी पार्किंग जागा.'],
  ['Generate the bills – every month', '<b>Collection</b> tab → <b>Generate bills</b> → <b>Generate</b>. Each flat gets its bill and every resident is notified. Doing it twice never makes duplicate bills.',
   'बिले तयार करा – दर महिन्याला', '<b>वसुली</b> टॅब → <b>बिले तयार करा</b> → <b>तयार करा</b>. प्रत्येक सदनिकेला बिल मिळते आणि सर्व रहिवाशांना सूचना जाते. दोनदा केल्याने दुहेरी बिले होत नाहीत.'],
  ['Residents pay', 'Residents tap <b>Pay with UPI app</b>, pay, type the 12-digit UTR and tap <b>I have paid</b>. You get a “Payment to verify” notification.',
   'रहिवासी पैसे भरतात', 'रहिवासी <b>UPI ॲपने भरा</b> दाबून पैसे भरतात, 12 अंकी UTR टाकतात आणि <b>मी पैसे भरले</b> दाबतात. तुम्हाला “पडताळायची पेमेंट” अशी सूचना येते.'],
  ['Check and confirm', 'Under <b>Payments to verify</b>, check the bank statement or UPI app, then tap <b>Money received</b> – the bill is marked paid and the receipt is sent. Money not there? Tap <b>Reject</b> and give a reason.',
   'तपासा आणि खात्री करा', '<b>पडताळायची पेमेंट</b> खाली बँक स्टेटमेंट किंवा UPI ॲप तपासा आणि <b>पैसे मिळाले</b> दाबा – बिल भरले म्हणून नोंदले जाते व पावती पाठवली जाते. पैसे आले नसल्यास <b>नाकारा</b> दाबून कारण लिहा.'],
  ['Cash or cheque', 'Paid at the office? Open that flat’s bill → <b>Record offline payment</b>.',
   'रोख किंवा चेक', 'कार्यालयात पैसे भरले? त्या सदनिकेचे बिल उघडा → <b>ऑफलाइन पेमेंट नोंदवा</b>.'],
  ['Late fees and corrections', 'After the due date tap <b>Apply late fees</b>. On any bill you can <b>Waive late fee</b>, give a <b>Credit / waiver</b> or add an <b>Extra charge</b>.',
   'विलंब शुल्क आणि दुरुस्ती', 'देय तारखेनंतर <b>विलंब शुल्क लावा</b> दाबा. कोणत्याही बिलावर <b>विलंब शुल्क माफ करा</b>, <b>सूट / माफी</b> द्या किंवा <b>अतिरिक्त शुल्क</b> जोडा.'],
  ['Follow up and report', 'Use the <b>Paid · Unpaid · Overdue</b> filters to follow up, <b>Export</b> a CSV for the accountant, and see totals in <b>Admin → Reports</b>.',
   'पाठपुरावा आणि अहवाल', 'पाठपुराव्यासाठी <b>भरले · न भरलेले · मुदत उलटली</b> फिल्टर वापरा, लेखापालासाठी CSV <b>निर्यात</b> करा आणि एकूण रक्कम <b>ॲडमिन → अहवाल</b> मध्ये पाहा.']
]

const html = `<!doctype html><html><head><meta charset="utf-8"><title>SociYo billing guide</title><style>
@font-face{font-family:PJ;font-weight:500;src:url(data:font/woff2;base64,${font('plus-jakarta-sans/files/plus-jakarta-sans-latin-500-normal.woff2')}) format('woff2')}
@font-face{font-family:PJ;font-weight:800;src:url(data:font/woff2;base64,${font('plus-jakarta-sans/files/plus-jakarta-sans-latin-800-normal.woff2')}) format('woff2')}
@font-face{font-family:ND;font-weight:500;src:url(data:font/woff2;base64,${font('noto-sans-devanagari/files/noto-sans-devanagari-devanagari-500-normal.woff2')}) format('woff2')}
@font-face{font-family:ND;font-weight:700;src:url(data:font/woff2;base64,${font('noto-sans-devanagari/files/noto-sans-devanagari-devanagari-700-normal.woff2')}) format('woff2')}
@page{size:A4;margin:0}
*{box-sizing:border-box}
body{margin:0;background:#F7F1E8;font-family:PJ,ND,sans-serif;color:#2E2B2C}
.page{width:1240px;padding:0 0 36px;background:#F7F1E8}
header{background:#3B1F3A;color:#F7F1E8;padding:44px 56px 40px;display:flex;align-items:center;gap:28px;position:relative;overflow:hidden}
header::after{content:'';position:absolute;right:-120px;top:-140px;width:420px;height:420px;border-radius:50%;background:radial-gradient(circle,rgba(232,103,74,.32),rgba(232,103,74,0) 70%)}
header svg{width:104px;height:104px;flex:none;border-radius:24px;box-shadow:0 0 0 2px rgba(255,255,255,.12)}
header h1{margin:0;font-weight:800;font-size:40px;letter-spacing:-.5px;line-height:1.15}
header h1 span{display:block;font-family:ND,PJ;font-weight:700;font-size:34px;color:#D6C8F0;margin-top:6px}
header p{margin:10px 0 0;font-size:19px;color:#ECE4F7}
header p span{font-family:ND}
.cols{display:grid;grid-template-columns:72px 1fr 1fr;gap:0 26px;padding:30px 56px 0}
.colhead{font-weight:800;font-size:15px;letter-spacing:2px;text-transform:uppercase;color:#B04A30;padding-bottom:12px}
.colhead.mr{font-family:ND;letter-spacing:0;font-size:18px}
.row{display:contents}
.n{width:56px;height:56px;border-radius:50%;background:#E8674A;color:#fff;font-weight:800;font-size:26px;display:grid;place-items:center;margin-top:14px}
.cell{background:#FFFCF7;border:1px solid #E7DED2;border-radius:18px;padding:16px 20px;margin-bottom:14px}
.cell h3{margin:0 0 6px;font-size:21px;font-weight:800;color:#2A1529}
.cell p{margin:0;font-size:17.5px;line-height:1.5;color:#3d3639}
.cell b{color:#2A1529}
.mr h3,.mr p{font-family:ND,PJ}
.mr h3{font-weight:700;font-size:22px}
.mr p{font-size:18px;line-height:1.6}
.note{margin:12px 56px 0;display:grid;grid-template-columns:1fr 1fr;gap:26px;background:#3B1F3A;color:#F7F1E8;border-radius:20px;padding:20px 26px}
.note p{margin:0;font-size:16.5px;line-height:1.55}
.note .mr{font-family:ND}
.note b{color:#F2A58F}
footer{margin:22px 56px 0;display:flex;justify-content:space-between;font-size:15px;color:#6E6569}
</style></head><body><div class="page">
<header>${icon}<div>
<h1>Maintenance billing – Chairman’s guide<span>देखभाल शुल्क बिलिंग – अध्यक्षांसाठी मार्गदर्शक</span></h1>
<p>For the Chairman, Treasurer and Society Office · <span>अध्यक्ष, खजिनदार व सोसायटी कार्यालयासाठी</span></p>
</div></header>
<div class="cols">
<div></div><div class="colhead">English</div><div class="colhead mr">मराठी</div>
${STEPS.map(([te, be, tm, bm], i) => `<div class="row"><div class="n">${i + 1}</div><div class="cell"><h3>${te}</h3><p>${be}</p></div><div class="cell mr"><h3>${tm}</h3><p>${bm}</p></div></div>`).join('\n')}
</div>
<div class="note">
<p><b>Good to know:</b> residents can never mark their own bill as paid – only you can, after checking the money. Bills are made for flats where at least one resident has joined the app.</p>
<p class="mr"><b>लक्षात ठेवा:</b> रहिवासी स्वतःचे बिल भरले म्हणून नोंदवू शकत नाहीत – पैसे तपासल्यानंतर फक्त तुम्हीच तसे करू शकता. ॲपमध्ये किमान एक रहिवासी सामील झालेल्या सदनिकांसाठीच बिले तयार होतात.</p>
</div>
<footer><span>SociYo · Your society, sorted.</span><span>shyamsignet.github.io/Society-app</span></footer>
</div></body></html>`

;(async () => {
  const out = path.join(__dirname, 'billing-guide-en-mr')
  fs.writeFileSync(out + '.html', html)
  let chromium
  try { ({ chromium } = require('playwright')) } catch { console.log('wrote HTML only (Playwright not installed)'); return }
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1240, height: 1600 }, deviceScaleFactor: 1.5 })
  await p.goto('file://' + out + '.html'); await p.evaluate(() => document.fonts.ready)
  await p.locator('.page').screenshot({ path: out + '.png' })
  const h = await p.evaluate(() => document.querySelector('.page').getBoundingClientRect().height)
  await p.pdf({ path: out + '.pdf', width: '1240px', height: Math.ceil(h) + 'px', printBackground: true })
  await b.close(); console.log('wrote', out + '.png/.pdf', Math.round(h) + 'px tall')
})()
