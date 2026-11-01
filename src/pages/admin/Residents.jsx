import { useState } from 'react'
import { Check, X, Search, UserX, UserCheck as UC, Plus, Trash2, Home } from 'lucide-react'
import { Page, Card, Tabs, Button, Input, Select, Sheet, Avatar, Badge, Empty, Field, useAction, useConfirm } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { useData } from '../../lib/db'
import { can, ROLES, roleLabel } from '../../lib/rbac'
import { approveRegistration, updateUser, aptNo, setMemberFlat, saveFlat, deleteFlat, flatUsage } from '../../lib/actions'
import { towerLabel, sortFlats, sortTowers } from '../../lib/flats'
import { timeAgo, cls, downloadCSV } from '../../lib/utils'

export default function Residents() {
  const { user } = useAuth()
  const act = useAction()
  const ask = useConfirm()
  const [tab, setTab] = useState('requests')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(null)
  const [flatSel, setFlatSel] = useState(null) // flat id, 'new', or null
  const regs = useData((d) => d.list('registrations', (r) => r.status === 'pending'))
  const users = useData((d) => d.list('users').sort((a, b) => aptNo(a.apartmentId).localeCompare(aptNo(b.apartmentId))))
  const apts = useData((d) => d.list('apartments').sort(sortFlats))
  const towerCodes = [...new Set(apts.map((a) => a.tower || ''))].sort(sortTowers)
  const occupied = new Map()
  users.filter((u) => u.apartmentId && u.status === 'active').forEach((u) => occupied.set(u.apartmentId, [...(occupied.get(u.apartmentId) || []), u]))
  if (!can(user, 'residents.manage')) return <Page title="Residents" back="/admin"><Empty title="Not allowed" /></Page>
  const list = users.filter((u) => !q || (u.name + aptNo(u.apartmentId) + u.phone).toLowerCase().includes(q.toLowerCase()))
  const u = sel && users.find((x) => x.id === sel)
  return (
    <Page title="Residents & apartments" back="/admin" actions={<><Button size="sm" variant="ghost" onClick={() => { window.location.hash = '#/admin/import' }}>Import</Button><Button size="sm" variant="secondary" onClick={() => downloadCSV('residents.csv', [['Name', 'Flat', 'Role', 'Phone', 'Email', 'Status'], ...users.map((x) => [x.name, aptNo(x.apartmentId), roleLabel(x.role), x.phone, x.email, x.status])])}>Export</Button></>}>
      <Tabs className="mt-1" value={tab} onChange={setTab} tabs={[{ value: 'requests', label: `Requests (${regs.length})`, count: regs.length }, { value: 'people', label: 'People' }, { value: 'flats', label: 'Flats' }]} />
      {tab === 'requests' && (
        <div className="space-y-3 mt-4">
          {regs.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-center gap-3">
                <Avatar name={r.name} size={44} />
                <div className="flex-1 min-w-0"><div className="font-bold">{r.name}</div><div className="text-xs text-ink-500">{r.phone}{r.email && ` · ${r.email}`}</div></div>
                <span className="text-[11px] text-ink-400">{timeAgo(r.createdAt)}</span>
              </div>
              <div className="flex gap-2 mt-3 text-xs"><Badge color="blue">{aptNo(r.apartmentId)}</Badge><Badge color="gray">{r.occupancy}</Badge>{occupied.get(r.apartmentId) && <Badge color="amber">Flat has {occupied.get(r.apartmentId).length} resident(s)</Badge>}</div>
              <div className="flex gap-2 mt-3">
                <Button variant="danger" block size="sm" icon={X} onClick={() => act(() => approveRegistration(user, r.id, false), 'Request rejected')}>Reject</Button>
                <Button variant="success" block size="sm" icon={Check} onClick={() => act(() => approveRegistration(user, r.id, true), `${r.name} approved – they can now log in`)}>Approve</Button>
              </div>
            </Card>
          ))}
          {!regs.length && <Empty icon={UC} title="No pending requests" text="New apartment registrations appear here for verification." />}
        </div>
      )}
      {tab === 'people' && (
        <>
          <div className="relative mt-3"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" /><Input className="pl-9" placeholder="Name, flat or phone" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Card className="mt-3 divide-y divide-ink-100 overflow-hidden">
            {list.map((x) => (
              <button key={x.id} onClick={() => setSel(x.id)} className={cls('w-full flex items-center gap-3 px-4 py-3 text-left active:bg-ink-100', x.status !== 'active' && 'opacity-50')}>
                <Avatar user={x} size={38} />
                <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate">{x.name}</div><div className="text-[11px] text-ink-500">{aptNo(x.apartmentId) || 'Staff'} · {x.phone}</div></div>
                {x.role !== 'resident' && <Badge color="purple">{roleLabel(x.role)}</Badge>}
                {x.status !== 'active' && <Badge color="red">Inactive</Badge>}
              </button>
            ))}
          </Card>
        </>
      )}
      {tab === 'flats' && (
        <>
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-ink-500">{apts.length} <span>flats</span> · <span>Tap a flat to rename, change or delete it</span></p>
            <Button size="sm" variant="secondary" icon={Plus} onClick={() => setFlatSel('new')}>Add flat</Button>
          </div>
          {!apts.length && <Empty icon={Home} title="No flats yet" text="Add flats one by one, or import them from a spreadsheet (Import → Flats)." />}
          {towerCodes.map((t) => (
            <div key={t || 'none'}>
              <div className="text-xs font-bold text-ink-400 uppercase tracking-wider mt-5 mb-2">{t ? towerLabel(t) : 'No tower'} · {apts.filter((a) => (a.tower || '') === t && occupied.has(a.id)).length}/{apts.filter((a) => (a.tower || '') === t).length} occupied</div>
              <div className="grid grid-cols-4 gap-2">
                {apts.filter((a) => (a.tower || '') === t).map((a) => {
                  const occ = occupied.get(a.id)
                  return (
                    <button key={a.id} onClick={() => setFlatSel(a.id)} title={occ?.map((x) => x.name).join(', ') || 'Vacant'} className={cls('rounded-xl p-2 text-center active:scale-95 transition', occ ? 'bg-white shadow-card' : 'bg-ink-100 text-ink-400')}>
                      <div className="text-[13px] font-extrabold truncate">{a.number}</div>
                      <div className="text-[10px] truncate">{occ ? `${occ[0].name.split(' ')[0]}${occ.length > 1 ? ` +${occ.length - 1}` : ''}` : 'Vacant'}</div>
                      <div className={cls('text-[9px] font-bold uppercase truncate', a.occupancy === 'tenant' ? 'text-violet-600' : 'text-ink-400')}>{a.type}{occ && a.occupancy === 'tenant' ? ' · T' : ''}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )}
      <FlatSheet id={flatSel} onClose={() => setFlatSel(null)} apts={apts} occupied={occupied} />
      <Sheet open={!!u} onClose={() => setSel(null)} title="Manage member">
        {u && (
          <>
            <div className="flex items-center gap-3 mb-4"><Avatar user={u} size={52} /><div><div className="font-bold">{u.name}</div><div className="text-xs text-ink-500">{aptNo(u.apartmentId) || 'Staff'} · {u.phone}</div></div></div>
            <Field label="Role" hint="Controls what this person can access in the app">
              <Select value={u.role} disabled={u.id === user.id} onChange={(e) => act(() => updateUser(user, u.id, { role: e.target.value }), 'Role updated')}>
                {Object.entries(ROLES).filter(([k]) => k !== 'super_admin' || user.role === 'super_admin').map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </Select>
            </Field>
            <MemberFlat key={u.id} u={u} apts={apts} />
            {u.id !== user.id && (u.status === 'active'
              ? <Button variant="danger" block icon={UserX} onClick={async () => { if (await ask({ title: `Deactivate ${u.name}?`, text: 'They will no longer be able to log in.', ok: 'Deactivate', danger: true })) act(() => updateUser(user, u.id, { status: 'inactive' }), 'Account deactivated') }}>Deactivate account</Button>
              : <Button variant="success" block onClick={() => act(() => updateUser(user, u.id, { status: 'active' }), 'Reactivated')}>Reactivate</Button>)}
          </>
        )}
      </Sheet>
    </Page>
  )
}

function MemberFlat({ u, apts }) {
  const { user } = useAuth()
  const act = useAction()
  const apt = apts.find((a) => a.id === u.apartmentId)
  const [f, setF] = useState({ apartmentId: u.apartmentId || '', occupancy: apt?.occupancy || 'owner' })
  const changed = f.apartmentId !== (u.apartmentId || '') || (f.apartmentId && f.occupancy !== (apts.find((a) => a.id === f.apartmentId)?.occupancy || 'owner'))
  const towers = [...new Set(apts.map((a) => a.tower || ''))].sort(sortTowers)
  return (
    <div className="rounded-2xl border border-ink-200 p-3 mb-4">
      <div className="grid grid-cols-[1fr_110px] gap-2">
        <Field label="Flat" className="mb-0">
          <Select value={f.apartmentId} onChange={(e) => setF({ apartmentId: e.target.value, occupancy: apts.find((a) => a.id === e.target.value)?.occupancy || 'owner' })}>
            <option value="">— No flat (office / staff) —</option>
            {towers.map((t) => <optgroup key={t || 'none'} label={t ? towerLabel(t) : 'Other'}>{apts.filter((a) => (a.tower || '') === t).map((a) => <option key={a.id} value={a.id}>{a.number}</option>)}</optgroup>)}
          </Select>
        </Field>
        <Field label="Lives as" className="mb-0">
          <Select value={f.occupancy} disabled={!f.apartmentId} onChange={(e) => setF({ ...f, occupancy: e.target.value })}><option value="owner">Owner</option><option value="tenant">Tenant</option></Select>
        </Field>
      </div>
      {changed && <Button block size="sm" className="mt-3" icon={Home} onClick={() => act(() => setMemberFlat(user, u.id, f.apartmentId || null, f.occupancy), f.apartmentId ? `${u.name} → ${apts.find((a) => a.id === f.apartmentId)?.number}` : 'Flat removed')}>Save flat</Button>}
    </div>
  )
}

function FlatSheet({ id, onClose, apts, occupied }) {
  const { user } = useAuth()
  const act = useAction()
  const ask = useConfirm()
  const a = id && id !== 'new' ? apts.find((x) => x.id === id) : null
  const blank = { number: '', tower: apts[apts.length - 1]?.tower || '', floor: '', type: apts[apts.length - 1]?.type || '2 BHK', area: apts[apts.length - 1]?.area || '', occupancy: 'owner' }
  const [f, setF] = useState(blank)
  const [openFor, setOpenFor] = useState(null)
  if (id !== openFor) { setOpenFor(id); setF(a ? { number: a.number, tower: a.tower || '', floor: a.floor ?? '', type: a.type || '', area: a.area || '', occupancy: a.occupancy || 'owner' } : blank) }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const people = a ? occupied.get(a.id) || [] : []
  const save = () => act(() => { saveFlat(user, a?.id || null, f); onClose() }, a ? 'Flat updated' : `Flat ${f.number.trim().toUpperCase()} added`)
  const remove = async () => {
    const used = Object.entries(flatUsage(a.id)).filter(([, v]) => v > 0)
    if (used.length) return act(() => deleteFlat(user, a.id))
    if (await ask({ title: `Delete flat ${a.number}?`, text: 'The flat is removed from the society. This cannot be undone.', ok: 'Delete', danger: true })) act(() => { deleteFlat(user, a.id); onClose() }, 'Flat deleted')
  }
  return (
    <Sheet open={!!id} onClose={onClose} title={a ? `Flat ${a.number}` : 'Add flat'} footer={<Button block onClick={save} disabled={!f.number.trim()}>{a ? 'Save changes' : 'Add flat'}</Button>}>
      {a && <p className="text-xs text-ink-500 mb-3">{people.length ? <><span>Residents</span>: <span translate="no">{people.map((x) => x.name).join(', ')}</span></> : <span>Vacant</span>} · <span>Renaming keeps its residents, bills and history.</span></p>}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Flat number" hint="Any format: A-101, G-02, 12B, Shop 3"><Input value={f.number} onChange={set('number')} autoCapitalize="characters" /></Field>
        <Field label="Tower / wing" hint="Leave empty if none"><Input value={f.tower} onChange={set('tower')} autoCapitalize="characters" maxLength={12} /></Field>
        <Field label="Floor" hint="Ground = 0"><Input type="number" inputMode="numeric" value={f.floor} onChange={set('floor')} /></Field>
        <Field label="Type"><Select value={f.type} onChange={set('type')}>{[...new Set(['1 RK', '1 BHK', '2 BHK', '3 BHK', '4 BHK', 'Penthouse', 'Row house', 'Villa', 'Shop', 'Office', f.type].filter(Boolean))].map((x) => <option key={x}>{x}</option>)}</Select></Field>
        <Field label="Area (sq.ft)" hint="Used for maintenance per sq.ft"><Input type="number" inputMode="numeric" min={0} value={f.area} onChange={set('area')} /></Field>
        <Field label="Occupied by"><Select value={f.occupancy} onChange={set('occupancy')}><option value="owner">Owner</option><option value="tenant">Tenant</option></Select></Field>
      </div>
      {a && <Button variant="ghost" block icon={Trash2} className="text-red-600 mt-1" onClick={remove}>Delete flat</Button>}
    </Sheet>
  )
}
