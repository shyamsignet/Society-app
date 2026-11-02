import { useNavigate } from 'react-router-dom'
import { Pin, Paperclip, CheckCheck, Share2 } from 'lucide-react'
import { Badge } from './ui'
import { useAuth } from '../lib/auth'
import { timeAgo, cls, fmtShort, appLink, shareOnWhatsApp } from '../lib/utils'

export const PRIORITY = {
  urgent: { label: 'Urgent', color: 'red', stripe: 'from-red-500 to-orange-500', bg: 'bg-gradient-to-br from-red-50 to-white' },
  important: { label: 'Important', color: 'amber', stripe: 'from-amber-400 to-yellow-400', bg: 'bg-gradient-to-br from-amber-50/70 to-white' },
  general: { label: 'General', color: 'blue', stripe: 'from-brand-500 to-sky-400', bg: 'bg-white' }
}

const PRI_EMOJI = { urgent: '🔴', important: '🟠', general: '📢' }

// WhatsApp-formatted text for an announcement (*bold* renders in WhatsApp).
export const announcementShareText = (a, society) => [
  `${PRI_EMOJI[a.priority] || '📢'} *${society?.name || 'Society'} – Notice*`,
  '',
  `*${a.title}*`,
  '',
  a.body,
  '',
  `Read in SociYo: ${appLink(`/announcements/${a.id}`)}`
].join('\n')

export default function AnnouncementCard({ a, compact, feed }) {
  const nav = useNavigate()
  const { user, society } = useAuth()
  const p = PRIORITY[a.priority] || PRIORITY.general
  const unread = !a.readBy.includes(user.id)
  const needsAck = a.requiresAck && !a.ackBy.includes(user.id)
  const open = () => nav(`/announcements/${a.id}`)
  const share = (e) => { e.stopPropagation(); shareOnWhatsApp(announcementShareText(a, society)) }
  return (
    <div role="button" tabIndex={0} onClick={open} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && open()} className={cls('relative w-full text-left rounded-2xl shadow-card overflow-hidden border border-white active:scale-[.99] transition', p.bg, compact ? 'p-4 pl-5' : 'p-4 pl-5')}>
      <span className={cls('absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b', p.stripe)} />
      <div className="flex items-center gap-2 mb-1.5">
        {feed && <span className="text-[11px] font-semibold text-ink-500 bg-ink-100 rounded-full px-2.5 py-1 whitespace-nowrap">📢 Notice</span>}
        <Badge color={p.color}>{p.label}</Badge>
        {a.pinned && <span className="text-ink-400 flex items-center gap-0.5 text-[11px] font-semibold"><Pin size={12} className="rotate-45" /> Pinned</span>}
        <span className="ml-auto text-[11px] text-ink-400">{timeAgo(a.createdAt)}</span>
        {unread && <span className="h-2.5 w-2.5 rounded-full bg-brand-500 ring-2 ring-brand-100" aria-label="Unread" />}
      </div>
      <div className={cls('text-[15px] text-ink-900 leading-snug', unread ? 'font-bold' : 'font-semibold')}>{a.title}</div>
      <p className="text-[13px] text-ink-500 mt-1 line-clamp-2">{a.body}</p>
      <div className="flex items-center gap-3 mt-2.5 text-[11px] font-semibold">
        {a.attachments?.length > 0 && <span className="flex items-center gap-1 text-ink-500"><Paperclip size={12} /> <span>{`${a.attachments.length} attachment${a.attachments.length > 1 ? 's' : ''}`}</span></span>}
        {a.expiresAt && <span className="text-ink-400">Valid till {fmtShort(a.expiresAt)}</span>}
        {needsAck && <span className="ml-auto text-red-600">Acknowledgement needed</span>}
        {a.requiresAck && !needsAck && <span className="ml-auto flex items-center gap-1 text-accent-600"><CheckCheck size={13} /> Acknowledged</span>}
        <button type="button" aria-label="Share on WhatsApp" title="Share on WhatsApp" onClick={share} className={cls('h-8 w-8 -my-1 -mr-1 grid place-items-center rounded-full text-ink-500 hover:bg-ink-100', !a.requiresAck && 'ml-auto')}><Share2 size={17} /></button>
      </div>
    </div>
  )
}
