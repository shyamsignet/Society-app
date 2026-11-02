import { useEffect, useState } from 'react'
import { Search, Settings, IndianRupee, Download, Building2, Users, Clock } from 'lucide-react'
import { Page, Card, Badge, Button, Chips, Empty, Field, Input, Select, Sheet, Textarea, useAction, useToast } from '../components/ui'
import { useAuth } from '../lib/auth'
import { CLOUD } from '../lib/config'
import { api } from '../lib/cloud'
import { describeSub, invoicePdf, usePlatformAdmin } from '../lib/subscription'
import { inr, fmtDate, timeAgo, cls } from '../lib/utils'

// Platform owner console: every society, its subscription, payments and invoices.
// Only accounts listed in public.platform_admins can open it (checked by the database).
export default function Platform() {
  const isOwner = usePlatformAdmin()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [f, setF] = useState('all')
  const [sel, setSel] = useState(null)
  const [settings, setSettings] = useState(false)
  const load = () => api.platformOverview().then((d) => { setData(d); setErr('') }).catch((e) => setErr(e.message))
  useEffect(() => { if (CLOUD) load() }, [])
  if (!CLOUD) return <Page title="Platform console" back="/profile"><Empty title="Available in society mode only" /></Page>
  if (err && !data) return <Page title="Platform console" back="/profile"><Empty title="Not available" text={isOwner ? err : 'Only the SociYo platform owner can open this page.'} /></Page>
  if (!data) return <Page title="Platform console" back="/profile"><Empty title="Loading…" /></Page>
  const rows = data.societies.map((s) => ({ ...s, d: describeSub(s, s.flats) }))
  const fy = (() => { const n = new Date(); const y = n.getMonth() >= 3 ? n.getFullYear() : n.getFullYear() - 1; return new Date(y, 3, 1) })()
  const revenueFY = rows.flatMap((s) => s.payments || []).filter((p) => new Date(p.created_at) >= fy).reduce((a, p) => a + Number(p.amount), 0)
  const soon = (s) => s.d.state === 'ok' && s.d.plan !== 'complimentary' && s.d.daysLeft !== null && s.d.daysLeft <= 30
  const counts = { all: rows.length, trial: rows.filter((s) => s.d.onTrial && s.d.state === 'ok' && s.d.plan !== 'complimentary').length, active: rows.filter((s) => !s.d.onTrial && s.d.state === 'ok').length, soon: rows.filter(soon).length, overdue: rows.filter((s) => s.d.state !== 'ok').length }
  const list = rows.filter((s) => (f === 'all' || (f === 'trial' && s.d.onTrial && s.d.state === 'ok' && s.d.plan !== 'complimentary') || (f === 'active' && !s.d.onTrial && s.d.state === 'ok') || (f === 'soon' && soon(s)) || (f === 'overdue' && s.d.state !== 'ok')) && (!q || `${s.name} ${s.city} ${s.id}`.toLowerCase().includes(q.toLowerCase())))
  const cur = sel && rows.find((s) => s.id === sel)
  return (
    <Page title="Platform console" subtitle="SociYo subscriptions" back="/profile" actions={<Button size="sm" variant="ghost" icon={Settings} onClick={() => setSettings(true)}>Business</Button>}>
      <div className="grid grid-cols-3 gap-2 mt-2">
        <Card className="p-3 text-center"><div className="text-lg font-extrabold">{rows.length}</div><div className="text-[11px] text-ink-500">Societies</div></Card>
        <Card className="p-3 text-center"><div className="text-lg font-extrabold">{rows.reduce((a, s) => a + Number(s.flats || 0), 0)}</div><div className="text-[11px] text-ink-500">Flats</div></Card>
        <Card className="p-3 text-center"><div className="text-lg font-extrabold">{inr(revenueFY)}</div><div className="text-[11px] text-ink-500">Received this FY</div></Card>
      </div>
      {!(data.settings?.businessName && data.settings?.upiId) && <Card className="p-4 mt-3 text-sm bg-amber-50 text-amber-900">Add your business name and UPI / bank details under <b>Business</b> – they appear on every society’s Subscription page and on invoices.</Card>}
      <div className="relative mt-3"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><Input className="pl-9" placeholder="Society name, city or code" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <Chips className="mt-3" value={f} onChange={setF} options={[{ value: 'all', label: 'All', count: counts.all }, { value: 'trial', label: 'On trial', count: counts.trial }, { value: 'active', label: 'Paid', count: counts.active }, { value: 'soon', label: 'Due in 30 days', count: counts.soon }, { value: 'overdue', label: 'Expired', count: counts.overdue }]} />
      <div className="space-y-2 mt-3">
        {list.map((s) => (
          <Card key={s.id} className="p-4" onClick={() => setSel(s.id)}>
            <div className="flex items-start gap-3">
              <span className="h-10 w-10 rounded-xl bg-brand-50 text-brand-800 grid place-items-center shrink-0"><Building2 size={18} /></span>
              <div className="flex-1 min-w-0">
                <div className="font-bold leading-snug" translate="no">{s.name}</div>
                <div className="text-xs text-ink-500"><span translate="no">{s.city}</span>{s.city && ' · '}<span>code</span> <b translate="no">{s.id}</b></div>
                <div className="text-xs text-ink-500 mt-1 flex flex-wrap gap-x-3"><span className="flex items-center gap-1"><Building2 size={12} /> {s.flats} <span>flats</span></span><span className="flex items-center gap-1"><Users size={12} /> {s.logins} <span>logins</span></span>{s.last_activity && <span className="flex items-center gap-1"><Clock size={12} /> {timeAgo(s.last_activity)}</span>}</div>
              </div>
              <div className="text-right shrink-0">
                <Badge color={s.d.tone}>{s.d.label}</Badge>
                {s.d.plan !== 'complimentary' && <div className="text-[11px] text-ink-500 mt-1">{fmtDate(s.d.endsAt)}</div>}
              </div>
            </div>
          </Card>
        ))}
        {!list.length && <Empty title="No societies here" />}
      </div>
      <SocietySheet s={cur} onClose={() => setSel(null)} reload={load} settings={data.settings || {}} />
      <BusinessSheet open={settings} onClose={() => setSettings(false)} settings={data.settings || {}} saved={() => { load(); toast('Saved') }} />
    </Page>
  )
}

