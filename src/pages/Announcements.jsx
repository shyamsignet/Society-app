import { useEffect, useState } from 'react'
import { Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { Plus, FileText, Image as ImageIcon, CheckCheck, Pin, Trash2, Megaphone, Download, Users, Share2, MessageCircle } from 'lucide-react'
import { Page, Button, Card, Chips, Empty, Field, Input, Textarea, Tabs, Toggle, MediaPicker, Badge, Avatar, Sheet, Bar, useAction, useConfirm } from '../components/ui'
import AnnouncementCard, { PRIORITY, announcementShareText } from '../components/AnnouncementCard'
import { sortAnnouncements } from './Home'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/db'
import { can } from '../lib/rbac'
import { publishAnnouncement, markAnnouncementRead, acknowledgeAnnouncement, updateAnnouncement, deleteAnnouncement, isActiveAnnouncement, userById, aptNo } from '../lib/actions'
import { fmtDateTime, fmtDate, isoDay, shareOnWhatsApp } from '../lib/utils'
import { noticePdf, openDataUrl, saveBlob } from '../lib/pdf'

export default function Announcements() {
  return (
    <Routes>
      <Route index element={<List />} />
      <Route path="new" element={<NewAnnouncement />} />
      <Route path=":id" element={<Detail />} />
    </Routes>
  )
}

function List() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [f, setF] = useState('active')
  const all = useData((d) => sortAnnouncements(d.list('announcements')))
  const list = all.filter((a) => {
    if (f === 'expired') return !isActiveAnnouncement(a)
    if (!isActiveAnnouncement(a)) return false
    if (f === 'unread') return !a.readBy.includes(user.id)
    if (f === 'ack') return a.requiresAck && !a.ackBy.includes(user.id)
    if (f === 'urgent' || f === 'important') return a.priority === f
    return true
  })
  return (
    <Page title="Announcements" subtitle="Official notices from the committee" back actions={can(user, 'announcement.publish') && <Button size="sm" icon={Plus} onClick={() => nav('new')}>New</Button>}>
      <Chips className="my-3" value={f} onChange={setF} options={[{ value: 'active', label: 'Active' }, { value: 'unread', label: 'Unread' }, { value: 'ack', label: 'Needs acknowledgement' }, { value: 'urgent', label: '🔴 Urgent' }, { value: 'important', label: '🟠 Important' }, { value: 'expired', label: 'Expired' }]} />
      <div className="space-y-3">
        {list.map((a) => <AnnouncementCard key={a.id} a={a} />)}
        {!list.length && <Empty icon={Megaphone} title="Nothing here" text="You’re all caught up." />}
      </div>
    </Page>
  )
}

