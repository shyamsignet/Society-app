import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, X, EyeOff, Trash2, RotateCcw, ShieldCheck, ClipboardList, Download, Plus } from 'lucide-react'
import { Page, Card, Tabs, Chips, Button, Empty, Toggle, Sheet, Field, Input, Textarea, Select, Stat, Badge, useAction, useConfirm } from '../../components/ui'
import { FACILITY_CATALOGUE, hourLabel } from '../../lib/facilities'
import { ComplaintRow } from '../Complaints'
import { BookingBadge } from '../Facilities'
import { VisitorRow } from '../Visitors'
import PostCard from '../../components/PostCard'
import { useAuth } from '../../lib/auth'
import { useData, db } from '../../lib/db'
import { can } from '../../lib/rbac'
import { isOverdue, decideBooking, saveFacility, removeFacility, moderatePost, aptNo, userById, VISITOR_TYPES, updateListing } from '../../lib/actions'
import { fmtDateTime, fmtTime, inr, sameDay, downloadCSV, timeAgo, uid } from '../../lib/utils'

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
const hrs = (h) => (h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} d`)

export function AdminComplaints() {
  const { user } = useAuth()
  const [f, setF] = useState('open')
  const all = useData((d) => d.list('complaints').sort((a, b) => (isOverdue(b) - isOverdue(a)) || new Date(b.createdAt) - new Date(a.createdAt)))
  if (!can(user, 'complaints.manage')) return <Page title="Complaints" back="/admin"><Empty title="Not allowed" /></Page>
  const open = all.filter((c) => !['resolved', 'closed'].includes(c.status))
  const resp = all.map((c) => { const h = c.history.find((x) => x.status === 'acknowledged'); return h && (new Date(h.at) - new Date(c.createdAt)) / 3600000 }).filter(Boolean)
  const res = all.map((c) => { const h = [...c.history].reverse().find((x) => x.status === 'resolved'); return h && (new Date(h.at) - new Date(c.createdAt)) / 3600000 }).filter(Boolean)
  const list = all.filter((c) => f === 'all' ? true : f === 'open' ? open.includes(c) : f === 'overdue' ? isOverdue(c) : f === 'unassigned' ? !c.assigneeId && open.includes(c) : c.status === f)
  return (
    <Page title="Complaint management" back="/admin">
      <div className="grid grid-cols-3 gap-2 mt-2">
        <Stat label="Open" value={open.length} />
        <Stat label="Avg response" value={hrs(avg(resp))} />
        <Stat label="Avg resolution" value={hrs(avg(res))} />
      </div>
      <Chips className="my-3" value={f} onChange={setF} options={[{ value: 'open', label: 'Open', count: open.length }, { value: 'overdue', label: 'Overdue', count: all.filter(isOverdue).length }, { value: 'unassigned', label: 'Unassigned', count: open.filter((c) => !c.assigneeId).length }, { value: 'resolved', label: 'Resolved' }, { value: 'closed', label: 'Closed' }, { value: 'all', label: 'All' }]} />
      <div className="space-y-3">{list.map((c) => <ComplaintRow key={c.id} c={c} showApt />)}</div>
      {!list.length && <Empty title="Nothing here" />}
    </Page>
  )
}

export function AdminBookings() {
  const { user } = useAuth()
  const act = useAction()
  const [tab, setTab] = useState('pending')
  const [reject, setReject] = useState(null)
  const [reason, setReason] = useState('')
  const [edit, setEdit] = useState(null)
  const bookings = useData((d) => d.list('bookings').sort((a, b) => new Date(a.start) - new Date(b.start)))
  const facilities = useData((d) => d.list('facilities'))
  if (!can(user, 'facilities.manage')) return <Page title="Bookings" back="/admin"><Empty title="Not allowed" /></Page>
  const fac = (id) => facilities.find((f) => f.id === id) || {}
  const pending = bookings.filter((b) => b.status === 'pending')
  const upcoming = bookings.filter((b) => b.status === 'confirmed' && new Date(b.end) > new Date())
  const Row = ({ b, children }) => (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{fac(b.facilityId).emoji}</span>
        <div className="flex-1 min-w-0"><div className="font-bold">{fac(b.facilityId).name}</div><div className="text-xs text-ink-500">{fmtDateTime(b.start)} – {fmtTime(b.end)}</div><div className="text-xs text-ink-500">{aptNo(b.apartmentId)} · {userById(b.userId)?.name}{b.amount ? ` · ${inr(b.amount)}` : ''}</div>{b.note && <div className="text-xs text-ink-400 mt-0.5">“{b.note}”</div>}</div>
        <BookingBadge s={b.status} />
      </div>
      {children}
    </Card>
  )
  return (
    <Page title="Facilities & bookings" back="/admin">
      <Tabs className="mt-1" value={tab} onChange={setTab} tabs={[{ value: 'pending', label: `Approvals (${pending.length})`, count: pending.length }, { value: 'upcoming', label: 'Upcoming' }, { value: 'facilities', label: 'Facilities' }]} />
      <div className="space-y-3 mt-4">
        {tab === 'pending' && pending.map((b) => (
          <Row key={b.id} b={b}>
            <div className="flex gap-2 mt-3">
              <Button size="sm" variant="danger" block icon={X} onClick={() => { setReason(''); setReject(b.id) }}>Decline</Button>
              <Button size="sm" variant="success" block icon={Check} onClick={() => act(() => decideBooking(user, b.id, true), 'Booking approved')}>Approve</Button>
            </div>
          </Row>
        ))}
        {tab === 'pending' && !pending.length && <Empty icon={Check} title="No pending approvals" />}
        {tab === 'upcoming' && upcoming.map((b) => <Row key={b.id} b={b} />)}
        {tab === 'facilities' && <Button block variant="secondary" icon={Plus} onClick={() => setEdit('new')}>Add facility</Button>}
        {tab === 'facilities' && facilities.filter((x) => !x.archived).map((x) => (
          <Card key={x.id} className="p-4 flex items-center gap-3" onClick={() => setEdit(x.id)}>
            <span className="text-2xl">{x.emoji}</span>
            <div className="flex-1 min-w-0"><div className="font-bold">{x.name}</div><div className="text-xs text-ink-500">{x.slotHours === 24 ? 'Full day' : `${x.slotHours}h slots · ${hourLabel(x.open)}–${hourLabel(x.close)}`} · {x.charge ? inr(x.charge) : 'Free'} · {x.requiresApproval ? 'Approval' : 'Instant'}</div></div>
            {x.active ? <Badge color="green">Open</Badge> : <Badge color="red">Closed</Badge>}
          </Card>
        ))}
        {tab === 'facilities' && !facilities.some((x) => !x.archived) && <Empty title="No facilities yet" text="Add the clubhouse, gym, hall… that residents can book." />}
        {tab === 'facilities' && facilities.some((x) => x.archived) && (
          <>
            <div className="text-xs font-bold text-ink-400 uppercase tracking-wider pt-2">Removed</div>
            {facilities.filter((x) => x.archived).map((x) => (
              <Card key={x.id} className="p-3 flex items-center gap-3 opacity-70">
                <span className="text-xl">{x.emoji}</span><div className="flex-1 font-semibold text-sm">{x.name}</div>
                <Button size="sm" variant="secondary" icon={RotateCcw} onClick={() => act(() => removeFacility(user, x.id, false), `${x.name} restored`)}>Restore</Button>
              </Card>
            ))}
          </>
        )}
      </div>
      <Sheet open={!!reject} onClose={() => setReject(null)} title="Decline booking">
        <Field label="Reason (shared with resident)"><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Hall reserved for society AGM" /></Field>
        <Button variant="dangerSolid" block onClick={() => { act(() => decideBooking(user, reject, false, reason), 'Booking declined'); setReject(null) }}>Decline booking</Button>
      </Sheet>
      <FacilitySheet id={edit} onClose={() => setEdit(null)} />
    </Page>
  )
}

export function Moderation() {
  const { user } = useAuth()
  const act = useAction()
  const [tab, setTab] = useState('reported')
  const posts = useData((d) => d.list('posts', (p) => (tab === 'reported' ? p.reports.length > 0 && !p.hidden : p.hidden)))
  const listings = useData((d) => d.list('listings', (l) => l.status === 'active'))
  if (!can(user, 'moderation')) return <Page title="Moderation" back="/admin"><Empty title="Not allowed" /></Page>
  return (
    <Page title="Community moderation" back="/admin">
      <Tabs className="mt-1" value={tab} onChange={setTab} tabs={[{ value: 'reported', label: 'Reported' }, { value: 'hidden', label: 'Hidden' }, { value: 'market', label: 'Marketplace' }]} />
      <div className="space-y-4 mt-4">
        {tab !== 'market' && posts.map((p) => (
          <div key={p.id}>
            {p.reports.length > 0 && <div className="text-xs font-semibold text-red-600 mb-1.5">{p.reports.length} report(s): {[...new Set(p.reports.map((r) => r.reason))].join(', ')}</div>}
            <PostCard post={p} />
            <div className="flex gap-2 mt-2">
              {!p.hidden ? <Button size="sm" variant="secondary" icon={EyeOff} onClick={() => act(() => moderatePost(user, p.id, 'hide'), 'Post hidden')}>Hide</Button> : null}
              <Button size="sm" variant="outline" icon={RotateCcw} onClick={() => act(() => moderatePost(user, p.id, 'restore'), 'Restored & reports cleared')}>{p.hidden ? 'Restore' : 'Dismiss reports'}</Button>
              <Button size="sm" variant="danger" icon={Trash2} onClick={() => act(() => moderatePost(user, p.id, 'delete'), 'Post deleted')}>Delete</Button>
            </div>
          </div>
        ))}
        {tab !== 'market' && !posts.length && <Empty icon={ShieldCheck} title="All clean" text="No posts need attention." />}
        {tab === 'market' && listings.map((l) => (
          <Card key={l.id} className="p-3 flex items-center gap-3">
            {l.media?.[0] && <img src={l.media[0]} alt="" className="h-12 w-12 rounded-xl object-cover" />}
            <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate">{l.title}</div><div className="text-xs text-ink-500">{userById(l.userId)?.name} · {timeAgo(l.createdAt)}</div></div>
            <Button size="sm" variant="danger" onClick={() => act(() => updateListing(user, l.id, { status: 'removed' }), 'Listing removed')}>Remove</Button>
          </Card>
        ))}
      </div>
    </Page>
  )
}

export function AdminVisitors() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [t, setT] = useState('all')
  const all = useData((d) => d.list('visitors', (v) => v.entryAt).sort((a, b) => new Date(b.entryAt) - new Date(a.entryAt)))
  if (!can(user, 'visitors.logs')) return <Page title="Visitors" back="/admin"><Empty title="Not allowed" /></Page>
  const list = all.filter((v) => t === 'all' || v.type === t).slice(0, 60)
  const today = all.filter((v) => sameDay(v.entryAt, new Date())).length
  return (
    <Page title="Visitor logs" back="/admin" actions={<Button size="sm" variant="secondary" icon={Download} onClick={() => downloadCSV('visitor-logs.csv', [['Name', 'Type', 'Flat', 'Entry', 'Exit', 'Vehicle'], ...all.map((v) => [v.name, VISITOR_TYPES[v.type], aptNo(v.apartmentId), fmtDateTime(v.entryAt), v.exitAt ? fmtDateTime(v.exitAt) : 'Inside', v.vehicle])])}>CSV</Button>}>
      <div className="grid grid-cols-3 gap-2 mt-2">
        <Stat label="Today" value={today} />
        <Stat label="Inside now" value={all.filter((v) => v.status === 'inside').length} />
        <Stat label="Last 7 days" value={all.filter((v) => Date.now() - new Date(v.entryAt) < 7 * 86400000).length} />
      </div>
      {can(user, 'visitors.gate') && <Button variant="outline" block className="mt-3" icon={ClipboardList} onClick={() => nav('/guard')}>Open gate console</Button>}
      <Chips className="my-3" value={t} onChange={setT} options={[{ value: 'all', label: 'All' }, ...Object.entries(VISITOR_TYPES).map(([k, l]) => ({ value: k, label: l }))]} />
      <div className="space-y-3">{list.map((v) => <VisitorRow key={v.id} v={v} showApt />)}</div>
    </Page>
  )
}

function FacilitySheet({ id, onClose }) {
  const { user } = useAuth()
  const act = useAction()
  const ask = useConfirm()
  const facilities = useData((d) => d.list('facilities'))
  const existing = id && id !== 'new' ? facilities.find((x) => x.id === id) : null
  const blank = { type: '', name: '', emoji: '🏟️', slotHours: 1, open: 6, close: 22, charge: 0, capacity: 20, requiresApproval: false, active: true, rules: '' }
  const [f, setF] = useState(blank)
  const [forId, setForId] = useState(null)
  if (id !== forId) { setForId(id); setF(existing ? { ...existing, rules: (existing.rules || []).join('\n') } : blank) }
  const set = (k, num) => (e) => setF({ ...f, [k]: num ? Number(e.target.value) : e.target.value })
  const have = new Set(facilities.filter((x) => !x.archived).map((x) => x.name.toLowerCase()))
  const pick = (name) => {
    const c = FACILITY_CATALOGUE.find((x) => x.name === name)
    setF(c ? { ...f, ...c, type: name } : { ...blank, type: name, name: '' })
  }
  const save = () => {
    const data = { name: f.name, emoji: f.emoji || '🏟️', slotHours: Number(f.slotHours), open: Number(f.open), close: Number(f.slotHours) === 24 ? Number(f.open) : Number(f.close), charge: Number(f.charge) || 0, capacity: Number(f.capacity) || 1, requiresApproval: !!f.requiresApproval, active: !!f.active, rules: String(f.rules || '').split('\n').map((x) => x.trim()).filter(Boolean) }
    if (act(() => saveFacility(user, existing?.id || null, data), existing ? 'Facility updated' : `${data.name} added – residents can book it now`)) onClose()
  }
  const remove = async () => {
    if (await ask({ title: `Remove ${existing.name}?`, text: 'Residents will no longer see it. Its booking history is kept and you can restore it later.', ok: 'Remove', danger: true })) {
      if (act(() => removeFacility(user, existing.id, true), `${existing.name} removed`)) onClose()
    }
  }
  const hours = Array.from({ length: 25 }, (_, h) => h)
  return (
    <Sheet open={!!id} onClose={onClose} title={existing ? `${existing.emoji} ${existing.name}` : 'Add a facility'} footer={<Button block onClick={save} disabled={!String(f.name || '').trim()}>{existing ? 'Save changes' : 'Add facility'}</Button>}>
      {!existing && (
        <Field label="Choose facility" hint="Fills in typical hours and charges – change anything below">
          <Select value={f.type} onChange={(e) => pick(e.target.value)}>
            <option value="">Select…</option>
            {FACILITY_CATALOGUE.map((c) => <option key={c.name} value={c.name} disabled={have.has(c.name.toLowerCase())}>{c.emoji} {c.name}{have.has(c.name.toLowerCase()) ? ' (added)' : ''}</option>)}
            <option value="other">Other – type your own</option>
          </Select>
        </Field>
      )}
      {(existing || f.type) && (
        <>
          <div className="grid grid-cols-[72px_1fr] gap-3">
            <Field label="Icon"><Input value={f.emoji} maxLength={4} onChange={set('emoji')} className="text-center text-xl" /></Field>
            <Field label="Name"><Input value={f.name} onChange={set('name')} placeholder="e.g. Table Tennis Room" /></Field>
          </div>
          <Field label="Booking slot"><Select value={f.slotHours} onChange={set('slotHours', true)}>{[1, 2, 3, 4, 6, 24].map((h) => <option key={h} value={h}>{h === 24 ? 'Full day (24 h)' : `${h} hour${h > 1 ? 's' : ''}`}</option>)}</Select></Field>
          {Number(f.slotHours) !== 24 && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Opens at"><Select value={f.open} onChange={set('open', true)}>{hours.slice(0, 24).map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}</Select></Field>
              <Field label="Closes at"><Select value={f.close} onChange={set('close', true)}>{hours.slice(1).map((h) => <option key={h} value={h}>{h === 24 ? 'Midnight' : hourLabel(h)}</option>)}</Select></Field>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label={Number(f.slotHours) === 24 ? 'Charge per day (₹)' : 'Charge per slot (₹)'}><Input type="number" inputMode="numeric" min={0} value={f.charge} onChange={set('charge', true)} /></Field>
            <Field label="Capacity (people)"><Input type="number" inputMode="numeric" min={1} value={f.capacity} onChange={set('capacity', true)} /></Field>
          </div>
          <div className="divide-y divide-ink-100 border-y border-ink-100 mb-3">
            <Toggle checked={!!f.requiresApproval} onChange={(v) => setF({ ...f, requiresApproval: v })} label="Require committee approval" desc="Otherwise bookings are confirmed instantly" />
            <Toggle checked={!!f.active} onChange={(v) => setF({ ...f, active: v })} label="Open for booking" desc="Turn off to close it temporarily (maintenance, renovation…)" />
          </div>
          <Field label="Rules (one per line)"><Textarea rows={4} value={f.rules} onChange={set('rules')} placeholder={'e.g. No outside shoes\nChildren below 12 with an adult'} /></Field>
          {existing && <Button variant="ghost" block icon={Trash2} className="text-red-600" onClick={remove}>Remove facility</Button>}
        </>
      )}
    </Sheet>
  )
}
