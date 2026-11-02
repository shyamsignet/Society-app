import { useState } from 'react'
import { Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { Plus, Minus, MapPin, Clock, Users, BellRing, BellOff, CalendarPlus, ImagePlus, ChevronLeft, ChevronRight, CalendarDays, Share2, ArrowLeft, Check, Receipt, Trash2, Wallet, ArrowRight, Pencil, HandCoins, Printer, FileText, Settings, Megaphone } from 'lucide-react'
import { Page, Button, Card, Tabs, Empty, Field, Input, Textarea, Select, Avatar, MediaPicker, MediaGrid, Sheet, Badge, Toggle, useAction, useToast, useConfirm } from '../components/ui'
import { getLocale } from '../i18n'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/db'
import { can } from '../lib/rbac'
import { createEvent, updateEvent, canEditEvent, rsvpEvent, toggleReminder, addEventPhotos, userById, household, addEventExpense, removeEventExpense, recordSettlement, removeSettlement, setEventSplit, isEventAdmin, recordContribution, setEventAccounts, publishEventAccounts } from '../lib/actions'
import { fmtDateTime, fmtDate, fmtTime, cls, sameDay, artImage, inr, timeAgo, appLink, shareText } from '../lib/utils'
import { goingCount, headsOf, includedBy, splitEvent } from '../lib/eventSplit'

export default function Events() {
  return (
    <Routes>
      <Route index element={<List />} />
      <Route path="new" element={<EventForm />} />
      <Route path=":id/edit" element={<EventForm />} />
      <Route path=":id/accounts" element={<EventAccounts />} />
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

// Opens the phone's share menu (WhatsApp, SMS, …) – same as sharing a feed post.
const useShareEvent = () => {
  const toast = useToast()
  return async (e, society) => {
    const r = await shareText({ title: e.title, text: eventShareText(e, society) })
    if (r === 'copied') toast('Copied – paste it in WhatsApp')
  }
}

function EventCard({ e }) {
  const nav = useNavigate()
  const { user, society } = useAuth()
  const shareEvent = useShareEvent()
  const my = e.rsvps.find((r) => r.userId === user.id)
  const d = new Date(e.start)
  return (
    <Card className="overflow-hidden" onClick={() => nav(`/events/${e.id}`)}>
      <div className="relative h-32"><img src={e.cover} alt="" className="h-full w-full object-cover" />
        <div className="absolute top-3 left-3 bg-white rounded-xl px-2.5 py-1 text-center shadow"><div className="text-[10px] font-bold text-red-500 uppercase">{d.toLocaleDateString(getLocale(), { month: 'short' })}</div><div className="text-lg font-extrabold leading-none">{d.getDate()}</div></div>
        {my && <Badge color={my.status === 'going' ? 'green' : 'amber'} className="absolute top-3 right-14 !bg-white">{my.status === 'going' ? '✓ Going' : 'Maybe'}</Badge>}
        <button type="button" aria-label="Share" title="Share" onClick={(ev) => { ev.stopPropagation(); shareEvent(e, society) }} className="absolute top-2.5 right-2.5 h-9 w-9 rounded-full bg-white text-ink-700 shadow grid place-items-center"><Share2 size={17} /></button>
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
  const shareEvent = useShareEvent()
  const share = () => shareEvent(e, society)
  const editable = canEditEvent(user, e)
  return (
    <Page noPad hero={<div className="relative"><img src={e.cover} alt="" className="w-full h-60 object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" /><button aria-label="Back" onClick={() => nav('/events')} className="absolute left-3 top-3 h-10 w-10 rounded-full bg-black/40 backdrop-blur text-white grid place-items-center safe-top"><ArrowLeft size={20} /></button>{editable && <button aria-label="Edit event" onClick={() => nav(`/events/${e.id}/edit`)} className="absolute right-16 top-3 h-10 w-10 rounded-full bg-black/40 backdrop-blur text-white grid place-items-center safe-top"><Pencil size={18} /></button>}<button aria-label="Share" onClick={share} className="absolute right-3 top-3 h-10 w-10 rounded-full bg-black/40 backdrop-blur text-white grid place-items-center safe-top"><Share2 size={19} /></button></div>}>
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
          {editable && <Button variant="secondary" size="sm" icon={Pencil} className="mt-4" onClick={() => nav(`/events/${e.id}/edit`)}>Edit event</Button>}
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
            <Button variant="secondary" size="sm" icon={Share2} onClick={share}>Share</Button>
          </div>
        )}
        <AccountsCard e={e} />

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

const pad = (n) => String(n).padStart(2, '0')
// ISO time -> value for <input type="datetime-local"> in the phone's own time zone
const localInput = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}` }
const isArt = (url) => !url || url.startsWith('data:image/svg+xml')

// Create a new event, or edit one (route :id/edit).
function EventForm() {
  const { id } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const act = useAction()
  const existing = useData((d) => (id ? d.get('events', id) : null))
  const d = new Date(Date.now() + 3 * 86400000)
  const dt = (h) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(h)}:00`
  const [f, setF] = useState(() => existing
    ? { title: existing.title, category: existing.category || 'Social', description: existing.description || '', start: localInput(existing.start), end: localInput(existing.end), venue: existing.venue, capacity: existing.capacity ?? '' }
    : { title: '', category: 'Social', description: '', start: dt(18), end: dt(21), venue: 'Clubhouse', capacity: '' })
  const [cover, setCover] = useState(() => (existing && !isArt(existing.cover) ? [{ type: 'image', url: existing.cover }] : []))
  const set = (k) => (ev) => setF({ ...f, [k]: ev.target.value })
  const cat = CATS.find((c) => c[0] === f.category) || CATS[4]
  const submit = () => {
    const data = { ...f, start: f.start && new Date(f.start).toISOString(), end: f.end ? new Date(f.end).toISOString() : null, capacity: Number(f.capacity) || null, emoji: cat[1], cover: cover[0]?.url || artImage(cat[1], cat[2], cat[3], f.title.slice(0, 26)) }
    const e = existing
      ? act(() => updateEvent(user, existing.id, data), 'Event updated')
      : act(() => createEvent(user, data), 'Event created – residents notified')
    if (e) nav(`/events/${e.id}`, { replace: true })
  }
  if (id && !existing) return <Page title="Edit event" back><Empty title="Event not found" /></Page>
  if (existing ? !canEditEvent(user, existing) : !can(user, 'events.create')) return <Page title={existing ? 'Edit event' : 'Create event'} back><Empty title="Not allowed" text={existing ? 'Only the organiser or the committee can edit this event.' : undefined} /></Page>
  const venues = ['Clubhouse', 'Community Hall', 'Central Lawn', 'Sports Ground', 'Swimming Pool', 'Rooftop Area', 'Main Gate Plaza', 'Party Hall']
  return (
    <Page title={existing ? 'Edit event' : 'Create event'} back>
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
        <Field label="Venue"><Select value={f.venue} onChange={set('venue')}>{(venues.includes(f.venue) ? venues : [f.venue, ...venues]).map((v) => <option key={v}>{v}</option>)}</Select></Field>
        <Field label="Max participants"><Input type="number" min={1} value={f.capacity} onChange={set('capacity')} placeholder="No limit" /></Field>
      </div>
      <Field label="Cover image (optional)" hint="A colourful cover is generated if you skip this"><MediaPicker value={cover} onChange={setCover} max={1} allowVideo={false} label="Cover" /></Field>
      <Button block size="lg" onClick={submit} disabled={!f.title.trim()}>{existing ? 'Save changes' : 'Create & notify residents'}</Button>
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

// ---------- Event accounts: contributions, expenses, who pays whom ----------
const nameOf = (user) => (id) => (id === user.id ? 'You' : userById(id)?.name || 'Former member')

// WhatsApp-formatted summary of the accounts with a link to the full statement.
export function accountsShareText(e, sp, society, nm) {
  const L = [`💰 *${e.title} – accounts*`, `🏡 ${society?.name || ''}`.trim(), '']
  if (sp.hasContributions) L.push(`Collected: ${inr(sp.collected)}`)
  L.push(`Spent: ${inr(sp.spent)}`)
  if (sp.hasContributions) L.push(sp.remaining >= 0 ? `Remaining: ${inr(sp.remaining)}${sp.kept ? ' (kept for the next event)' : ''}` : `Overspent by: ${inr(-sp.remaining)}`)
  if (sp.hasContributions && sp.holders.length) L.push(`Collected money is with: ${sp.holders.map((h) => `${nm(h.userId)} (${inr(h.amount)})`).join(', ')}`)
  L.push(`${sp.perFamily ? 'Per family' : 'Per person'}: ${inr(Math.round(sp.perUnit))} · ${sp.perFamily ? `${sp.families} families` : `${sp.heads} people`}`)
  if (sp.transfers.length) { L.push('', '*Who pays whom*'); sp.transfers.forEach((t) => L.push(`• ${nm(t.from)} → ${nm(t.to)}: ${inr(Math.round(t.amount))}`)) } else L.push('', 'All settled ✅')
  L.push('', `📄 Full details: ${appLink(`/events/${e.id}/accounts`)}`)
  return L.join('\n')
}

function AccountsCard({ e }) {
  const { user, society } = useAuth()
  const nav = useNavigate()
  const act = useAction()
  const ask = useConfirm()
  const toast = useToast()
  const [sheet, setSheet] = useState(null) // 'expense' | 'contribution' | 'settings'
  const [tab, setTab] = useState('expenses')
  const my = e.rsvps.find((r) => r.userId === user.id)
  const admin = isEventAdmin(user, e)
  const expenses = e.expenses || []
  const settlements = e.settlements || []
  const contributions = settlements.filter((s) => s.kind === 'contribution')
  const payments = settlements.filter((s) => s.kind !== 'contribution')
  if (!expenses.length && !settlements.length && my?.status !== 'going' && !admin && !e.contribution) return null
  const sp = splitEvent(e)
  const nm = nameOf(user)
  const me = sp.people.find((p) => p.userId === user.id)
  const going = e.rsvps.filter((r) => r.status === 'going')
  const paidFamilies = going.filter((r) => { const p = sp.people.find((x) => x.userId === r.userId); return p && p.expected > 0 && p.contributed >= p.expected }).length
  const share = async () => { const r = await shareText({ title: `${e.title} – accounts`, text: accountsShareText(e, sp, society, (id) => userById(id)?.name || 'Former member') }); if (r === 'copied') toast('Copied – paste it in WhatsApp') }
  const canAdd = my?.status === 'going' || admin
  const Stat = ({ label, value, tone }) => <div><div className={cls('font-extrabold', tone)}>{value}</div><div className="text-[11px] text-ink-500">{label}</div></div>
  return (
    <>
      <div className="flex items-center justify-between mt-6 mb-2">
        <h3 className="font-bold flex items-center gap-2"><Wallet size={18} /> <span>Event accounts</span></h3>
        <button onClick={() => nav(`/events/${e.id}/accounts`)} className="text-sm font-semibold text-brand-600 flex items-center gap-1"><FileText size={15} /> <span>Statement</span></button>
      </div>
      <Card className="p-4">
        {e.accountsPublishedAt && <div className="mb-3"><Badge color="green">Published {timeAgo(e.accountsPublishedAt)}</Badge></div>}
        {sp.hasContributions ? (
          <div className="grid grid-cols-3 text-center">
            <Stat label="Collected" value={inr(sp.collected)} />
            <Stat label="Spent" value={inr(sp.spent)} />
            <Stat label={sp.remaining >= 0 ? 'Remaining' : 'Overspent'} value={inr(Math.abs(sp.remaining))} tone={sp.remaining < 0 ? 'text-red-600' : 'text-accent-700'} />
          </div>
        ) : expenses.length ? (
          <div className="grid grid-cols-3 text-center">
            <Stat label="Total spent" value={inr(sp.spent)} />
            <Stat label={sp.perFamily ? 'Families' : 'People'} value={sp.perFamily ? sp.families : sp.heads} />
            <Stat label={sp.perFamily ? 'Per family' : 'Per person'} value={inr(Math.round(sp.perUnit))} />
          </div>
        ) : <p className="text-sm text-ink-500">Nothing recorded yet. Collect a contribution first, or add expenses as people spend – both are split fairly among everyone going.</p>}
        {sp.hasContributions && sp.remaining > 0 && <p className="text-xs text-ink-500 mt-3 text-center">{sp.kept ? <span>{inr(sp.kept)} kept for the next event</span> : <><span>Collected money is with</span> {sp.holders.map((h) => `${nm(h.userId)} (${inr(h.amount)})`).join(', ')}</>}</p>}
        {sp.hasContributions && expenses.length > 0 && <p className="text-xs text-ink-500 mt-1 text-center">{sp.perFamily ? 'Per family' : 'Per person'}: {inr(Math.round(sp.perUnit))}</p>}
        {e.contribution && (
          <div className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-sm flex items-center justify-between gap-2">
            <span><b>{inr(e.contribution.amount)}</b> <span>{e.contribution.per === 'person' ? 'per person' : 'per family'}</span> · {paidFamilies}/{going.length} <span>paid</span></span>
            {me && me.expected > me.contributed && <Button size="sm" variant="primary" onClick={() => setSheet('contribution')}>Pay {inr(me.expected - me.contributed)}</Button>}
          </div>
        )}
        {me && Math.abs(me.balance) >= 0.5 && (expenses.length > 0 || sp.kept > 0) && (
          <div className={cls('mt-3 rounded-xl px-3 py-2 text-sm font-semibold', me.balance < 0 ? 'bg-red-50 text-red-700' : 'bg-accent-50 text-accent-700')}>
            {me.balance < 0 ? <span>You owe {inr(Math.round(-me.balance))}</span> : <span>You get back {inr(Math.round(me.balance))}</span>}
            <span className="font-normal text-xs"> · <span>your share</span> {inr(Math.round(me.share))}, <span>paid in</span> {inr(me.spentFor + me.contributed)}</span>
          </div>
        )}
        {canAdd && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            <Button variant="secondary" size="sm" icon={Receipt} onClick={() => setSheet('expense')}>Add expense</Button>
            <Button variant="secondary" size="sm" icon={HandCoins} onClick={() => setSheet('contribution')}>Contribution</Button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Button variant="outline" size="sm" icon={Share2} onClick={share}>Share summary</Button>
          {admin ? <Button variant="outline" size="sm" icon={Settings} onClick={() => setSheet('settings')}>Settings</Button> : <Button variant="outline" size="sm" icon={FileText} onClick={() => nav(`/events/${e.id}/accounts`)}>Statement</Button>}
        </div>
        {admin && (expenses.length > 0 || settlements.length > 0) && <Button block size="sm" variant={e.accountsPublishedAt ? 'secondary' : 'primary'} icon={Megaphone} className="mt-2" onClick={async () => { if (await ask({ title: 'Publish the accounts?', text: 'Everyone going is notified and can open the statement.', ok: 'Publish' })) act(() => publishEventAccounts(user, e.id), 'Accounts published – attendees notified') }}>{e.accountsPublishedAt ? 'Publish again' : 'Publish accounts'}</Button>}
      </Card>

      {(expenses.length > 0 || settlements.length > 0) && (
        <>
          <Tabs className="mt-3" value={tab} onChange={setTab} tabs={[{ value: 'expenses', label: `Expenses (${expenses.length})` }, { value: 'contrib', label: `Collected (${contributions.length})` }, { value: 'settle', label: 'Settle up' }]} />
          {tab === 'expenses' && (
            <Card className="mt-2 divide-y divide-ink-100 overflow-hidden">
              {expenses.slice().reverse().map((x) => (
                <div key={x.id} className="flex items-center gap-3 px-4 py-3">
                  {x.receipt ? <a href={x.receipt} target="_blank" rel="noreferrer"><img src={x.receipt} alt="" className="h-10 w-10 rounded-lg object-cover" /></a> : <span className="h-10 w-10 rounded-lg bg-ink-100 text-ink-500 grid place-items-center"><Receipt size={18} /></span>}
                  <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate" translate="no">{x.title}</div><div className="text-[11px] text-ink-500"><span>{nm(x.userId)}</span> · {timeAgo(x.at)}</div></div>
                  <div className="font-bold text-sm">{inr(x.amount)}</div>
                  {(x.userId === user.id || admin) && <button aria-label="Remove" onClick={async () => { if (await ask({ title: 'Remove this expense?', ok: 'Remove', danger: true })) act(() => removeEventExpense(user, e.id, x.id), 'Removed') }} className="h-8 w-8 grid place-items-center text-ink-400"><Trash2 size={15} /></button>}
                </div>
              ))}
              {!expenses.length && <p className="px-4 py-3 text-sm text-ink-500">No expenses yet.</p>}
            </Card>
          )}
          {tab === 'contrib' && (
            <Card className="mt-2 divide-y divide-ink-100 overflow-hidden">
              {contributions.slice().reverse().map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="h-10 w-10 rounded-lg bg-accent-50 text-accent-700 grid place-items-center"><HandCoins size={18} /></span>
                  <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate"><span>{nm(c.from)}</span> → <span>{nm(c.to)}</span></div><div className="text-[11px] text-ink-500 truncate">{c.note ? <span translate="no">{c.note} · </span> : ''}{timeAgo(c.at)}</div></div>
                  <div className="font-bold text-sm">{inr(c.amount)}</div>
                  {(c.userId === user.id || admin) && <button aria-label="Remove" onClick={async () => { if (await ask({ title: 'Remove this entry?', ok: 'Remove', danger: true })) act(() => removeSettlement(user, e.id, c.id), 'Removed') }} className="h-8 w-8 grid place-items-center text-ink-400"><Trash2 size={15} /></button>}
                </div>
              ))}
              {!contributions.length && <p className="px-4 py-3 text-sm text-ink-500">No money collected yet.</p>}
            </Card>
          )}
          {tab === 'settle' && (
            <>
              <Card className="mt-2 divide-y divide-ink-100 overflow-hidden">
                {sp.transfers.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 px-4 py-3 text-sm">
                    <span className="font-semibold">{nm(t.from)}</span><ArrowRight size={14} className="text-ink-400" /><span className="font-semibold flex-1 truncate">{nm(t.to)}</span>
                    <span className="font-bold">{inr(Math.round(t.amount))}</span>
                    {t.from === user.id && <Button size="sm" variant="success" onClick={() => act(() => recordSettlement(user, e.id, t), 'Payment recorded')}>I paid</Button>}
                    {t.to === user.id && <Button size="sm" variant="secondary" onClick={() => act(() => recordSettlement(user, e.id, t), 'Marked as received')}>Received</Button>}
                  </div>
                ))}
                {!sp.transfers.length && <div className="px-4 py-3 text-sm text-accent-700 font-semibold">All settled 🎉</div>}
              </Card>
              {payments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {payments.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 text-xs text-ink-500 px-1">
                      <Check size={13} className="text-accent-600" /><span className="flex-1"><span>{nm(s.from)}</span> → <span>{nm(s.to)}</span> · {inr(s.amount)} · {timeAgo(s.at)}</span>
                      {(s.userId === user.id || admin) && <button className="underline" onClick={() => act(() => removeSettlement(user, e.id, s.id), 'Removed')}>Undo</button>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      <ExpenseSheet open={sheet === 'expense'} onClose={() => setSheet(null)} e={e} />
      <ContributionSheet open={sheet === 'contribution'} onClose={() => setSheet(null)} e={e} sp={sp} />
      <AccountsSettings open={sheet === 'settings'} onClose={() => setSheet(null)} e={e} />
    </>
  )
}

function ExpenseSheet({ open, onClose, e }) {
  const { user } = useAuth()
  const act = useAction()
  const [f, setF] = useState({ amount: '', title: '', receipt: [] })
  const add = () => { const x = act(() => addEventExpense(user, e.id, { amount: f.amount, title: f.title, receipt: f.receipt[0]?.url }), 'Expense added – everyone’s share is updated'); if (x) { onClose(); setF({ amount: '', title: '', receipt: [] }) } }
  return (
    <Sheet open={open} onClose={onClose} title="Add an expense" footer={<Button block onClick={add} disabled={!f.amount || !f.title.trim()}>Add {f.amount ? inr(Number(f.amount) || 0) : ''}</Button>}>
      <Field label="What was it for?"><Input value={f.title} onChange={(ev) => setF({ ...f, title: ev.target.value })} placeholder="e.g. Sweets, decoration, DJ" maxLength={80} /></Field>
      <Field label="Amount you paid (₹)"><Input type="number" inputMode="decimal" min={1} value={f.amount} onChange={(ev) => setF({ ...f, amount: ev.target.value })} /></Field>
      <Field label="Bill / receipt photo (optional)"><MediaPicker value={f.receipt} onChange={(v) => setF({ ...f, receipt: v.slice(-1) })} allowVideo={false} max={1} /></Field>
      <p className="text-xs text-ink-500">{e.split === 'family' ? <span>It is split equally between the families going. Everyone going is notified.</span> : <span>It is split evenly per person among everyone going (including family members and guests). Everyone going is notified.</span>}</p>
    </Sheet>
  )
}

function ContributionSheet({ open, onClose, e, sp }) {
  const { user } = useAuth()
  const act = useAction()
  const admin = isEventAdmin(user, e)
  const nm = nameOf(user)
  const going = e.rsvps.filter((r) => r.status === 'going')
  const collectors = [...new Set([e.organizerId, ...(e.settlements || []).filter((s) => s.kind === 'contribution').map((s) => s.to), ...(admin ? [user.id] : [])])]
  const due = (id) => { const p = sp.people.find((x) => x.userId === id); return p ? Math.max(0, p.expected - p.contributed) : 0 }
  const blank = () => { const from = admin && user.id === e.organizerId ? (going.find((r) => r.userId !== user.id && due(r.userId) > 0)?.userId || going[0]?.userId || user.id) : user.id; return { from, to: e.organizerId, amount: due(from) || e.contribution?.amount || '', note: '' } }
  const [f, setF] = useState(blank)
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) { setWasOpen(open); if (open) setF(blank()) }
  const save = () => { const c = act(() => recordContribution(user, e.id, { ...f, from: f.from, to: f.to }), 'Contribution recorded'); if (c) onClose() }
  const fromOptions = admin ? [...new Set([...going.map((r) => r.userId), user.id])] : [user.id]
  return (
    <Sheet open={open} onClose={onClose} title="Record a contribution" footer={<Button block onClick={save} disabled={!(Number(f.amount) > 0) || f.from === undefined}>Save {Number(f.amount) > 0 ? inr(Number(f.amount)) : ''}</Button>}>
      <p className="text-sm text-ink-500 mb-3">Money collected for this event, for example a fixed amount per family before the event.</p>
      <Field label="Given by">
        <Select value={f.from} disabled={!admin} onChange={(ev) => setF({ ...f, from: ev.target.value, amount: due(ev.target.value) || f.amount })}>{fromOptions.map((id) => <option key={id} value={id}>{nm(id)}{due(id) ? ` · ${inr(due(id))} due` : ''}</option>)}</Select>
      </Field>
      <Field label="Received by">
        <Select value={f.to} onChange={(ev) => setF({ ...f, to: ev.target.value })}>{collectors.map((id) => <option key={id} value={id}>{nm(id)}{id === e.organizerId ? ' (organiser)' : ''}</option>)}</Select>
      </Field>
      <Field label="Amount (₹)"><Input type="number" inputMode="decimal" min={1} value={f.amount} onChange={(ev) => setF({ ...f, amount: ev.target.value })} /></Field>
      <Field label="Note (optional)"><Input value={f.note} onChange={(ev) => setF({ ...f, note: ev.target.value })} placeholder="e.g. cash, UPI" maxLength={80} /></Field>
    </Sheet>
  )
}

function AccountsSettings({ open, onClose, e }) {
  const { user } = useAuth()
  const act = useAction()
  const init = () => ({ amount: e.contribution?.amount || '', per: e.contribution?.per || 'family', split: e.split === 'family' ? 'family' : 'person', keepSurplus: !!e.keepSurplus })
  const [f, setF] = useState(init)
  const [wasOpen, setWasOpen] = useState(false)
  if (open !== wasOpen) { setWasOpen(open); if (open) setF(init()) }
  const save = () => { if (act(() => setEventAccounts(user, e.id, { contribution: { amount: f.amount, per: f.per }, split: f.split, keepSurplus: f.keepSurplus }), 'Saved')) onClose() }
  return (
    <Sheet open={open} onClose={onClose} title="Accounts settings" footer={<Button block onClick={save}>Save</Button>}>
      <div className="text-sm font-bold mb-2">Contribution to collect (optional)</div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Amount (₹)"><Input type="number" inputMode="numeric" min={0} value={f.amount} onChange={(ev) => setF({ ...f, amount: ev.target.value })} placeholder="e.g. 500" /></Field>
        <Field label="Per"><Select value={f.per} onChange={(ev) => setF({ ...f, per: ev.target.value })}><option value="family">Family</option><option value="person">Person</option></Select></Field>
      </div>
      <div className="text-sm font-bold mt-2 mb-2">How the cost is shared</div>
      <Tabs value={f.split} onChange={(v) => setF({ ...f, split: v })} tabs={[{ value: 'person', label: 'Per person' }, { value: 'family', label: 'Per family' }]} />
      <div className="mt-3 border-t border-ink-100"><Toggle checked={f.keepSurplus} onChange={(v) => setF({ ...f, keepSurplus: v })} label="Keep leftover money for the next event" desc="Otherwise the app suggests refunds to the families who paid more than their share" /></div>
    </Sheet>
  )
}

// ---------- Printable statement (Share → Save as PDF) ----------
function EventAccounts() {
  const { id } = useParams()
  const { user, society } = useAuth()
  const toast = useToast()
  const e = useData((d) => d.get('events', id))
  if (!e) return <Page title="Event accounts" back><Empty title="Event not found" /></Page>
  const sp = splitEvent(e)
  const nm = (uid) => userById(uid)?.name || 'Former member'
  const expenses = e.expenses || []
  const contributions = (e.settlements || []).filter((s) => s.kind === 'contribution')
  const payments = (e.settlements || []).filter((s) => s.kind !== 'contribution')
  const share = async () => { const r = await shareText({ title: `${e.title} – accounts`, text: accountsShareText(e, sp, society, nm) }); if (r === 'copied') toast('Copied – paste it in WhatsApp') }
  const th = 'text-left text-[11px] font-bold uppercase tracking-wide text-ink-500 py-2'
  return (
    <Page title="Event accounts" subtitle={e.title} back={`/events/${e.id}`}>
      <div className="no-print grid grid-cols-2 gap-2 mb-3">
        <Button variant="secondary" size="sm" icon={Share2} onClick={share}>Share on WhatsApp</Button>
        <Button variant="secondary" size="sm" icon={Printer} onClick={() => window.print()}>Print / Save PDF</Button>
      </div>
      <Card className="p-5">
        <div className="text-xs text-ink-500">{society.name}</div>
        <h2 className="text-xl font-extrabold leading-tight" translate="no">{e.emoji} {e.title}</h2>
        <div className="text-xs text-ink-500 mt-1">{fmtDateTime(e.start)} · {e.venue} · <span>Organised by</span> {nm(e.organizerId)}</div>
        {e.accountsPublishedAt && <div className="text-xs text-accent-700 mt-1"><span>Published</span> {fmtDateTime(e.accountsPublishedAt)}</div>}
        <div className="grid grid-cols-3 gap-2 mt-4 text-center">
          <div className="rounded-xl bg-ink-100/70 py-2"><div className="font-extrabold">{inr(sp.collected)}</div><div className="text-[11px] text-ink-500">Collected</div></div>
          <div className="rounded-xl bg-ink-100/70 py-2"><div className="font-extrabold">{inr(sp.spent)}</div><div className="text-[11px] text-ink-500">Spent</div></div>
          <div className="rounded-xl bg-ink-100/70 py-2"><div className={cls('font-extrabold', sp.remaining < 0 && 'text-red-600')}>{inr(Math.abs(sp.remaining))}</div><div className="text-[11px] text-ink-500">{sp.remaining >= 0 ? 'Remaining' : 'Overspent'}</div></div>
        </div>
        <p className="text-xs text-ink-500 mt-2 text-center">{sp.perFamily ? 'Per family' : 'Per person'}: <b>{inr(Math.round(sp.perUnit))}</b> · {sp.perFamily ? sp.families : sp.heads} {sp.perFamily ? 'families' : 'people'}{sp.kept ? <> · <span>{inr(sp.kept)} kept for the next event</span></> : sp.remaining > 0 && sp.holders.length ? <> · <span>Collected money is with</span> {sp.holders.map((h) => `${nm(h.userId)} (${inr(h.amount)})`).join(', ')}</> : null}</p>
      </Card>

      <h3 className="font-bold mt-5 mb-2">Families</h3>
      <Card className="px-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr><th className={th}>Name</th><th className={cls(th, 'text-right')}>People</th><th className={cls(th, 'text-right')}>Share</th><th className={cls(th, 'text-right')}>Paid in</th><th className={cls(th, 'text-right')}>Balance</th></tr></thead>
          <tbody className="divide-y divide-ink-100">
            {sp.people.map((p) => (
              <tr key={p.userId}>
                <td className="py-2 pr-2 font-semibold">{nm(p.userId)}</td>
                <td className="py-2 text-right">{p.heads || '–'}</td>
                <td className="py-2 text-right">{inr(Math.round(p.share))}</td>
                <td className="py-2 text-right">{inr(p.spentFor + p.contributed)}</td>
                <td className={cls('py-2 text-right font-bold', p.balance < -0.5 ? 'text-red-600' : p.balance > 0.5 ? 'text-accent-700' : 'text-ink-500')}>{Math.abs(p.balance) < 0.5 ? 'Settled' : `${p.balance < 0 ? '−' : '+'}${inr(Math.round(Math.abs(p.balance)))}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[11px] text-ink-500 pb-3">+ = gets money back · − = still has to pay. Paid in = expenses paid + contributions given; payments already settled are included in the balance.</p>
      </Card>

      <h3 className="font-bold mt-5 mb-2">Who pays whom</h3>
      <Card className="divide-y divide-ink-100 overflow-hidden">
        {sp.transfers.map((t, i) => <div key={i} className="flex items-center gap-2 px-4 py-2.5 text-sm"><span className="font-semibold">{nm(t.from)}</span><ArrowRight size={14} className="text-ink-400" /><span className="font-semibold flex-1">{nm(t.to)}</span><span className="font-bold">{inr(Math.round(t.amount))}</span></div>)}
        {!sp.transfers.length && <div className="px-4 py-2.5 text-sm text-accent-700 font-semibold">All settled 🎉</div>}
      </Card>

      {contributions.length > 0 && (<>
        <h3 className="font-bold mt-5 mb-2">Money collected · {inr(sp.collected)}</h3>
        <Card className="divide-y divide-ink-100 overflow-hidden">
          {contributions.map((c) => <div key={c.id} className="flex items-center gap-2 px-4 py-2.5 text-sm"><span className="flex-1"><b>{nm(c.from)}</b> → {nm(c.to)}{c.note ? <span className="text-ink-500" translate="no"> · {c.note}</span> : ''}</span><span className="text-xs text-ink-500">{fmtDate(c.at)}</span><span className="font-bold w-20 text-right">{inr(c.amount)}</span></div>)}
        </Card>
      </>)}

      <h3 className="font-bold mt-5 mb-2">Expenses · {inr(sp.spent)}</h3>
      <Card className="divide-y divide-ink-100 overflow-hidden">
        {expenses.map((x) => <div key={x.id} className="flex items-center gap-2 px-4 py-2.5 text-sm"><span className="flex-1"><b translate="no">{x.title}</b> <span className="text-ink-500">· {nm(x.userId)}</span></span><span className="text-xs text-ink-500">{fmtDate(x.at)}</span><span className="font-bold w-20 text-right">{inr(x.amount)}</span></div>)}
        {!expenses.length && <div className="px-4 py-2.5 text-sm text-ink-500">No expenses yet.</div>}
      </Card>
      {expenses.some((x) => x.receipt) && (<>
        <h3 className="font-bold mt-5 mb-2">Bills</h3>
        <div className="grid grid-cols-3 gap-2">{expenses.filter((x) => x.receipt).map((x) => <figure key={x.id} className="m-0"><img src={x.receipt} alt={x.title} className="w-full aspect-square object-cover rounded-xl" /><figcaption className="text-[11px] text-ink-500 mt-1 truncate" translate="no">{x.title} · {inr(x.amount)}</figcaption></figure>)}</div>
      </>)}

      {payments.length > 0 && (<>
        <h3 className="font-bold mt-5 mb-2">Payments already made</h3>
        <Card className="divide-y divide-ink-100 overflow-hidden">
          {payments.map((s) => <div key={s.id} className="flex items-center gap-2 px-4 py-2.5 text-sm"><Check size={14} className="text-accent-600" /><span className="flex-1">{nm(s.from)} → {nm(s.to)}</span><span className="text-xs text-ink-500">{fmtDate(s.at)}</span><span className="font-bold w-20 text-right">{inr(s.amount)}</span></div>)}
        </Card>
      </>)}
      <p className="text-[11px] text-ink-400 text-center mt-6">SociYo · {society.name} · {fmtDateTime(new Date().toISOString())}</p>
    </Page>
  )
}
