// Tiny dependency-free PDF writer (text, lines and filled rectangles) used for
// receipts, notices and reports so they can be downloaded offline.
const esc = (s) => String(s).replace(/₹/g, 'Rs. ').replace(/[^\x20-\x7E]/g, '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

export function makePdf(draw) {
  // draw(api) where api has text(x,y,str,{size,bold,color}), line(x1,y1,x2,y2), rect(x,y,w,h,color)
  // Coordinates: top-left origin in points on an A4 page (595 x 842).
  const H = 842
  const ops = []
  const rgb = (hex = '#0F172A') => {
    const n = parseInt(hex.slice(1), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(3)).join(' ')
  }
  const api = {
    text(x, y, str, { size = 11, bold = false, color, align } = {}) {
      let xx = x
      if (align === 'right') xx = x - String(esc(str)).length * size * (bold ? 0.56 : 0.5)
      ops.push(`BT ${rgb(color)} rg /${bold ? 'F2' : 'F1'} ${size} Tf ${xx.toFixed(1)} ${(H - y).toFixed(1)} Td (${esc(str)}) Tj ET`)
    },
    line(x1, y1, x2, y2, color = '#E2E8F0', w = 1) { ops.push(`${rgb(color)} RG ${w} w ${x1} ${H - y1} m ${x2} ${H - y2} l S`) },
    rect(x, y, w, h, color = '#F1F5F9') { ops.push(`${rgb(color)} rg ${x} ${H - y - h} ${w} ${h} re f`) },
    wrap(x, y, str, width, opts = {}) {
      const size = opts.size || 11
      const max = Math.floor(width / (size * 0.5))
      const words = String(str).split(/\s+/)
      let line = ''
      let yy = y
      for (const w of words) {
        if ((line + ' ' + w).trim().length > max) { api.text(x, yy, line.trim(), opts); yy += size * 1.5; line = w } else line += ' ' + w
      }
      if (line.trim()) { api.text(x, yy, line.trim(), opts); yy += size * 1.5 }
      return yy
    }
  }
  draw(api)
  const content = ops.join('\n')
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
  ]
  let out = '%PDF-1.4\n'
  const offsets = []
  objs.forEach((o, i) => { offsets.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n` })
  const xref = out.length
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('')
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new Blob([out], { type: 'application/pdf' })
}

export function saveBlob(blob, filename) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 1000)
}

export function openDataUrl(url, name = 'file') {
  try {
    const [meta, data] = url.split(',')
    const mime = meta.match(/data:([^;]+)/)?.[1] || 'application/octet-stream'
    const bin = meta.includes('base64') ? atob(data) : decodeURIComponent(data)
    const arr = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
    const blob = new Blob([arr], { type: mime })
    const w = window.open(URL.createObjectURL(blob), '_blank')
    if (!w) saveBlob(blob, name)
  } catch { window.open(url, '_blank') }
}

export function noticePdf(society, a, author) {
  return makePdf((p) => {
    p.rect(0, 0, 595, 90, '#3B1F3A')
    p.text(40, 42, society.name, { size: 20, bold: true, color: '#FFFFFF' })
    p.text(40, 64, society.address || society.city, { size: 9, color: '#B3C2E3' })
    p.text(40, 130, 'NOTICE', { size: 11, bold: true, color: '#16A34A' })
    let y = p.wrap(40, 155, a.title, 515, { size: 18, bold: true })
    p.text(40, y + 4, `Issued: ${new Date(a.createdAt).toDateString()}   |   Priority: ${a.priority.toUpperCase()}${a.expiresAt ? '   |   Valid till: ' + new Date(a.expiresAt).toDateString() : ''}`, { size: 9, color: '#64748B' })
    p.line(40, y + 18, 555, y + 18)
    y = p.wrap(40, y + 44, a.body, 515, { size: 12, color: '#334155' })
    p.text(40, y + 40, 'By order of the Managing Committee', { size: 11, color: '#334155' })
    p.text(40, y + 58, `${author?.name || 'Society Office'}`, { size: 11, bold: true })
  })
}
