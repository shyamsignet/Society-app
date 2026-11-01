import { useEffect, useRef, useState } from 'react'
import { Routes, Route, useNavigate, useSearchParams } from 'react-router-dom'
import { ScanLine, KeyRound, Phone, LogOut, LogIn, Check, X, Users, Clock, UserPlus, Search, Package, Car, Wrench, User, ShieldCheck, Bell } from 'lucide-react'
import { Page, Button, Card, Input, Field, Select, Sheet, Empty, Stat, Chips, IconButton, MediaPicker, useAction, useToast } from '../components/ui'
import FlatPicker from '../components/FlatPicker'
import { VisitorRow, V_ICON } from './Visitors'
import { useAuth } from '../lib/auth'
import { useData, db } from '../lib/db'
import { verifyVisitorCode, markEntry, markExit, guardRegisterVisitor, respondVisitor, residentsOfApt, aptNo, VISITOR_TYPES } from '../lib/actions'
import { fmtDateTime, sameDay, cls, isoDay, downloadCSV } from '../lib/utils'

export default function Guard() {
  return (
    <Routes>
      <Route index element={<Console />} />
      <Route path="new" element={<Register />} />
      <Route path="logs" element={<Logs />} />
    </Routes>
  )
}

function Console() {
  const { user } = useAuth()
  const nav = useNavigate()
  const act = useAction()
  const toast = useToast()
  const [code, setCode] = useState('')
  const [found, setFound] = useState(null)
  const [scan, setScan] = useState(false)
  const all = useData((d) => d.list('visitors'))
  const unread = useData((d) => d.list('notifications', (n) => n.userId === user.id && !n.read).length)
  const inside = all.filter((v) => v.status === 'inside').sort((a, b) => new Date(b.entryAt) - new Date(a.entryAt))
  const uniqueWaiting = all.filter((v) => v.status === 'pending' || v.status === 'approved' || (v.status === 'rejected' && Date.now() - new Date(v.respondedAt || v.createdAt) < 3600000))
  const expected = all.filter((v) => v.status === 'preapproved' && v.expectedAt && sameDay(v.expectedAt, new Date()))
  const today = all.filter((v) => v.entryAt && sameDay(v.entryAt, new Date())).length

  const verify = (c = code) => {
    try { setFound(verifyVisitorCode(user, c)); setCode('') } catch (e) { toast(e.message, 'error') }
  }
  return (
    <Page title="Main Gate" subtitle={`Security console · ${user.name}`} actions={<IconButton icon={Bell} label="Notifications" badge={unread} onClick={() => nav('/notifications')} />}>
      <div className="grid grid-cols-3 gap-2 mt-2">
        <Stat label="Inside now" value={inside.length} icon={Users} tone="green" />
        <Stat label="Entries today" value={today} icon={LogIn} tone="brand" />
        <Stat label="Expected" value={expected.length} icon={Clock} tone="purple" />
      </div>

      <Card className="p-4 mt-3">
        <div className="font-bold flex items-center gap-2"><ShieldCheck size={18} className="text-accent-600" /> Verify visitor</div>
        <div className="flex gap-2 mt-3">
          <Input inputMode="numeric" maxLength={6} placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && verify()} className="text-center text-lg font-bold tracking-[0.3em]" />
          <Button icon={KeyRound} onClick={() => verify()} disabled={code.length !== 6}>Verify</Button>
        </div>
        <Button variant="secondary" block className="mt-2" icon={ScanLine} onClick={() => setScan(true)}>Scan QR pass</Button>
      </Card>

      <div className="grid grid-cols-4 gap-2 mt-3">
        {Object.entries(VISITOR_TYPES).map(([k, l]) => { const Icon = V_ICON[k]; return (
          <button key={k} onClick={() => nav(`new?type=${k}`)} className="bg-white rounded-2xl shadow-card p-3 flex flex-col items-center gap-1.5 text-[11px] font-semibold active:scale-95 transition"><span className="h-10 w-10 rounded-xl bg-brand-50 text-brand-700 grid place-items-center"><Icon size={19} /></span>{l.split(' ')[0]}</button>
        ) })}
      </div>

      {uniqueWaiting.length > 0 && <h3 className="font-bold mt-6 mb-2">Awaiting resident approval</h3>}
      <div className="space-y-3">
        {uniqueWaiting.map((v) => {
          const res = residentsOfApt(v.apartmentId)[0]
          return (
            <VisitorRow key={v.id} v={v} showApt>
              <div className="flex gap-2 mt-3">
                {v.status === 'pending' && <>
                  {res && <a href={`tel:${res.phone.replace(/\s/g, '')}`} className="h-9 px-3 rounded-xl bg-accent-50 text-accent-700 text-[13px] font-semibold flex items-center gap-1.5"><Phone size={15} /> Call</a>}
                  <Button size="sm" variant="danger" icon={X} onClick={() => act(() => respondVisitor(user, v.id, false), 'Entry denied')}>Deny</Button>
                  <Button size="sm" variant="secondary" block icon={Check} onClick={() => act(() => respondVisitor(user, v.id, true), 'Approved on call')}>Approved on call</Button>
                </>}
                {v.status === 'approved' && <Button size="sm" variant="success" block icon={LogIn} onClick={() => act(() => markEntry(user, v.id), 'Entry recorded – resident notified')}>Allow entry</Button>}
                {v.status === 'rejected' && <span className="text-xs text-red-600 font-semibold">Resident denied entry – do not allow</span>}
              </div>
            </VisitorRow>
          )
        })}
      </div>

      <h3 className="font-bold mt-6 mb-2">Expected today</h3>
      <div className="space-y-3">
        {expected.map((v) => <VisitorRow key={v.id} v={v} showApt><Button size="sm" variant="success" className="mt-3" block icon={LogIn} onClick={() => act(() => markEntry(user, v.id), 'Entry recorded')}>Mark arrived</Button></VisitorRow>)}
        {!expected.length && <p className="text-sm text-ink-400">No pre-approved visitors for today.</p>}
      </div>

      <h3 className="font-bold mt-6 mb-2">Inside the premises ({inside.length})</h3>
      <div className="space-y-3">
        {inside.map((v) => <VisitorRow key={v.id} v={v} showApt><Button size="sm" variant="outline" className="mt-3" block icon={LogOut} onClick={() => act(() => markExit(user, v.id), 'Exit recorded')}>Mark exit</Button></VisitorRow>)}
        {!inside.length && <p className="text-sm text-ink-400">No visitors inside.</p>}
      </div>

      <Sheet open={!!found} onClose={() => setFound(null)} title="Valid gate pass ✅">
        {found && (
          <>
            <VisitorRow v={found} showApt />
            <div className="text-sm text-ink-500 mt-3">Host: <b className="text-ink-900">{db.get('users', found.hostId)?.name}</b> · {found.guests || 1} person(s)</div>
            <Button variant="success" size="lg" block className="mt-4" icon={LogIn} onClick={() => { act(() => markEntry(user, found.id), 'Entry recorded – resident notified'); setFound(null) }}>Allow entry</Button>
          </>
        )}
      </Sheet>
      <Scanner open={scan} onClose={() => setScan(false)} onCode={(c) => { setScan(false); verify(c) }} />
    </Page>
  )
}

