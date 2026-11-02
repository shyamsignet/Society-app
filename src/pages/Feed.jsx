import { useState } from 'react'
import { Routes, Route, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Send, ImagePlus, AlertTriangle } from 'lucide-react'
import { Page, Button, Textarea, MediaPicker, Toggle, Avatar, Card, Empty, Chips, useAction } from '../components/ui'
import PostCard from '../components/PostCard'
import AnnouncementCard from '../components/AnnouncementCard'
import { can } from '../lib/rbac'
import { isActiveAnnouncement } from '../lib/actions'
import { sortAnnouncements } from './Home'
import { useAuth } from '../lib/auth'
import { useData } from '../lib/db'
import { POST_CATEGORIES, createPost, addComment, userById, aptNo } from '../lib/actions'
import { cls, timeAgo } from '../lib/utils'

export default function Feed() {
  return (
    <Routes>
      <Route index element={<FeedHome />} />
      <Route path="new" element={<NewPost />} />
      <Route path="post/:id" element={<PostDetail />} />
    </Routes>
  )
}

// Community feed: neighbours' posts mixed with active committee notices, newest first.
function FeedHome() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [cat, setCat] = useState('all')
  const announcements = useData((d) => sortAnnouncements(d.list('announcements', isActiveAnnouncement)))
  const posts = useData((d) => d.list('posts', (p) => !p.hidden || p.userId === user.id || can(user, 'moderation')).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
  const counts = posts.reduce((m, p) => ({ ...m, [p.category]: (m[p.category] || 0) + 1 }), {})
  const feedItems = [...posts.map((p) => ({ kind: 'post', item: p })), ...announcements.map((a) => ({ kind: 'notice', item: a }))]
    .sort((x, y) => new Date(y.item.createdAt) - new Date(x.item.createdAt))
  const shown = cat === 'all' ? feedItems : cat === 'notices' ? feedItems.filter((f) => f.kind === 'notice') : feedItems.filter((f) => f.kind === 'post' && f.item.category === cat)
  return (
    <Page title="Community feed" subtitle="Posts from your neighbours and committee notices">
      <Card className="p-3 flex items-center gap-3 mb-3 mt-1" onClick={() => nav('/feed/new')}>
        <Avatar user={user} size={38} />
        <span className="flex-1 text-sm text-ink-400">Share something with your neighbours…</span>
        <ImagePlus size={20} className="text-accent-600" />
      </Card>
      <Chips className="mb-3" value={cat} onChange={setCat} options={[{ value: 'all', label: 'All', count: feedItems.length }, { value: 'notices', label: '📢 Notices', count: announcements.length }, ...POST_CATEGORIES.map((c) => ({ value: c.id, label: `${c.emoji} ${c.label}`, count: counts[c.id] || 0 }))]} />
      <div className="space-y-3">
        {shown.map((f) => f.kind === 'notice' ? <AnnouncementCard key={'n' + f.item.id} a={f.item} feed /> : <PostCard key={f.item.id} post={f.item} />)}
        {!shown.length && <Empty icon={AlertTriangle} title="No posts here yet" text="Be the first to post in this category." action={cat !== 'notices' && <Button onClick={() => nav(`/feed/new?cat=${cat === 'all' ? 'general' : cat}`)}>Create post</Button>} />}
      </div>
    </Page>
  )
}

const PLACEHOLDER = {
  general: 'Share an update with your neighbours…', events: 'Tell everyone about a community activity…', recommendations: 'Ask for or share a recommendation…',
  lost_found: 'What did you lose or find? Where and when?', buy_sell: 'What are you buying or selling? Add price and photos.', help: 'How can neighbours help you?', celebrations: 'Share your happy moment! 🎉'
}

