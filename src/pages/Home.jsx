import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Bell, Wallet, MessageSquareWarning, UserCheck, CalendarDays, Vote, Store, Siren, Dumbbell, ChevronRight, ImagePlus, Check, X, LayoutDashboard, AlertTriangle } from 'lucide-react'
import { Avatar, Card, Chips, SectionTitle, IconButton, Empty, Button, useAction } from '../components/ui'
import PostCard from '../components/PostCard'
import AnnouncementCard from '../components/AnnouncementCard'
import SubscriptionBanner from '../components/SubscriptionBanner'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/db'
import { can, isAdmin } from '../lib/rbac'
import { greeting, inr, fmtDate, cls, timeAgo } from '../lib/utils'
import { POST_CATEGORIES, billTotal, billStatus, isActiveAnnouncement, aptNo, respondVisitor, VISITOR_TYPES } from '../lib/actions'

const PRI = { urgent: 0, important: 1, general: 2 }
export const sortAnnouncements = (list) => [...list].sort((a, b) => (b.pinned - a.pinned) || (PRI[a.priority] - PRI[b.priority]) || (new Date(b.createdAt) - new Date(a.createdAt)))

const SHORTCUTS = [
  { label: 'Payments', icon: Wallet, to: '/payments', c: 'text-accent-700 bg-accent-50' },
  { label: 'Helpdesk', icon: MessageSquareWarning, to: '/complaints', c: 'text-red-600 bg-red-50' },
  { label: 'Visitors', icon: UserCheck, to: '/visitors', c: 'text-violet-700 bg-violet-50' },
  { label: 'Amenities', icon: Dumbbell, to: '/facilities', c: 'text-sky-700 bg-sky-50' },
  { label: 'Events', icon: CalendarDays, to: '/events', c: 'text-pink-600 bg-pink-50' },
  { label: 'Polls', icon: Vote, to: '/polls', c: 'text-amber-700 bg-amber-50' },
  { label: 'Market', icon: Store, to: '/marketplace', c: 'text-teal-700 bg-teal-50' },
  { label: 'SOS', icon: Siren, to: '/emergency', c: 'text-white bg-red-500' }
]

