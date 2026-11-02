import { getLocale } from '../i18n'
export const uid = (p = '') => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)

export const inr = (n = 0) =>
  '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })

export const cls = (...a) => a.filter(Boolean).join(' ')

const DAY = 86400000
export const daysFromNow = (d, h = 10, m = 0) => {
  const x = new Date(Date.now() + d * DAY)
  x.setHours(h, m, 0, 0)
  return x.toISOString()
}
export const hoursAgo = (h) => new Date(Date.now() - h * 3600000).toISOString()

export const fmtDate = (iso, opts = {}) =>
  iso ? new Date(iso).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short', year: opts.year === false ? undefined : 'numeric', ...opts }) : '—'
export const fmtShort = (iso) => (iso ? new Date(iso).toLocaleDateString(getLocale(), { day: 'numeric', month: 'short' }) : '—')
export const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString(getLocale(), { hour: 'numeric', minute: '2-digit' }) : '')
export const fmtDateTime = (iso) => (iso ? `${fmtShort(iso)}, ${fmtTime(iso)}` : '—')
export const monthLabel = (ym) => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(getLocale(), { month: 'long', year: 'numeric' })
}
export const ymOf = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
export const addMonths = (ym, n) => {
  const [y, m] = ym.split('-').map(Number)
  return ymOf(new Date(y, m - 1 + n, 1))
}
export const isoDay = (d) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
export const sameDay = (a, b) => isoDay(a) === isoDay(b)

export const timeAgo = (iso) => {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 0) {
    const f = -s
    if (f < 3600) return `in ${Math.max(1, Math.round(f / 60))}m`
    if (f < 86400) return `in ${Math.round(f / 3600)}h`
    return `in ${Math.round(f / 86400)}d`
  }
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`
  return fmtShort(iso)
}

export const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase()

export const otp6 = () => String(Math.floor(100000 + Math.random() * 900000))

// Decorative offline-safe images (SVG data URIs) for sample content
export const artImage = (emoji, from = '#3B1F3A', to = '#22C55E', label = '') => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='800' height='500' viewBox='0 0 800 500'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${from}'/><stop offset='1' stop-color='${to}'/></linearGradient></defs><rect width='800' height='500' fill='url(#g)'/><circle cx='680' cy='80' r='140' fill='white' fill-opacity='.08'/><circle cx='90' cy='450' r='180' fill='white' fill-opacity='.07'/><text x='400' y='${label ? 265 : 290}' font-size='170' text-anchor='middle'>${emoji}</text>${label ? `<text x='400' y='400' font-family='Helvetica,Arial' font-weight='700' font-size='40' fill='white' text-anchor='middle'>${label}</text>` : ''}</svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

// Compress an image File to a JPEG data URL (keeps the local DB small)
export const fileToDataUrl = (file, max = 1280, quality = 0.8) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      if (!file.type.startsWith('image/') || file.type === 'image/gif') return resolve(reader.result)
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.round(img.width * scale)
        c.height = Math.round(img.height * scale)
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
        resolve(c.toDataURL('image/jpeg', quality))
      }
      img.onerror = () => resolve(reader.result)
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })

export const downloadCSV = (filename, rows) => {
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n')
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 500)
}

export const shareText = async ({ title, text, url }) => {
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url })
      return 'shared'
    }
  } catch (e) {
    if (e?.name === 'AbortError') return 'cancelled'
  }
  try {
    await navigator.clipboard.writeText([text, url].filter(Boolean).join('\n'))
    return 'copied'
  } catch {
    return 'failed'
  }
}

// Link that opens a screen of this app (HashRouter), e.g. appLink('/announcements/a1').
export const appLink = (path = '/') => `${location.origin}${location.pathname}#${path}`

// Opens WhatsApp with the text pre-filled, so the user only picks the chat/group.
export const shareOnWhatsApp = (text) => {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
}
