import { useEffect, useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import { Plus, UserPlus, Check, X, Share2, Copy, Clock, LogIn, LogOut, Package, Car, Wrench, User, QrCode } from 'lucide-react'
import { Page, Button, Card, Tabs, Empty, Sheet, Field, Input, Select, Badge, useAction, useToast, useConfirm } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/db'
import { preapproveVisitor, respondVisitor, cancelInvite, VISITOR_TYPES, aptNo } from '../lib/actions'
import { fmtDateTime, timeAgo, cls, shareText } from '../lib/utils'

export const V_ICON = { guest: User, delivery: Package, cab: Car, service: Wrench }
const STATUS = { preapproved: ['blue', 'Expected'], pending: ['amber', 'Waiting at gate'], approved: ['green', 'Approved'], rejected: ['red', 'Denied'], inside: ['green', 'Inside'], exited: ['gray', 'Exited'], cancelled: ['gray', 'Cancelled'] }
export const VisitorStatus = ({ s }) => <Badge color={STATUS[s]?.[0]} dot>{STATUS[s]?.[1]}</Badge>

export default function Visitors() {
  return (
    <Routes>
      <Route index element={<List />} />
      <Route path="new" element={<Invite />} />
    </Routes>
  )
}

export function VisitorRow({ v, children, showApt }) {
  const Icon = V_ICON[v.type] || User
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-2xl bg-violet-50 text-violet-700 grid place-items-center shrink-0"><Icon size={20} /></div>
        <div className="flex-1 min-w-0">
          <div className="font-bold truncate">{v.name}</div>
          <div className="text-xs text-ink-500 truncate">{VISITOR_TYPES[v.type]}{showApt && ` · ${aptNo(v.apartmentId)}`}{v.purpose && ` · ${v.purpose}`}{v.vehicle && ` · ${v.vehicle}`}</div>
        </div>
        <VisitorStatus s={v.status} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-500 mt-2.5">
        {v.expectedAt && v.status === 'preapproved' && <span className="flex items-center gap-1"><Clock size={12} /> Expected {fmtDateTime(v.expectedAt)}</span>}
        {v.entryAt && <span className="flex items-center gap-1"><LogIn size={12} /> In {fmtDateTime(v.entryAt)}</span>}
        {v.exitAt && <span className="flex items-center gap-1"><LogOut size={12} /> Out {fmtDateTime(v.exitAt)}</span>}
        {!v.entryAt && v.status !== 'preapproved' && <span>{timeAgo(v.createdAt)}</span>}
      </div>
      {children}
    </Card>
  )
}

function List() {
  const { user } = useAuth()
  const nav = useNavigate()
  const act = useAction()
  const ask = useConfirm()
  const [tab, setTab] = useState('upcoming')
  const [pass, setPass] = useState(null)
  const all = useData((d) => d.list('visitors', (v) => v.apartmentId === user.apartmentId).sort((a, b) => new Date(b.entryAt || b.createdAt) - new Date(a.entryAt || a.createdAt)))
  const pending = all.filter((v) => v.status === 'pending')
  const upcoming = all.filter((v) => ['preapproved', 'approved', 'inside'].includes(v.status))
  const history = all.filter((v) => ['exited', 'rejected', 'cancelled'].includes(v.status))
  if (!user.apartmentId) return <Page title="Visitors" back><Empty title="No apartment linked" /></Page>
  return (
    <Page title="Visitors" subtitle={`Gate pass & entry log · ${aptNo(user.apartmentId)}`} back actions={<Button size="sm" icon={Plus} onClick={() => nav('new')}>Invite</Button>}>
      {pending.length > 0 && (
        <div className="space-y-3 mt-2">
          {pending.map((v) => (
            <VisitorRow key={v.id} v={v}>
              <div className="flex gap-2 mt-3">
                <Button variant="danger" block size="sm" icon={X} onClick={() => act(() => respondVisitor(user, v.id, false), 'Entry denied')}>Deny</Button>
                <Button variant="success" block size="sm" icon={Check} onClick={() => act(() => respondVisitor(user, v.id, true), 'Entry approved – guard notified')}>Approve entry</Button>
              </div>
            </VisitorRow>
          ))}
        </div>
      )}
      <Card className="p-4 mt-3 flex items-center gap-3 bg-gradient-to-r from-violet-50 to-white" onClick={() => nav('new')}>
        <div className="h-11 w-11 rounded-2xl bg-violet-600 text-white grid place-items-center"><UserPlus size={20} /></div>
        <div className="flex-1"><div className="font-bold">Pre-approve a visitor</div><div className="text-xs text-ink-500">Share a QR / OTP pass for hassle-free entry</div></div>
      </Card>
      <Tabs className="mt-4" value={tab} onChange={setTab} tabs={[{ value: 'upcoming', label: `Expected & inside (${upcoming.length})` }, { value: 'history', label: 'History' }]} />
      <div className="space-y-3 mt-3">
        {(tab === 'upcoming' ? upcoming : history).map((v) => (
          <VisitorRow key={v.id} v={v}>
            {v.status === 'preapproved' && (
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" onClick={async () => { if (await ask({ title: 'Cancel this invitation?', ok: 'Cancel invite', danger: true })) act(() => cancelInvite(user, v.id), 'Invitation cancelled') }}>Cancel</Button>
                <Button variant="secondary" size="sm" block icon={QrCode} onClick={() => setPass(v)}>View pass · {v.otp}</Button>
              </div>
            )}
          </VisitorRow>
        ))}
        {!(tab === 'upcoming' ? upcoming : history).length && <Empty icon={User} title={tab === 'upcoming' ? 'No expected visitors' : 'No visitor history'} />}
      </div>
      <PassSheet v={pass} onClose={() => setPass(null)} />
    </Page>
  )
}

