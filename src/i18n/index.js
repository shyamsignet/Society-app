// Lightweight app-wide translation layer (English / मराठी / हिंदी).
//
// Screens are written in English. When Marathi or Hindi is selected, this module
// translates every visible text node and the placeholder / aria-label / title /
// alt attributes as React renders them, using the dictionaries in strings*.js
// plus patterns for dynamic text ("3h ago", "Ticket #PG-1043 created" …).
// The original English is remembered per node, so switching back is lossless.
// User-written content (posts, comments, names) is left as typed.
import s1 from './strings1'
import s2 from './strings2'
import s3 from './strings3'
import s4 from './strings4'
import s5 from './strings5'

export const LANGS = [
  { code: 'en', label: 'English', locale: 'en-IN' },
  { code: 'mr', label: 'मराठी', locale: 'mr-IN-u-nu-latn' },
  { code: 'hi', label: 'हिंदी', locale: 'hi-IN-u-nu-latn' }
]
const KEY = 'smart-society-lang'
const IDX = { mr: 1, hi: 2 }

const DICT = new Map()
for (const row of [...s1, ...s2, ...s3, ...s4, ...s5]) if (!DICT.has(row[0])) DICT.set(row[0], row)

let lang = (() => {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved && LANGS.some((l) => l.code === saved)) return saved
  } catch { /* ignore */ }
  const nav = (navigator.language || '').toLowerCase()
  return nav.startsWith('mr') ? 'mr' : nav.startsWith('hi') ? 'hi' : 'en'
})()

export const getLang = () => lang
export const getLocale = () => LANGS.find((l) => l.code === lang).locale

const word = (en) => {
  if (lang === 'en') return en
  const row = DICT.get(en)
  return row ? row[IDX[lang]] : en
}

