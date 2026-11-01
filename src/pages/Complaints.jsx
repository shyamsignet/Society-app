import { useState } from 'react'
import { Routes, Route, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Plus, Phone, MessageSquare, Send, RotateCcw, Lock, Clock, UserCog, CheckCircle2, Wrench, Droplets, Zap, ArrowUpDown, Sparkles, Shield, Car, Waves, Volume2, Trees, HelpCircle, AlertTriangle, Timer } from 'lucide-react'
import { Page, Button, Card, Chips, Empty, Field, Input, Textarea, Tabs, Select, MediaPicker, MediaGrid, Avatar, Sheet, Stars, useAction, Badge } from '../components/ui'
import { ComplaintStatus, PriorityBadge } from '../components/StatusBadge'
import { useAuth } from '../lib/auth'
import { useData, db } from '../lib/db'
import { can } from '../lib/rbac'
import { COMPLAINT_CATEGORIES, SERVICE_CATEGORIES, STATUS_FLOW, STATUS_LABEL, createComplaint, setComplaintStatus, assignComplaint, addComplaintComment, rateComplaint, userById, aptNo, isOverdue, SLA_HOURS } from '../lib/actions'
import { timeAgo, fmtDateTime, cls, isoDay } from '../lib/utils'
import { towerLabel, sortTowers } from '../lib/flats'

export const CAT_ICON = { Plumbing: Droplets, Electrical: Zap, Lift: ArrowUpDown, Cleaning: Sparkles, Security: Shield, Parking: Car, 'Water Supply': Waves, Noise: Volume2, 'Common Area': Trees, Other: HelpCircle }

export default function Complaints() {
  return (
    <Routes>
      <Route index element={<List />} />
      <Route path="new" element={<NewComplaint />} />
      <Route path=":id" element={<Detail />} />
    </Routes>
  )
}

export function ComplaintRow({ c, showApt }) {
  const nav = useNavigate()
  const Icon = CAT_ICON[c.category] || Wrench
  const st = db.get('staff', c.assigneeId)
  return (
    <Card className="p-4" onClick={() => nav(`/complaints/${c.id}`)}>
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-2xl bg-brand-50 text-brand-700 grid place-items-center shrink-0"><Icon size={20} /></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-bold text-ink-400">
            <span>#{c.ticket}</span><span>·</span><span>{c.kind === 'service' ? 'Service request' : c.category}</span>
            {showApt && c.apartmentId && <><span>·</span><span>{aptNo(c.apartmentId)}</span></>}
          </div>
          <div className="font-bold text-[15px] text-ink-900 truncate mt-0.5">{c.title}</div>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <ComplaintStatus status={c.status} />
            {['urgent', 'high'].includes(c.priority) && <PriorityBadge p={c.priority} />}
            {isOverdue(c) && <Badge color="red">Overdue</Badge>}
          </div>
        </div>
        <div className="text-[11px] text-ink-400 whitespace-nowrap">{timeAgo(c.createdAt)}</div>
      </div>
      {st && <div className="text-xs text-ink-500 mt-3 pt-3 border-t border-ink-100 flex items-center gap-1.5"><UserCog size={14} /> Assigned to <b className="text-ink-700">{st.name}</b></div>}
    </Card>
  )
}

