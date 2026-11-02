import { useEffect } from 'react'
import { BadgeCheck, CalendarClock, Download, Building2, Phone, Mail, Copy, Smartphone } from 'lucide-react'
import { Page, Card, Badge, Button, Empty, useToast } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { can } from '../../lib/rbac'
import { CLOUD } from '../../lib/config'
import { useSubscription, loadSubscription, describeSub, invoicePdf, PRICE_PER_FLAT, GRACE_DAYS } from '../../lib/subscription'
import { inr, fmtDate, cls } from '../../lib/utils'

// Admin → Subscription: the society's SociYo plan, how to pay, invoices.
export default function Subscription() {
  const { user, society } = useAuth()
  const toast = useToast()
  const sub = useSubscription()
  useEffect(() => { loadSubscription(true) }, [])
  if (!can(user, 'residents.manage') && !can(user, 'billing.manage')) return <Page title="Subscription" back="/admin"><Empty title="Not allowed" /></Page>
  if (!CLOUD) return (
    <Page title="Subscription" back="/admin">
      <Card className="p-5 mt-2 text-sm text-ink-700 space-y-2">
        <p><b>Demo mode.</b> When your society uses SociYo for real, this page shows your plan: a 30-day free trial, then <b>{inr(PRICE_PER_FLAT)} per flat per month</b>, billed yearly.</p>
        <p className="text-ink-500">Example: 24 flats × ₹20 × 12 months = ₹5,760 a year.</p>
      </Card>
    </Page>
  )
  if (!sub) return <Page title="Subscription" back="/admin"><Empty title="Loading…" /></Page>
  const d = describeSub(sub)
  const pay = sub.payTo || {}
  const upi = pay.upiId ? `upi://pay?pa=${encodeURIComponent(pay.upiId)}&pn=${encodeURIComponent(pay.businessName || 'SociYo')}&am=${d.yearly}&cu=INR&tn=${encodeURIComponent(`SociYo ${society.name || ''}`.slice(0, 40))}` : ''
  const copy = async (t) => { try { await navigator.clipboard.writeText(t); toast('Copied') } catch { toast(t, 'info') } }
  return (
    <Page title="Subscription" subtitle="SociYo plan for your society" back="/admin">
      <Card className="p-5 mt-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-ink-400 uppercase tracking-wider">Your plan</div>
          <Badge color={d.tone}>{d.label}</Badge>
        </div>
        <div className="mt-2 text-2xl font-extrabold">{d.plan === 'complimentary' ? <span>Complimentary</span> : <>{inr(d.price)} <span className="text-base font-semibold text-ink-500">per flat / month</span></>}</div>
        <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
          <div className="rounded-xl bg-ink-100/60 p-3"><div className="text-xs text-ink-500">Flats</div><div className="font-bold">{d.flats}</div></div>
          <div className="rounded-xl bg-ink-100/60 p-3"><div className="text-xs text-ink-500">Yearly amount</div><div className="font-bold">{d.plan === 'complimentary' ? '—' : inr(d.yearly)}</div></div>
          <div className="rounded-xl bg-ink-100/60 p-3 col-span-2 flex items-center gap-3">
            <CalendarClock size={18} className="text-ink-500" />
            <div>
              <div className="text-xs text-ink-500">{d.onTrial ? <span>Free trial ends</span> : d.state === 'ok' ? <span>Paid until</span> : <span>Expired on</span>}</div>
              <div className="font-bold">{d.plan === 'complimentary' ? <span>No expiry</span> : fmtDate(d.endsAt)}{d.state === 'ok' && d.daysLeft !== null && d.plan !== 'complimentary' && <span className="text-xs font-semibold text-ink-500"> · {d.daysLeft} <span>days left</span></span>}</div>
            </div>
          </div>
        </div>
        {d.state === 'grace' && <p className="mt-3 text-sm rounded-xl bg-amber-50 text-amber-900 px-3 py-2">Renew by <b>{fmtDate(d.graceEnds)}</b>. After that the app becomes read-only for everyone (nothing is deleted).</p>}
        {d.state === 'locked' && <p className="mt-3 text-sm rounded-xl bg-red-50 text-red-800 px-3 py-2">The app is read-only. Residents can still see everything, but nothing can be added or changed until the subscription is renewed.</p>}
        <p className="text-xs text-ink-500 mt-3">{d.flats} flats × {inr(d.price)} × 12 months = <b>{inr(d.yearly)}</b> a year. After the expiry date there are {GRACE_DAYS} days to renew before the app becomes read-only.</p>
      </Card>

      {d.plan !== 'complimentary' && (
        <>
          <div className="text-xs font-bold text-ink-400 uppercase tracking-wider mt-5 mb-2">How to pay</div>
          <Card className="p-5 text-sm space-y-3">
            {pay.businessName || pay.upiId || pay.bank ? (
              <>
                {pay.businessName && <div className="flex items-center gap-2"><Building2 size={16} className="text-ink-500" /><b>{pay.businessName}</b></div>}
                {pay.upiId && <div className="flex items-center gap-2"><span className="text-ink-500 w-20">UPI ID</span><b className="flex-1 select-all">{pay.upiId}</b><button aria-label="Copy UPI ID" onClick={() => copy(pay.upiId)} className="h-8 w-8 grid place-items-center text-ink-500"><Copy size={15} /></button></div>}
                {pay.bank && <div className="flex gap-2"><span className="text-ink-500 w-20 shrink-0">Bank</span><span className="whitespace-pre-line select-all">{pay.bank}</span></div>}
                {upi && <a href={upi} className="h-11 rounded-xl bg-accent-500 text-white font-semibold flex items-center justify-center gap-2"><Smartphone size={18} /> <span>Pay {inr(d.yearly)} with UPI app</span></a>}
                <p className="text-xs text-ink-500">After paying, send the UTR / reference number{pay.phone || pay.email ? ' to' : ''} {pay.phone && <a className="font-semibold" href={`https://wa.me/${pay.phone.replace(/\D/g, '')}`}>{pay.phone}</a>}{pay.phone && pay.email ? ' or ' : ''}{pay.email && <a className="font-semibold" href={`mailto:${pay.email}`}>{pay.email}</a>}. Your plan is extended and the invoice appears below within one working day.</p>
              </>
            ) : <p className="text-ink-500">Payment details will be shared by the SociYo team.</p>}
            {(pay.phone || pay.email) && (
              <div className="flex gap-2 pt-1">
                {pay.phone && <a href={`tel:${pay.phone.replace(/\s/g, '')}`} className="flex-1 h-10 rounded-xl bg-brand-50 text-brand-800 font-semibold flex items-center justify-center gap-2"><Phone size={16} /> <span>Call</span></a>}
                {pay.email && <a href={`mailto:${pay.email}`} className="flex-1 h-10 rounded-xl bg-brand-50 text-brand-800 font-semibold flex items-center justify-center gap-2"><Mail size={16} /> <span>Email</span></a>}
              </div>
            )}
          </Card>
        </>
      )}

      <div className="text-xs font-bold text-ink-400 uppercase tracking-wider mt-5 mb-2">Invoices</div>
      <Card className="divide-y divide-ink-100 overflow-hidden">
        {(sub.payments || []).map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3">
            <span className="h-10 w-10 rounded-xl bg-accent-50 text-accent-700 grid place-items-center"><BadgeCheck size={18} /></span>
            <div className="flex-1 min-w-0"><div className="text-sm font-semibold">{inr(p.amount)} · {p.months} <span>months</span></div><div className="text-[11px] text-ink-500">{p.invoice_no} · {fmtDate(p.period_from)} – {fmtDate(p.period_to)}</div></div>
            <Button size="sm" variant="secondary" icon={Download} onClick={() => invoicePdf(p, society, pay)}>PDF</Button>
          </div>
        ))}
        {!(sub.payments || []).length && <div className={cls('px-4 py-4 text-sm text-ink-500')}>No invoices yet.</div>}
      </Card>
    </Page>
  )
}
