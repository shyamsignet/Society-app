// Shown after login when the person is not yet part of a society:
//  • Join – ask to be added to a flat (the committee approves it)
//  • Set up – create a brand-new society (the creator becomes Super Admin)
import { useEffect, useMemo, useState } from 'react'
import { Building2, CheckCircle2, Clock, LogOut, Plus, RefreshCw, Trash2, Users, Wallet, Dumbbell, ArrowLeft, ArrowRight } from 'lucide-react'
import { Button, Card, Field, Input, Select, Tabs, Toggle, useToast } from '../components/ui'
import { Hero } from './Login'
import { useAuth } from '../lib/auth'
import { api } from '../lib/cloud'
import { DEFAULT_SOCIETY } from '../lib/config'
import { db } from '../lib/db'
import { uid, cls } from '../lib/utils'

export default function Onboarding() {
  const { logout, enter } = useAuth()
  const [view, setView] = useState('home')
  const [regs, setRegs] = useState(null)
  const load = () => api.myRegistrations().then(setRegs).catch(() => setRegs([]))
  useEffect(() => { load() }, [])
  if (view === 'setup') return <Setup onBack={() => setView('home')} />
  const pendingReg = regs?.find((r) => r.status === 'pending')
  const rejected = regs?.find((r) => r.status === 'rejected')
  return (
    <div className="min-h-full flex flex-col">
      <Hero title="Welcome to Sociyo" sub="Let’s connect you to your society" />
      <div className="flex-1 -mt-14 px-4 pb-10 relative space-y-3">
        {pendingReg ? (
          <Card className="p-5 text-center">
            <Clock size={44} className="mx-auto text-amber-500" />
            <h2 className="text-lg font-bold mt-3">Request submitted</h2>
            <p className="text-sm text-ink-500 mt-1">{pendingReg.societyName} · waiting for the committee to approve your request. You’ll be able to log in once approved.</p>
            <Button className="mt-4" variant="secondary" icon={RefreshCw} onClick={() => enter()}>Check again</Button>
          </Card>
        ) : view === 'join' ? <Join onBack={() => setView('home')} onDone={load} /> : (
          <>
            {rejected && <Card className="p-4 text-sm text-red-700 bg-red-50">Your earlier request to join {rejected.societyName} was not approved. Please contact the society office.</Card>}
            <Card className="p-5">
              <h2 className="text-lg font-bold">You’re not linked to a society yet</h2>
              <p className="text-sm text-ink-500 mt-1">If your society already uses Sociyo, ask to join your flat. If you are setting it up for your committee, create the society.</p>
              <div className="grid gap-3 mt-5">
                <button onClick={() => setView('join')} className="text-left p-4 rounded-2xl border-2 border-ink-200 hover:border-brand-500 flex items-center gap-3">
                  <span className="h-11 w-11 rounded-xl bg-brand-50 text-brand-700 grid place-items-center"><Users size={20} /></span>
                  <span className="flex-1"><span className="block font-bold">Join my society</span><span className="text-xs text-ink-500">I live here – add me to my flat</span></span>
                  <ArrowRight size={18} className="text-ink-400" />
                </button>
                <button onClick={() => setView('setup')} className="text-left p-4 rounded-2xl border-2 border-ink-200 hover:border-brand-500 flex items-center gap-3">
                  <span className="h-11 w-11 rounded-xl bg-accent-50 text-accent-700 grid place-items-center"><Building2 size={20} /></span>
                  <span className="flex-1"><span className="block font-bold">Set up a new society</span><span className="text-xs text-ink-500">For the committee / society office</span></span>
                  <ArrowRight size={18} className="text-ink-400" />
                </button>
              </div>
            </Card>
          </>
        )}
        <Button variant="ghost" block icon={LogOut} onClick={logout}>Log out</Button>
      </div>
    </div>
  )
}

