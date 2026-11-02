// SociYo subscription status for the open society (society mode only).
import { useEffect, useState } from 'react'
import { CLOUD } from './config'
import { api } from './cloud'
import { currentSocietyId } from './db'
import { makePdf, saveBlob } from './pdf'

export const PRICE_PER_FLAT = 20 // ₹ per flat per month (default yearly plan)
export const GRACE_DAYS = 15
const DAY = 86400000

let cache = { soc: null, data: null, at: 0 }
const listeners = new Set()
export async function loadSubscription(force = false) {
  const soc = currentSocietyId()
  if (!CLOUD || !soc) return null
  if (!force && cache.soc === soc && Date.now() - cache.at < 5 * 60000) return cache.data
  try {
    const data = await api.mySubscription(soc)
    cache = { soc, data, at: Date.now() }
    listeners.forEach((f) => f())
    return data
  } catch { return cache.soc === soc ? cache.data : null }
}
export function useSubscription() {
  const [, tick] = useState(0)
  useEffect(() => {
    const f = () => tick((x) => x + 1)
    listeners.add(f)
    loadSubscription()
    const onVis = () => document.visibilityState === 'visible' && loadSubscription()
    document.addEventListener('visibilitychange', onVis)
    return () => { listeners.delete(f); document.removeEventListener('visibilitychange', onVis) }
  }, [])
  return cache.soc && cache.soc === currentSocietyId() ? cache.data : null
}

let platform = null
export function usePlatformAdmin() {
  const [v, setV] = useState(platform)
  useEffect(() => { if (!CLOUD || platform !== null) return; api.isPlatformAdmin().then((x) => { platform = !!x; setV(platform) }).catch(() => {}) }, [])
  return !!v
}

// Human view of a subscription row (works for my_subscription and platform rows).
export function describeSub(s, flats) {
  if (!s) return null
  const plan = s.plan || 'yearly'
  const trialEnds = s.trialEnds || s.trial_ends
  const paidUntil = s.paidUntil || s.paid_until
  const price = Number(s.pricePerFlat ?? s.price_per_flat ?? PRICE_PER_FLAT)
  const n = Number(flats ?? s.flats ?? 0)
  const ends = [trialEnds, paidUntil].filter(Boolean).map((d) => new Date(d).getTime()).sort((a, b) => b - a)[0] || null
  const daysLeft = ends ? Math.ceil((ends - Date.now()) / DAY) : null
  const onTrial = !paidUntil || (trialEnds && new Date(trialEnds) >= new Date(paidUntil))
  const state = s.state || 'ok'
  const label = plan === 'complimentary' ? 'Complimentary'
    : s.status === 'suspended' ? 'Suspended'
      : state === 'locked' ? 'Expired – read-only'
        : state === 'grace' ? 'Expired – renew now'
          : onTrial ? 'Free trial' : 'Active'
  const tone = plan === 'complimentary' ? 'blue' : state === 'locked' ? 'red' : state === 'grace' ? 'amber' : onTrial ? 'purple' : 'green'
  return {
    plan, state, label, tone, onTrial, trialEnds, paidUntil, price, flats: n,
    endsAt: ends ? new Date(ends).toISOString() : null, daysLeft,
    graceEnds: ends ? new Date(ends + GRACE_DAYS * DAY).toISOString() : null,
    yearly: n * price * 12
  }
}

const dmy = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
const rs = (n) => 'Rs. ' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })

// One-page invoice PDF for a subscription payment (English).
export function invoicePdf(pay, society, payTo = {}) {
  const blob = makePdf((d) => {
    d.rect(0, 0, 595, 96, '#3B1F3A')
    d.text(40, 46, payTo.businessName || 'SociYo', { size: 22, bold: true, color: '#F7F1E8' })
    d.text(40, 70, 'Your society, sorted.', { size: 11, color: '#D6C8F0' })
    d.text(555, 46, 'INVOICE', { size: 18, bold: true, color: '#F7F1E8', align: 'right' })
    d.text(555, 70, pay.invoice_no, { size: 11, color: '#D6C8F0', align: 'right' })
    let y = 130
    d.text(40, y, 'From', { size: 9, bold: true, color: '#6E6569' }); d.text(320, y, 'Billed to', { size: 9, bold: true, color: '#6E6569' })
    y += 16
    const from = [payTo.businessName || 'SociYo', payTo.address, payTo.phone && `Phone: ${payTo.phone}`, payTo.email && `Email: ${payTo.email}`, payTo.gstin && `GSTIN: ${payTo.gstin}`].filter(Boolean)
    const to = [society.name, society.address, society.city, society.regNo && `Reg. No. ${society.regNo}`].filter(Boolean)
    for (let i = 0; i < Math.max(from.length, to.length); i++) {
      if (from[i]) d.text(40, y, from[i], { size: 10, bold: i === 0 })
      if (to[i]) d.text(320, y, to[i], { size: 10, bold: i === 0 })
      y += 15
    }
    y += 10
    d.text(40, y, `Invoice date: ${dmy(pay.created_at)}`, { size: 10 }); d.text(320, y, `Society code: ${pay.society_id}`, { size: 10 })
    y += 30
    d.rect(40, y - 14, 515, 24, '#F6F2FB')
    d.text(50, y, 'Description', { size: 10, bold: true }); d.text(545, y, 'Amount', { size: 10, bold: true, align: 'right' })
    y += 28
    d.text(50, y, `SociYo subscription - ${pay.months} month(s)`, { size: 11, bold: true })
    d.text(545, y, rs(pay.amount), { size: 11, bold: true, align: 'right' })
    y += 16
    d.text(50, y, `Period: ${dmy(pay.period_from)} to ${dmy(pay.period_to)}`, { size: 10, color: '#6E6569' })
    y += 15
    d.text(50, y, `${pay.flats} flats x Rs. ${Number(pay.price_per_flat)} per flat per month`, { size: 10, color: '#6E6569' })
    y += 18
    d.line(40, y, 555, y, '#E7DED2')
    y += 22
    d.text(400, y, 'Total', { size: 12, bold: true }); d.text(545, y, rs(pay.amount), { size: 12, bold: true, align: 'right' })
    y += 18
    d.text(400, y, payTo.gstin ? 'Amount as agreed' : 'GST not applicable', { size: 9, color: '#6E6569' })
    y += 34
    d.rect(40, y - 16, 515, 52, '#ECFDF3')
    d.text(52, y, 'PAID', { size: 14, bold: true, color: '#15803D' })
    d.text(52, y + 20, `Received by ${pay.method || 'payment'}${pay.ref ? ` - Ref ${pay.ref}` : ''} on ${dmy(pay.created_at)}`, { size: 10, color: '#15803D' })
    if (pay.note) { y += 60; d.wrap(40, y, `Note: ${pay.note}`, 515, { size: 10, color: '#6E6569' }) }
    d.text(40, 800, 'This is a computer-generated invoice and does not require a signature.', { size: 9, color: '#6E6569' })
  })
  saveBlob(blob, `${pay.invoice_no.replace(/\//g, '-')}.pdf`)
}
