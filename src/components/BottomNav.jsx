import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { Home, Users, Plus, Newspaper, UserRound, ShieldCheck, ClipboardList, MessageSquareWarning, Wallet, PenSquare, AlertTriangle, Wrench, UserPlus, Search, CalendarPlus } from 'lucide-react'
import { Sheet } from './ui'
import { cls } from '../lib/utils'
import { useAuth } from '../lib/auth'
import { can } from '../lib/rbac'

export const QUICK_ACTIONS = [
  { label: 'Raise a Complaint', icon: MessageSquareWarning, to: '/complaints/new', bg: 'bg-red-50 text-red-600' },
  { label: 'Pay Maintenance', icon: Wallet, to: '/payments?pay=1', bg: 'bg-accent-50 text-accent-700' },
  { label: 'Create a Post', icon: PenSquare, to: '/feed/new', bg: 'bg-brand-50 text-brand-700' },
  { label: 'Report an Issue', icon: AlertTriangle, to: '/complaints/new?kind=issue', bg: 'bg-amber-50 text-amber-700' },
  { label: 'Request a Service', icon: Wrench, to: '/complaints/new?kind=service', bg: 'bg-sky-50 text-sky-700' },
  { label: 'Invite a Visitor', icon: UserPlus, to: '/visitors/new', bg: 'bg-violet-50 text-violet-700' },
  { label: 'Lost & Found', icon: Search, to: '/feed/new?cat=lost_found', bg: 'bg-teal-50 text-teal-700' },
  { label: 'Create an Event', icon: CalendarPlus, to: '/events/new', bg: 'bg-pink-50 text-pink-600' }
]

const Item = ({ to, icon: Icon, label, end }) => (
  <NavLink to={to} end={end} className={({ isActive }) => cls('flex-1 flex flex-col items-center justify-center gap-0.5 h-full text-[11px] font-semibold transition', isActive ? 'text-brand-800' : 'text-ink-400')}>
    {({ isActive }) => (<><Icon size={23} strokeWidth={isActive ? 2.4 : 1.9} /><span>{label}</span></>)}
  </NavLink>
)

export default function BottomNav({ guard }) {
  const [open, setOpen] = useState(false)
  const nav = useNavigate()
  const { user } = useAuth()
  const go = (to) => { setOpen(false); nav(to) }
  const actions = QUICK_ACTIONS.filter((a) => user.apartmentId || !['/payments?pay=1', '/visitors/new'].includes(a.to))
  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-40 mx-auto max-w-[520px] no-print">
        <div className="relative bg-white/95 backdrop-blur border-t border-ink-200/70 safe-bottom">
          <div className="flex items-center h-16 px-2">
            {guard ? (
              <>
                <Item to="/guard" end icon={ShieldCheck} label="Gate" />
                <Item to="/guard/logs" icon={ClipboardList} label="Logs" />
              </>
            ) : (
              <>
                <Item to="/" end icon={Home} label="Home" />
                <Item to="/directory" icon={Users} label="Directory" />
              </>
            )}
            <div className="flex-1 flex justify-center">
              <button aria-label="Quick actions" onClick={() => (guard ? nav('/guard/new') : setOpen(true))} className="-mt-8 h-[60px] w-[60px] rounded-[22px] bg-gradient-to-br from-brand-700 to-brand-900 text-white grid place-items-center shadow-float ring-[5px] ring-canvas active:scale-95 transition">
                <Plus size={30} strokeWidth={2.6} className={cls('transition-transform', open && 'rotate-45')} />
              </button>
            </div>
            {guard ? <Item to="/directory" icon={Users} label="Directory" /> : <Item to="/feed" icon={Newspaper} label="Feed" />}
            <Item to="/profile" icon={UserRound} label="Profile" />
          </div>
        </div>
      </nav>
      <Sheet open={open} onClose={() => setOpen(false)} title="Quick actions">
        <div className="grid grid-cols-4 gap-y-5 gap-x-2 pb-2">
          {actions.map((a, i) => (
            <button key={a.label} onClick={() => go(a.to)} className="flex flex-col items-center gap-2 animate-pop" style={{ animationDelay: `${i * 25}ms`, animationFillMode: 'both' }}>
              <span className={cls('h-14 w-14 rounded-2xl grid place-items-center', a.bg)}><a.icon size={24} /></span>
              <span className="text-[11.5px] leading-tight font-semibold text-ink-700 text-center">{a.label}</span>
            </button>
          ))}
        </div>
        {can(user, 'announcement.publish') && (
          <button onClick={() => go('/announcements/new')} className="mt-4 w-full flex items-center gap-3 p-3 rounded-2xl bg-brand-800 text-white text-left">
            <span className="h-10 w-10 rounded-xl bg-white/15 grid place-items-center">📢</span>
            <span className="flex-1"><span className="block font-semibold text-sm">Publish announcement</span><span className="text-xs text-brand-200">Committee only</span></span>
          </button>
        )}
      </Sheet>
    </>
  )
}
