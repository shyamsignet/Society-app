import { useState } from 'react'
import { Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { Plus, Minus, MapPin, Clock, Users, BellRing, BellOff, CalendarPlus, ImagePlus, ChevronLeft, ChevronRight, CalendarDays, Share2, ArrowLeft, Check, Receipt, Trash2, Wallet, ArrowRight } from 'lucide-react'
import { Page, Button, Card, Tabs, Empty, Field, Input, Textarea, Select, Avatar, MediaPicker, MediaGrid, Sheet, Badge, useAction, useToast, useConfirm } from '../components/ui'
import { getLocale } from '../i18n'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/db'
import { can } from '../lib/rbac'
import { createEvent, rsvpEvent, toggleReminder, addEventPhotos, userById, household, addEventExpense, removeEventExpense, recordSettlement, removeSettlement, setEventSplit } from '../lib/actions'
import { fmtDateTime, fmtTime, cls, sameDay, artImage, inr, timeAgo, appLink, shareOnWhatsApp } from '../lib/utils'
import { goingCount, headsOf, includedBy, splitEvent } from '../lib/eventSplit'

export default function Events() {
  return (
    <Routes>
      <Route index element={<List />} />
      <Route path="new" element={<NewEvent />} />
      <Route path=":id" element={<Detail />} />
    </Routes>
  )
}
const going = goingCount

// WhatsApp-formatted invite with a link that opens this event in the app for RSVP.
export const eventShareText = (e, society) => [
  `${e.emoji || '🎉'} *${e.title}*`,
  `🏡 ${society?.name || ''}`.trim(),
  '',
  `🗓️ ${fmtDateTime(e.start)}`,
  `📍 ${e.venue}`,
  ...(e.description ? ['', e.description.length > 300 ? e.description.slice(0, 300).trimEnd() + '…' : e.description] : []),
  '',
  `👉 RSVP here: ${appLink(`/events/${e.id}`)}`
].join('\n')

function EventCard({ e }) {
  const nav = useNavigate()
  const { user, society } = useAuth()
  const my = e.rsvps.find((r) => r.userId === user.id)
  const d = new Date(e.start)
  return (
    <Card className="overflow-hidden" onClick={() => nav(`/events/${e.id}`)}>
      <div className="relative h-32"><img src={e.cover} alt="" className="h-full w-full object-cover" />
        <div className="absolute top-3 left-3 bg-white rounded-xl px-2.5 py-1 text-center shadow"><div className="text-[10px] font-bold text-red-500 uppercase">{d.toLocaleDateString(getLocale(), { month: 'short' })}</div><div className="text-lg font-extrabold leading-none">{d.getDate()}</div></div>
        {my && <Badge color={my.status === 'going' ? 'green' : 'amber'} className="absolute top-3 right-14 !bg-white">{my.status === 'going' ? '✓ Going' : 'Maybe'}</Badge>}
        <button type="button" aria-label="Share on WhatsApp" title="Share on WhatsApp" onClick={(ev) => { ev.stopPropagation(); shareOnWhatsApp(eventShareText(e, society)) }} className="absolute top-2.5 right-2.5 h-9 w-9 rounded-full bg-white text-ink-700 shadow grid place-items-center"><Share2 size={17} /></button>
      </div>
      <div className="p-4">
        <div className="text-[11px] font-bold text-pink-600 uppercase tracking-wide">{e.category}</div>
        <div className="font-bold text-[16px] leading-snug">{e.title}</div>
        <div className="text-xs text-ink-500 mt-1.5 flex flex-wrap gap-x-3 gap-y-1"><span className="flex items-center gap-1"><Clock size={12} /> {fmtDateTime(e.start)}</span><span className="flex items-center gap-1"><MapPin size={12} /> {e.venue}</span><span className="flex items-center gap-1"><Users size={12} /> {going(e)} going</span></div>
      </div>
    </Card>
  )
}

function List() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [tab, setTab] = useState('upcoming')
  const events = useData((d) => d.list('events').sort((a, b) => new Date(a.start) - new Date(b.start)))
  const now = new Date()
  const upcoming = events.filter((e) => new Date(e.end || e.start) >= now)
  const past = events.filter((e) => new Date(e.end || e.start) < now).reverse()
  return (
    <Page title="Events" subtitle="Celebrate together" back actions={can(user, 'events.create') && <Button size="sm" icon={Plus} onClick={() => nav('new')}>Create</Button>}>
      <Tabs className="mt-1" value={tab} onChange={setTab} tabs={[{ value: 'upcoming', label: 'Upcoming' }, { value: 'calendar', label: 'Calendar' }, { value: 'past', label: 'Past & gallery' }]} />
      {tab === 'calendar' ? <Calendar events={events} /> : (
        <div className="space-y-3 mt-4">
          {(tab === 'upcoming' ? upcoming : past).map((e) => <EventCard key={e.id} e={e} />)}
          {!(tab === 'upcoming' ? upcoming : past).length && <Empty icon={CalendarDays} title="No events" action={can(user, 'events.create') && <Button onClick={() => nav('new')}>Create an event</Button>} />}
        </div>
      )}
    </Page>
  )
}

