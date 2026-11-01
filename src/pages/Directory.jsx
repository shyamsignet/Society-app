import { useState } from 'react'
import { Search, Phone, Mail, MessageCircle, Building2, Shield, Wrench, Zap, Droplet, Sparkles, ArrowUpDown, Siren, Ambulance, Flame, BadgeCheck, Hospital, Lock, Crown } from 'lucide-react'
import { Page, Card, Chips, Avatar, Sheet, Empty, Badge, Tabs } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/db'
import { roleLabel, can } from '../lib/rbac'
import { aptNo, aptById } from '../lib/actions'
import { towerLabel, sortTowers } from '../lib/flats'
import { cls } from '../lib/utils'

const ICONS = { building: Building2, shield: Shield, wrench: Wrench, zap: Zap, droplet: Droplet, sparkles: Sparkles, 'arrow-up-down': ArrowUpDown, siren: Siren, ambulance: Ambulance, flame: Flame, badge: BadgeCheck, hospital: Hospital }
const COMMITTEE = ['chairman', 'secretary', 'treasurer', 'committee']
const tel = (p) => `tel:${p.replace(/\s/g, '')}`
const wa = (p) => `https://wa.me/${p.replace(/\D/g, '')}`

export default function Directory() {
  const { user } = useAuth()
  const [tab, setTab] = useState('residents')
  const [q, setQ] = useState('')
  const [tower, setTower] = useState('all')
  const [view, setView] = useState(null)
  const users = useData((d) => d.list('users', (u) => u.status === 'active' && u.apartmentId && (u.privacy?.showInDirectory !== false || u.id === user.id)))
  const committee = useData((d) => d.list('users', (u) => COMMITTEE.includes(u.role)))
  const contacts = useData((d) => d.list('contacts'))
  const staffAdmin = can(user, 'residents.manage')
  const towers = useData((d) => [...new Set(d.list('apartments').map((a) => a.tower || ''))].filter(Boolean).sort(sortTowers).join('|')).split('|').filter(Boolean)
  const s = q.trim().toLowerCase()
  const list = users
    .map((u) => ({ u, apt: aptNo(u.apartmentId), tw: aptById(u.apartmentId)?.tower || '' }))
    .filter(({ u, apt, tw }) => (tower === 'all' || tw === tower) && (!s || u.name.toLowerCase().includes(s) || ((u.privacy?.showApartment !== false || staffAdmin) && apt.toLowerCase().includes(s))))
    .sort((a, b) => sortTowers(a.tw, b.tw) || a.apt.localeCompare(b.apt, undefined, { numeric: true }))
  const groups = list.reduce((m, x) => { const k = x.tw; (m[k] = m[k] || []).push(x); return m }, {})

  return (
    <Page title="Directory" subtitle={`${users.length} residents · ${contacts.length} useful contacts`}>
      <Tabs className="mt-1" value={tab} onChange={setTab} tabs={[{ value: 'residents', label: 'Residents' }, { value: 'committee', label: 'Committee' }, { value: 'contacts', label: 'Contacts' }]} />
      {tab === 'residents' && (
        <>
          <div className="relative mt-3">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or flat (e.g. B-203)" className="w-full h-12 rounded-2xl bg-white shadow-card pl-10 pr-4 text-[15px] outline-none focus:ring-2 focus:ring-brand-200" />
          </div>
          <Chips className="mt-3" value={tower} onChange={setTower} options={[{ value: 'all', label: 'All towers' }, ...towers.map((t) => ({ value: t, label: towerLabel(t) }))]} />
          {Object.entries(groups).map(([t, rows]) => (
            <div key={t}>
              <div className="text-xs font-bold text-ink-400 uppercase tracking-wider mt-5 mb-2">{t ? towerLabel(t) : 'Residents'} · {rows.length}</div>
              <Card className="divide-y divide-ink-100 overflow-hidden">
                {rows.map(({ u, apt }) => {
                  const showApt = u.privacy?.showApartment !== false || staffAdmin || u.id === user.id
                  return (
                    <button key={u.id} onClick={() => setView(u)} className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-ink-100">
                      <Avatar user={u} size={42} />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{u.name}{u.id === user.id && <span className="text-ink-400 font-normal"> (you)</span>}</div>
                        <div className="text-xs text-ink-500">{showApt ? apt : 'Flat hidden'}{COMMITTEE.includes(u.role) && ` · ${roleLabel(u.role)}`}</div>
                      </div>
                      {u.privacy?.showPhone ? <a onClick={(e) => e.stopPropagation()} href={tel(u.phone)} aria-label="Call" className="h-9 w-9 rounded-full bg-accent-50 text-accent-700 grid place-items-center"><Phone size={16} /></a> : <Lock size={14} className="text-ink-300" />}
                    </button>
                  )
                })}
              </Card>
            </div>
          ))}
          {!list.length && <Empty icon={Search} title="No residents found" text="Try a different name or flat number." />}
        </>
      )}
      {tab === 'committee' && (
        <div className="space-y-2 mt-4">
          {committee.map((u) => (
            <Card key={u.id} className="p-4 flex items-center gap-3" onClick={() => setView(u)}>
              <Avatar user={u} size={48} />
              <div className="flex-1 min-w-0"><div className="font-bold">{u.name}</div><div className="text-xs text-ink-500">{aptNo(u.apartmentId)}</div><Badge color="blue" className="mt-1"><Crown size={10} /> {roleLabel(u.role)}</Badge></div>
              <a href={tel(u.phone)} aria-label="Call" className="h-10 w-10 rounded-full bg-accent-50 text-accent-700 grid place-items-center"><Phone size={18} /></a>
            </Card>
          ))}
        </div>
      )}
      {tab === 'contacts' && ['Emergency', 'Society', 'Maintenance'].map((g) => (
        <div key={g}>
          <div className="text-xs font-bold text-ink-400 uppercase tracking-wider mt-5 mb-2">{g}</div>
          <Card className="divide-y divide-ink-100 overflow-hidden">
            {contacts.filter((c) => c.group === g).map((c) => {
              const Icon = ICONS[c.icon] || Phone
              return (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={cls('h-10 w-10 rounded-xl grid place-items-center', g === 'Emergency' ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-700')}><Icon size={18} /></div>
                  <div className="flex-1 min-w-0"><div className="font-semibold text-[14px] truncate">{c.name}</div><div className="text-xs text-ink-500">{c.phone} · {c.note}</div></div>
                  <a href={tel(c.phone)} aria-label={`Call ${c.name}`} className={cls('h-10 w-10 rounded-full grid place-items-center', g === 'Emergency' ? 'bg-red-500 text-white' : 'bg-accent-50 text-accent-700')}><Phone size={17} /></a>
                </div>
              )
            })}
          </Card>
        </div>
      ))}

      <Sheet open={!!view} onClose={() => setView(null)}>
        {view && <Profile u={view} me={user} admin={staffAdmin} />}
      </Sheet>
    </Page>
  )
}

function Profile({ u, me, admin }) {
  const pv = u.privacy || {}
  const self = u.id === me.id
  const show = (k) => pv[k] || self || admin
  return (
    <div className="text-center pt-2">
      <Avatar user={u} size={80} className="mx-auto" />
      <div className="text-xl font-extrabold mt-3">{u.name}</div>
      <div className="text-sm text-ink-500">{show('showApartment') ? aptNo(u.apartmentId) : 'Flat number hidden'}{u.role !== 'resident' && ` · ${roleLabel(u.role)}`}</div>
      {u.bio && <p className="text-sm text-ink-700 mt-2">{u.bio}</p>}
      <div className="flex justify-center gap-3 mt-5">
        {show('showPhone') ? (
          <>
            <a href={tel(u.phone)} className="flex flex-col items-center gap-1 text-xs font-semibold text-ink-700"><span className="h-12 w-12 rounded-2xl bg-accent-50 text-accent-700 grid place-items-center"><Phone size={20} /></span>Call</a>
            <a href={wa(u.phone)} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-1 text-xs font-semibold text-ink-700"><span className="h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 grid place-items-center"><MessageCircle size={20} /></span>WhatsApp</a>
          </>
        ) : null}
        {show('showEmail') && <a href={`mailto:${u.email}`} className="flex flex-col items-center gap-1 text-xs font-semibold text-ink-700"><span className="h-12 w-12 rounded-2xl bg-brand-50 text-brand-700 grid place-items-center"><Mail size={20} /></span>Email</a>}
      </div>
      {!show('showPhone') && !show('showEmail') && <p className="text-xs text-ink-400 mt-2 flex items-center justify-center gap-1"><Lock size={12} /> Contact details are private</p>}
      {show('showPhone') && <p className="text-sm text-ink-700 mt-4">{u.phone}</p>}
      {show('showFamily') && u.family?.length > 0 && (
        <div className="text-left mt-5">
          <div className="text-xs font-bold text-ink-400 uppercase mb-2">Family</div>
          {u.family.map((f) => <div key={f.id} className="flex justify-between text-sm py-1"><span>{f.name}</span><span className="text-ink-500">{f.relation}</span></div>)}
        </div>
      )}
    </div>
  )
}
