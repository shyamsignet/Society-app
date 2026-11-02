import { Routes, Route, useNavigate } from 'react-router-dom'
import { BadgeIndianRupee, Building2, Users, Wallet, AlertCircle, MessageSquareWarning, CalendarCheck, CalendarDays, UserPlus, Megaphone, Receipt, UserCheck, Dumbbell, Vote, ShieldAlert, BarChart3, ChevronRight, Siren, Upload, Contact } from 'lucide-react'
import { Page, Card, Stat, SectionTitle } from '../../components/ui'
import { Ring } from '../../components/Charts'
import { useAuth } from '../../lib/auth'
import { useData } from '../../lib/db'
import { can, roleLabel } from '../../lib/rbac'
import { billTotal, isOverdue } from '../../lib/actions'
import { inr, ymOf, monthLabel, cls } from '../../lib/utils'
import Billing from './Billing'
import Residents from './Residents'
import Reports from './Reports'
import { AdminComplaints, AdminBookings, Moderation, AdminVisitors } from './Manage'
import Import from './Import'
import Contacts from './Contacts'
import Subscription from './Subscription'

export default function Admin() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="billing" element={<Billing />} />
      <Route path="residents" element={<Residents />} />
      <Route path="complaints" element={<AdminComplaints />} />
      <Route path="bookings" element={<AdminBookings />} />
      <Route path="moderation" element={<Moderation />} />
      <Route path="visitors" element={<AdminVisitors />} />
      <Route path="reports" element={<Reports />} />
      <Route path="import" element={<Import />} />
      <Route path="contacts" element={<Contacts />} />
      <Route path="subscription" element={<Subscription />} />
    </Routes>
  )
}