function Detail() {
  const { id } = useParams()
  const { user, society } = useAuth()
  const nav = useNavigate()
  const act = useAction()
  const ask = useConfirm()
  const a = useData((d) => d.get('announcements', id))
  const residents = useData((d) => d.list('users', (u) => u.status === 'active' && u.apartmentId).length)
  const [stats, setStats] = useState(false)
  useEffect(() => { if (a) markAnnouncementRead(user, a.id) }, [a?.id])
  if (!a) return <Page title="Announcement" back><Empty title="Not found" /></Page>
  const p = PRIORITY[a.priority]
  const author = userById(a.authorId)
  const acked = a.ackBy.includes(user.id)
  const admin = can(user, 'announcement.publish')
  const openAtt = (att) => {
    if (att.url) return openDataUrl(att.url, att.name)
    saveBlob(noticePdf(society, a, author), att.name || 'notice.pdf')
  }
  const share = () => shareOnWhatsApp(announcementShareText(a, society))
  return (
    <Page title="Announcement" back="/announcements" actions={<>
      <Button size="sm" variant="ghost" icon={Share2} aria-label="Share on WhatsApp" onClick={share} />
      {admin && <Button size="sm" variant="ghost" icon={Trash2} onClick={async () => { if (await ask({ title: 'Delete announcement?', danger: true, ok: 'Delete' })) { act(() => deleteAnnouncement(user, a.id), 'Deleted'); nav('/announcements') } }} />}
    </>}>
      <div className="flex items-center gap-2 mt-2">
        <Badge color={p.color}>{p.label}</Badge>
        {a.pinned && <Badge color="gray"><Pin size={11} /> Pinned</Badge>}
        {!isActiveAnnouncement(a) && <Badge color="gray">Expired</Badge>}
      </div>
      <h1 className="text-[22px] font-extrabold leading-tight mt-3">{a.title}</h1>
      <div className="flex items-center gap-2.5 mt-3">
        <Avatar user={author} size={32} />
        <div className="text-xs text-ink-500"><span className="font-semibold text-ink-700">{author?.name}</span> · {author?.role?.replace('_', ' ')}<br />{fmtDateTime(a.createdAt)}{a.expiresAt && ` · valid till ${fmtDate(a.expiresAt)}`}</div>
      </div>
      <Card className="p-5 mt-4"><p className="text-[15px] leading-relaxed text-ink-700 whitespace-pre-line">{a.body}</p></Card>
      <Button block variant="success" className="mt-3" icon={MessageCircle} onClick={share}>Share on WhatsApp</Button>

      {a.attachments?.length > 0 && (
        <>
          <h3 className="font-bold mt-6 mb-2 text-sm">Attachments</h3>
          <div className="space-y-2">
            {a.attachments.map((att, i) => att.type === 'image' && att.url ? (
              <button key={i} onClick={() => openAtt(att)} className="block w-full rounded-2xl overflow-hidden shadow-card"><img src={att.url} alt={att.name} className="w-full" /></button>
            ) : (
              <Card key={i} className="p-3 flex items-center gap-3" onClick={() => openAtt(att)}>
                <div className="h-11 w-11 rounded-xl bg-red-50 text-red-600 grid place-items-center">{att.type === 'image' ? <ImageIcon /> : <FileText />}</div>
                <div className="flex-1 min-w-0"><div className="text-sm font-semibold truncate">{att.name}</div><div className="text-xs text-ink-500">{att.size || 'PDF'} · Tap to open</div></div>
                <Download size={18} className="text-ink-400" />
              </Card>
            ))}
          </div>
        </>
      )}

      {a.requiresAck && (
        <Card className="p-4 mt-6">
          {acked ? (
            <div className="flex items-center gap-3 text-accent-700"><CheckCheck /> <span className="font-semibold">You acknowledged this notice</span></div>
          ) : (
            <>
              <p className="text-sm text-ink-700 mb-3">The committee has requested all residents to acknowledge this notice.</p>
              <Button variant="success" block icon={CheckCheck} onClick={() => act(() => acknowledgeAnnouncement(user, a.id), 'Acknowledged. Thank you!')}>I have read & understood</Button>
            </>
          )}
        </Card>
      )}

      {admin && (
        <Card className="p-4 mt-3" onClick={() => setStats(true)}>
          <div className="flex items-center gap-2 text-sm font-bold"><Users size={16} /> Reach</div>
          <div className="grid grid-cols-2 gap-4 mt-3">
            <div><div className="text-xs text-ink-500">Read</div><div className="font-extrabold text-lg">{a.readBy.length}<span className="text-ink-400 text-sm font-semibold">/{residents}</span></div><Bar value={a.readBy.length} max={residents} /></div>
            {a.requiresAck && <div><div className="text-xs text-ink-500">Acknowledged</div><div className="font-extrabold text-lg">{a.ackBy.length}<span className="text-ink-400 text-sm font-semibold">/{residents}</span></div><Bar value={a.ackBy.length} max={residents} color="bg-accent-500" /></div>}
          </div>
          <div className="flex gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="secondary" icon={Pin} onClick={() => act(() => updateAnnouncement(user, a.id, { pinned: !a.pinned }), a.pinned ? 'Unpinned' : 'Pinned to top')}>{a.pinned ? 'Unpin' : 'Pin'}</Button>
            {isActiveAnnouncement(a) && <Button size="sm" variant="outline" onClick={() => act(() => updateAnnouncement(user, a.id, { expiresAt: new Date().toISOString() }), 'Marked as expired')}>Expire now</Button>}
          </div>
        </Card>
      )}
      <Sheet open={stats} onClose={() => setStats(false)} title="Acknowledgements">
        {a.ackBy.length ? a.ackBy.map((uid) => { const u = userById(uid); return u && <div key={uid} className="flex items-center gap-3 py-2"><Avatar user={u} size={34} /><div className="text-sm font-semibold flex-1">{u.name}</div><span className="text-xs text-ink-500">{aptNo(u.apartmentId)}</span></div> }) : <p className="text-sm text-ink-500">No acknowledgements yet.</p>}
      </Sheet>
    </Page>
  )
}

function NewAnnouncement() {
  const { user } = useAuth()
  const nav = useNavigate()
  const act = useAction()
  const [f, setF] = useState({ title: '', body: '', priority: 'general', pinned: false, requiresAck: false, expiresAt: isoDay(Date.now() + 7 * 86400000) })
  const [files, setFiles] = useState([])
  if (!can(user, 'announcement.publish')) return <Page title="New announcement" back><Empty title="Committee only" text="Only authorised committee members can publish announcements." /></Page>
  const submit = () => {
    const a = act(() => publishAnnouncement(user, {
      ...f, expiresAt: f.expiresAt ? new Date(f.expiresAt + 'T23:59').toISOString() : null,
      attachments: files.map((m) => ({ name: m.name || (m.type === 'pdf' ? 'notice.pdf' : 'image.jpg'), type: m.type === 'pdf' ? 'pdf' : 'image', url: m.url, size: m.size }))
    }), 'Announcement published & residents notified')
    if (a) nav(`/announcements/${a.id}`, { replace: true })
  }
  return (
    <Page title="New announcement" back>
      <Field label="Title"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Water supply interruption" maxLength={120} /></Field>
      <Field label="Message"><Textarea rows={6} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} placeholder="Details residents need to know…" /></Field>
      <Field label="Priority"><Tabs value={f.priority} onChange={(v) => setF({ ...f, priority: v })} tabs={[{ value: 'urgent', label: '🔴 Urgent' }, { value: 'important', label: '🟠 Important' }, { value: 'general', label: 'General' }]} /></Field>
      <Field label="Expires on" hint="It will be hidden from the home screen after this date"><Input type="date" value={f.expiresAt} min={isoDay(new Date())} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} /></Field>
      <Field label="Attachments (images or PDF)"><MediaPicker value={files} onChange={setFiles} allowVideo="pdf" label="Attach" max={4} /></Field>
      <Card className="px-4 divide-y divide-ink-100">
        <Toggle checked={f.pinned} onChange={(v) => setF({ ...f, pinned: v })} label="Pin to top" desc="Stays at the top of everyone’s home screen" />
        <Toggle checked={f.requiresAck} onChange={(v) => setF({ ...f, requiresAck: v })} label="Require acknowledgement" desc="Residents must confirm they have read it" />
      </Card>
      <Button block size="lg" className="mt-6" icon={Megaphone} onClick={submit}>Publish & notify everyone</Button>
    </Page>
  )
}