function Scanner({ open, onClose, onCode }) {
  const video = useRef()
  const [err, setErr] = useState('')
  useEffect(() => {
    if (!open) return
    let stream, timer, stop = false
    setErr('')
    ;(async () => {
      if (!('BarcodeDetector' in window)) return setErr('QR scanning is not supported in this browser. Please type the 6-digit code instead.')
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        video.current.srcObject = stream
        await video.current.play()
        const det = new window.BarcodeDetector({ formats: ['qr_code'] })
        const tick = async () => {
          if (stop) return
          try { const r = await det.detect(video.current); if (r[0]) return onCode(r[0].rawValue) } catch { /* frame not ready */ }
          timer = setTimeout(tick, 250)
        }
        tick()
      } catch { setErr('Camera permission denied. Allow camera access or type the code instead.') }
    })()
    return () => { stop = true; clearTimeout(timer); stream?.getTracks().forEach((t) => t.stop()) }
  }, [open])
  return (
    <Sheet open={open} onClose={onClose} title="Scan gate pass">
      {err ? <p className="text-sm text-red-600 py-6 text-center">{err}</p> : (
        <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
          <video ref={video} playsInline muted className="h-full w-full object-cover" />
          <div className="absolute inset-10 border-4 border-accent-400 rounded-3xl" />
        </div>
      )}
    </Sheet>
  )
}