function List() {
  const { user } = useAuth()
  const nav = useNavigate()
  const manage = can(user, 'complaints.manage')
  const [scope, setScope] = useState(manage && !user.apartmentId ? 'all' : 'mine')
  const [f, setF] = useState('open')
  const all = useData((d) => d.list('complaints').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
  const base = scope === 'mine' ? all.filter((c) => c.userId === user.id || (c.apartmentId && c.apartmentId === user.apartmentId)) : all
  const list = base.filter((c) => f === 'all' || (f === 'open' ? !['resolved', 'closed'].includes(c.status) : f === 'overdue' ? isOverdue(c) : c.status === f))
  const n = (fn) => base.filter(fn).length
  return (
    <Page title="Helpdesk" subtitle="Complaints & service requests" back actions={<Button size="sm" icon={Plus} onClick={() => nav('new')}>New</Button>}>
      {manage && <Tabs className="mt-2" value={scope} onChange={setScope} tabs={[{ value: 'mine', label: 'My tickets' }, { value: 'all', label: 'All society' }]} />}
      <Chips className="my-3" value={f} onChange={setF} options={[
        { value: 'open', label: 'Open', count: n((c) => !['resolved', 'closed'].includes(c.status)) },
        ...(scope === 'all' ? [{ value: 'overdue', label: 'Overdue', count: n(isOverdue) }] : []),
        { value: 'resolved', label: 'Resolved', count: n((c) => c.status === 'resolved') },
        { value: 'closed', label: 'Closed', count: n((c) => c.status === 'closed') },
        { value: 'all', label: 'All', count: base.length }
      ]} />
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[{ k: 'complaint', l: 'Complaint', i: AlertTriangle, to: 'new' }, { k: 'service', l: 'Service', i: Wrench, to: 'new?kind=service' }, { k: 'issue', l: 'Common issue', i: Trees, to: 'new?kind=issue' }].map((x) => (
          <button key={x.k} onClick={() => nav(x.to)} className="bg-white rounded-2xl shadow-card p-3 flex flex-col items-center gap-1.5 text-xs font-semibold text-ink-700 active:scale-95 transition"><x.i size={20} className="text-brand-600" />{x.l}</button>
        ))}
      </div>
      <div className="space-y-3">
        {list.map((c) => <ComplaintRow key={c.id} c={c} showApt={scope === 'all'} />)}
        {!list.length && <Empty icon={CheckCircle2} title="No tickets here" text="Raise a complaint or request a service — we’ll keep you posted at every step." />}
      </div>
    </Page>
  )
}

const KIND = {
  complaint: { title: 'Raise a complaint', btn: 'Submit complaint' },
  issue: { title: 'Report an issue', btn: 'Report issue' },
  service: { title: 'Request a service', btn: 'Submit request' }
}

