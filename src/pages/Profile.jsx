import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, ChevronRight, Users, Car, HeartPulse, ShieldCheck, Bell, LogOut, RotateCcw, Pencil, Plus, Trash2, Download, Smartphone, Home as HomeIcon, Info, LayoutDashboard, Phone, Mail } from 'lucide-react'
import { Page, Card, Avatar, Sheet, Field, Input, Textarea, Select, Toggle, Button, Badge, useAction, useConfirm, useToast } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useData, db, resetDB } from '../lib/db'
import { roleLabel, can } from '../lib/rbac'
import { updateUser, aptById, devicePush } from '../lib/actions'
import { fileToDataUrl, uid, cls } from '../lib/utils'
import { DEMO } from '../lib/config'
import { storeMedia } from '../lib/media'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { canInstall, isStandalone, onInstallChange, promptInstall } from '../lib/install'

export default function Profile() {
  const { user, logout, society } = useAuth()
  const nav = useNavigate()
  const act = useAction()
  const ask = useConfirm()
  const toast = useToast()
  const fileRef = useRef()
  const [sheet, setSheet] = useState(null)
  const [installable, setInstallable] = useState(canInstall())
  useEffect(() => onInstallChange(() => setInstallable(canInstall())), [])
  const apt = useData(() => aptById(user.apartmentId))
  const flatmates = useData((d) => d.list('users', (u) => u.apartmentId && u.apartmentId === user.apartmentId && u.id !== user.id && u.status === 'active'))
  const save = (patch, msg = 'Saved') => act(() => updateUser(user, user.id, patch), msg)

  const changePhoto = async (e) => {
    const f = e.target.files[0]
    e.target.value = ''
    if (!f) return
    try { save({ avatar: await storeMedia(await fileToDataUrl(f, 400, 0.85), 'avatar.jpg') }, 'Profile photo updated') } catch (err) { toast(err.message, 'error') }
  }
  const row = (icon, label, sub, key, color = 'bg-brand-50 text-brand-700') => (
    <button onClick={() => (key === 'admin' ? nav('/admin') : setSheet(key))} className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-ink-100">
      <span className={cls('h-10 w-10 rounded-xl grid place-items-center', color)}>{icon}</span>
      <div className="flex-1 min-w-0"><div className="font-semibold">{label}</div>{sub && <div className="text-xs text-ink-500 truncate">{sub}</div>}</div>
      <ChevronRight size={18} className="text-ink-300" />
    </button>
  )

  return (
    <Page title="Profile">
      <Card className="p-5 mt-1 text-center relative">
        <button onClick={() => setSheet('edit')} className="absolute top-3 right-3 h-9 w-9 rounded-full bg-ink-100 grid place-items-center" aria-label="Edit profile"><Pencil size={16} /></button>
        <div className="relative inline-block">
          <Avatar user={user} size={88} />
          <button onClick={() => fileRef.current.click()} aria-label="Change photo" className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-brand-800 text-white grid place-items-center ring-4 ring-white"><Camera size={15} /></button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={changePhoto} />
        </div>
        <div className="text-xl font-extrabold mt-3">{user.name}</div>
        <div className="text-sm text-ink-500">{user.phone}</div>
        <div className="flex justify-center gap-2 mt-3 flex-wrap">
          {apt && <Badge color="blue"><HomeIcon size={11} /> {apt.number} · Tower {apt.tower}</Badge>}
          {apt && <Badge color="gray">{apt.type} · {apt.occupancy}</Badge>}
          <Badge color={user.role === 'resident' ? 'green' : 'purple'}>{roleLabel(user.role)}</Badge>
          {user.familyOf && <Badge color="amber">{user.access === 'full' ? 'Family · full access' : 'Family · limited'}</Badge>}
        </div>
        {user.bio && <p className="text-sm text-ink-700 mt-3">{user.bio}</p>}
      </Card>

      {installable && !isStandalone() && (
        <Card className="p-4 mt-3 flex items-center gap-3 bg-gradient-to-r from-accent-50 to-white">
          <Smartphone className="text-accent-700" />
          <div className="flex-1"><div className="font-bold text-sm">Install Sociyo</div><div className="text-xs text-ink-500">Add to your home screen – works offline</div></div>
          <Button size="sm" variant="success" icon={Download} onClick={promptInstall}>Install</Button>
        </Card>
      )}

      {can(user, 'admin.view') && <Card className="mt-3 overflow-hidden">{row(<LayoutDashboard size={18} />, 'Admin dashboard', roleLabel(user.role), 'admin', 'bg-brand-800 text-white')}</Card>}

      {user.apartmentId && (
        <>
          <div className="text-xs font-bold text-ink-400 uppercase tracking-wider mt-5 mb-2">My apartment</div>
          <Card className="divide-y divide-ink-100 overflow-hidden">
            {row(<Users size={18} />, 'Family members', `${user.family?.length || 0} members${flatmates.length ? ` · ${flatmates.length} with app access` : ''}`, 'family')}
            {row(<Car size={18} />, 'Vehicles', user.vehicles?.map((v) => v.number).join(', ') || 'Add your vehicles', 'vehicles', 'bg-sky-50 text-sky-700')}
            {row(<HeartPulse size={18} />, 'Emergency contact', user.emergencyContact ? `${user.emergencyContact.name} · ${user.emergencyContact.phone}` : 'Not set', 'emergency', 'bg-red-50 text-red-600')}
          </Card>
        </>
      )}

      <div className="text-xs font-bold text-ink-400 uppercase tracking-wider mt-5 mb-2">Settings</div>
      <Card className="divide-y divide-ink-100 overflow-hidden">
        <div className="px-4 py-3.5">
          <div className="font-semibold mb-2"><span>Language</span> <span translate="no" className="text-ink-400 font-medium">· भाषा</span></div>
          <LanguageSwitcher />
        </div>
        {row(<ShieldCheck size={18} />, 'Privacy', 'Control what neighbours can see', 'privacy', 'bg-violet-50 text-violet-700')}
        {row(<Bell size={18} />, 'Notification preferences', user.prefs?.push ? 'Device notifications on' : 'In-app only', 'notifs', 'bg-amber-50 text-amber-700')}
        {row(<Info size={18} />, 'About & help', `${society.name} · v1.0`, 'about', 'bg-ink-100 text-ink-700')}
      </Card>

      <Card className="mt-3 divide-y divide-ink-100 overflow-hidden">
        <button onClick={async () => { if (await ask({ title: 'Log out?', ok: 'Log out' })) { logout(); nav('/') } }} className="w-full flex items-center gap-3 px-4 py-3.5 text-left font-semibold text-red-600"><LogOut size={18} /> {DEMO ? 'Log out / switch demo account' : 'Log out'}</button>
        {DEMO && <button onClick={async () => { if (await ask({ title: 'Reset demo data?', text: 'All changes on this device will be erased and the sample data restored.', ok: 'Reset', danger: true })) { await resetDB(); toast('Demo data restored') } }} className="w-full flex items-center gap-3 px-4 py-3.5 text-left font-semibold text-ink-500"><RotateCcw size={18} /> Reset demo data</button>}
      </Card>
      <p className="text-center text-[11px] text-ink-400 mt-5">Sociyo · Made for {society.name}</p>

      <EditSheet open={sheet === 'edit'} onClose={() => setSheet(null)} user={user} save={save} />
      <FamilySheet open={sheet === 'family'} onClose={() => setSheet(null)} user={user} save={save} flatmates={flatmates} />
      <VehicleSheet open={sheet === 'vehicles'} onClose={() => setSheet(null)} user={user} save={save} />
      <EmergencySheet open={sheet === 'emergency'} onClose={() => setSheet(null)} user={user} save={save} />
      <PrivacySheet open={sheet === 'privacy'} onClose={() => setSheet(null)} user={user} save={save} />
      <NotifSheet open={sheet === 'notifs'} onClose={() => setSheet(null)} user={user} save={save} />
      <Sheet open={sheet === 'about'} onClose={() => setSheet(null)} title="About">
        <div className="text-sm text-ink-700 space-y-3">
          <p><b>{society.name}</b><br />{society.address}<br />Reg. No. {society.regNo}</p>
          {(society.officePhone || society.officeEmail) && <p className="flex items-center gap-2 flex-wrap">{society.officePhone && <><Phone size={14} /> {society.officePhone}</>} {society.officeEmail && <><Mail size={14} className="ml-2" /> {society.officeEmail}</>}</p>}
          <p className="text-ink-500"><b translate="no">Sociyo</b> – <span>Your society, sorted.</span></p>
          <p className="text-ink-500">Sociyo is an installable web app. In Chrome, tap ⋮ → <b>Add to Home screen</b> {DEMO ? 'to install it. It works offline; data is stored securely on this device in demo mode.' : 'to install it. Your society’s data is stored securely in the cloud and also works offline.'}</p>
        </div>
      </Sheet>
    </Page>
  )
}