export function PassSheet({ v, onClose }) {
  const { society } = useAuth()
  const toast = useToast()
  const [qr, setQr] = useState('')
  useEffect(() => { if (v) QRCode.toDataURL(`SSV:${v.id}:${v.otp}`, { width: 520, margin: 1, color: { dark: '#3B1F3A' } }).then(setQr) }, [v?.id])
  if (!v) return null
  const text = `Hi ${v.name.split(' ')[0]}! You're invited to ${society.name}, flat ${aptNo(v.apartmentId)}.\n📅 ${fmtDateTime(v.expectedAt)}\n🔐 Entry code: ${v.otp}\nShow this code (or the QR) to security at the main gate.\n📍 ${society.address}`
  const share = async () => {
    try {
      const blob = await (await fetch(qr)).blob()
      const file = new File([blob], 'gate-pass.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], text, title: 'Gate pass' })
    } catch (e) { if (e?.name === 'AbortError') return }
    const r = await shareText({ title: 'Gate pass', text })
    if (r === 'copied') toast('Invitation copied – paste it in WhatsApp')
  }
  return (
    <Sheet open={!!v} onClose={onClose} title="Gate pass">
      <div className="rounded-3xl bg-gradient-to-br from-brand-800 to-brand-900 text-white p-5 text-center">
        <div className="text-xs text-brand-200">{society.name}</div>
        <div className="text-lg font-extrabold">{v.name}</div>
        <div className="text-xs text-brand-200">{VISITOR_TYPES[v.type]} · {aptNo(v.apartmentId)} · {v.guests || 1} person(s)</div>
        <div className="bg-white rounded-2xl p-3 mt-4 mx-auto w-52">{qr ? <img src={qr} alt="QR code" className="w-full" /> : <div className="aspect-square" />}</div>
        <div className="text-xs text-brand-200 mt-4">Entry code</div>
        <div className="text-[34px] font-extrabold tracking-[0.25em]">{v.otp}</div>
        <div className="text-xs text-brand-200">{fmtDateTime(v.expectedAt)}{v.validTill && ` · valid till ${fmtDateTime(v.validTill)}`}</div>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-4">
        <Button variant="outline" icon={Copy} onClick={async () => { try { await navigator.clipboard.writeText(text); toast('Copied') } catch { toast('Copy failed', 'error') } }}>Copy</Button>
        <Button variant="success" icon={Share2} onClick={share}>Share pass</Button>
      </div>
    </Sheet>
  )
}

const pad = (n) => String(n).padStart(2, '0')
const localDT = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`

function Invite() {
  const { user } = useAuth()
  const nav = useNavigate()
  const act = useAction()
  const soon = new Date(Date.now() + 2 * 3600000); soon.setMinutes(0)
  const [f, setF] = useState({ name: '', phone: '', type: 'guest', company: '', expectedAt: localDT(soon), validHours: '6', guests: 1, vehicle: '', purpose: '' })
  const [created, setCreated] = useState(null)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = () => {
    const exp = new Date(f.expectedAt)
    const v = act(() => preapproveVisitor(user, { name: f.name.trim(), phone: f.phone, type: f.type, company: f.company, expectedAt: exp.toISOString(), validTill: new Date(exp.getTime() + Number(f.validHours) * 3600000).toISOString(), guests: Number(f.guests) || 1, vehicle: f.vehicle.toUpperCase(), purpose: f.purpose }), 'Visitor pre-approved – security informed')
    if (v) setCreated(v)
  }
  return (
    <Page title="Invite a visitor" back>
      <Field label="Visitor type">
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(VISITOR_TYPES).map(([k, l]) => { const Icon = V_ICON[k]; return (
            <button key={k} type="button" onClick={() => setF({ ...f, type: k })} className={cls('rounded-2xl p-3 flex flex-col items-center gap-1 text-[11px] font-semibold border-2', f.type === k ? 'border-violet-500 bg-violet-50 text-violet-800' : 'border-transparent bg-white shadow-card')}><Icon size={20} />{l.split(' ')[0]}</button>
          ) })}
        </div>
      </Field>
      <Field label={f.type === 'guest' ? 'Guest name' : 'Name'}><Input value={f.name} onChange={set('name')} placeholder={f.type === 'delivery' ? 'e.g. Amazon delivery' : 'Full name'} /></Field>
      {f.type !== 'guest' && <Field label="Company"><Input value={f.company} onChange={set('company')} placeholder="Amazon, Uber, Urban Company…" /></Field>}
      <Field label="Mobile (optional)"><Input inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="Visitor’s mobile" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Expected at"><Input type="datetime-local" value={f.expectedAt} onChange={set('expectedAt')} /></Field>
        <Field label="Valid for"><Select value={f.validHours} onChange={set('validHours')}>{[['2', '2 hours'], ['6', '6 hours'], ['12', '12 hours'], ['24', '1 day'], ['72', '3 days']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="No. of people"><Input type="number" min={1} max={20} value={f.guests} onChange={set('guests')} /></Field>
        <Field label="Vehicle no."><Input value={f.vehicle} onChange={set('vehicle')} placeholder="Optional" /></Field>
      </div>
      <Field label="Purpose"><Input value={f.purpose} onChange={set('purpose')} placeholder="Dinner, delivery, repair…" /></Field>
      <Button block size="lg" icon={QrCode} onClick={submit} disabled={!f.name.trim()}>Generate gate pass</Button>
      <PassSheet v={created} onClose={() => { setCreated(null); nav('/visitors', { replace: true }) }} />
    </Page>
  )
}