function SocietySheet({ s, onClose, reload, settings }) {
  const act = useAction()
  const toast = useToast()
  const [tab, setTab] = useState('pay')
  const [p, setP] = useState({ amount: '', months: 12, method: 'UPI', ref: '', note: '' })
  const [e, setE] = useState({})
  const [busy, setBusy] = useState(false)
  const [forId, setForId] = useState(null)
  if (s && s.id !== forId) {
    setForId(s.id); setTab('pay')
    setP({ amount: s.d.yearly || '', months: 12, method: 'UPI', ref: '', note: '' })
    setE({ pricePerFlat: s.d.price, plan: s.d.plan, status: s.status || 'trial', trialEnds: (s.d.trialEnds || '').slice(0, 10), paidUntil: (s.d.paidUntil || '').slice(0, 10), notes: s.notes || '' })
  }
  if (!s) return <Sheet open={false} onClose={onClose} title="" />
  const run = async (fn, msg) => { setBusy(true); try { const r = await fn(); toast(msg); await reload(); return r } catch (x) { toast(x.message, 'error') } finally { setBusy(false) } }
  const recordPay = async () => {
    const r = await run(() => api.platformRecordPayment(s.id, p), 'Payment recorded – plan extended')
    if (r) { setP({ ...p, ref: '', note: '' }); setTab('invoices') }
  }
  const saveEdit = () => run(() => api.platformUpdateSubscription(s.id, {
    pricePerFlat: Number(e.pricePerFlat) || 20, plan: e.plan, status: e.status, notes: e.notes,
    trialEnds: e.trialEnds ? new Date(e.trialEnds + 'T23:59:00').toISOString() : null,
    paidUntil: e.paidUntil ? new Date(e.paidUntil + 'T23:59:00').toISOString() : null
  }), 'Subscription updated')
  const society = { name: s.name, city: s.city }
  return (
    <Sheet open={!!s} onClose={onClose} title={s.name}>
      <div className="text-sm text-ink-500 -mt-2 mb-3"><span>code</span> <b translate="no">{s.id}</b> · {s.flats} <span>flats</span> · {s.logins} <span>logins</span> · <span>since</span> {fmtDate(s.created_at)}</div>
      <div className="rounded-2xl bg-ink-100/60 p-3 text-sm mb-3 flex items-center justify-between">
        <div><div className="font-bold">{s.d.label}</div><div className="text-xs text-ink-500">{s.d.plan === 'complimentary' ? 'No expiry' : `${s.d.onTrial ? 'Trial ends' : 'Paid until'} ${fmtDate(s.d.endsAt)}`}</div></div>
        <div className="text-right"><div className="font-bold">{inr(s.d.yearly)}</div><div className="text-xs text-ink-500">per year</div></div>
      </div>
      <div className="flex gap-2 mb-3">
        {[['pay', 'Record payment'], ['edit', 'Edit plan'], ['invoices', `Invoices (${(s.payments || []).length})`]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={cls('flex-1 h-10 rounded-xl text-sm font-semibold', tab === k ? 'bg-brand-800 text-white' : 'bg-ink-100 text-ink-700')}>{l}</button>
        ))}
      </div>
      {tab === 'pay' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Amount received (₹)"><Input type="number" inputMode="decimal" value={p.amount} onChange={(x) => setP({ ...p, amount: x.target.value })} /></Field>
            <Field label="Months covered"><Select value={p.months} onChange={(x) => setP({ ...p, months: Number(x.target.value), amount: Math.round(s.d.flats * s.d.price * Number(x.target.value)) })}>{[1, 3, 6, 12, 24].map((m) => <option key={m} value={m}>{m}</option>)}</Select></Field>
            <Field label="Method"><Select value={p.method} onChange={(x) => setP({ ...p, method: x.target.value })}>{['UPI', 'Bank transfer', 'Cheque', 'Cash'].map((m) => <option key={m}>{m}</option>)}</Select></Field>
            <Field label="UTR / cheque no."><Input value={p.ref} onChange={(x) => setP({ ...p, ref: x.target.value })} /></Field>
          </div>
          <Field label="Note (optional)"><Input value={p.note} onChange={(x) => setP({ ...p, note: x.target.value })} /></Field>
          <p className="text-xs text-ink-500 mb-3">{s.d.flats} flats × {inr(s.d.price)} × {p.months} months = {inr(s.d.flats * s.d.price * p.months)}. The plan is extended from {fmtDate(new Date(Math.max(Date.now(), s.d.paidUntil ? new Date(s.d.paidUntil).getTime() : 0, s.d.trialEnds ? new Date(s.d.trialEnds).getTime() : 0)).toISOString())} and an invoice number is issued.</p>
          <Button block icon={IndianRupee} loading={busy} disabled={!(Number(p.amount) >= 0) || p.amount === ''} onClick={recordPay}>Record {p.amount !== '' ? inr(Number(p.amount)) : ''}</Button>
        </>
      )}
      {tab === 'edit' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Price per flat / month (₹)"><Input type="number" inputMode="decimal" value={e.pricePerFlat} onChange={(x) => setE({ ...e, pricePerFlat: x.target.value })} /></Field>
            <Field label="Plan"><Select value={e.plan} onChange={(x) => setE({ ...e, plan: x.target.value })}><option value="yearly">Yearly</option><option value="complimentary">Complimentary (free)</option></Select></Field>
            <Field label="Trial ends"><Input type="date" value={e.trialEnds} onChange={(x) => setE({ ...e, trialEnds: x.target.value })} /></Field>
            <Field label="Paid until"><Input type="date" value={e.paidUntil} onChange={(x) => setE({ ...e, paidUntil: x.target.value })} /></Field>
          </div>
          <Field label="Status" hint="Suspended = read-only immediately, whatever the dates"><Select value={e.status} onChange={(x) => setE({ ...e, status: x.target.value })}><option value="trial">Trial</option><option value="active">Active</option><option value="suspended">Suspended</option></Select></Field>
          <Field label="Private notes"><Textarea rows={3} value={e.notes} onChange={(x) => setE({ ...e, notes: x.target.value })} placeholder="Contact person, negotiated price, reminders…" /></Field>
          <Button block loading={busy} onClick={saveEdit}>Save changes</Button>
        </>
      )}
      {tab === 'invoices' && (
        <Card className="divide-y divide-ink-100 overflow-hidden">
          {(s.payments || []).map((x) => (
            <div key={x.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0"><div className="text-sm font-semibold">{inr(x.amount)} · {x.months} <span>months</span></div><div className="text-[11px] text-ink-500">{x.invoice_no} · {fmtDate(x.created_at)} · {x.method}{x.ref ? ` · ${x.ref}` : ''}</div></div>
              <Button size="sm" variant="secondary" icon={Download} onClick={() => invoicePdf(x, society, settings)}>PDF</Button>
            </div>
          ))}
          {!(s.payments || []).length && <div className="px-4 py-4 text-sm text-ink-500">No payments yet.</div>}
        </Card>
      )}
    </Sheet>
  )
}