function Register() {
  const { user } = useAuth()
  const nav = useNavigate()
  const act = useAction()
  const [sp] = useSearchParams()
  const [f, setF] = useState({ type: VISITOR_TYPES[sp.get('type')] ? sp.get('type') : 'guest', name: '', phone: '', company: '', apartmentId: '', vehicle: '', purpose: '', guests: 1 })
  const [photo, setPhoto] = useState([])
  const apts = useData((d) => d.list('apartments'))
  const occupied = useData((d) => new Set(d.list('users', (u) => u.apartmentId && u.status === 'active').map((u) => u.apartmentId)))
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const submit = () => {
    const v = act(() => guardRegisterVisitor(user, { type: f.type, name: f.name.trim() || (f.company ? `${f.company} – ${VISITOR_TYPES[f.type]}` : ''), phone: f.phone, company: f.company, apartmentId: f.apartmentId, vehicle: f.vehicle.toUpperCase(), purpose: f.purpose, guests: Number(f.guests) || 1, photo: photo[0]?.url }), 'Request sent to resident for approval')
    if (v) nav('/guard', { replace: true })
  }
  return (
    <Page title="Register walk-in" back="/guard">
      <Field label="Type">
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(VISITOR_TYPES).map(([k, l]) => { const Icon = V_ICON[k]; return <button key={k} type="button" onClick={() => setF({ ...f, type: k })} className={cls('rounded-2xl p-3 flex flex-col items-center gap-1 text-[11px] font-semibold border-2', f.type === k ? 'border-brand-600 bg-brand-50' : 'border-transparent bg-white shadow-card')}><Icon size={20} />{l.split(' ')[0]}</button> })}
        </div>
      </Field>
      {f.type !== 'guest' && (
        <Field label="Company">
          <Chips className="mb-2" value={f.company} onChange={(v) => setF({ ...f, company: v })} options={(f.type === 'delivery' ? ['Amazon', 'Flipkart', 'Swiggy', 'Zomato', 'Zepto', 'Blinkit', 'BigBasket'] : f.type === 'cab' ? ['Uber', 'Ola', 'Rapido'] : ['Urban Company', 'Plumber', 'Electrician', 'Carpenter', 'Maid'])} />
          <Input value={f.company} onChange={set('company')} placeholder="Or type company" />
        </Field>
      )}
      <Field label="Visitor name"><Input value={f.name} onChange={set('name')} placeholder={f.type === 'guest' ? 'Full name' : 'Optional'} /></Field>
      <Field label="Mobile"><Input inputMode="tel" value={f.phone} onChange={set('phone')} /></Field>
      <FlatPicker apartments={apts} value={f.apartmentId} onChange={(id) => setF((x) => ({ ...x, apartmentId: id }))} disabled={(a) => !occupied.has(a.id)} option={(a) => `${a.number}${!occupied.has(a.id) ? ' (vacant)' : ''}`} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Vehicle no."><Input value={f.vehicle} onChange={set('vehicle')} placeholder="Optional" /></Field>
        <Field label="People"><Input type="number" min={1} value={f.guests} onChange={set('guests')} /></Field>
      </div>
      <Field label="Purpose"><Input value={f.purpose} onChange={set('purpose')} placeholder="Delivery, meeting, repair…" /></Field>
      <Field label="Photo (optional)"><MediaPicker value={photo} onChange={setPhoto} max={1} allowVideo={false} label="Capture" /></Field>
      <Button block size="lg" icon={UserPlus} onClick={submit} disabled={!f.apartmentId || (f.type === 'guest' && !f.name.trim())}>Send for approval</Button>
    </Page>
  )
}

function Logs() {
  const [q, setQ] = useState('')
  const [type, setType] = useState('all')
  const [day, setDay] = useState(isoDay(new Date()))
  const all = useData((d) => d.list('visitors', (v) => v.entryAt).sort((a, b) => new Date(b.entryAt) - new Date(a.entryAt)))
  const list = all.filter((v) => (!day || isoDay(v.entryAt) === day) && (type === 'all' || v.type === type) && (!q || (v.name + aptNo(v.apartmentId) + (v.vehicle || '')).toLowerCase().includes(q.toLowerCase())))
  const exp = () => downloadCSV(`visitor-log-${day || 'all'}.csv`, [['Name', 'Type', 'Company', 'Flat', 'Vehicle', 'Entry', 'Exit', 'Purpose'], ...list.map((v) => [v.name, VISITOR_TYPES[v.type], v.company, aptNo(v.apartmentId), v.vehicle, fmtDateTime(v.entryAt), v.exitAt ? fmtDateTime(v.exitAt) : 'Inside', v.purpose])])
  return (
    <Page title="Entry / exit log" subtitle={`${list.length} entries`} back actions={<Button size="sm" variant="secondary" onClick={exp}>Export</Button>}>
      <div className="flex gap-2 mt-2">
        <div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><Input className="pl-9" placeholder="Name, flat or vehicle" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Input type="date" className="w-[150px]" value={day} onChange={(e) => setDay(e.target.value)} />
      </div>
      <Chips className="mt-3" value={type} onChange={setType} options={[{ value: 'all', label: 'All' }, ...Object.entries(VISITOR_TYPES).map(([k, l]) => ({ value: k, label: l }))]} />
      <div className="space-y-3 mt-3">
        {list.map((v) => <VisitorRow key={v.id} v={v} showApt />)}
        {!list.length && <Empty icon={Search} title="No entries" text={day ? 'Try another date, or clear the date to see all.' : ''} action={day && <Button variant="secondary" onClick={() => setDay('')}>Show all dates</Button>} />}
      </div>
    </Page>
  )
}