function Overview() {
  const { user } = useAuth()
  const nav = useNavigate()
  const ym = ymOf()
  const s = useData((d) => {
    const bills = d.list('bills', (b) => b.month === ym)
    const paid = bills.filter((b) => b.status === 'paid')
    const unpaidAll = d.list('bills', (b) => b.status !== 'paid')
    const comps = d.list('complaints', (c) => !['resolved', 'closed'].includes(c.status))
    return {
      apts: d.list('apartments').length,
      occupied: new Set(d.list('users', (u) => u.apartmentId && u.status === 'active').map((u) => u.apartmentId)).size,
      residents: d.list('users', (u) => u.apartmentId && u.status === 'active').length,
      billed: bills.reduce((a, b) => a + billTotal(b), 0), collected: paid.reduce((a, b) => a + billTotal(b), 0), paidCount: paid.length, billCount: bills.length,
      pendingAmt: unpaidAll.reduce((a, b) => a + billTotal(b), 0), pendingFlats: new Set(unpaidAll.map((b) => b.apartmentId)).size,
      open: comps.length, overdue: comps.filter(isOverdue).length,
      bookings: d.list('bookings', (b) => b.status === 'pending').length,
      events: d.list('events', (e) => new Date(e.start) > new Date()).length,
      regs: d.list('registrations', (r) => r.status === 'pending').length,
      reported: d.list('posts', (p) => p.reports.length && !p.hidden).length,
      alerts: d.list('alerts', (a) => a.active).length
    }
  })
  const rate = s.billed ? s.collected / s.billed : 0
  const links = [
    can(user, 'residents.manage') && { to: 'residents', label: 'Residents & apartments', icon: Users, badge: s.regs },
    can(user, 'residents.manage') && { to: 'import', label: 'Import residents & flats', icon: Upload },
    can(user, 'facilities.manage') && { to: 'contacts', label: 'Staff & contacts', icon: Contact },
    can(user, 'announcement.publish') && { to: '/announcements/new', label: 'Publish announcement', icon: Megaphone },
    can(user, 'billing.manage') && { to: 'billing', label: 'Maintenance billing', icon: Receipt },
    can(user, 'payments.view_all') && !can(user, 'billing.manage') && { to: 'billing', label: 'Payment tracking', icon: Receipt },
    can(user, 'complaints.manage') && { to: 'complaints', label: 'Complaint assignment', icon: MessageSquareWarning, badge: s.overdue },
    can(user, 'visitors.logs') && { to: 'visitors', label: 'Visitor logs', icon: UserCheck },
    can(user, 'facilities.manage') && { to: 'bookings', label: 'Facilities & bookings', icon: Dumbbell, badge: s.bookings },
    { to: '/events', label: 'Events', icon: CalendarDays },
    { to: '/polls', label: can(user, 'polls.create') ? 'Polls – create & results' : 'Polls', icon: Vote },
    can(user, 'moderation') && { to: 'moderation', label: 'Community moderation', icon: ShieldAlert, badge: s.reported },
    can(user, 'emergency.alert') && { to: '/emergency', label: 'Emergency alerts', icon: Siren, badge: s.alerts },
    can(user, 'reports.view') && { to: 'reports', label: 'Reports & analytics', icon: BarChart3 },
    (can(user, 'residents.manage') || can(user, 'billing.manage')) && { to: 'subscription', label: 'SociYo subscription', icon: BadgeIndianRupee }
  ].filter(Boolean)
  return (
    <Page title="Admin dashboard" subtitle={roleLabel(user.role)} back="/">
      <Card className="p-4 mt-2 flex items-center gap-4">
        <Ring value={rate} label="collected" />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-ink-500 font-semibold">{monthLabel(ym)} collection</div>
          <div className="text-2xl font-extrabold">{inr(s.collected)}</div>
          <div className="text-xs text-ink-500">{`of ${inr(s.billed)} billed · ${s.paidCount}/${s.billCount} flats paid`}</div>
        </div>
      </Card>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <Stat label="Total apartments" value={s.apts} sub={`${s.occupied} occupied`} icon={Building2} />
        <Stat label="Registered residents" value={s.residents} sub={s.regs ? `${s.regs} pending approval` : 'All verified'} icon={Users} tone="purple" onClick={can(user, 'residents.manage') ? () => nav('residents') : undefined} />
        <Stat label="Pending payments" value={inr(s.pendingAmt)} sub={`${s.pendingFlats} flats`} icon={Wallet} tone="amber" onClick={() => nav('billing')} />
        <Stat label="Open complaints" value={s.open} sub={s.overdue ? `${s.overdue} overdue` : 'None overdue'} icon={AlertCircle} tone="red" onClick={() => nav('complaints')} />
        <Stat label="Pending bookings" value={s.bookings} sub="Awaiting approval" icon={CalendarCheck} tone="sky" onClick={() => nav('bookings')} />
        <Stat label="Upcoming events" value={s.events} icon={CalendarDays} tone="green" onClick={() => nav('/events')} />
      </div>
      {s.regs > 0 && can(user, 'residents.manage') && (
        <Card className="p-4 mt-3 flex items-center gap-3 border-2 border-violet-100" onClick={() => nav('residents')}>
          <UserPlus className="text-violet-600" /><div className="flex-1 text-sm"><b>{s.regs} registration request(s)</b> waiting for verification</div><ChevronRight size={18} className="text-ink-400" />
        </Card>
      )}
      <SectionTitle>Management</SectionTitle>
      <Card className="divide-y divide-ink-100 overflow-hidden">
        {links.map((l) => (
          <button key={l.label} onClick={() => nav(l.to)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-ink-100">
            <span className="h-10 w-10 rounded-xl bg-brand-50 text-brand-700 grid place-items-center"><l.icon size={18} /></span>
            <span className="flex-1 font-semibold">{l.label}</span>
            {l.badge > 0 && <span className={cls('min-w-[22px] h-[22px] px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold grid place-items-center')}>{l.badge}</span>}
            <ChevronRight size={18} className="text-ink-300" />
          </button>
        ))}
      </Card>
    </Page>
  )
}