export default function Home() {
  const { user, society } = useAuth()
  const nav = useNavigate()
  const act = useAction()
  const [cat, setCat] = useState('all')
  const unread = useData((d) => d.list('notifications', (n) => n.userId === user.id && !n.read).length)
  const announcements = useData((d) => sortAnnouncements(d.list('announcements', isActiveAnnouncement)))
  const posts = useData((d) => d.list('posts', (p) => !p.hidden || p.userId === user.id || can(user, 'moderation')).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
  const dues = useData((d) => d.list('bills', (b) => b.apartmentId === user.apartmentId && b.status !== 'paid'))
  const lastPaid = useData((d) => d.list('payments', (p) => p.apartmentId === user.apartmentId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0])
  const waiting = useData((d) => d.list('visitors', (v) => v.apartmentId === user.apartmentId && v.status === 'pending'))
  const alerts = useData((d) => d.list('alerts', (a) => a.active))
  const counts = posts.reduce((m, p) => ({ ...m, [p.category]: (m[p.category] || 0) + 1 }), {})
  // Feed mixes community posts with active committee announcements, newest first.
  const feedItems = [...posts.map((p) => ({ kind: 'post', item: p })), ...announcements.map((a) => ({ kind: 'notice', item: a }))]
    .sort((x, y) => new Date(y.item.createdAt) - new Date(x.item.createdAt))
  const shown = cat === 'all' ? feedItems : cat === 'notices' ? feedItems.filter((f) => f.kind === 'notice') : feedItems.filter((f) => f.kind === 'post' && f.item.category === cat)
  const total = dues.reduce((a, b) => a + billTotal(b), 0)
  const nextDue = dues.map((b) => b.dueDate).sort()[0]
  const overdue = dues.some((b) => billStatus(b) === 'overdue')
  const firstName = user.name.split(' ')[0]
  const unreadAnn = announcements.filter((a) => !a.readBy.includes(user.id)).length

  return (
    <div className="pb-28">
      {/* Header */}
      <div className="relative bg-gradient-to-br from-brand-800 to-brand-900 text-white px-4 pb-20 safe-top overflow-hidden">
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
        <div className="relative mt-6">
          <p className="text-brand-200 text-sm">{greeting()},</p>
          <h1 className="text-[26px] font-extrabold leading-tight">{firstName} 👋</h1>
          <div className="flex items-center gap-2 mt-2">
            {user.apartmentId && <span className="text-xs font-semibold bg-white/10 rounded-full px-2.5 py-1">🏠 {aptNo(user.apartmentId)}</span>}
            {user.role !== 'resident' && <span className="text-xs font-semibold bg-accent-500/90 rounded-full px-2.5 py-1 capitalize">{user.role.replace('_', ' ')}</span>}
          </div>
        </div>
      </div>

      <div className="px-4 -mt-14 relative space-y-3">
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

        {user.apartmentId ? (
          <Card className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-semibold text-ink-500">Maintenance outstanding</div>
                <div className={cls('text-[28px] font-extrabold leading-tight', total ? 'text-ink-900' : 'text-accent-600')}>{total ? inr(total) : 'All paid ✓'}</div>
                <div className={cls('text-xs mt-0.5 font-medium', overdue ? 'text-red-600' : 'text-ink-500')}>
                  {total ? `${overdue ? 'Overdue since' : 'Due by'} ${fmtDate(nextDue)}` : lastPaid ? `Last paid ${inr(lastPaid.amount)} on ${fmtDate(lastPaid.createdAt)}` : 'No dues'}
                </div>
              </div>
              {total > 0 ? <Button variant="success" onClick={() => nav('/payments?pay=1')}>Pay now</Button> : <Button variant="secondary" size="sm" onClick={() => nav('/payments')}>History</Button>}
            </div>
          </Card>
        ) : isAdmin(user) && (
          <Card className="p-4 flex items-center gap-3" onClick={() => nav('/admin')}>
            <div className="h-11 w-11 rounded-2xl bg-brand-50 text-brand-700 grid place-items-center"><LayoutDashboard /></div>
            <div className="flex-1"><div className="font-bold">Admin dashboard</div><div className="text-xs text-ink-500">Billing, complaints, residents & reports</div></div>
            <ChevronRight className="text-ink-400" />
          </Card>
        )}
        {user.apartmentId && isAdmin(user) && (
          <Card className="p-3.5 flex items-center gap-3" onClick={() => nav('/admin')}>
            <div className="h-9 w-9 rounded-xl bg-brand-800 text-white grid place-items-center"><LayoutDashboard size={18} /></div>
            <div className="flex-1 text-sm font-bold">Open admin dashboard</div>
            <ChevronRight className="text-ink-400" size={18} />
          </Card>
        )}
      </div>

      {/* Shortcuts */}
      <div className="grid grid-cols-4 gap-y-4 px-4 mt-5">
        {SHORTCUTS.map((s) => (
          <button key={s.label} onClick={() => nav(s.to)} className="flex flex-col items-center gap-1.5 active:scale-95 transition">
            <span className={cls('h-[52px] w-[52px] rounded-2xl grid place-items-center shadow-sm', s.c)}><s.icon size={23} /></span>
            <span className="text-[11.5px] font-semibold text-ink-700">{s.label}</span>
          </button>
        ))}
      </div>

      {/* Announcements */}
      <div className="px-4">
        <SectionTitle action="See all" onAction={() => nav('/announcements')}>
          📢 Announcements {unreadAnn > 0 && <span className="ml-1 text-xs font-bold text-white bg-brand-600 rounded-full px-2 py-0.5 align-middle">{unreadAnn} new</span>}
        </SectionTitle>
        {announcements.length ? (
          <div className="space-y-3">{announcements.slice(0, 3).map((a) => <AnnouncementCard key={a.id} a={a} />)}</div>
        ) : <Card className="p-5 text-sm text-ink-500 text-center">No active announcements</Card>}
      </div>

      {/* Feed */}
      <div className="px-4">
        <SectionTitle>Community feed</SectionTitle>
        <Card className="p-3 flex items-center gap-3 mb-3" onClick={() => nav('/feed/new')}>
          <Avatar user={user} size={38} />
          <span className="flex-1 text-sm text-ink-400">Share something with your neighbours…</span>
          <ImagePlus size={20} className="text-accent-600" />
        </Card>
        <Chips className="mb-3" value={cat} onChange={setCat} options={[{ value: 'all', label: 'All', count: feedItems.length }, { value: 'notices', label: '📢 Notices', count: announcements.length }, ...POST_CATEGORIES.map((c) => ({ value: c.id, label: `${c.emoji} ${c.label}`, count: counts[c.id] || 0 }))]} />
        <div className="space-y-3">
          {shown.map((f) => f.kind === 'notice' ? <AnnouncementCard key={'n' + f.item.id} a={f.item} feed /> : <PostCard key={f.item.id} post={f.item} />)}
          {!shown.length && <Empty icon={AlertTriangle} title="No posts here yet" text="Be the first to post in this category." action={cat !== 'notices' && <Button onClick={() => nav(`/feed/new?cat=${cat === 'all' ? 'general' : cat}`)}>Create post</Button>} />}
        </div>
      </div>
    </div>
  )
}