function NewComplaint() {
  const { user } = useAuth()
  const nav = useNavigate()
  const act = useAction()
  const [sp] = useSearchParams()
  const kind = KIND[sp.get('kind')] ? sp.get('kind') : 'complaint'
  // wings and floors come from the society's actual flats
  const towers = useData((d) => [...new Set(d.list('apartments').map((a) => a.tower || ''))].filter(Boolean).sort(sortTowers).join('|')).split('|').filter(Boolean)
  const floors = useData((d) => [...new Set(d.list('apartments').map((a) => Number(a.floor) || 0))].sort((a, b) => a - b).join('|')).split('|').filter((x) => x !== '').map(Number)
  const [f, setF] = useState({
    title: '', description: '', category: '', priority: 'medium',
    locType: kind === 'issue' || !user.apartmentId ? 'common' : 'apartment', locValue: kind === 'issue' || !user.apartmentId ? '' : aptNo(user.apartmentId), tower: '', floor: '1',
    contactMethod: 'app', contactWindow: 'Anytime', preferredDate: isoDay(Date.now() + 86400000)
  })
  const [media, setMedia] = useState([])
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }))
  const cats = kind === 'service' ? SERVICE_CATEGORIES : COMPLAINT_CATEGORIES
  const tw = towers.includes(f.tower) ? f.tower : towers[0] || ''
  const submit = () => {
    const location = f.locType === 'apartment' ? { type: 'apartment', value: f.locValue } : f.locType === 'floor' ? { type: 'floor', value: [tw && towerLabel(tw), Number(f.floor) === 0 ? 'Ground floor' : `Floor ${f.floor}`].filter(Boolean).join(' · ') } : f.locType === 'tower' ? { type: 'tower', value: towerLabel(tw) } : { type: 'common', value: f.locValue || 'Common area' }
    const c = act(() => createComplaint(user, {
      kind: kind === 'service' ? 'service' : 'complaint', title: f.title, description: f.description, category: f.category, priority: f.priority, location, media,
      contact: { method: f.contactMethod, value: f.contactMethod === 'app' ? '' : user.phone, window: f.contactWindow },
      preferredDate: kind === 'service' ? f.preferredDate : undefined
    }), (c) => `Ticket #${c.ticket} created`)
    if (c) nav(`/complaints/${c.id}`, { replace: true })
  }
  return (
    <Page title={KIND[kind].title} back>
      <Field label="Category">
        <div className="grid grid-cols-4 gap-2">
          {cats.map((c) => {
            const Icon = CAT_ICON[c] || Wrench
            return (
              <button type="button" key={c} onClick={() => set('category', c)} className={cls('rounded-2xl p-2.5 flex flex-col items-center gap-1.5 text-[11px] font-semibold border-2 transition', f.category === c ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-transparent bg-white shadow-card text-ink-700')}>
                <Icon size={20} />{c}
              </button>
            )
          })}
        </div>
      </Field>
      <Field label="Title"><Input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder={kind === 'service' ? 'e.g. Need a carpenter for wardrobe hinge' : 'e.g. Bathroom tap leaking'} maxLength={100} /></Field>
      <Field label="Description"><Textarea value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Describe the problem — when it started, how severe it is…" /></Field>
      <Field label="Photos / videos"><MediaPicker value={media} onChange={setMedia} /></Field>
      <Field label="Location">
        <Tabs className="mb-2" value={f.locType} onChange={(v) => { set('locType', v); if (v === 'apartment') set('locValue', aptNo(user.apartmentId)); if (v === 'common') set('locValue', '') }} tabs={[...(user.apartmentId ? [{ value: 'apartment', label: 'My flat' }] : []), { value: 'floor', label: 'Floor' }, ...(towers.length ? [{ value: 'tower', label: 'Tower' }] : []), { value: 'common', label: 'Common' }]} />
        {f.locType === 'apartment' && <Input value={f.locValue} readOnly />}
        {(f.locType === 'floor' || f.locType === 'tower') && (
          <div className={cls('grid gap-2', towers.length > 0 && f.locType === 'floor' ? 'grid-cols-2' : 'grid-cols-1')}>
            {towers.length > 0 && <Select value={tw} onChange={(e) => set('tower', e.target.value)}>{towers.map((t) => <option key={t} value={t}>{towerLabel(t)}</option>)}</Select>}
            {f.locType === 'floor' && <Select value={f.floor} onChange={(e) => set('floor', e.target.value)}>{(floors.length ? floors : [0, 1, 2, 3, 4, 5, 6]).map((n) => <option key={n} value={n}>{n === 0 ? 'Ground' : `Floor ${n}`}</option>)}</Select>}
          </div>
        )}
        {f.locType === 'common' && <Input value={f.locValue} onChange={(e) => set('locValue', e.target.value)} placeholder="e.g. Clubhouse gym, Basement P2, Garden" />}
      </Field>
      {kind === 'service' && <Field label="Preferred date"><Input type="date" min={isoDay(new Date())} value={f.preferredDate} onChange={(e) => set('preferredDate', e.target.value)} /></Field>}
      <Field label="Priority"><Tabs value={f.priority} onChange={(v) => set('priority', v)} tabs={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }]} /></Field>
      <Field label="Preferred contact" hint={f.contactMethod !== 'app' ? `We’ll use ${user.phone}` : 'You’ll get updates in the app'}>
        <div className="grid grid-cols-2 gap-2">
          <Select value={f.contactMethod} onChange={(e) => set('contactMethod', e.target.value)}><option value="app">In-app only</option><option value="phone">Phone call</option><option value="whatsapp">WhatsApp</option></Select>
          <Select value={f.contactWindow} onChange={(e) => set('contactWindow', e.target.value)}>{['Anytime', 'Morning (8–12)', 'Afternoon (12–5)', 'After 6 PM'].map((x) => <option key={x}>{x}</option>)}</Select>
        </div>
      </Field>
      <p className="text-xs text-ink-500 mb-4 flex items-center gap-1.5"><Timer size={14} /> Expected resolution: within {SLA_HOURS[f.priority] < 48 ? SLA_HOURS[f.priority] + ' hours' : SLA_HOURS[f.priority] / 24 + ' days'}</p>
      <Button block size="lg" onClick={submit} disabled={!f.category}>{KIND[kind].btn}</Button>
    </Page>
  )
}

