import { useState } from 'react'
import { Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { Plus, MapPin, Clock, Users, BellRing, BellOff, CalendarPlus, ImagePlus, ChevronLeft, ChevronRight, CalendarDays, Share2, ArrowLeft } from 'lucide-react'
import { Page, Button, Card, Tabs, Empty, Field, Input, Textarea, Select, Avatar, MediaPicker, MediaGrid, Sheet, Badge, useAction, useToast } from '../components/ui'
import { getLocale } from '../i18n'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/db'
import { can } from '../lib/rbac'
import { createEvent, rsvpEvent, toggleReminder, addEventPhotos, userById } from '../lib/actions'
import { fmtDateTime, fmtTime, cls, sameDay, artImage, shareText } from '../lib/utils'

export default function Events() {
  return (
    <Routes>
      <Route index element={<List />} />
      <Route path="new" element={<NewEvent />} />
      <Route path=":id" element={<Detail />} />
    </Routes>
  )
}
const going = (e) => e.rsvps.filter((r) => r.status === 'going').reduce((a, r) => a + 1 + (r.guests || 0), 0)

function EventCard({ e }) {
  const nav = useNavigate()
  const { user } = useAuth()
  const my = e.rsvps.find((r) => r.userId === user.id)
  const d = new Date(e.start)
  return (
    <Card className="overflow-hidden" onClick={() => nav(`/events/${e.id}`)}>
      <div className="relative h-32"><img src={e.cover} alt="" className="h-full w-full object-cover" />
        <div className="absolute top-3 left-3 bg-white rounded-xl px-2.5 py-1 text-center shadow"><div className="text-[10px] font-bold text-red-500 uppercase">{d.toLocaleDateString(getLocale(), { month: 'short' })}</div><div className="text-lg font-extrabold leading-none">{d.getDate()}</div></div>
        {my && <Badge color={my.status === 'going' ? 'green' : 'amber'} className="absolute top-3 right-3 !bg-white">{my.status === 'going' ? '✓ Going' : 'Maybe'}</Badge>}
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
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sociyo//EN', 'BEGIN:VEVENT', `UID:${e.id}@sociyo`, `DTSTAMP:${icsDate(new Date().toISOString())}`, `DTSTART:${icsDate(e.start)}`, `DTEND:${icsDate(e.end || e.start)}`, `SUMMARY:${e.title}`, `LOCATION:${e.venue}, ${society.name}`, `DESCRIPTION:${(e.description || '').replace(/\n/g, '\\n')}`, 'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', `DESCRIPTION:${e.title}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
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
  const [guests, setGuests] = useState(0)
  const [photos, setPhotos] = useState([])
  const [people, setPeople] = useState(false)
  if (!e) return <Page title="Event" back><Empty title="Event not found" /></Page>
  const my = e.rsvps.find((r) => r.userId === user.id)
  const g = going(e)
  const past = new Date(e.end || e.start) < new Date()
  const reminder = e.reminders.includes(user.id)
  const org = userById(e.organizerId)
  const attendees = e.rsvps.filter((r) => r.status === 'going')
  return (
    <Page noPad hero={<div className="relative"><img src={e.cover} alt="" className="w-full h-60 object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" /><button aria-label="Back" onClick={() => nav('/events')} className="absolute left-3 top-3 h-10 w-10 rounded-full bg-black/40 backdrop-blur text-white grid place-items-center safe-top"><ArrowLeft size={20} /></button></div>}>
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

        {!past && (
          <Card className="p-4 mt-3">
            <div className="font-bold text-sm mb-3">{my ? `You’re ${my.status === 'going' ? 'going 🎉' : 'a maybe'}` : 'Will you attend?'}</div>
            {(!my || my.status !== 'going') && (
              <div className="flex items-center gap-2 mb-3 text-sm"><span className="text-ink-500">Bringing guests:</span><Select className="!h-10 w-24" value={guests} onChange={(ev) => setGuests(Number(ev.target.value))}>{[0, 1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</Select></div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <Button variant={my?.status === 'going' ? 'success' : 'outline'} size="sm" onClick={() => act(() => rsvpEvent(user, e.id, 'going', guests), 'RSVP confirmed – see you there!')}>Going</Button>
              <Button variant={my?.status === 'maybe' ? 'primary' : 'outline'} size="sm" onClick={() => act(() => rsvpEvent(user, e.id, 'maybe', 0), 'Marked as maybe')}>Maybe</Button>
              <Button variant="outline" size="sm" disabled={!my} onClick={() => act(() => rsvpEvent(user, e.id, null), 'RSVP removed')}>Can’t go</Button>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <Button variant="secondary" size="sm" icon={reminder ? BellOff : BellRing} onClick={() => { const on = act(() => toggleReminder(user, e.id)); toast(on === true ? 'We’ll remind you a day before' : 'Reminder removed', 'info') }}>{reminder ? 'Remind off' : 'Remind me'}</Button>
              <Button variant="secondary" size="sm" icon={CalendarPlus} onClick={() => downloadIcs(e, society)}>Calendar</Button>
              <Button variant="secondary" size="sm" icon={Share2} onClick={async () => { const r = await shareText({ title: e.title, text: `${e.title} – ${fmtDateTime(e.start)} at ${e.venue}, ${society.name}. RSVP on Sociyo!` }); if (r === 'copied') toast('Copied') }}>Share</Button>
            </div>
          </Card>
        )}

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
        {e.rsvps.map((r) => { const u = userById(r.userId); return u && <div key={r.userId} className="flex items-center gap-3 py-2"><Avatar user={u} size={36} /><div className="flex-1 text-sm font-semibold">{u.name}{r.guests ? <span className="text-ink-400 font-normal"> +{r.guests}</span> : ''}</div><Badge color={r.status === 'going' ? 'green' : 'amber'}>{r.status}</Badge></div> })}
        {!e.rsvps.length && <p className="text-sm text-ink-500">No RSVPs yet.</p>}
      </Sheet>
    </Page>
  )
}

const CATS = [['Festival', '🪔', '#F97316', '#EAB308'], ['Sports', '🏏', '#22C55E', '#13254A'], ['Kids', '🧸', '#EC4899', '#8B5CF6'], ['Meeting', '🗳️', '#13254A', '#6366F1'], ['Social', '🎉', '#0EA5E9', '#8B5CF6'], ['National', '🇮🇳', '#F97316', '#22C55E'], ['Wellness', '🧘', '#14B8A6', '#0EA5E9']]

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