// Dynamic phrases. Each entry: regex on the trimmed English text, and per-language
// builders receiving the capture groups (already passed through word()).
const P = (re, mr, hi, raw = []) => ({ re, mr, hi, raw })
const PATTERNS = [
  P(/^(\d+)m ago$/, (n) => `${n} मिनिटांपूर्वी`, (n) => `${n} मिनट पहले`),
  P(/^(\d+)h ago$/, (n) => `${n} तासांपूर्वी`, (n) => `${n} घंटे पहले`),
  P(/^(\d+)d ago$/, (n) => `${n} दिवसांपूर्वी`, (n) => `${n} दिन पहले`),
  P(/^in (\d+)m$/, (n) => `${n} मिनिटांत`, (n) => `${n} मिनट में`),
  P(/^in (\d+)h$/, (n) => `${n} तासांत`, (n) => `${n} घंटे में`),
  P(/^in (\d+)d$/, (n) => `${n} दिवसांत`, (n) => `${n} दिन में`),
  P(/^Closes (in \d+[mhd]|\d.*)$/, (x) => `${x} बंद होईल`, (x) => `${x} बंद होगा`),
  P(/^Closed (\d.*)$/, (x) => `${x} रोजी बंद`, (x) => `${x} को बंद`),
  P(/^Due by (\d.*)$/, (x) => `देय तारीख ${x}`, (x) => `देय तिथि ${x}`),
  P(/^Overdue since (\d.*)$/, (x) => `${x} पासून थकीत`, (x) => `${x} से बकाया`),
  P(/^Last paid (.+) on (.+)$/, (a, d) => `शेवटचे पेमेंट ${a} · ${d}`, (a, d) => `पिछला भुगतान ${a} · ${d}`),
  P(/^Paid on (\d.*)$/, (d) => `${d} रोजी भरले`, (d) => `${d} को भुगतान`),
  P(/^Paid (\d.*)$/, (d) => `${d} रोजी भरले`, (d) => `${d} को भुगतान`),
  P(/^Due (\d.*)$/, (d) => `देय ${d}`, (d) => `देय ${d}`),
  P(/^Ticket #(.+) created$/, (t) => `तिकीट #${t} तयार झाले`, (t) => `टिकट #${t} बनाया गया`),
  P(/^Floor (\d+)$/, (n) => `मजला ${n}`, (n) => `मंज़िल ${n}`),
  P(/^Sorry, only (\d+) place\(s\) left\.$/, (n) => `माफ करा, फक्त ${n} जागा शिल्लक आहेत.`, (n) => `माफ़ करें, केवल ${n} जगह बची है.`, [0]),
  P(/^Tower ([A-Z0-9]{1,2})$/, (t) => `टॉवर ${t}`, (t) => `टावर ${t}`, [0]),
  P(/^Flat (.+) added$/, (n) => `सदनिका ${n} जोडली`, (n) => `फ्लैट ${n} जोड़ा गया`, [0]),
  P(/^Flat ([A-Z0-9][A-Z0-9 /-]{0,15})$/, (n) => `सदनिका ${n}`, (n) => `फ्लैट ${n}`, [0]),
  P(/^Delete flat (.+)\?$/, (n) => `सदनिका ${n} हटवायची?`, (n) => `फ्लैट ${n} हटाएँ?`, [0]),
  P(/^Tower ([A-Z]) · Floor (\d+)$/, (t, n) => `टॉवर ${t} · मजला ${n}`, (t, n) => `टावर ${t} · मंज़िल ${n}`),
  P(/^We’ll use (.+)$/, (x) => `आम्ही ${x} वापरू`, (x) => `हम ${x} का उपयोग करेंगे`),
  P(/^Expected resolution: within (\d+) hours$/, (n) => `अपेक्षित निराकरण: ${n} तासांत`, (n) => `अपेक्षित समाधान: ${n} घंटों में`),
  P(/^Expected resolution: within (\d+) days$/, (n) => `अपेक्षित निराकरण: ${n} दिवसांत`, (n) => `अपेक्षित समाधान: ${n} दिनों में`),
  P(/^([\d.]+) min$/, (n) => `${n} मिनिटे`, (n) => `${n} मिनट`),
  P(/^([\d.]+) h$/, (n) => `${n} तास`, (n) => `${n} घंटे`),
  P(/^([\d.]+) d$/, (n) => `${n} दिवस`, (n) => `${n} दिन`),
  P(/^([\d.]+) days$/, (n) => `${n} दिवस`, (n) => `${n} दिन`),
  P(/^Internal notes \((\d+)\)$/, (n) => `अंतर्गत नोंदी (${n})`, (n) => `आंतरिक नोट (${n})`),
  P(/^Mark as (.+)$/, (s) => `“${s}” अशी नोंद करा`, (s) => `“${s}” के रूप में दर्ज करें`),
  P(/^(\d+) residents · (\d+) useful contacts$/, (a, b) => `${a} रहिवासी · ${b} उपयुक्त संपर्क`, (a, b) => `${a} निवासी · ${b} उपयोगी संपर्क`),
  P(/^You’re (.+)$/, (s) => `तुम्ही ${s}`, (s) => `आप ${s}`),
  P(/^My bookings \((\d+)\)$/, (n) => `माझे बुकिंग (${n})`, (n) => `मेरी बुकिंग (${n})`),
  P(/^(\d+)h slots$/, (n) => `${n} तासांचे स्लॉट`, (n) => `${n} घंटे के स्लॉट`),
  P(/^Booked \(pending\)$/, () => 'बुक झाले (प्रलंबित)', () => 'बुक (लंबित)'),
  P(/^Security console · (.+)$/, (n) => `सुरक्षा कन्सोल · ${n}`, (n) => `सुरक्षा कंसोल · ${n}`, [0]),
  P(/^(\d+) entries$/, (n) => `${n} नोंदी`, (n) => `${n} प्रविष्टियाँ`),
  P(/^Demo mode – no SMS is sent\. Use (\d+)$/, (o) => `डेमो मोड – SMS पाठवला जात नाही. ${o} वापरा`, (o) => `डेमो मोड – SMS नहीं भेजा जाता. ${o} डालें`),
  P(/^Demo mode: your OTP is (\d+)$/, (o) => `डेमो मोड: तुमचा OTP ${o} आहे`, (o) => `डेमो मोड: आपका OTP ${o} है`),
  P(/^(\d+) unread$/, (n) => `${n} न वाचलेल्या`, (n) => `${n} अपठित`),
  P(/^Adjustment: (.+)$/, (x) => `समायोजन: ${x}`, (x) => `समायोजन: ${x}`, [0]),
  P(/^Approve the request in (.+)$/, (x) => `${x} मध्ये विनंती मंजूर करा`, (x) => `${x} में अनुरोध मंज़ूर करें`),
  P(/^Open \((\d+)\)$/, (n) => `चालू (${n})`, (n) => `खुले (${n})`),
  P(/^Option (\d+)$/, (n) => `पर्याय ${n}`, (n) => `विकल्प ${n}`),
  P(/^(\d+) members$/, (n) => `${n} सदस्य`, (n) => `${n} सदस्य`),
  P(/^(\d+) members · (\d+) with app access$/, (a, b) => `${a} सदस्य · ${b} ॲप वापरतात`, (a, b) => `${a} सदस्य · ${b} ऐप का उपयोग करते हैं`),
  P(/^(.+) can now log in with (.+)$/, (a, b) => `${a} आता ${b} ने लॉग इन करू शकतात`, (a, b) => `${a} अब ${b} से लॉग इन कर सकते हैं`, [0, 1]),
  P(/^(₹[\d,]+) outstanding$/, (a) => `${a} थकीत`, (a) => `${a} बकाया`),
  P(/^(\d+) open ticket\(s\)$/, (n) => `${n} खुली तिकिटे`, (n) => `${n} खुले टिकट`),
  P(/^(\d+) upcoming booking\(s\)$/, (n) => `${n} आगामी बुकिंग`, (n) => `${n} आगामी बुकिंग`),
  P(/^(\d+) open poll\(s\)$/, (n) => `${n} सुरू मतदान`, (n) => `${n} खुले मतदान`),
  P(/^Gate pass & entry log · (.+)$/, (x) => `गेट पास व प्रवेश नोंद · ${x}`, (x) => `गेट पास और प्रवेश लॉग · ${x}`, [0]),
  P(/^Expected & inside \((\d+)\)$/, (n) => `अपेक्षित व आत (${n})`, (n) => `अपेक्षित और अंदर (${n})`),
  P(/^(\d+) occupied$/, (n) => `${n} वसलेल्या`, (n) => `${n} बसे हुए`),
  P(/^(\d+) pending approval$/, (n) => `${n} मंजुरी प्रलंबित`, (n) => `${n} मंज़ूरी लंबित`),
  P(/^(\d+) flats$/, (n) => `${n} सदनिका`, (n) => `${n} फ्लैट`),
  P(/^(\d+) overdue$/, (n) => `${n} मुदत उलटलेल्या`, (n) => `${n} समय सीमा पार`),
  P(/^Generate bills for (.+)\?$/, (m) => `${m} ची बिले तयार करायची?`, (m) => `${m} के बिल बनाएँ?`),
  P(/^(\d+) bills generated – residents notified$/, (n) => `${n} बिले तयार – रहिवाशांना कळवले`, (n) => `${n} बिल बने – निवासियों को सूचित किया`),
  P(/^Late fee applied to (\d+) bill\(s\)$/, (n) => `${n} बिलांवर विलंब शुल्क लावले`, (n) => `${n} बिलों पर विलंब शुल्क लगाया`),
  P(/^Approvals \((\d+)\)$/, (n) => `मंजुरी (${n})`, (n) => `मंज़ूरी (${n})`),
  P(/^Requests \((\d+)\)$/, (n) => `विनंत्या (${n})`, (n) => `अनुरोध (${n})`),
  P(/^(\d+) with 2\+ months$/, (n) => `${n} — 2+ महिने`, (n) => `${n} — 2+ महीने`),
  P(/^(.+) approved – they can now log in$/, (n) => `${n} मंजूर – आता लॉग इन करू शकतात`, (n) => `${n} मंज़ूर – अब लॉग इन कर सकते हैं`, [0]),
  P(/^Deactivate (.+)\?$/, (n) => `${n} यांचे खाते निष्क्रिय करायचे?`, (n) => `${n} का खाता निष्क्रिय करें?`, [0]),
  P(/^(\d+) bill\(s\) · (.+)$/, (n, a) => `${n} बिल · ${a}`, (n, a) => `${n} बिल · ${a}`, [1]),
  P(/^Pay (₹[\d,]+)$/, (a) => `${a} भरा`, (a) => `${a} भरें`),
  P(/^Pay (₹[\d,]+) securely$/, (a) => `${a} सुरक्षितपणे भरा`, (a) => `${a} सुरक्षित रूप से भरें`),
  P(/^Includes (₹[\d,]+) late payment charges$/, (a) => `यात ${a} विलंब शुल्क समाविष्ट`, (a) => `इसमें ${a} विलंब शुल्क शामिल`),
  P(/^(\d+) bill\(s\) selected$/, (n) => `${n} बिल निवडले`, (n) => `${n} बिल चुने गए`),
  P(/^(\d+) available$/, (n) => `${n} उपलब्ध`, (n) => `${n} उपलब्ध`),
  P(/^(\d+) going$/, (n) => `${n} येणार`, (n) => `${n} आ रहे`),
  P(/^(\d+) votes?$/, (n) => `${n} मते`, (n) => `${n} वोट`),
  P(/^Upload (\d+) photo\(s\)$/, (n) => `${n} फोटो अपलोड करा`, (n) => `${n} फ़ोटो अपलोड करें`),
  P(/^View pass · (\d+)$/, (n) => `पास पहा · ${n}`, (n) => `पास देखें · ${n}`),
  P(/^Expected (\d.*)$/, (d) => `अपेक्षित ${d}`, (d) => `अपेक्षित ${d}`),
  P(/^Mark (rented|sold)$/, (s) => `${s} म्हणून नोंदवा`, (s) => `${s} दर्ज करें`),
  P(/^(\d+) bookings$/, (n) => `${n} बुकिंग`, (n) => `${n} बुकिंग`),
  P(/^(.+) · (Approval required|Instant booking) · (\d+) bookings$/, (a, b, c) => `${a} · ${b} · ${c} बुकिंग`, (a, b, c) => `${a} · ${b} · ${c} बुकिंग`),
  P(/^(\d+) participants$/, (n) => `${n} सहभागी`, (n) => `${n} प्रतिभागी`),
  P(/^(\d+) with app access$/, (n) => `${n} ॲप वापरतात`, (n) => `${n} ऐप उपयोगकर्ता`),
  P(/^· valid till (.+)$/, (d) => `· ${d} पर्यंत वैध`, (d) => `· ${d} तक मान्य`),
  P(/^by (.+) ·$/, (n) => `${n} द्वारे ·`, (n) => `${n} द्वारा ·`, [0]),
  P(/^(₹[\d,]+)\/(slot|day|month|meal|hour)$/, (a, u) => `${a}/${u}`, (a, u) => `${a}/${u}`),
  P(/^(\d+) attachments?$/, (n) => `${n} जोडण्या`, (n) => `${n} अटैचमेंट`),
  P(/^(\d+) (hours)$/, (n) => `${n} तास`, (n) => `${n} घंटे`),
  P(/^(.+) collection$/, (m) => `${m} वसुली`, (m) => `${m} वसूली`),
  P(/^(\d+) new$/, (n) => `${n} नवीन`, (n) => `${n} नए`),
  P(/^of (₹[\d,]+) billed · (\d+)\/(\d+) flats paid$/, (a, p, c) => `${a} बिलापैकी · ${c} पैकी ${p} सदनिकांनी भरले`, (a, p, c) => `${a} के बिल में से · ${c} में से ${p} फ्लैटों ने भुगतान किया`),
  P(/^Exclusively for (.+) residents$/, (n) => `फक्त ${n} रहिवाशांसाठी`, (n) => `केवल ${n} निवासियों के लिए`, [0]),
  P(/^Step (\d) of (\d) · (.+)$/, (a, b, c) => `टप्पा ${a} / ${b} · ${c}`, (a, b, c) => `चरण ${a} / ${b} · ${c}`),
  P(/^(\d+) flats · (.+)$/, (n, x) => `${n} सदनिका · ${x}`, (n, x) => `${n} फ्लैट · ${x}`, [1]),
  P(/^(\d+) ready · $/, (n) => `${n} तयार · `, (n) => `${n} तैयार · `),
  P(/^(\d+) with problems$/, (n) => `${n} मध्ये अडचणी`, (n) => `${n} में समस्या`),
  P(/^Import (\d+)$/, (n) => `${n} आयात करा`, (n) => `${n} इम्पोर्ट करें`),
  P(/^Save (\d+)$/, (n) => `${n} जतन करा`, (n) => `${n} सेव करें`),
  P(/^(\d+) residents imported$/, (n) => `${n} रहिवासी आयात झाले`, (n) => `${n} निवासी इम्पोर्ट हुए`),
  P(/^(\d+) flats saved$/, (n) => `${n} सदनिका जतन झाल्या`, (n) => `${n} फ्लैट सेव हुए`),
  P(/^Staff \((\d+)\)$/, (n) => `कर्मचारी (${n})`, (n) => `कर्मचारी (${n})`),
  P(/^Directory contacts \((\d+)\)$/, (n) => `निर्देशिका संपर्क (${n})`, (n) => `डायरेक्टरी संपर्क (${n})`),
  P(/^Remove (.+)\?$/, (n) => `${n} काढायचे?`, (n) => `${n} हटाएँ?`, [0]),
  P(/^Sent to (.+@.+)$/, (e) => `${e} वर पाठवला`, (e) => `${e} पर भेजा गया`, [0]),
  P(/^Payments to verify \((\d+)\)$/, (n) => `पडताळायची पेमेंट (${n})`, (n) => `सत्यापित करने के लिए भुगतान (${n})`),
  P(/^The treasurer will confirm your payment of (₹[\d,]+)\. You’ll get a notification and a receipt once it’s verified\.$/, (a) => `खजिनदार तुमचे ${a} चे पेमेंट निश्चित करतील. पडताळणीनंतर तुम्हाला सूचना व पावती मिळेल.`, (a) => `कोषाध्यक्ष आपके ${a} के भुगतान की पुष्टि करेंगे. सत्यापन के बाद आपको सूचना और रसीद मिलेगी.`),
  P(/^Remove$/, () => 'काढा', () => 'हटाएँ'),
  // notification titles / bodies created by the app
  P(/^(.+) liked your post$/, (n) => `${n} यांना तुमची पोस्ट आवडली`, (n) => `${n} को आपकी पोस्ट पसंद आई`, [0]),
  P(/^(.+) commented on your post$/, (n) => `${n} यांनी तुमच्या पोस्टवर प्रतिक्रिया दिली`, (n) => `${n} ने आपकी पोस्ट पर टिप्पणी की`, [0]),
  P(/^Complaint (\S+) is (.+)$/, (t, s) => `तक्रार ${t} — ${s}`, (t, s) => `शिकायत ${t} — ${s}`, [0]),
  P(/^(\S+) is now (.+)$/, (t, s) => `${t} — आता ${s}`, (t, s) => `${t} — अब ${s}`, [0]),
  P(/^New update on (.+)$/, (t) => `${t} वर नवीन अपडेट`, (t) => `${t} पर नया अपडेट`, [0]),
  P(/^(.+) reopened by resident$/, (t) => `${t} रहिवाशाने पुन्हा उघडले`, (t) => `${t} निवासी ने फिर से खोला`, [0]),
  P(/^New (complaint|service request) (.+)$/, (k, t) => `नवीन ${k} ${t}`, (k, t) => `नया ${k} ${t}`, [1]),
  P(/^Maintenance bill for (.+)$/, (m) => `${m} चे देखभाल बिल`, (m) => `${m} का मेंटेनेंस बिल`),
  P(/^Your bill is ready\. Due by (.+)\.$/, (d) => `तुमचे बिल तयार आहे. देय तारीख ${d}.`, (d) => `आपका बिल तैयार है. देय तिथि ${d}.`),
  P(/^(Guest|Delivery|Cab|Service Provider) at the gate$/, (t) => `${t} गेटवर`, (t) => `${t} गेट पर`),
  P(/^(.+) has arrived$/, (n) => `${n} आले आहेत`, (n) => `${n} आ गए हैं`, [0]),
  P(/^Reminder: (.+)$/, (n) => `आठवण: ${n}`, (n) => `रिमाइंडर: ${n}`, [0]),
  P(/^New event: (.+)$/, (n) => `नवीन कार्यक्रम: ${n}`, (n) => `नया इवेंट: ${n}`, [0]),
  P(/^New poll: (.+)$/, (n) => `नवीन मतदान: ${n}`, (n) => `नया मतदान: ${n}`, [0]),
  P(/^Booking approved: (.+)$/, (n) => `बुकिंग मंजूर: ${n}`, (n) => `बुकिंग मंज़ूर: ${n}`),
  P(/^Booking declined: (.+)$/, (n) => `बुकिंग नाकारले: ${n}`, (n) => `बुकिंग अस्वीकार: ${n}`),
  P(/^Upcoming: (.+)$/, (n) => `आगामी: ${n}`, (n) => `आगामी: ${n}`, [0]),
  P(/^Urgent: (.+)$/, (n) => `तातडीचे: ${n}`, (n) => `अत्यावश्यक: ${n}`, [0]),
  P(/^🔴 Urgent: (.+)$/, (n) => `🔴 तातडीचे: ${n}`, (n) => `🔴 अत्यावश्यक: ${n}`, [0]),
  P(/^Important: (.+)$/, (n) => `महत्त्वाचे: ${n}`, (n) => `महत्वपूर्ण: ${n}`, [0]),
  P(/^🆘 SOS from (.+)$/, (n) => `🆘 ${n} कडून SOS`, (n) => `🆘 ${n} से SOS`, [0])
]

export function translate(src) {
  if (lang === 'en' || !src) return src
  const m = src.match(/^(\s*)([\s\S]*?)(\s*)$/)
  const core = m[2]
  if (!core || !/[A-Za-z]/.test(core)) return src
  const row = DICT.get(core)
  if (row) return m[1] + row[IDX[lang]] + m[3]
  for (const p of PATTERNS) {
    const g = core.match(p.re)
    if (g) {
      const args = g.slice(1).map((x, i) => (p.raw.includes(i) ? x : word(x)))
      return m[1] + p[lang](...args) + m[3]
    }
  }
  // "💬 General" → emoji + translated word
  const em = core.match(/^([^A-Za-z0-9₹(]+?)\s*([A-Za-z].*)$/)
  if (em && em[1].trim()) { const t = translate(em[2]); if (t !== em[2]) return m[1] + em[1] + ' ' + t + m[3] }
  // "A · B · C" → translate each segment that we know
  if (core.includes(' · ') || core.startsWith('· ') || core.endsWith(' ·')) {
    const parts = core.split(/(\s*·\s*)/)
    let changed = false
    const out = parts.map((x) => { if (!x.trim() || /^\s*·\s*$/.test(x)) return x; const t = translate(x); if (t !== x) changed = true; return t })
    if (changed) return m[1] + out.join('') + m[3]
  }
  return src
}

/* ---------- DOM translator ---------- */
const ATTRS = ['placeholder', 'aria-label', 'title', 'alt']
const textRec = new WeakMap() // Text node -> { src, out }
const attrRec = new WeakMap() // Element -> { [attr]: { src, out } }
const skip = (el) => !el || el.closest?.('script,style,textarea,[translate="no"],[contenteditable="true"]')

function doText(node, force) {
  if (skip(node.parentElement)) return
  const cur = node.nodeValue
  const rec = textRec.get(node)
  const src = rec && cur === rec.out && !force ? null : rec && cur === rec.out ? rec.src : cur
  if (src === null) return
  const out = translate(src)
  textRec.set(node, { src, out })
  if (out !== cur) node.nodeValue = out
}
function doAttrs(el, force) {
  if (el.closest?.('script,style,[translate="no"]')) return
  let recs = attrRec.get(el)
  for (const a of ATTRS) {
    if (!el.hasAttribute(a)) continue
    const cur = el.getAttribute(a)
    const rec = recs?.[a]
    if (rec && cur === rec.out && !force) continue
    const src = rec && cur === rec.out ? rec.src : cur
    const out = translate(src)
    recs = recs || {}
    recs[a] = { src, out }
    attrRec.set(el, recs)
    if (out !== cur) el.setAttribute(a, out)
  }
}
function walk(root, force) {
  if (root.nodeType === 3) return doText(root, force)
  if (root.nodeType !== 1) return
  doAttrs(root, force)
  const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  let n
  while ((n = it.nextNode())) n.nodeType === 3 ? doText(n, force) : doAttrs(n, force)
}

let started = false
export function startTranslator() {
  if (started) return
  started = true
  applyDocLang()
  walk(document.body)
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') doText(m.target)
      else if (m.type === 'attributes') doAttrs(m.target)
      else m.addedNodes.forEach((n) => walk(n))
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS })
}

const subs = new Set()
export const onLangChange = (f) => { subs.add(f); return () => subs.delete(f) }
function applyDocLang() {
  document.documentElement.lang = lang === 'en' ? 'en' : lang
  document.title = translate('Sociyo')
}
export function setLang(code) {
  lang = code
  try { localStorage.setItem(KEY, code) } catch { /* ignore */ }
  applyDocLang()
  walk(document.body, true)
  subs.forEach((f) => f(code))
}