const dur = (ms) => { const h = ms / 3600000; return h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} days` }

function Detail() {
  const { id } = useParams()
  const { user } = useAuth()
  const act = useAction()
  const c = useData((d) => d.get('complaints', id))
  const staff = useData((d) => d.list('staff'))
  const [text, setText] = useState('')
  const [tab, setTab] = useState('updates')
  const [sheet, setSheet] = useState(null)
  const [rating, setRating] = useState(0)
  const [note, setNote] = useState('')
  if (!c) return <Page title="Ticket" back><Empty title="Ticket not found" /></Page>
  const manage = can(user, 'complaints.manage')
  const owner = c.userId === user.id
  const raiser = userById(c.userId)
  const st = staff.find((s) => s.id === c.assigneeId)
  const idx = STATUS_FLOW.indexOf(c.status)
  const nextStatus = STATUS_FLOW[idx + 1]
  const timeline = [...c.history.map((h) => ({ ...h, t: 'h' })), ...c.comments.map((x) => ({ ...x, t: 'c', at: x.createdAt }))].sort((a, b) => new Date(a.at) - new Date(b.at))
  const firstAck = c.history.find((h) => h.status === 'acknowledged')
  const resolved = [...c.history].reverse().find((h) => h.status === 'resolved')
  const send = () => { if (act(() => addComplaintComment(user, c.id, text, tab === 'internal'))) setText('') }

  return (
    <Page title={`#${c.ticket}`} subtitle={c.kind === 'service' ? 'Service request' : c.category} back="/complaints">
      <Card className="p-4 mt-2">
        <div className="flex items-center gap-2 flex-wrap"><ComplaintStatus status={c.status} /><PriorityBadge p={c.priority} />{isOverdue(c) && <Badge color="red">Overdue</Badge>}</div>
        <h1 className="text-lg font-extrabold mt-2 leading-snug">{c.title}</h1>
        <p className="text-sm text-ink-700 mt-2 whitespace-pre-line">{c.description}</p>
        <MediaGrid media={c.media} className="mt-3" />
        <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
          <Info k="Location" v={c.location?.value} />
          <Info k="Raised by" v={`${raiser?.name || '—'}${c.apartmentId ? ' · ' + aptNo(c.apartmentId) : ''}`} />
          <Info k="Created" v={fmtDateTime(c.createdAt)} />
          <Info k="Contact" v={c.contact?.method === 'app' ? 'In-app' : `${c.contact?.method} · ${c.contact?.window || ''}`} />
          {c.preferredDate && <Info k="Preferred date" v={c.preferredDate} />}
        </div>
      </Card>

      {/* Progress */}
      <Card className="p-4 mt-3">
        <div className="flex items-center">
          {STATUS_FLOW.map((s, i) => (
            <div key={s} className="flex-1 flex flex-col items-center relative">
              {i > 0 && <span className={cls('absolute right-1/2 top-3 h-0.5 w-full', i <= idx ? 'bg-accent-500' : 'bg-ink-200')} />}
              <span className={cls('relative z-10 h-6 w-6 rounded-full grid place-items-center text-[10px] font-bold', i <= idx ? 'bg-accent-500 text-white' : 'bg-ink-200 text-ink-500')}>{i <= idx ? '✓' : i + 1}</span>
              <span className={cls('text-[10px] mt-1.5 font-semibold text-center leading-tight', i <= idx ? 'text-ink-900' : 'text-ink-400')}>{STATUS_LABEL[s]}</span>
            </div>
          ))}
        </div>
        {(firstAck || resolved) && (
          <div className="flex gap-4 mt-4 pt-3 border-t border-ink-100 text-xs text-ink-500">
            {firstAck && <span className="flex items-center gap-1"><Clock size={13} /> Response: <b className="text-ink-700">{dur(new Date(firstAck.at) - new Date(c.createdAt))}</b></span>}
            {resolved && <span className="flex items-center gap-1"><CheckCircle2 size={13} /> Resolution: <b className="text-ink-700">{dur(new Date(resolved.at) - new Date(c.createdAt))}</b></span>}
          </div>
        )}
      </Card>

      {st && (
        <Card className="p-4 mt-3 flex items-center gap-3">
          <Avatar name={st.name} size={42} />
          <div className="flex-1 min-w-0"><div className="text-xs text-ink-500">Assigned to</div><div className="font-bold truncate">{st.name}</div><div className="text-xs text-ink-500">{st.role}</div></div>
          <a href={`tel:${st.phone.replace(/\s/g, '')}`} className="h-10 w-10 rounded-full bg-accent-50 text-accent-700 grid place-items-center"><Phone size={18} /></a>
        </Card>
      )}

      {/* Resident actions */}
      {owner && c.status === 'resolved' && (
        <Card className="p-4 mt-3 border-2 border-accent-100">
          <div className="font-bold">Is your issue resolved?</div>
          <p className="text-sm text-ink-500 mb-3">Rate the resolution to close this ticket, or reopen it if the problem persists.</p>
          <div className="flex gap-2">
            <Button variant="outline" block icon={RotateCcw} onClick={() => setSheet('reopen')}>Reopen</Button>
            <Button variant="success" block onClick={() => setSheet('rate')}>Rate & close</Button>
          </div>
        </Card>
      )}
      {owner && c.status === 'closed' && c.rating && <Card className="p-4 mt-3"><div className="text-xs text-ink-500 mb-1">Your rating</div><Stars value={c.rating} size={22} />{c.feedback && <p className="text-sm text-ink-700 mt-2">“{c.feedback}”</p>}</Card>}
      {owner && c.status === 'closed' && <Button variant="ghost" className="mt-2" size="sm" icon={RotateCcw} onClick={() => setSheet('reopen')}>Reopen ticket</Button>}

      {/* Admin actions */}
      {manage && (
        <Card className="p-4 mt-3">
          <div className="text-sm font-bold mb-3 flex items-center gap-2"><UserCog size={16} /> Manage ticket</div>
          <Field label="Assign to staff">
            <Select value={c.assigneeId || ''} onChange={(e) => e.target.value && act(() => assignComplaint(user, c.id, e.target.value), 'Assigned')}>
              <option value="">Unassigned</option>
              {staff.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.role}{s.skills?.includes(c.category) ? ' ★' : ''}</option>)}
            </Select>
          </Field>
          {nextStatus && <Button block icon={CheckCircle2} onClick={() => { setNote(''); setSheet('status') }}>Mark as {STATUS_LABEL[nextStatus]}</Button>}
        </Card>
      )}

      {/* Timeline */}
      <div className="mt-6">
        {manage ? <Tabs value={tab} onChange={setTab} tabs={[{ value: 'updates', label: 'Updates' }, { value: 'internal', label: `Internal notes (${c.internalNotes.length})` }]} /> : <h3 className="font-bold">Updates</h3>}
        <div className="mt-4 space-y-0 mb-28">
          {tab === 'updates' ? timeline.map((e, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className={cls('h-8 w-8 rounded-full grid place-items-center shrink-0', e.t === 'c' ? 'bg-brand-50 text-brand-600' : 'bg-accent-50 text-accent-700')}>{e.t === 'c' ? <MessageSquare size={14} /> : <CheckCircle2 size={14} />}</span>
                {i < timeline.length - 1 && <span className="w-0.5 flex-1 bg-ink-200 my-1" />}
              </div>
              <div className="pb-5 flex-1 min-w-0">
                <div className="text-[13px] font-bold">{e.t === 'c' ? userById(e.userId)?.name : e.status === 'assigned' ? 'Assigned' : STATUS_LABEL[e.status]}</div>
                <div className="text-[11px] text-ink-400">{e.t === 'h' && userById(e.by) ? `by ${userById(e.by).name} · ` : ''}{fmtDateTime(e.at)}</div>
                {(e.text || e.note) && <div className={cls('text-sm mt-1.5', e.t === 'c' ? 'bg-white rounded-2xl rounded-tl-md p-3 shadow-card text-ink-700' : 'text-ink-500')}>{e.text || e.note}</div>}
              </div>
            </div>
          )) : (
            <div className="space-y-2">
              <p className="text-xs text-ink-500 flex items-center gap-1.5 mb-2"><Lock size={12} /> Visible only to committee and staff</p>
              {c.internalNotes.map((n) => <Card key={n.id} className="p-3 bg-amber-50/60"><div className="text-xs font-bold">{userById(n.userId)?.name} <span className="font-normal text-ink-400">{timeAgo(n.createdAt)}</span></div><div className="text-sm mt-1">{n.text}</div></Card>)}
              {!c.internalNotes.length && <p className="text-sm text-ink-400">No internal notes yet.</p>}
            </div>
          )}
        </div>
      </div>

      {(owner || manage) && c.status !== 'closed' && (
        <div className="fixed bottom-16 inset-x-0 mx-auto max-w-[520px] bg-white border-t border-ink-200 p-3 flex gap-2 z-30">
          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder={tab === 'internal' ? 'Add an internal note…' : 'Add a comment…'} className={cls('flex-1 h-11 rounded-full px-4 text-[15px] outline-none focus:ring-2 focus:ring-brand-200', tab === 'internal' ? 'bg-amber-50' : 'bg-ink-100')} />
          <button aria-label="Send" onClick={send} disabled={!text.trim()} className="h-11 w-11 rounded-full bg-brand-800 text-white grid place-items-center disabled:opacity-40"><Send size={18} /></button>
        </div>
      )}

      <Sheet open={sheet === 'status'} onClose={() => setSheet(null)} title={`Mark as ${STATUS_LABEL[nextStatus]}`}>
        <Field label="Note for the resident (optional)"><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Technician will visit at 11 AM" /></Field>
        <Button block onClick={() => { act(() => setComplaintStatus(user, c.id, nextStatus, note), 'Status updated – resident notified'); setSheet(null) }}>Update status</Button>
      </Sheet>
      <Sheet open={sheet === 'reopen'} onClose={() => setSheet(null)} title="Reopen ticket">
        <Field label="What’s still wrong?"><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="The tap started leaking again…" /></Field>
        <Button block icon={RotateCcw} disabled={!note.trim()} onClick={() => { act(() => setComplaintStatus(user, c.id, 'reopened', note), 'Ticket reopened'); setSheet(null); setNote('') }}>Reopen</Button>
      </Sheet>
      <Sheet open={sheet === 'rate'} onClose={() => setSheet(null)} title="Rate the resolution">
        <div className="flex justify-center my-3"><Stars value={rating} onChange={setRating} size={40} /></div>
        <Field label="Feedback (optional)"><Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="How was your experience?" /></Field>
        <Button variant="success" block disabled={!rating} onClick={() => { act(() => rateComplaint(user, c.id, rating, note), 'Thanks for your feedback!'); setSheet(null) }}>Submit & close ticket</Button>
      </Sheet>
    </Page>
  )
}

const Info = ({ k, v }) => <div><div className="text-ink-400 font-semibold">{k}</div><div className="text-ink-900 font-semibold mt-0.5 capitalize-first">{v || '—'}</div></div>