function Calendar({ events }) {
  const [cur, setCur] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const [sel, setSel] = useState(new Date())
  const first = cur.getDay()
  const daysIn = new Date(cur.getFullYear(), cur.getMonth() + 1, 0).getDate()
  const cells = [...Array(first).fill(null), ...Array.from({ length: daysIn }, (_, i) => new Date(cur.getFullYear(), cur.getMonth(), i + 1))]
  const on = (d) => events.filter((e) => sameDay(e.start, d) || (e.end && new Date(e.start) <= d && new Date(e.end) >= new Date(d.getFullYear(), d.getMonth(), d.getDate())))
  return (
    <>
      <Card className="p-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <button aria-label="Previous month" onClick={() => setCur(new Date(cur.getFullYear(), cur.getMonth() - 1, 1))} className="h-9 w-9 grid place-items-center rounded-full hover:bg-ink-100"><ChevronLeft size={18} /></button>
          <div className="font-bold">{cur.toLocaleDateString(getLocale(), { month: 'long', year: 'numeric' })}</div>
          <button aria-label="Next month" onClick={() => setCur(new Date(cur.getFullYear(), cur.getMonth() + 1, 1))} className="h-9 w-9 grid place-items-center rounded-full hover:bg-ink-100"><ChevronRight size={18} /></button>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] font-bold text-ink-400 mb-1">{Array.from({ length: 7 }, (_, i) => new Date(2023, 0, 1 + i).toLocaleDateString(getLocale(), { weekday: 'narrow' })).map((d, i) => <div key={i}>{d}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => d ? (
            <button key={i} onClick={() => setSel(d)} className={cls('aspect-square rounded-xl text-sm font-semibold relative', sameDay(d, sel) ? 'bg-brand-800 text-white' : sameDay(d, new Date()) ? 'bg-brand-50 text-brand-800' : 'hover:bg-ink-100')}>
              {d.getDate()}
              {on(d).length > 0 && <span className={cls('absolute bottom-1 left-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full', sameDay(d, sel) ? 'bg-accent-400' : 'bg-pink-500')} />}
            </button>
          ) : <div key={i} />)}
        </div>
      </Card>
      <div className="space-y-3 mt-4">
        {on(sel).map((e) => <EventCard key={e.id} e={e} />)}
        {!on(sel).length && <p className="text-sm text-ink-400 text-center py-4">No events on {sel.toLocaleDateString(getLocale(), { day: 'numeric', month: 'long' })}</p>}
      </div>
    </>
  )
}

const icsDate = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
function downloadIcs(e, society) {
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SociYo//EN', 'BEGIN:VEVENT', `UID:${e.id}@sociyo`, `DTSTAMP:${icsDate(new Date().toISOString())}`, `DTSTART:${icsDate(e.start)}`, `DTEND:${icsDate(e.end || e.start)}`, `SUMMARY:${e.title}`, `LOCATION:${e.venue}, ${society.name}`, `DESCRIPTION:${(e.description || '').replace(/\n/g, '\\n')}`, 'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', `DESCRIPTION:${e.title}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  a.download = `${e.title.replace(/[^\w]+/g, '-')}.ics`
  a.click()
}