function Join({ onBack, onDone }) {
  const toast = useToast()
  const [code, setCode] = useState(DEFAULT_SOCIETY)
  const [dir, setDir] = useState(null)
  const [f, setF] = useState({ name: '', email: '', tower: '', apartmentId: '', occupancy: 'owner' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const find = async (c = code) => {
    setErr(''); setBusy(true)
    try {
      const d = await api.societyDirectory(c.trim().toLowerCase())
      if (!d?.society) throw new Error('No society found with that code.')
      setDir(d); setF((x) => ({ ...x, tower: d.towers[0]?.code || '' }))
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  useEffect(() => { if (DEFAULT_SOCIETY) find(DEFAULT_SOCIETY) }, [])
  const flats = (dir?.apartments || []).filter((a) => !f.tower || a.tower === f.tower).sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
  const submit = async () => {
    setErr(''); setBusy(true)
    try {
      await api.submitRegistration(code.trim().toLowerCase(), { name: f.name, email: f.email, apartmentId: f.apartmentId, occupancy: f.occupancy })
      toast('Request sent – the committee will approve it')
      onDone()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <Card className="p-5">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-ink-500 mb-3"><ArrowLeft size={16} /> Back</button>
      <h2 className="text-lg font-bold">Join my society</h2>
      {!dir ? (
        <>
          <p className="text-sm text-ink-500 mb-4">Enter the society code shared by your committee (it’s on the flyer).</p>
          <Field label="Society code" error={err}><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. palm-grove-baner" autoCapitalize="none" /></Field>
          <Button block loading={busy} onClick={() => find()} disabled={!code.trim()}>Find society</Button>
        </>
      ) : (
        <>
          <p className="text-sm text-ink-500 mb-4"><b className="text-ink-900">{dir.society.name}</b>{dir.society.city && ` · ${dir.society.city}`}</p>
          <Field label="Full name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="As per sale deed / rent agreement" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tower"><Select value={f.tower} onChange={(e) => setF({ ...f, tower: e.target.value, apartmentId: '' })}>{dir.towers.map((t) => <option key={t.code} value={t.code}>{t.name}</option>)}</Select></Field>
            <Field label="Flat"><Select value={f.apartmentId} onChange={(e) => setF({ ...f, apartmentId: e.target.value })}><option value="">Select</option>{flats.map((a) => <option key={a.id} value={a.id}>{a.number}</option>)}</Select></Field>
          </div>
          <Field label="I am the"><Tabs tabs={[{ value: 'owner', label: 'Owner' }, { value: 'tenant', label: 'Tenant' }]} value={f.occupancy} onChange={(v) => setF({ ...f, occupancy: v })} /></Field>
          <Field label="Email (optional)"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          {err && <p className="text-sm text-red-600 mb-3">{err}</p>}
          <Button block size="lg" loading={busy} onClick={submit} disabled={!f.name.trim() || !f.apartmentId}>Submit for approval</Button>
        </>
      )}
    </Card>
  )
}

/* ---------------- Society setup wizard ---------------- */
const STD_FACILITIES = [
  ['Clubhouse', '🏛️', 2, 0, false], ['Gym', '🏋️', 1, 0, false], ['Swimming Pool', '🏊', 1, 0, false], ['Community Hall', '🎉', 4, 3000, true],
  ['Badminton Court', '🏸', 1, 0, false], ['Guest Room', '🛏️', 24, 1500, true], ['Party Hall', '🥳', 3, 1500, true], ['Rooftop Area', '🌇', 2, 500, true]
]
const COLORS = ['#6366F1', '#EF4444', '#0EA5E9', '#F97316', '#22C55E', '#8B5CF6', '#EC4899', '#EAB308']
const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
const initials = (s) => s.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).map((w) => w[0]).join('').toUpperCase().slice(0, 3) || 'SS'
export const flatNumber = (tower, floor, n, pad) => `${tower}-${floor}${String(n).padStart(pad, '0')}`

function Setup({ onBack }) {
  const { enter, logout } = useAuth()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [s, setS] = useState({ name: '', city: '', address: '', regNo: '', officePhone: '', officeEmail: '', securityPhone: '', code: '', codeTouched: false })
  const [towers, setTowers] = useState([{ code: 'A', floors: 7, perFloor: 4, area: 1050, type: '2 BHK' }])
  const [skipFlats, setSkipFlats] = useState(false)
  const [me, setMe] = useState({ name: '', apartment: '' })
  const [bill, setBill] = useState({ mode: 'sqft', rate: 3, fixed: 2500, dueDay: 10, lateFee: 250, sinking: 500, water: 0 })
  const [fac, setFac] = useState(STD_FACILITIES.slice(0, 4).map((x) => x[0]))
  const set = (k) => (e) => setS((x) => ({ ...x, [k]: e.target.value, ...(k === 'name' && !x.codeTouched ? { code: slug(e.target.value) } : {}) }))
  const pad = 2
  const apartments = useMemo(() => skipFlats ? [] : towers.flatMap((t) => Array.from({ length: Number(t.floors) || 0 }, (_, i) => i + 1).flatMap((floor) => Array.from({ length: Number(t.perFloor) || 0 }, (_, j) => {
    const number = flatNumber(t.code.trim().toUpperCase(), floor, j + 1, pad)
    return { id: 'apt_' + number, number, tower: t.code.trim().toUpperCase(), floor, type: t.type, area: Number(t.area) || 0, occupancy: 'owner' }
  }))), [towers, skipFlats, pad])

  const steps = ['Society', 'Towers & flats', 'You', 'Maintenance & amenities']
  const next = () => {
    setErr('')
    if (step === 0 && (!s.name.trim() || !/^[a-z0-9][a-z0-9_-]{2,39}$/.test(s.code))) return setErr(!s.name.trim() ? 'Enter the society name.' : 'Society code: 3–40 lowercase letters, numbers or dashes.')
    if (step === 1 && !skipFlats && (!apartments.length || new Set(apartments.map((a) => a.id)).size !== apartments.length)) return setErr('Check the towers: each tower needs a unique code, floors and flats per floor.')
    if (step === 2 && !me.name.trim()) return setErr('Enter your name.')
    setStep(step + 1)
  }

  const create = async () => {
    setErr(''); setBusy(true)
    const code = s.code
    try {
      const prefix = initials(s.name)
      await api.createSociety(code, { name: s.name.trim(), short: s.name.trim().split(/\s+/).slice(0, 2).join(' '), city: s.city.trim(), address: s.address.trim(), regNo: s.regNo.trim(), officePhone: s.officePhone.trim(), officeEmail: s.officeEmail.trim(), prefix, logoEmoji: '🏢' },
        { id: 'u_' + uid(), name: me.name.trim(), apartmentId: me.apartment || null, color: '#0EA5E9', bio: '', family: [], vehicles: [], emergencyContact: null, joinedAt: new Date().toISOString(),
          privacy: { showPhone: true, showEmail: false, showApartment: true, showFamily: false, showInDirectory: true },
          prefs: { announcements: true, payments: true, complaints: true, visitors: true, bookings: true, events: true, social: true, marketplace: true, push: false, email: false, sms: false } })
      await enter(code)
      const now = new Date().toISOString()
      const towerRows = [...new Set(apartments.map((a) => a.tower))].map((c) => ({ id: 'tw_' + c, code: c, name: 'Tower ' + c, floors: Math.max(...apartments.filter((a) => a.tower === c).map((a) => a.floor)) }))
      towerRows.forEach((t) => db.insert('towers', t))
      apartments.forEach((a) => db.insert('apartments', { ...a, createdAt: now }))
      db.insert('settings', { id: 'billing', value: {
        ratePerSqft: bill.mode === 'sqft' ? Number(bill.rate) : 0, dueDay: Number(bill.dueDay), lateFeeType: 'flat', lateFee: Number(bill.lateFee),
        items: [bill.mode === 'fixed' && { id: 'i0', label: 'Maintenance charges', amount: Number(bill.fixed) }, Number(bill.sinking) && { id: 'i1', label: 'Sinking Fund', amount: Number(bill.sinking) }, Number(bill.water) && { id: 'i2', label: 'Water Charges', amount: Number(bill.water) }].filter(Boolean)
      } })
      db.insert('settings', { id: 'ticketSeq', value: 1000 })
      STD_FACILITIES.filter((x) => fac.includes(x[0])).forEach(([name, emoji, slotHours, charge, requiresApproval], i) => db.insert('facilities', {
        id: 'fa_' + slug(name), name, emoji, slotHours, charge, chargeUnit: slotHours === 24 ? 'day' : 'slot', requiresApproval, active: true,
        open: slotHours === 24 ? 12 : name === 'Gym' || name === 'Swimming Pool' || name === 'Badminton Court' ? 6 : 9, close: slotHours === 24 ? 12 : 22,
        capacity: name === 'Community Hall' ? 150 : name === 'Gym' ? 12 : 30, rules: requiresApproval ? ['Booking subject to committee approval'] : ['Keep the space clean'], color: COLORS[i % COLORS.length] }))
      const contacts = [
        s.officePhone && ['Society', 'Management Office', s.officePhone, 'Society office', 'building'],
        s.securityPhone && ['Society', 'Security Desk (Main Gate)', s.securityPhone, '24 × 7', 'shield'],
        ['Emergency', 'National Emergency', '112', 'All emergencies', 'siren'], ['Emergency', 'Ambulance', '108', 'Medical emergency', 'ambulance'],
        ['Emergency', 'Fire Brigade', '101', 'Fire emergency', 'flame'], ['Emergency', 'Police', '100', '', 'badge']
      ].filter(Boolean)
      contacts.forEach(([group, name, phone, note, icon]) => db.insert('contacts', { id: 'c_' + uid(), group, name, phone, note, icon }))
      toast('Society created! Next: import your residents.')
      window.location.hash = '#/admin/import'
    } catch (e) {
      setErr(e.message || 'Could not create the society.')
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-full flex flex-col">
      <Hero title="Set up your society" sub={`Step ${step + 1} of ${steps.length} · ${steps[step]}`} />
      <div className="flex-1 -mt-14 px-4 pb-10 relative">
        <Card className="p-5">
          <div className="flex gap-1.5 mb-5">{steps.map((_, i) => <span key={i} className={cls('h-1.5 flex-1 rounded-full', i <= step ? 'bg-brand-600' : 'bg-ink-200')} />)}</div>

          {step === 0 && (
            <>
              <Field label="Society name"><Input value={s.name} onChange={set('name')} placeholder="e.g. Shanti Nagar Co-op Housing Society" /></Field>
              <Field label="Society code" hint="Residents type this to join. Lowercase letters, numbers and dashes."><Input value={s.code} onChange={(e) => setS({ ...s, code: e.target.value.toLowerCase(), codeTouched: true })} autoCapitalize="none" /></Field>
              <Field label="Area / city"><Input value={s.city} onChange={set('city')} placeholder="e.g. Kothrud, Pune" /></Field>
              <Field label="Full address"><Input value={s.address} onChange={set('address')} /></Field>
              <Field label="Registration no. (optional)"><Input value={s.regNo} onChange={set('regNo')} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Office phone"><Input inputMode="tel" value={s.officePhone} onChange={set('officePhone')} /></Field>
                <Field label="Security desk phone"><Input inputMode="tel" value={s.securityPhone} onChange={set('securityPhone')} /></Field>
              </div>
              <Field label="Office email (optional)"><Input type="email" value={s.officeEmail} onChange={set('officeEmail')} /></Field>
            </>
          )}

          {step === 1 && (
            <>
              <p className="text-sm text-ink-500 mb-4">Describe each tower/wing. Flats are numbered like <b>A-101</b>, <b>A-102</b> … You can fix individual flats later or import them from a spreadsheet instead.</p>
              {!skipFlats && towers.map((t, i) => (
                <div key={i} className="rounded-2xl border border-ink-200 p-3 mb-3">
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Tower code" className="mb-2"><Input value={t.code} maxLength={4} onChange={(e) => setTowers(towers.map((x, j) => (j === i ? { ...x, code: e.target.value.toUpperCase() } : x)))} /></Field>
                    <Field label="Floors" className="mb-2"><Input type="number" min={1} max={60} value={t.floors} onChange={(e) => setTowers(towers.map((x, j) => (j === i ? { ...x, floors: e.target.value } : x)))} /></Field>
                    <Field label="Flats / floor" className="mb-2"><Input type="number" min={1} max={30} value={t.perFloor} onChange={(e) => setTowers(towers.map((x, j) => (j === i ? { ...x, perFloor: e.target.value } : x)))} /></Field>
                  </div>
                  <div className="grid grid-cols-[1fr_1fr_40px] gap-2 items-end">
                    <Field label="Usual type" className="mb-0"><Select value={t.type} onChange={(e) => setTowers(towers.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}>{['1 RK', '1 BHK', '2 BHK', '3 BHK', '4 BHK', 'Shop', 'Office'].map((x) => <option key={x}>{x}</option>)}</Select></Field>
                    <Field label="Area (sq.ft)" className="mb-0"><Input type="number" min={0} value={t.area} onChange={(e) => setTowers(towers.map((x, j) => (j === i ? { ...x, area: e.target.value } : x)))} /></Field>
                    <button aria-label="Remove tower" disabled={towers.length === 1} onClick={() => setTowers(towers.filter((_, j) => j !== i))} className="h-12 grid place-items-center text-ink-400 disabled:opacity-30"><Trash2 size={17} /></button>
                  </div>
                </div>
              ))}
              {!skipFlats && <Button variant="ghost" size="sm" icon={Plus} onClick={() => setTowers([...towers, { ...towers[towers.length - 1], code: String.fromCharCode((towers[towers.length - 1].code.charCodeAt(0) || 64) + 1) }])}>Add tower</Button>}
              {!skipFlats && <p className="text-sm font-semibold mt-3">{apartments.length} flats · {apartments.slice(0, 3).map((a) => a.number).join(', ')}{apartments.length > 3 && ' …'}</p>}
              <div className="mt-3 border-t border-ink-100"><Toggle checked={skipFlats} onChange={setSkipFlats} label="I’ll import flats from a spreadsheet" desc="Use this if flat numbers or sizes vary a lot" /></div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm text-ink-500 mb-4">You’ll be the <b>Super Admin</b> – you can give committee roles (Chairman, Secretary, Treasurer…) to others after importing residents.</p>
              <Field label="Your name"><Input value={me.name} onChange={(e) => setMe({ ...me, name: e.target.value })} /></Field>
              <Field label="Your flat (optional)" hint="Leave empty if you are society office staff">
                <Select value={me.apartment} onChange={(e) => setMe({ ...me, apartment: e.target.value })}><option value="">— Not a resident —</option>{apartments.map((a) => <option key={a.id} value={a.id}>{a.number}</option>)}</Select>
              </Field>
            </>
          )}

          {step === 3 && (
            <>
              <div className="font-bold text-sm mb-2 flex items-center gap-2"><Wallet size={16} /> Monthly maintenance</div>
              <Tabs className="mb-3" value={bill.mode} onChange={(v) => setBill({ ...bill, mode: v })} tabs={[{ value: 'sqft', label: 'Per sq.ft' }, { value: 'fixed', label: 'Fixed per flat' }]} />
              <div className="grid grid-cols-2 gap-3">
                {bill.mode === 'sqft'
                  ? <Field label="Rate per sq.ft (₹)"><Input type="number" step="0.1" value={bill.rate} onChange={(e) => setBill({ ...bill, rate: e.target.value })} /></Field>
                  : <Field label="Amount per flat (₹)"><Input type="number" value={bill.fixed} onChange={(e) => setBill({ ...bill, fixed: e.target.value })} /></Field>}
                <Field label="Due day of month"><Input type="number" min={1} max={28} value={bill.dueDay} onChange={(e) => setBill({ ...bill, dueDay: e.target.value })} /></Field>
                <Field label="Sinking fund (₹)"><Input type="number" value={bill.sinking} onChange={(e) => setBill({ ...bill, sinking: e.target.value })} /></Field>
                <Field label="Late fee (₹)"><Input type="number" value={bill.lateFee} onChange={(e) => setBill({ ...bill, lateFee: e.target.value })} /></Field>
              </div>
              <p className="text-xs text-ink-500 -mt-2 mb-4">More charges (water, parking…) can be added later in Admin → Maintenance billing.</p>
              <div className="font-bold text-sm mb-2 flex items-center gap-2"><Dumbbell size={16} /> Amenities residents can book</div>
              <div className="flex flex-wrap gap-2 mb-2">
                {STD_FACILITIES.map(([n, e]) => (
                  <button key={n} type="button" onClick={() => setFac(fac.includes(n) ? fac.filter((x) => x !== n) : [...fac, n])} className={cls('h-9 px-3 rounded-full text-[13px] font-semibold border', fac.includes(n) ? 'bg-brand-800 text-white border-brand-800' : 'bg-white border-ink-200')}>{e} {n}</button>
                ))}
              </div>
            </>
          )}

          {err && <p className="text-sm text-red-600 mt-3">{err}</p>}
          <div className="flex gap-2 mt-5">
            <Button variant="outline" onClick={() => (step ? setStep(step - 1) : onBack())} icon={ArrowLeft}>Back</Button>
            {step < steps.length - 1
              ? <Button block onClick={next}>Next</Button>
              : <Button block variant="success" loading={busy} icon={CheckCircle2} onClick={create}>Create society</Button>}
          </div>
        </Card>
        <Button variant="ghost" block className="mt-3" icon={LogOut} onClick={logout}>Log out</Button>
      </div>
    </div>
  )
}