function EditSheet({ open, onClose, user, save }) {
  const [f, setF] = useState(user)
  useEffect(() => { if (open) setF(user) }, [open])
  return (
    <Sheet open={open} onClose={onClose} title="Edit profile" footer={<Button block onClick={() => { if (save({ name: f.name, email: f.email, bio: f.bio, phone: f.phone })) onClose() }}>Save changes</Button>}>
      <Field label="Full name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Mobile"><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
      <Field label="Email"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
      <Field label="About you"><Textarea rows={2} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} placeholder="A line about yourself for neighbours" maxLength={140} /></Field>
    </Sheet>
  )
}

function FamilySheet({ open, onClose, user, save, flatmates }) {
  const act = useAction()
  const [f, setF] = useState({ name: '', relation: 'Spouse', phone: '', access: 'limited', appLogin: false })
  const add = () => {
    if (!f.name.trim()) return
    const m = { id: uid('f'), name: f.name.trim(), relation: f.relation, phone: f.phone, access: f.access }
    if (f.appLogin) {
      if (!/^\d{10}$/.test(f.phone.replace(/\D/g, '').slice(-10))) return act(() => { throw new Error('A 10-digit mobile number is needed for app access.') })
      db.insert('users', { id: uid('u_'), name: m.name, phone: '+91 ' + f.phone.replace(/\D/g, '').slice(-10), email: '', apartmentId: user.apartmentId, role: 'resident', status: 'active', familyOf: user.id, access: f.access, color: '#14B8A6', avatar: null, bio: '', family: [], vehicles: [], emergencyContact: null, privacy: { ...user.privacy }, prefs: { ...user.prefs, push: false }, joinedAt: new Date().toISOString() })
      m.hasLogin = true
    }
    save({ family: [...(user.family || []), m] }, f.appLogin ? `${m.name} can now log in with ${f.phone}` : 'Family member added')
    setF({ name: '', relation: 'Spouse', phone: '', access: 'limited', appLogin: false })
  }
  return (
    <Sheet open={open} onClose={onClose} title="Family members">
      <div className="space-y-2 mb-5">
        {(user.family || []).map((m) => (
          <div key={m.id} className="flex items-center gap-3 p-3 rounded-2xl bg-ink-100/60">
            <Avatar name={m.name} size={38} />
            <div className="flex-1 min-w-0"><div className="font-semibold text-sm">{m.name}</div><div className="text-xs text-ink-500">{m.relation}{m.phone && ` · ${m.phone}`}</div></div>
            <Badge color={m.access === 'full' ? 'green' : 'gray'}>{m.access}</Badge>
            <button aria-label="Remove" onClick={() => save({ family: user.family.filter((x) => x.id !== m.id) }, 'Removed')} className="h-8 w-8 grid place-items-center text-ink-400"><Trash2 size={16} /></button>
          </div>
        ))}
        {flatmates.length > 0 && <p className="text-xs text-ink-500 pt-1">Also registered on this flat: {flatmates.map((u) => u.name).join(', ')}</p>}
      </div>
      <div className="text-sm font-bold mb-2">Add a member</div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Relation"><Select value={f.relation} onChange={(e) => setF({ ...f, relation: e.target.value })}>{['Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Sibling', 'Relative', 'Domestic help', 'Driver'].map((r) => <option key={r}>{r}</option>)}</Select></Field>
      </div>
      <Field label="Mobile (optional)"><Input inputMode="numeric" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
      <Field label="Permissions" hint={f.access === 'full' ? 'Can pay dues, approve visitors and book facilities' : 'Can view notices, feed and approve visitors only'}>
        <Select value={f.access} onChange={(e) => setF({ ...f, access: e.target.value })}><option value="limited">Limited access</option><option value="full">Full access</option></Select>
      </Field>
      <Toggle checked={f.appLogin} onChange={(v) => setF({ ...f, appLogin: v })} label="Give app login" desc="They can log in with their own mobile number" />
      <Button block icon={Plus} className="mt-3" onClick={add} disabled={!f.name.trim()}>Add member</Button>
    </Sheet>
  )
}