function NewPost() {
  const { user } = useAuth()
  const nav = useNavigate()
  const act = useAction()
  const [sp] = useSearchParams()
  const initial = POST_CATEGORIES.some((c) => c.id === sp.get('cat')) ? sp.get('cat') : 'general'
  const [category, setCategory] = useState(initial)
  const [text, setText] = useState('')
  const [media, setMedia] = useState([])
  const [showApartment, setShowApt] = useState(user.privacy?.showApartment !== false)
  const submit = () => {
    const p = act(() => createPost(user, { text, category, media, showApartment }), 'Posted to the community feed')
    if (p) nav('/', { replace: true })
  }
  return (
    <Page title={category === 'lost_found' ? 'Lost & Found post' : 'Create post'} back actions={<Button size="sm" icon={Send} onClick={submit} disabled={!text.trim() && !media.length}>Post</Button>}>
      <div className="flex items-center gap-3 mt-2 mb-4">
        <Avatar user={user} size={44} />
        <div><div className="font-bold">{user.name}</div><div className="text-xs text-ink-500">{showApartment && user.apartmentId ? aptNo(user.apartmentId) + ' · ' : ''}Visible to all society members</div></div>
      </div>
      <div className="text-[13px] font-semibold text-ink-700 mb-2">Category</div>
      <div className="flex flex-wrap gap-2 mb-4">
        {POST_CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => setCategory(c.id)} className={cls('h-9 px-3 rounded-full text-[13px] font-semibold border transition', category === c.id ? 'bg-brand-800 text-white border-brand-800' : 'bg-white border-ink-200 text-ink-700')}>{c.emoji} {c.label}</button>
        ))}
      </div>
      <Textarea autoFocus rows={6} placeholder={PLACEHOLDER[category]} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
      <div className="text-right text-[11px] text-ink-400 mt-1 mb-3">{text.length}/2000</div>
      <MediaPicker value={media} onChange={setMedia} label="Photo/Video" />
      <Card className="px-4 mt-5"><Toggle checked={showApartment} onChange={setShowApt} label="Show my apartment number" desc="Neighbours will see your flat number on this post" /></Card>
      <Button block size="lg" className="mt-6" onClick={submit} disabled={!text.trim() && !media.length}>Post to community</Button>
    </Page>
  )
}

function PostDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const act = useAction()
  const post = useData((d) => d.get('posts', id))
  const [text, setText] = useState('')
  if (!post) return <Page title="Post" back><Empty title="Post not found" text="It may have been removed." /></Page>
  const send = () => { if (act(() => addComment(user, post.id, text))) setText('') }
  return (
    <Page title="Post" back>
      <div className="mt-2"><PostCard post={post} full /></div>
      <h3 className="font-bold mt-6 mb-3">Comments ({post.comments.length})</h3>
      <div className="space-y-3 mb-24">
        {post.comments.map((c) => {
          const u = userById(c.userId)
          return (
            <div key={c.id} className="flex gap-2.5">
              <Avatar user={u} size={34} />
              <div className="flex-1 bg-white rounded-2xl rounded-tl-md px-3.5 py-2.5 shadow-card">
                <div className="text-[13px] font-bold">{u?.name} <span className="font-normal text-ink-400 text-[11px] ml-1">{timeAgo(c.createdAt)}</span></div>
                <div className="text-sm text-ink-700 mt-0.5 whitespace-pre-line">{c.text}</div>
              </div>
            </div>
          )
        })}
        {!post.comments.length && <p className="text-sm text-ink-400 text-center py-6">No comments yet. Start the conversation!</p>}
      </div>
      <div className="fixed bottom-16 inset-x-0 mx-auto max-w-[520px] bg-white border-t border-ink-200 p-3 flex gap-2 z-30">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Write a comment…" className="flex-1 h-11 rounded-full bg-ink-100 px-4 text-[15px] outline-none focus:ring-2 focus:ring-brand-200" />
        <button aria-label="Send" onClick={send} disabled={!text.trim()} className="h-11 w-11 rounded-full bg-brand-800 text-white grid place-items-center disabled:opacity-40"><Send size={18} /></button>
      </div>
    </Page>
  )
}