function BusinessSheet({ open, onClose, settings, saved }) {
  const toast = useToast()
  const [f, setF] = useState(settings)
  const [was, setWas] = useState(false)
  const [busy, setBusy] = useState(false)
  if (open !== was) { setWas(open); if (open) setF(settings) }
  const set = (k) => (x) => setF({ ...f, [k]: x.target.value })
  const save = async () => { setBusy(true); try { await api.platformSetSettings(f); saved(); onClose() } catch (x) { toast(x.message, 'error') } finally { setBusy(false) } }
  return (
    <Sheet open={open} onClose={onClose} title="Your business details" footer={<Button block loading={busy} onClick={save}>Save</Button>}>
      <p className="text-sm text-ink-500 mb-3">Shown to society committees on their Subscription page and printed on invoices.</p>
      <Field label="Business name"><Input value={f.businessName || ''} onChange={set('businessName')} placeholder="e.g. SociYo" /></Field>
      <Field label="Address"><Textarea rows={2} value={f.address || ''} onChange={set('address')} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Phone / WhatsApp"><Input inputMode="tel" value={f.phone || ''} onChange={set('phone')} /></Field>
        <Field label="Email"><Input type="email" value={f.email || ''} onChange={set('email')} /></Field>
      </div>
      <Field label="UPI ID"><Input value={f.upiId || ''} onChange={set('upiId')} autoCapitalize="none" placeholder="name@bank" /></Field>
      <Field label="Bank details (for NEFT)"><Textarea rows={3} value={f.bank || ''} onChange={set('bank')} placeholder={'Account name\nAccount no.\nIFSC'} /></Field>
      <Field label="GSTIN (optional)" hint="Leave empty until you are GST-registered"><Input value={f.gstin || ''} onChange={set('gstin')} autoCapitalize="characters" /></Field>
    </Sheet>
  )
}