function Detail() {
  const { id } = useParams()
  const { user, society } = useAuth()
  const nav = useNavigate()
  const act = useAction()
  const toast = useToast()
  const e = useData((d) => d.get('events', id))
  const [photos, setPhotos] = useState([])
  const [people, setPeople] = useState(false)
  if (!e) return <Page title="Event" back><Empty title="Event not found" /></Page>
  const my = e.rsvps.find((r) => r.userId === user.id)
  const g = going(e)
  const past = new Date(e.end || e.start) < new Date()
  const reminder = e.reminders.includes(user.id)
  const org = userById(e.organizerId)
  const attendees = e.rsvps.filter((r) => r.status === 'going')
  const share = () => shareOnWhatsApp(eventShareText(e, society))
  return (
    <Page noPad hero={<div className="relative"><img src={e.cover} alt="" className="w-full h-60 object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" /><button aria-label="Back" onClick={() => nav('/events')} className="absolute left-3 top-3 h-10 w-10 rounded-full bg-black/40 backdrop-blur text-white grid place-items-center safe-top"><ArrowLeft size={20} /></button><button aria-label="Share on WhatsApp" onClick={share} className="absolute right-3 top-3 h-10 w-10 rounded-full bg-black/40 backdrop-blur text-white grid place-items-center safe-top"><Share2 size={19} /></button></div>}>
      <div className="px-4 -mt-10 relative">
        <Card className="p-5">
          <div className="text-[11px] font-bold text-pink-600 uppercase tracking-wide">{e.emoji} {e.category}</div>
          <h1 className="text-[22px] font-extrabold leading-tight mt-1">{e.title}</h1>
          <div className="space-y-2 mt-4 text-sm">
            <div className="flex items-center gap-3"><span className="h-9 w-9 rounded-xl bg-pink-50 text-pink-600 grid place-items-center"><Clock size={17} /></span><div><div className="font-semibold">{new Date(e.start).toLocaleDateString(getLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}</div><div className="text-xs text-ink-500">{fmtTime(e.start)}{e.end && ` – ${sameDay(e.start, e.end) ? fmtTime(e.end) : fmtDateTime(e.end)}`}</div></div></div>
            <div className="flex items-center gap-3"><span className="h-9 w-9 rounded-xl bg-sky-50 text-sky-700 grid place-items-center"><MapPin size={17} /></span><div className="font-semibold">{e.venue}</div></div>
            <div className="flex items-center gap-3"><Avatar user={org} size={36} /><div><div className="text-xs text-ink-500">Organised by</div><div className="font-semibold">{org?.name}</div></div></div>
          </div>
          <p className="text-[15px] text-ink-700 mt-4 leading-relaxed whitespace-pre-line">{e.description}</p>
        </Card>

        <Card className="p-4 mt-3" onClick={() => setPeople(true)}>
          <div className="flex items-center justify-between">
            <div><div className="font-extrabold text-lg">{g}{e.capacity ? <span className="text-sm text-ink-400 font-semibold"> / {e.capacity}</span> : ''}</div><div className="text-xs text-ink-500">participants{e.rsvps.filter((r) => r.status === 'maybe').length ? ` · ${e.rsvps.filter((r) => r.status === 'maybe').length} maybe` : ''}</div></div>
            <div className="flex -space-x-2">{attendees.slice(0, 5).map((r) => <Avatar key={r.userId} user={userById(r.userId)} size={32} className="ring-2 ring-white" />)}</div>
          </div>
        </Card>

        {!past && <RsvpCard e={e} />}
        {!past && (
          <div className="grid grid-cols-3 gap-2 mt-2">
            <Button variant="secondary" size="sm" icon={reminder ? BellOff : BellRing} onClick={() => { const on = act(() => toggleReminder(user, e.id)); toast(on === true ? 'We’ll remind you a day before' : 'Reminder removed', 'info') }}>{reminder ? 'Remind off' : 'Remind me'}</Button>
            <Button variant="secondary" size="sm" icon={CalendarPlus} onClick={() => downloadIcs(e, society)}>Calendar</Button>
            <Button variant="secondary" size="sm" icon={Share2} onClick={share}>WhatsApp</Button>
          </div>
        )}
        <ExpensesCard e={e} />

        <h3 className="font-bold mt-6 mb-2">Photo gallery {e.gallery.length > 0 && <span className="text-ink-400 font-semibold text-sm">· {e.gallery.length}</span>}</h3>
        {e.gallery.length > 0 ? <MediaGrid media={e.gallery.map((g) => ({ type: 'image', url: g.url }))} /> : <p className="text-sm text-ink-400 mb-2">{past ? 'No photos yet — share your memories!' : 'Photos can be shared here after the event.'}</p>}
        {(past || new Date(e.start) < new Date()) && (
          <Card className="p-4 mt-3">
            <div className="text-sm font-semibold mb-2 flex items-center gap-2"><ImagePlus size={16} /> Add your photos</div>
            <MediaPicker value={photos} onChange={setPhotos} allowVideo={false} max={8} />
            {photos.length > 0 && <Button block className="mt-3" onClick={() => { act(() => addEventPhotos(user, e.id, photos.map((p) => p.url)), 'Photos added to the gallery'); setPhotos([]) }}>Upload {photos.length} photo(s)</Button>}
          </Card>
        )}
        <div className="h-6" />
      </div>
      <Sheet open={people} onClose={() => setPeople(false)} title="Participants">
        {e.rsvps.map((r) => { const u = userById(r.userId); return u && (
          <div key={r.userId} className="flex items-center gap-3 py-2">
            <Avatar user={u} size={36} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">{u.name}{r.status === 'going' && headsOf(r) > 1 && <span className="text-ink-400 font-normal"> · {headsOf(r)} <span>people</span></span>}</div>
              {r.status === 'going' && (r.members?.length > 0 || r.guests > 0) && <div className="text-xs text-ink-500 truncate">{[...(r.members || []).map((m) => m.name), r.guests ? `+${r.guests} guest${r.guests > 1 ? 's' : ''}` : ''].filter(Boolean).join(', ')}</div>}
            </div>
            <Badge color={r.status === 'going' ? 'green' : 'amber'}>{r.status}</Badge>
          </div>) })}
        {!e.rsvps.length && <p className="text-sm text-ink-500">No RSVPs yet.</p>}
      </Sheet>
    </Page>
  )
}

const CATS = [['Festival', '🪔', '#F97316', '#EAB308'], ['Sports', '🏏', '#22C55E', '#3B1F3A'], ['Kids', '🧸', '#EC4899', '#8B5CF6'], ['Meeting', '🗳️', '#3B1F3A', '#6366F1'], ['Social', '🎉', '#0EA5E9', '#8B5CF6'], ['National', '🇮🇳', '#F97316', '#22C55E'], ['Wellness', '🧘', '#14B8A6', '#0EA5E9']]

function NewEvent() {
  const { user } = useAuth()
  const nav = useNavigate()
  const act = useAction()
  const pad = (n) => String(n).padStart(2, '0')
  const d = new Date(Date.now() + 3 * 86400000)
  const dt = (h) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(h)}:00`
  const [f, setF] = useState({ title: '', category: 'Social', description: '', start: dt(18), end: dt(21), venue: 'Clubhouse', capacity: '' })
  const [cover, setCover] = useState([])
  const set = (k) => (ev) => setF({ ...f, [k]: ev.target.value })
  const cat = CATS.find((c) => c[0] === f.category)
  const submit = () => {
    const e = act(() => createEvent(user, { ...f, start: f.start && new Date(f.start).toISOString(), end: f.end && new Date(f.end).toISOString(), capacity: Number(f.capacity) || null, emoji: cat[1], cover: cover[0]?.url || artImage(cat[1], cat[2], cat[3], f.title.slice(0, 26)) }), 'Event created – residents notified')
    if (e) nav(`/events/${e.id}`, { replace: true })
  }
  if (!can(user, 'events.create')) return <Page title="Create event" back><Empty title="Not allowed" /></Page>
  return (
    <Page title="Create event" back>
      <Field label="Event name"><Input value={f.title} onChange={set('title')} placeholder="e.g. Holi Celebration 2027" /></Field>
      <Field label="Category">
        <div className="flex flex-wrap gap-2">{CATS.map(([c, em]) => <button type="button" key={c} onClick={() => setF({ ...f, category: c })} className={cls('h-9 px-3 rounded-full text-[13px] font-semibold border', f.category === c ? 'bg-brand-800 text-white border-brand-800' : 'bg-white border-ink-200')}>{em} {c}</button>)}</div>
      </Field>
      <Field label="Description"><Textarea value={f.description} onChange={set('description')} placeholder="What’s happening, what to bring, contribution…" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Starts"><Input type="datetime-local" value={f.start} onChange={set('start')} /></Field>
        <Field label="Ends"><Input type="datetime-local" value={f.end} onChange={set('end')} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Venue"><Select value={f.venue} onChange={set('venue')}>{['Clubhouse', 'Community Hall', 'Central Lawn', 'Sports Ground', 'Swimming Pool', 'Rooftop Area', 'Main Gate Plaza', 'Party Hall'].map((v) => <option key={v}>{v}</option>)}</Select></Field>
        <Field label="Max participants"><Input type="number" min={1} value={f.capacity} onChange={set('capacity')} placeholder="No limit" /></Field>
      </div>
      <Field label="Cover image (optional)" hint="A colourful cover is generated if you skip this"><MediaPicker value={cover} onChange={setCover} max={1} allowVideo={false} label="Cover" /></Field>
      <Button block size="lg" onClick={submit} disabled={!f.title.trim()}>Create & notify residents</Button>
    </Page>
  )
}

// ---------- RSVP: me + household members + outside guests ----------
function RsvpCard({ e }) {
  const { user } = useAuth()
  const act = useAction()
  const home = useData(() => household(user)) || []
  const my = e.rsvps.find((r) => r.userId === user.id)
  const by = includedBy(e, user.id)
  // household members already brought by someone else in the flat
  const elsewhere = new Set(e.rsvps.filter((r) => r.status === 'going' && r.userId !== user.id).flatMap((r) => [r.userId, ...(r.members || []).map((m) => m.userId || m.id)]))
  const available = home.filter((m) => !elsewhere.has(m.userId || m.id))
  const [edit, setEdit] = useState(null) // { ids:Set, guests }
  const cur = edit || { ids: new Set((my?.members || []).map((m) => m.id)), guests: my?.guests || 0 }
  const save = (status, draft = cur) => act(() => rsvpEvent(user, e.id, status, { guests: draft.guests, members: available.filter((m) => draft.ids.has(m.id)) }), status === 'going' ? 'RSVP saved – see you there!' : status === 'maybe' ? 'Marked as maybe' : 'RSVP removed')
  const goingNow = () => { const d = { ids: new Set(my?.status === 'going' ? cur.ids : available.map((m) => m.id)), guests: my?.status === 'going' ? cur.guests : 0 }; if (save('going', d)) setEdit(null) }
  const toggle = (id) => { const ids = new Set(cur.ids); ids.has(id) ? ids.delete(id) : ids.add(id); setEdit({ ...cur, ids }) }
  const total = 1 + cur.ids.size + cur.guests
  return (
    <Card className="p-4 mt-3">
      <div className="font-bold text-sm mb-3">{my?.status === 'going' ? <span>You’re going 🎉</span> : my?.status === 'maybe' ? <span>You’re a maybe</span> : <span>Will you attend?</span>}</div>
      {by && !my && <p className="text-xs text-accent-700 bg-accent-50 rounded-xl px-3 py-2 mb-3"><span>{userById(by.userId)?.name}</span> <span>has already included you.</span></p>}
      <div className="grid grid-cols-3 gap-2">
        <Button variant={my?.status === 'going' ? 'success' : 'outline'} size="sm" onClick={goingNow}>Going</Button>
        <Button variant={my?.status === 'maybe' ? 'primary' : 'outline'} size="sm" onClick={() => { save('maybe', { ids: new Set(), guests: 0 }); setEdit(null) }}>Maybe</Button>
        <Button variant="outline" size="sm" disabled={!my} onClick={() => { save(null); setEdit(null) }}>Can’t go</Button>
      </div>
      {my?.status === 'going' && (
        <div className="mt-4 border-t border-ink-100 pt-3">
          <div className="text-xs font-bold text-ink-400 uppercase tracking-wider mb-2">Who’s coming</div>
          <label className="flex items-center gap-3 py-1.5 text-sm"><span className="h-5 w-5 rounded-md bg-accent-500 text-white grid place-items-center"><Check size={14} /></span><span className="font-semibold">{user.name}</span> <span className="text-ink-400">(you)</span></label>
          {available.map((m) => (
            <label key={m.id} className="flex items-center gap-3 py-1.5 text-sm cursor-pointer" onClick={() => toggle(m.id)}>
              <span className={cls('h-5 w-5 rounded-md border-2 grid place-items-center', cur.ids.has(m.id) ? 'bg-accent-500 border-accent-500 text-white' : 'border-ink-300')}>{cur.ids.has(m.id) && <Check size={14} />}</span>
              <span className="font-medium">{m.name}</span>{m.relation && <span className="text-ink-400 text-xs">{m.relation}</span>}
            </label>
          ))}
          {!home.length && <p className="text-xs text-ink-400 py-1">Add family members in Profile → Family members to bring them along.</p>}
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm"><span>Guests from outside</span></span>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Fewer guests" disabled={cur.guests <= 0} onClick={() => setEdit({ ...cur, guests: Math.max(0, cur.guests - 1) })} className="h-9 w-9 rounded-xl bg-ink-100 grid place-items-center disabled:opacity-40"><Minus size={16} /></button>
              <span className="w-6 text-center font-bold">{cur.guests}</span>
              <button type="button" aria-label="More guests" disabled={cur.guests >= 20} onClick={() => setEdit({ ...cur, guests: cur.guests + 1 })} className="h-9 w-9 rounded-xl bg-ink-100 grid place-items-center disabled:opacity-40"><Plus size={16} /></button>
            </div>
          </div>
          <div className="flex items-center justify-between mt-3">
            <span className="text-sm text-ink-500">{total} <span>{total === 1 ? 'person' : 'people'}</span></span>
            {edit && <Button size="sm" onClick={() => { if (save('going')) setEdit(null) }}>Save</Button>}
          </div>
        </div>
      )}
    </Card>
  )
}

// ---------- Shared expenses ----------
function ExpensesCard({ e }) {
  const { user } = useAuth()
  const act = useAction()
  const ask = useConfirm()
  const [adding, setAdding] = useState(false)
  const [f, setF] = useState({ amount: '', title: '', receipt: [] })
  const my = e.rsvps.find((r) => r.userId === user.id)
  const isAdmin = e.organizerId === user.id || can(user, 'announcement.publish')
  const expenses = e.expenses || []
  const settlements = e.settlements || []
  if (!expenses.length && my?.status !== 'going' && !isAdmin) return null
  const sp = splitEvent(e)
  const name = (id) => (id === user.id ? 'You' : userById(id)?.name || 'Former member')
  const me = sp.people.find((p) => p.userId === user.id)
  const add = () => { const x = act(() => addEventExpense(user, e.id, { amount: f.amount, title: f.title, receipt: f.receipt[0]?.url }), 'Expense added – everyone’s share is updated'); if (x) { setAdding(false); setF({ amount: '', title: '', receipt: [] }) } }
  return (
    <>
      <h3 className="font-bold mt-6 mb-2 flex items-center gap-2"><Wallet size={18} /> <span>Shared expenses</span></h3>
      <Card className="p-4">
        {expenses.length ? (
          <>
            <div className="grid grid-cols-3 text-center">
              <div><div className="font-extrabold">{inr(sp.total)}</div><div className="text-[11px] text-ink-500">Total spent</div></div>
              <div><div className="font-extrabold">{sp.perFamily ? sp.families : sp.heads}</div><div className="text-[11px] text-ink-500">{sp.perFamily ? 'Families' : 'People'}</div></div>
              <div><div className="font-extrabold">{inr(Math.round(sp.perUnit))}</div><div className="text-[11px] text-ink-500">{sp.perFamily ? 'Per family' : 'Per person'}</div></div>
            </div>
            {me && (Math.abs(me.balance) >= 0.5) && (
              <div className={cls('mt-3 rounded-xl px-3 py-2 text-sm font-semibold', me.balance < 0 ? 'bg-red-50 text-red-700' : 'bg-accent-50 text-accent-700')}>
                {me.balance < 0 ? <span>You owe {inr(Math.round(-me.balance))}</span> : <span>You get back {inr(Math.round(me.balance))}</span>}
                <span className="font-normal text-xs"> · <span>your share</span> {inr(Math.round(me.share))} <span>for</span> {sp.perFamily ? 1 : me.heads}{!sp.perFamily && <> <span>{me.heads === 1 ? 'person' : 'people'}</span></>}, <span>paid</span> {inr(me.paid)}</span>
              </div>
            )}
          </>
        ) : <p className="text-sm text-ink-500">Nothing added yet. If you paid for something (food, decoration, sound…), add it here – the total is split evenly among everyone going.</p>}
        {isAdmin && (
          <div className="mt-3"><Tabs value={e.split === 'family' ? 'family' : 'person'} onChange={(v) => act(() => setEventSplit(user, e.id, v))} tabs={[{ value: 'person', label: 'Split per person' }, { value: 'family', label: 'Split per family' }]} /></div>
        )}
        {(my?.status === 'going' || isAdmin) && <Button block variant="secondary" size="sm" icon={Plus} className="mt-3" onClick={() => setAdding(true)}>Add an expense</Button>}
      </Card>

      {expenses.length > 0 && (
        <Card className="mt-3 divide-y divide-ink-100 overflow-hidden">
          {expenses.slice().reverse().map((x) => (
            <div key={x.id} className="flex items-center gap-3 px-4 py-3">
              {x.receipt ? <a href={x.receipt} target="_blank" rel="noreferrer"><img src={x.receipt} alt="" className="h-10 w-10 rounded-lg object-cover" /></a> : <span className="h-10 w-10 rounded-lg bg-ink-100 text-ink-500 grid place-items-center"><Receipt size={18} /></span>}
              <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate" translate="no">{x.title}</div><div className="text-[11px] text-ink-500"><span>{name(x.userId)}</span> · {timeAgo(x.at)}</div></div>
              <div className="font-bold text-sm">{inr(x.amount)}</div>
              {(x.userId === user.id || isAdmin) && <button aria-label="Remove" onClick={async () => { if (await ask({ title: 'Remove this expense?', ok: 'Remove', danger: true })) act(() => removeEventExpense(user, e.id, x.id), 'Removed') }} className="h-8 w-8 grid place-items-center text-ink-400"><Trash2 size={15} /></button>}
            </div>
          ))}
        </Card>
      )}

      {(sp.transfers.length > 0 || settlements.length > 0) && (
        <>
          <div className="text-xs font-bold text-ink-400 uppercase tracking-wider mt-4 mb-2">Settle up</div>
          <Card className="divide-y divide-ink-100 overflow-hidden">
            {sp.transfers.map((t, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-3 text-sm">
                <span className="font-semibold">{name(t.from)}</span><ArrowRight size={14} className="text-ink-400" /><span className="font-semibold flex-1 truncate">{name(t.to)}</span>
                <span className="font-bold">{inr(Math.round(t.amount))}</span>
                {t.from === user.id && <Button size="sm" variant="success" onClick={() => act(() => recordSettlement(user, e.id, t), 'Payment recorded')}>I paid</Button>}
                {t.to === user.id && <Button size="sm" variant="secondary" onClick={() => act(() => recordSettlement(user, e.id, t), 'Marked as received')}>Received</Button>}
              </div>
            ))}
            {!sp.transfers.length && <div className="px-4 py-3 text-sm text-accent-700 font-semibold">All settled 🎉</div>}
          </Card>
          {settlements.length > 0 && (
            <div className="mt-2 space-y-1">
              {settlements.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-xs text-ink-500 px-1">
                  <Check size={13} className="text-accent-600" /><span className="flex-1"><span>{name(s.from)}</span> → <span>{name(s.to)}</span> · {inr(s.amount)} · {timeAgo(s.at)}</span>
                  {(s.userId === user.id || isAdmin) && <button className="underline" onClick={() => act(() => removeSettlement(user, e.id, s.id), 'Removed')}>Undo</button>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title="Add an expense" footer={<Button block onClick={add} disabled={!f.amount || !f.title.trim()}>Add {f.amount ? inr(Number(f.amount) || 0) : ''}</Button>}>
        <Field label="What was it for?"><Input value={f.title} onChange={(ev) => setF({ ...f, title: ev.target.value })} placeholder="e.g. Sweets, decoration, DJ" maxLength={80} /></Field>
        <Field label="Amount you paid (₹)"><Input type="number" inputMode="decimal" min={1} value={f.amount} onChange={(ev) => setF({ ...f, amount: ev.target.value })} /></Field>
        <Field label="Bill / receipt photo (optional)"><MediaPicker value={f.receipt} onChange={(v) => setF({ ...f, receipt: v.slice(-1) })} allowVideo={false} max={1} /></Field>
        <p className="text-xs text-ink-500">{e.split === 'family' ? <span>It is split equally between the families going. Everyone going is notified.</span> : <span>It is split evenly per person among everyone going (including family members and guests). Everyone going is notified.</span>}</p>
      </Sheet>
    </>
  )
}

