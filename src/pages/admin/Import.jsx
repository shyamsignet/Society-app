import { useRef, useState } from 'react'
import { Upload, Download, CheckCircle2, AlertCircle, FileSpreadsheet, Users, Building } from 'lucide-react'
import { Page, Card, Tabs, Button, Textarea, Badge, Empty, Toggle, useToast } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { useData, db } from '../../lib/db'
import { can, ROLES } from '../../lib/rbac'
import { parseCSV } from '../../lib/csv'
import { downloadCSV, uid, inr, ymOf, cls } from '../../lib/utils'
import { flatKey, normFlatNumber, newFlatId, cleanTower, towerLabel } from '../../lib/flats'

const COLORS = ['#F97316', '#0EA5E9', '#8B5CF6', '#EC4899', '#14B8A6', '#EAB308', '#6366F1', '#EF4444', '#22C55E', '#06B6D4']
const ROLE_ALIASES = { '': 'resident', resident: 'resident', member: 'resident', chairman: 'chairman', chairperson: 'chairman', president: 'chairman', secretary: 'secretary', treasurer: 'treasurer', committee: 'committee', committee_member: 'committee', facility_manager: 'facility_manager', manager: 'facility_manager', security: 'security', guard: 'security', security_guard: 'security', super_admin: 'super_admin', admin: 'super_admin' }
const digits = (s) => (s || '').replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '')

export default function Import() {
  const { user } = useAuth()
  const [tab, setTab] = useState('residents')
  if (!can(user, 'residents.manage')) return <Page title="Import" back="/admin"><Empty title="Not allowed" /></Page>
  return (
    <Page title="Import from spreadsheet" subtitle="Excel / Google Sheets → Save as CSV" back="/admin">
      <Tabs className="mt-1" value={tab} onChange={setTab} tabs={[{ value: 'residents', label: 'Residents' }, { value: 'flats', label: 'Flats' }]} />
      {tab === 'residents' ? <Residents /> : <Flats />}
    </Page>
  )
}

function Source({ onRows, template, hint }) {
  const ref = useRef()
  const [text, setText] = useState('')
  const read = (t) => { setText(t); onRows(parseCSV(t)) }
  return (
    <Card className="p-4 mt-4">
      <div className="flex items-start gap-3">
        <FileSpreadsheet className="text-accent-600 shrink-0" />
        <p className="text-sm text-ink-700">{hint}</p>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <Button variant="outline" size="sm" icon={Download} onClick={template}>Template</Button>
        <Button variant="secondary" size="sm" icon={Upload} onClick={() => ref.current.click()}>Choose CSV file</Button>
      </div>
      <input ref={ref} type="file" accept=".csv,text/csv,text/plain" hidden onChange={async (e) => { const f = e.target.files[0]; e.target.value = ''; if (f) read(await f.text()) }} />
      <Textarea className="mt-3 font-mono text-xs" rows={4} placeholder="…or paste the rows here (first line = column names)" value={text} onChange={(e) => read(e.target.value)} />
    </Card>
  )
}