function VehicleSheet({ open, onClose, user, save }) {
  const [f, setF] = useState({ number: '', type: 'Car', model: '', slot: '' })
  const add = () => {
    save({ vehicles: [...(user.vehicles || []), { ...f, number: f.number.toUpperCase(), id: uid('v') }] }, 'Vehicle added')
    setF({ number: '', type: 'Car', model: '', slot: '' })
  }
  const valid = /^[A-Z]{2}\s?\d{1,2}\s?[A-Z]{0,3}\s?\d{3,4}$/i.test(f.number.trim())
  return (
    <Sheet open={open} onClose={onClose} title="Vehicles">
      <div className="space-y-2 mb-5">
        {(user.vehicles || []).map((v) => (
          <div key={v.id} className="flex items-center gap-3 p-3 rounded-2xl bg-ink-100/60">
            <Car className="text-sky-700" />
            <div className="flex-1"><div className="font-bold text-sm tracking-wide">{v.number}</div><div className="text-xs text-ink-500">{v.type}{v.model && ` · ${v.model}`}{v.slot && ` · Slot ${v.slot}`}</div></div>
            <button aria-label="Remove" onClick={() => save({ vehicles: user.vehicles.filter((x) => x.id !== v.id) }, 'Removed')} className="h-8 w-8 grid place-items-center text-ink-400"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
      <Field label="Registration number" error={f.number && !valid ? 'Format: MH 12 AB 1234' : ''}><Input value={f.number} onChange={(e) => setF({ ...f, number: e.target.value.toUpperCase() })} placeholder="MH 12 AB 1234" /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Type"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option>Car</option><option>Two-wheeler</option><option>EV Car</option><option>Bicycle</option></Select></Field>
        <Field label="Parking slot"><Input value={f.slot} onChange={(e) => setF({ ...f, slot: e.target.value })} placeholder="P-A12" /></Field>
      </div>
      <Field label="Make / model"><Input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} placeholder="Hyundai Creta" /></Field>
      <Button block icon={Plus} onClick={add} disabled={!valid}>Add vehicle</Button>
    </Sheet>
  )
}

function EmergencySheet({ open, onClose, user, save }) {
  const [f, setF] = useState(user.emergencyContact || { name: '', relation: '', phone: '' })
  return (
    <Sheet open={open} onClose={onClose} title="Emergency contact" footer={<Button block disabled={!f.name || !f.phone} onClick={() => { save({ emergencyContact: f }, 'Emergency contact saved'); onClose() }}>Save</Button>}>
      <p className="text-sm text-ink-500 mb-4">Security and the committee will call this person in an emergency.</p>
      <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Relation"><Input value={f.relation} onChange={(e) => setF({ ...f, relation: e.target.value })} /></Field>
      <Field label="Phone"><Input inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
    </Sheet>
  )
}

function PrivacySheet({ open, onClose, user, save }) {
  const p = user.privacy || {}
  const set = (k) => (v) => save({ privacy: { ...p, [k]: v } }, 'Privacy updated')
  return (
    <Sheet open={open} onClose={onClose} title="Privacy">
      <p className="text-sm text-ink-500 mb-2">Choose what other residents can see. The society office can always see your details.</p>
      <div className="divide-y divide-ink-100">
        <Toggle checked={p.showInDirectory !== false} onChange={set('showInDirectory')} label="Show me in the directory" />
        <Toggle checked={p.showApartment !== false} onChange={set('showApartment')} label="Show my flat number" desc="On posts, listings and in the directory" />
        <Toggle checked={!!p.showPhone} onChange={set('showPhone')} label="Show my mobile number" />
        <Toggle checked={!!p.showEmail} onChange={set('showEmail')} label="Show my email" />
        <Toggle checked={!!p.showFamily} onChange={set('showFamily')} label="Show family members" />
      </div>
    </Sheet>
  )
}

function NotifSheet({ open, onClose, user, save }) {
  const toast = useToast()
  const p = user.prefs || {}
  const set = (k) => (v) => save({ prefs: { ...p, [k]: v } }, 'Preferences saved')
  const enablePush = async (v) => {
    if (!v) return set('push')(false)
    if (!('Notification' in window)) return toast('This browser does not support notifications', 'error')
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return toast('Permission denied – enable notifications in browser settings', 'error')
    set('push')(true)
    devicePush('Notifications enabled 🎉', 'You will now get alerts for visitors, payments and announcements.', '/notifications')
  }
  const items = [['announcements', 'Announcements'], ['payments', 'Bills & payments'], ['complaints', 'Complaint updates'], ['visitors', 'Visitor arrivals'], ['bookings', 'Facility bookings'], ['events', 'Events & polls'], ['social', 'Likes & comments'], ['marketplace', 'Marketplace']]
  return (
    <Sheet open={open} onClose={onClose} title="Notifications">
      <div className="text-xs font-bold text-ink-400 uppercase mb-1">Channels</div>
      <div className="divide-y divide-ink-100 mb-4">
        <Toggle checked={!!p.push} onChange={enablePush} label="Device notifications" desc="Pop-up alerts on this phone" />
        <Toggle checked={!!p.email} onChange={set('email')} label="Email" desc="When an email provider is configured by the society" />
        <Toggle checked={!!p.sms} onChange={set('sms')} label="SMS" desc="When an SMS provider is configured by the society" />
      </div>
      <div className="text-xs font-bold text-ink-400 uppercase mb-1">Notify me about</div>
      <div className="divide-y divide-ink-100">{items.map(([k, l]) => <Toggle key={k} checked={p[k] !== false} onChange={set(k)} label={l} />)}</div>
      <p className="text-xs text-ink-400 mt-3">Emergency alerts are always delivered.</p>
    </Sheet>
  )
}
