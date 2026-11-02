import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Bell, Wallet, MessageSquareWarning, UserCheck, CalendarDays, Vote, Store, Siren, Dumbbell, Check, X, LayoutDashboard, Wrench, Megaphone, BookUser, ShieldCheck } from 'lucide-react'
import { Avatar, Card, SectionTitle, IconButton, Button, useAction } from '../components/ui'
import AnnouncementCard from '../components/AnnouncementCard'
import SubscriptionBanner from '../components/SubscriptionBanner'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/db'
import { can, isAdmin } from '../lib/rbac'
import { greeting, cls, timeAgo } from '../lib/utils'
import { billTotal, isActiveAnnouncement, aptNo, respondVisitor, VISITOR_TYPES } from '../lib/actions'

const PRI = { urgent: 0, important: 1, general: 2 }
export const sortAnnouncements = (list) => [...list].sort((a, b) => (b.pinned - a.pinned) || (PRI[a.priority] - PRI[b.priority]) || (new Date(b.createdAt) - new Date(a.createdAt)))


export default function Home() {
  const { user, society } = useAuth()
  const nav = useNavigate()
  const act = useAction()
  const unread = useData((d) => d.list('notifications', (n) => n.userId === user.id && !n.read).length)
  const announcements = useData((d) => sortAnnouncements(d.list('announcements', isActiveAnnouncement)))
  const dues = useData((d) => d.list('bills', (b) => b.apartmentId === user.apartmentId && b.status !== 'paid'))
  const waiting = useData((d) => d.list('visitors', (v) => v.apartmentId === user.apartmentId && v.status === 'pending'))
  const alerts = useData((d) => d.list('alerts', (a) => a.active))
  const total = dues.reduce((a, b) => a + billTotal(b), 0)
  const firstName = user.name.split(' ')[0]
  const unreadAnn = announcements.filter((a) => !a.readBy.includes(user.id)).length
  const openTickets = useData((d) => d.list('complaints', (c) => c.userId === user.id && !['resolved', 'closed'].includes(c.status)).length)
  const myBookings = useData((d) => d.list('bookings', (b) => b.userId === user.id && ['pending', 'confirmed'].includes(b.status) && new Date(b.start) > new Date()).length)
  const openPolls = useData((d) => d.list('polls', (p) => new Date(p.closesAt) > new Date() && !(p.votes || []).some((v) => v.userId === user.id)).length)
  // Every service of the society, one tap away (this replaces the old Services tab).
  const shortcuts = [
    user.apartmentId && { label: 'Payments', icon: Wallet, to: '/payments', c: 'text-accent-700 bg-accent-50', dot: total > 0 },
    { label: 'Helpdesk', icon: MessageSquareWarning, to: '/complaints', c: 'text-red-600 bg-red-50', badge: openTickets },
    { label: 'Services', icon: Wrench, to: '/complaints/new?kind=service', c: 'text-sky-700 bg-sky-50' },
    user.apartmentId && { label: 'Visitors', icon: UserCheck, to: '/visitors', c: 'text-violet-700 bg-violet-50', badge: waiting.length },
    { label: 'Amenities', icon: Dumbbell, to: '/facilities', c: 'text-sky-700 bg-sky-50', badge: myBookings },
    { label: 'Events', icon: CalendarDays, to: '/events', c: 'text-pink-600 bg-pink-50' },
    { label: 'Polls', icon: Vote, to: '/polls', c: 'text-amber-700 bg-amber-50', badge: openPolls },
    { label: 'Market', icon: Store, to: '/marketplace', c: 'text-teal-700 bg-teal-50' },
    { label: 'Notices', icon: Megaphone, to: '/announcements', c: 'text-brand-700 bg-brand-50', badge: unreadAnn },
    { label: 'Directory', icon: BookUser, to: '/directory', c: 'text-ink-700 bg-ink-100' },
    isAdmin(user) && { label: 'Admin', icon: LayoutDashboard, to: '/admin', c: 'text-white bg-brand-800' },
    can(user, 'visitors.gate') && { label: 'Gate', icon: ShieldCheck, to: '/guard', c: 'text-white bg-brand-800' },
    { label: 'SOS', icon: Siren, to: '/emergency', c: 'text-white bg-red-500' }
  ].filter(Boolean)

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-brand-800 to-brand-900 text-white px-4 pb-9 safe-top overflow-hidden">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-accent-500/15 blur-2xl" />
        <div className="relative flex items-center gap-3 pt-4">
          <div className="h-10 w-10 rounded-xl bg-white/10 grid place-items-center text-xl">{society.logoEmoji}</div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-bold leading-tight truncate">{society.name}</div>
            <div className="text-xs text-brand-200 truncate">{society.city}</div>
          </div>
          <IconButton icon={Bell} label="Notifications" badge={unread} onClick={() => nav('/notifications')} className="!bg-white/10 !text-white !shadow-none" />
          <button onClick={() => nav('/profile')} aria-label="Profile" className="rounded-full ring-2 ring-white/30"><Avatar user={user} size={40} /></button>
        </div>
        <div className="relative mt-5">
          <h1 className="text-[22px] font-extrabold leading-tight"><span className="font-semibold text-brand-200">{greeting()},</span> {firstName} 👋</h1>
          <div className="flex items-center gap-2 mt-2">
            {user.apartmentId && <span className="text-xs font-semibold bg-white/10 rounded-full px-2.5 py-1">🏠 {aptNo(user.apartmentId)}</span>}
            {user.role !== 'resident' && <span className="text-xs font-semibold bg-accent-500/90 rounded-full px-2.5 py-1 capitalize">{user.role.replace('_', ' ')}</span>}
          </div>
        </div>
      </div>

      <div className="px-4 -mt-5 relative space-y-3">
        <SubscriptionBanner className="shadow-card" />
        {alerts.map((a) => (
          <Link to="/emergency" key={a.id} className="flex items-start gap-3 p-4 rounded-2xl bg-red-600 text-white shadow-float animate-pop">
            <Siren className="shrink-0 animate-pulse" />
            <div className="min-w-0"><div className="font-bold">{a.title}</div><div className="text-sm text-red-100 line-clamp-2">{a.message}</div></div>
          </Link>
        ))}

        {waiting.map((v) => (
          <Card key={v.id} className="p-4 border-2 border-violet-200 animate-pop">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-violet-100 text-violet-700 grid place-items-center"><UserCheck size={22} /></div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-violet-700 uppercase tracking-wide">{VISITOR_TYPES[v.type]} at the gate · {timeAgo(v.createdAt)}</div>
                <div className="font-bold text-ink-900 truncate">{v.name}</div>
                {v.purpose && <div className="text-xs text-ink-500">{v.purpose}</div>}
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button variant="danger" block size="sm" icon={X} onClick={() => act(() => respondVisitor(user, v.id, false), 'Entry denied – guard informed')}>Deny</Button>
              <Button variant="success" block size="sm" icon={Check} onClick={() => act(() => respondVisitor(user, v.id, true), 'Entry approved – guard informed')}>Approve</Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Announcements */}
      <div className="px-4">
        <SectionTitle action="See all" onAction={() => nav('/announcements')}>
          📢 Announcements {unreadAnn > 0 && <span className="ml-1 text-xs font-bold text-white bg-brand-600 rounded-full px-2 py-0.5 align-middle">{unreadAnn} new</span>}
        </SectionTitle>
        {announcements.length ? (
          <div className="space-y-3">{announcements.slice(0, 2).map((a) => <AnnouncementCard key={a.id} a={a} />)}</div>
        ) : <Card className="p-5 text-sm text-ink-500 text-center">No active announcements</Card>}
      </div>

      {/* Shortcuts */}
      <div className="grid grid-cols-4 gap-y-4 px-4 mt-6">
        {shortcuts.map((s) => (
          <button key={s.label} onClick={() => nav(s.to)} className="flex flex-col items-center gap-1.5 active:scale-95 transition">
            <span className={cls('relative h-[52px] w-[52px] rounded-2xl grid place-items-center shadow-sm', s.c)}><s.icon size={23} />
              {s.badge > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-coral-500 text-white text-[11px] font-bold grid place-items-center ring-2 ring-canvas">{s.badge > 9 ? '9+' : s.badge}</span>}
              {s.dot && <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-red-500 ring-2 ring-canvas" />}
            </span>
            <span className="text-[11.5px] font-semibold text-ink-700">{s.label}</span>
          </button>
        ))}
      </div>

    </div>
  )
}