function Residents() {
  const toast = useToast()
  const apts = useData((d) => d.list('apartments'))
  const users = useData((d) => d.list('users'))
  const [rows, setRows] = useState([])
  const [done, setDone] = useState(null)
  const byFlat = new Map(apts.map((a) => [flatKey(a.number), a]))
  const byPhone = new Map(users.filter((u) => u.phone).map((u) => [digits(u.phone).slice(-10), u]))
  const seen = new Set()
  const checked = rows.map((r) => {
    const apt = byFlat.get(flatKey(r.flat || r.flat_no || r.apartment || r.unit))
    const phone = digits(r.mobile || r.phone || r.mobile_number).slice(-10)
    const role = ROLE_ALIASES[(r.role || '').toLowerCase().replace(/[^a-z]+/g, '_')]
    const occ = (r.owner_tenant || r.occupancy || r.type || 'owner').toLowerCase().startsWith('t') ? 'tenant' : 'owner'
    const opening = Number(String(r.opening_balance || r.dues || r.outstanding || '0').replace(/[₹,\s]/g, '')) || 0
    const errs = []
    if (!(r.name || '').trim()) errs.push('name missing')
    if (!apt && role !== 'security' && role !== 'facility_manager') errs.push(`flat “${r.flat || ''}” not found`)
    if (!/^\d{10}$/.test(phone) && !(r.email || '').includes('@')) errs.push('needs a 10-digit mobile or an email')
    if (role === undefined) errs.push(`unknown role “${r.role}”`)
    if (phone && seen.has(phone)) errs.push('mobile repeated in file')
    if (opening < 0) errs.push('opening balance cannot be negative')
    if (phone) seen.add(phone)
    const existing = phone ? byPhone.get(phone) : null
    return { line: r._line, name: (r.name || '').trim(), apt, phone, email: (r.email || '').trim(), role: role || 'resident', occ, opening, errs, existing }
  })
  const good = checked.filter((r) => !r.errs.length)
  const template = () => downloadCSV('residents-template.csv', [['flat', 'name', 'mobile', 'email', 'owner_tenant', 'role', 'opening_balance'], ['A-101', 'Sunita Patil', '9822012345', 'sunita@example.com', 'owner', 'resident', '0'], ['A-102', 'Rakesh Shah', '9822098765', '', 'tenant', 'treasurer', '4500'], ['', 'Ramesh Yadav', '9730055511', '', '', 'security', '']])
  const run = () => {
    const now = new Date()
    const due = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59).toISOString()
    let added = 0, updated = 0, balances = 0
    for (const r of good) {
      // never demote a Super Admin through a spreadsheet
      const base = { name: r.name, phone: r.phone ? '+91 ' + r.phone : '', email: r.email, apartmentId: r.apt?.id || null, role: r.existing?.role === 'super_admin' ? 'super_admin' : r.role, status: 'active' }
      if (r.existing) { db.update('users', r.existing.id, base); updated++ }
      else {
        db.insert('users', { id: 'u_' + uid(), ...base, color: COLORS[(added + r.line) % COLORS.length], avatar: null, bio: '', family: [], vehicles: [], emergencyContact: null, joinedAt: now.toISOString(),
          privacy: { showPhone: false, showEmail: false, showApartment: true, showFamily: false, showInDirectory: true },
          prefs: { announcements: true, payments: true, complaints: true, visitors: true, bookings: true, events: true, social: true, marketplace: true, push: false, email: false, sms: false } })
        added++
      }
      if (r.apt && r.apt.occupancy !== r.occ) db.update('apartments', r.apt.id, { occupancy: r.occ })
      if (r.apt && r.opening > 0 && !db.get('bills', 'bill_opening_' + r.apt.number)) {
        db.insert('bills', { id: 'bill_opening_' + r.apt.number, apartmentId: r.apt.id, month: ymOf(now), title: 'Opening balance', items: [{ label: 'Opening balance (carried forward)', amount: r.opening }], adjustments: [], lateFee: 0, amount: r.opening, dueDate: due, status: 'unpaid' })
        balances++
      }
    }
    setDone({ added, updated, balances })
    setRows([])
    toast(`${added + updated} residents imported`)
  }
  return (
    <>
      <Source onRows={(r) => { setRows(r); setDone(null) }} template={template} hint="Columns: flat, name, mobile, email, owner_tenant, role, opening_balance. One row per person (add family members as extra rows with the same flat). Residents then log in with their mobile number — no invite needed." />
      {done && <Card className="p-4 mt-4 bg-accent-50 text-accent-800 text-sm font-semibold flex gap-2"><CheckCircle2 size={18} /> {done.added} added · {done.updated} updated · {done.balances} opening balances created</Card>}
      {checked.length > 0 && (
        <>
          <div className="flex items-center justify-between mt-5 mb-2">
            <div className="text-sm font-bold">{good.length} ready · <span className={checked.length - good.length ? 'text-red-600' : ''}>{checked.length - good.length} with problems</span></div>
            <Button size="sm" variant="success" icon={Users} disabled={!good.length} onClick={run}>Import {good.length}</Button>
          </div>
          <Card className="divide-y divide-ink-100 overflow-hidden">
            {checked.map((r) => (
              <div key={r.line} className={cls('px-4 py-2.5 text-sm', r.errs.length && 'bg-red-50/60')}>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-ink-400 w-8">#{r.line}</span>
                  <span className="font-semibold flex-1 truncate">{r.name || '—'}</span>
                  {r.apt && <Badge color="blue">{r.apt.number}</Badge>}
                  {r.role !== 'resident' && <Badge color="purple">{ROLES[r.role]}</Badge>}
                  {r.errs.length ? <AlertCircle size={16} className="text-red-500" /> : <CheckCircle2 size={16} className="text-accent-600" />}
                </div>
                <div className="text-xs text-ink-500 ml-10">{r.phone && '+91 ' + r.phone}{r.email && ` · ${r.email}`}{r.occ === 'tenant' && ' · tenant'}{r.opening > 0 && ` · dues ${inr(r.opening)}`}{r.existing && ' · will update existing'}</div>
                {r.errs.length > 0 && <div className="text-xs text-red-600 ml-10">{r.errs.join(' · ')}</div>}
              </div>
            ))}
          </Card>
        </>
      )}
    </>
  )
}

