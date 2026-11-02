import { useMemo, useState } from 'react'
import { Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { Users, IndianRupee, ShieldCheck, Clock, CalendarCheck, Info, CheckCircle2 } from 'lucide-react'
import { Page, Button, Card, Tabs, Empty, Sheet, Field, Textarea, Badge, useAction, useConfirm } from '../components/ui'
import { getLocale } from '../i18n'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/db'
import { createBooking, cancelBooking, activeBookings, overlaps, aptNo } from '../lib/actions'
import { inr, fmtDateTime, fmtTime, cls, isoDay } from '../lib/utils'

export default function Facilities() {
  return (
    <Routes>
      <Route index element={<List />} />
      <Route path=":id" element={<Book />} />
    </Routes>
  )
}

const BST = { confirmed: ['green', 'Confirmed'], pending: ['amber', 'Awaiting approval'], cancelled: ['gray', 'Cancelled'], rejected: ['red', 'Declined'] }
export const BookingBadge = ({ s }) => <Badge color={BST[s][0]} dot>{BST[s][1]}</Badge>

function List() {
  const { user } = useAuth()
  const nav = useNavigate()
  const act = useAction()
  const ask = useConfirm()
  const [tab, setTab] = useState('book')
  const facilities = useData((d) => d.list('facilities', (f) => f.active))
  const mine = useData((d) => d.list('bookings', (b) => b.apartmentId && b.apartmentId === user.apartmentId).sort((a, b) => new Date(b.start) - new Date(a.start)))
  const upcoming = mine.filter((b) => new Date(b.end) > new Date() && ['pending', 'confirmed'].includes(b.status))
  const past = mine.filter((b) => !upcoming.includes(b))
  const fac = (id) => facilities.find((f) => f.id === id) || {}
  const Row = ({ b }) => {
    const f = fac(b.facilityId)
    return (
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl grid place-items-center text-2xl" style={{ background: f.color + '1A' }}>{f.emoji}</div>
          <div className="flex-1 min-w-0"><div className="font-bold">{f.name}</div><div className="text-xs text-ink-500">{fmtDateTime(b.start)} – {fmtTime(b.end)}</div>{b.note && <div className="text-xs text-ink-400 truncate">{b.note}</div>}</div>
          <BookingBadge s={b.status} />
        </div>
        {b.reason && <p className="text-xs text-red-600 mt-2">Reason: {b.reason}</p>}
        {upcoming.includes(b) && <Button size="sm" variant="danger" className="mt-3" onClick={async () => { if (await ask({ title: 'Cancel this booking?', ok: 'Cancel booking', danger: true })) act(() => cancelBooking(user, b.id), 'Booking cancelled') }}>Cancel booking</Button>}
      </Card>
    )
  }
  return (
    <Page title="Amenities" subtitle="Book society facilities" back>
      <Tabs className="mt-1" value={tab} onChange={setTab} tabs={[{ value: 'book', label: 'Book a facility' }, { value: 'mine', label: `My bookings (${upcoming.length})` }]} />
      {tab === 'book' ? (
        <div className="grid grid-cols-2 gap-3 mt-4">
          {facilities.map((f) => (
            <Card key={f.id} className="overflow-hidden" onClick={() => nav(f.id)}>
              <div className="h-24 grid place-items-center text-5xl relative" style={{ background: `linear-gradient(135deg, ${f.color}26, ${f.color}0D)` }}>
                {f.emoji}
                {f.requiresApproval && <span className="absolute top-2 right-2 text-[9px] font-bold bg-white/90 rounded-full px-2 py-0.5 text-amber-700">APPROVAL</span>}
              </div>
              <div className="p-3">
                <div className="font-bold text-[14px]">{f.name}</div>
                <div className="text-[11px] text-ink-500 mt-0.5">{f.charge ? `${inr(f.charge)}/${f.chargeUnit}` : 'Free'} · {f.slotHours === 24 ? 'Full day' : `${f.slotHours}h slots`}</div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-3 mt-4">
          {upcoming.map((b) => <Row key={b.id} b={b} />)}
          {!upcoming.length && <Empty icon={CalendarCheck} title="No upcoming bookings" action={<Button onClick={() => setTab('book')}>Book now</Button>} />}
          {past.length > 0 && <div className="text-xs font-bold text-ink-400 uppercase tracking-wider pt-4">Past & cancelled</div>}
          {past.map((b) => <Row key={b.id} b={b} />)}
        </div>
      )}
    </Page>
  )
}

function Book() {
  const { id } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const act = useAction()
  const f = useData((d) => d.get('facilities', id))
  const bookings = useData(() => activeBookings(id))
  const [day, setDay] = useState(isoDay(new Date()))
  const [slot, setSlot] = useState(null)
  const [note, setNote] = useState('')
  const [agree, setAgree] = useState(false)
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => new Date(Date.now() + i * 86400000)), [])
  if (!f) return <Page title="Facility" back><Empty title="Not found" /></Page>
  const slots = []
  const [y, m, d] = day.split('-').map(Number)
  if (f.slotHours === 24) {
    const s = new Date(y, m - 1, d, f.open), e = new Date(y, m - 1, d + 1, 11)
    slots.push({ s, e })
  } else for (let h = f.open; h + f.slotHours <= f.close; h += f.slotHours) slots.push({ s: new Date(y, m - 1, d, h), e: new Date(y, m - 1, d, h + f.slotHours) })
  const info = (sl) => {
    const b = bookings.find((x) => overlaps(sl.s, sl.e, x.start, x.end))
    if (b) return b.apartmentId === user.apartmentId ? { state: 'mine', b } : { state: 'booked', b }
    if (sl.s < new Date()) return { state: 'past' }
    return { state: 'free' }
  }
  const free = slots.filter((s) => info(s).state === 'free').length
  const confirm = () => {
    const b = act(() => createBooking(user, { facilityId: f.id, start: slot.s.toISOString(), end: slot.e.toISOString(), note }), f.requiresApproval ? 'Request sent for approval' : 'Booking confirmed!')
    if (b) { setSlot(null); setNote(''); setAgree(false); nav('/facilities') }
  }
  return (
    <Page title={f.name} back="/facilities" noPad>
      <div className="h-36 grid place-items-center text-7xl" style={{ background: `linear-gradient(135deg, ${f.color}33, ${f.color}0A)` }}>{f.emoji}</div>
      <div className="px-4">
        <div className="grid grid-cols-3 gap-2 -mt-6 relative">
          <Card className="p-3 text-center"><Users size={16} className="mx-auto text-ink-400" /><div className="font-bold text-sm mt-1">{f.capacity}</div><div className="text-[10px] text-ink-500">Capacity</div></Card>
          <Card className="p-3 text-center"><IndianRupee size={16} className="mx-auto text-ink-400" /><div className="font-bold text-sm mt-1">{f.charge ? inr(f.charge) : 'Free'}</div><div className="text-[10px] text-ink-500">per {f.chargeUnit}</div></Card>
          <Card className="p-3 text-center"><Clock size={16} className="mx-auto text-ink-400" /><div className="font-bold text-sm mt-1">{f.slotHours === 24 ? '24h' : `${f.open}–${f.close}`}</div><div className="text-[10px] text-ink-500">{f.slotHours === 24 ? 'Check-in 12 PM' : 'Hours'}</div></Card>
        </div>
        {f.requiresApproval && <div className="mt-3 text-xs font-semibold text-amber-800 bg-amber-50 rounded-xl px-3 py-2 flex items-center gap-2"><ShieldCheck size={15} /> Bookings need committee approval</div>}

        <h3 className="font-bold mt-5 mb-2">Select date</h3>
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
          {days.map((dt) => {
            const k = isoDay(dt)
            return (
              <button key={k} onClick={() => setDay(k)} className={cls('shrink-0 w-14 py-2 rounded-2xl text-center border transition', day === k ? 'bg-brand-800 text-white border-brand-800' : 'bg-white border-ink-200')}>
                <div className={cls('text-[10px] font-semibold uppercase', day === k ? 'text-brand-200' : 'text-ink-400')}>{dt.toLocaleDateString(getLocale(), { weekday: 'short' })}</div>
                <div className="text-lg font-extrabold">{dt.getDate()}</div>
                <div className={cls('text-[10px]', day === k ? 'text-brand-200' : 'text-ink-400')}>{dt.toLocaleDateString(getLocale(), { month: 'short' })}</div>
              </button>
            )
          })}
        </div>

        <h3 className="font-bold mt-5 mb-2 flex items-center justify-between">Time slots <span className="text-xs font-semibold text-ink-500">{free} available</span></h3>
        <div className="grid grid-cols-2 gap-2">
          {slots.map((sl, i) => {
            const st = info(sl)
            return (
              <button key={i} disabled={st.state !== 'free'} onClick={() => setSlot(sl)} className={cls('rounded-2xl p-3 text-left border-2 transition',
                st.state === 'free' && 'bg-white border-accent-100 hover:border-accent-500 active:scale-[.98]',
                st.state === 'booked' && 'bg-ink-100 border-transparent text-ink-400',
                st.state === 'mine' && 'bg-brand-50 border-brand-200',
                st.state === 'past' && 'bg-ink-100/50 border-transparent text-ink-300')}>
                <div className="text-sm font-bold">{fmtTime(sl.s.toISOString())} – {fmtTime(sl.e.toISOString())}</div>
                <div className={cls('text-[11px] font-semibold mt-0.5', st.state === 'free' ? 'text-accent-600' : st.state === 'mine' ? 'text-brand-700' : '')}>
                  {st.state === 'free' ? 'Available' : st.state === 'mine' ? (st.b.status === 'pending' ? 'Your request' : 'Your booking') : st.state === 'booked' ? `Booked${st.b.status === 'pending' ? ' (pending)' : ''}` : 'Past'}
                </div>
              </button>
            )
          })}
        </div>

        <Card className="p-4 mt-5">
          <div className="font-bold text-sm flex items-center gap-2 mb-2"><Info size={16} /> Rules</div>
          <ul className="text-sm text-ink-700 space-y-1.5">{f.rules.map((r) => <li key={r} className="flex gap-2"><span className="text-accent-500">•</span>{r}</li>)}</ul>
        </Card>
      </div>

      <Sheet open={!!slot} onClose={() => setSlot(null)} title="Confirm booking">
        {slot && (
          <>
            <div className="rounded-2xl bg-ink-100 p-4">
              <div className="font-bold">{f.emoji} {f.name}</div>
              <div className="text-sm text-ink-700 mt-1">{fmtDateTime(slot.s.toISOString())} – {f.slotHours === 24 ? fmtDateTime(slot.e.toISOString()) : fmtTime(slot.e.toISOString())}</div>
              <div className="text-sm text-ink-700">For {aptNo(user.apartmentId)}</div>
              <div className="flex justify-between mt-3 pt-3 border-t border-ink-200 font-bold"><span>Charges</span><span>{f.charge ? inr(f.charge) : 'Free'}</span></div>
              {f.charge > 0 && <div className="text-[11px] text-ink-500 mt-1">Payable at the society office before use.</div>}
            </div>
            <Field label="Purpose / note (optional)" className="mt-4"><Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Birthday party, practice session…" /></Field>
            <label className="flex items-start gap-3 text-sm text-ink-700 mb-4"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="h-5 w-5 mt-0.5 accent-[#3B1F3A]" /> I agree to follow the facility rules and take responsibility for any damage.</label>
            <Button block size="lg" variant="success" icon={CheckCircle2} disabled={!agree} onClick={confirm}>{f.requiresApproval ? 'Request booking' : 'Confirm booking'}</Button>
          </>
        )}
      </Sheet>
    </Page>
  )
}
