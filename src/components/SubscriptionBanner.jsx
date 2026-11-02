import { Link } from 'react-router-dom'
import { Lock, Clock, Sparkles } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { can } from '../lib/rbac'
import { CLOUD } from '../lib/config'
import { useSubscription, describeSub } from '../lib/subscription'
import { fmtDate, cls } from '../lib/utils'

// Shown on Home: read-only notice for everyone, renewal reminders for the committee.
export default function SubscriptionBanner({ className = '' }) {
  const { user } = useAuth()
  const sub = useSubscription()
  if (!CLOUD || !sub || !user) return null
  const d = describeSub(sub)
  const admin = can(user, 'residents.manage') || can(user, 'billing.manage')
  let tone, icon, text
  if (d.state === 'locked') { tone = 'bg-red-50 text-red-800 border-red-200'; icon = Lock; text = admin ? 'The SociYo subscription has expired – the app is read-only until it is renewed.' : 'The app is read-only until the committee renews the SociYo subscription.' }
  else if (!admin || d.plan === 'complimentary') return null
  else if (d.state === 'grace') { tone = 'bg-amber-50 text-amber-900 border-amber-200'; icon = Clock; text = `Subscription expired on ${fmtDate(d.endsAt)}. Renew by ${fmtDate(d.graceEnds)} to avoid read-only mode.` }
  else if (d.onTrial && d.daysLeft !== null && d.daysLeft <= 7) { tone = 'bg-brand-50 text-brand-800 border-brand-200'; icon = Sparkles; text = `Free trial ends in ${Math.max(0, d.daysLeft)} day(s) – on ${fmtDate(d.endsAt)}.` }
  else if (!d.onTrial && d.daysLeft !== null && d.daysLeft <= 15) { tone = 'bg-brand-50 text-brand-800 border-brand-200'; icon = Clock; text = `Subscription renews on ${fmtDate(d.endsAt)}.` }
  else return null
  const Icon = icon
  return (
    <div className={cls('rounded-2xl border px-4 py-3 flex items-start gap-3 text-sm', tone, className)}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div className="flex-1"><span>{text}</span>{admin && <> <Link to="/admin/subscription" className="font-bold underline whitespace-nowrap">View & renew</Link></>}</div>
    </div>
  )
}