function Flats() {
  const toast = useToast()
  const apts = useData((d) => d.list('apartments'))
  const towers = useData((d) => d.list('towers'))
  const [rows, setRows] = useState([])
  const [replace, setReplace] = useState(false)
  const byKey = new Map(apts.map((a) => [flatKey(a.number), a]))
  const seen = new Set()
  const checked = rows.map((r) => {
    const number = normFlatNumber(r.flat || r.flat_no || r.number)
    const tower = cleanTower(r.tower || r.wing || (number.includes('-') ? number.split('-')[0] : ''))
    const errs = []
    if (!number) errs.push('flat number missing')
    if (seen.has(flatKey(number))) errs.push('repeated in file')
    seen.add(flatKey(number))
    return { line: r._line, number, tower, floor: Number(r.floor) || Number((number.split('-')[1] || '').slice(0, -2)) || 0, type: r.type || r.bhk || '', area: Number(String(r.area || r.area_sqft || r.sqft || 0).replace(/[^\d.]/g, '')) || 0, errs, existing: byKey.get(flatKey(number)), exists: byKey.has(flatKey(number)) }
  })
  const good = checked.filter((r) => !r.errs.length && (replace || !r.exists))
  const template = () => downloadCSV('flats-template.csv', [['flat', 'tower', 'floor', 'type', 'area_sqft'], ['A-101', 'A', '1', '2 BHK', '1050'], ['A-102', 'A', '1', '3 BHK', '1450'], ['SHOP-1', 'Shops', '0', 'Shop', '400']])
  const run = () => {
    for (const t of new Set(good.map((r) => r.tower))) if (t && !towers.some((x) => x.code === t)) db.insert('towers', { id: newFlatId(t, new Set(towers.map((x) => x.id))).replace(/^apt_/, 'tw_'), code: t, name: towerLabel(t), floors: Math.max(...good.filter((r) => r.tower === t).map((r) => r.floor)) })
    const taken = new Set(apts.map((a) => a.id))
    for (const r of good) {
      const rec = { number: r.number, tower: r.tower, floor: r.floor, type: r.type, area: r.area }
      if (r.existing) db.update('apartments', r.existing.id, rec)
      else { const id = newFlatId(r.number, taken); taken.add(id); db.insert('apartments', { id, ...rec, occupancy: 'owner' }) }
    }
    toast(`${good.length} flats saved`)
    setRows([])
  }
  return (
    <>
      <Source onRows={setRows} template={template} hint="Columns: flat, tower, floor, type, area_sqft. Use this when flat numbers or sizes vary, or to correct areas used for maintenance billing." />
      <Card className="px-4 mt-3"><Toggle checked={replace} onChange={setReplace} label="Update flats that already exist" desc={`${apts.length} flats in the society now`} /></Card>
      {checked.length > 0 && (
        <>
          <div className="flex items-center justify-between mt-5 mb-2">
            <div className="text-sm font-bold">{good.length} to save · {checked.filter((r) => r.exists && !replace).length} already exist</div>
            <Button size="sm" variant="success" icon={Building} disabled={!good.length} onClick={run}>Save {good.length}</Button>
          </div>
          <Card className="divide-y divide-ink-100 overflow-hidden">
            {checked.slice(0, 300).map((r) => (
              <div key={r.line} className={cls('px-4 py-2 text-sm flex items-center gap-2', r.errs.length && 'bg-red-50/60')}>
                <span className="font-semibold w-24">{r.number}</span>
                <span className="text-xs text-ink-500 flex-1">{r.tower} · floor {r.floor} · {r.type} · {r.area} sq.ft{r.errs.length ? ` · ${r.errs.join(', ')}` : ''}</span>
                {r.exists && <Badge color="gray">exists</Badge>}
              </div>
            ))}
          </Card>
        </>
      )}
    </>
  )
}
