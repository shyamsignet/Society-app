import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, MessageCircle, Share2, MoreHorizontal, Flag, Trash2, EyeOff } from 'lucide-react'
import { Avatar, Card, MediaGrid, Sheet, Button, useAction, useConfirm, useToast } from './ui'
import { useAuth } from '../lib/auth'
import { can } from '../lib/rbac'
import { POST_CATEGORIES, toggleLike, reportPost, moderatePost, userById, aptNo } from '../lib/actions'
import { timeAgo, fmtDateTime, cls, shareText } from '../lib/utils'

export const catOf = (id) => POST_CATEGORIES.find((c) => c.id === id) || POST_CATEGORIES[0]

export default function PostCard({ post, full }) {
  const { user, society } = useAuth()
  const nav = useNavigate()
  const act = useAction()
  const ask = useConfirm()
  const toast = useToast()
  const [menu, setMenu] = useState(false)
  const [reporting, setReporting] = useState(false)
  const author = userById(post.userId)
  const liked = post.likes.includes(user.id)
  const cat = catOf(post.category)
  const showApt = post.showApartment && author?.privacy?.showApartment !== false && author?.apartmentId
  const [pop, setPop] = useState(false)

  const like = () => { act(() => toggleLike(user, post.id)); if (!liked) { setPop(true); setTimeout(() => setPop(false), 400) } }
  const share = async () => {
    const r = await shareText({ title: society.name || 'SociYo', text: `${author?.name}: ${post.text}` })
    if (r === 'copied') toast('Post copied to clipboard')
  }
  const remove = async () => {
    setMenu(false)
    if (await ask({ title: 'Delete this post?', text: 'This cannot be undone.', ok: 'Delete', danger: true })) act(() => moderatePost(user, post.id, 'delete'), 'Post deleted')
    if (full) nav('/')
  }
  const text = post.text
  const long = !full && text.length > 220

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <Avatar user={author} size={42} />
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold text-ink-900 truncate">{author?.name || 'Former resident'}</div>
          <div className="text-xs text-ink-500 truncate">{showApt ? aptNo(author.apartmentId) + ' · ' : ''}<span title={fmtDateTime(post.createdAt)}>{timeAgo(post.createdAt)}</span></div>
        </div>
        <span className="text-[11px] font-semibold text-ink-500 bg-ink-100 rounded-full px-2.5 py-1 whitespace-nowrap">{cat.emoji} {cat.label}</span>
        <button aria-label="More" onClick={() => setMenu(true)} className="h-8 w-8 -mr-2 grid place-items-center rounded-full text-ink-400 hover:bg-ink-100"><MoreHorizontal size={20} /></button>
      </div>
      {post.hidden && <div className="mt-3 text-xs font-semibold text-amber-700 bg-amber-50 rounded-lg px-3 py-2">Hidden by moderators – only visible to you and admins.</div>}
      {text && (
        <p onClick={() => !full && nav(`/feed/post/${post.id}`)} className={cls('mt-3 text-[15px] leading-relaxed text-ink-900 whitespace-pre-line', long && 'line-clamp-3')}>{text}</p>
      )}
      {long && <button onClick={() => nav(`/feed/post/${post.id}`)} className="text-sm font-semibold text-brand-600 mt-1">Read more</button>}
      <MediaGrid media={post.media} className="mt-3" />
      <div className="flex items-center gap-1 mt-3 -mx-2 text-ink-500">
        <button onClick={like} className={cls('flex items-center gap-1.5 h-9 px-2.5 rounded-full text-sm font-semibold transition hover:bg-ink-100', liked && 'text-red-500')}>
          <Heart size={20} fill={liked ? 'currentColor' : 'none'} className={cls(pop && 'animate-pop')} />{post.likes.length || ''}
        </button>
        <button onClick={() => nav(`/feed/post/${post.id}`)} className="flex items-center gap-1.5 h-9 px-2.5 rounded-full text-sm font-semibold hover:bg-ink-100">
          <MessageCircle size={20} />{post.comments.length || ''}
        </button>
        <button onClick={share} className="flex items-center gap-1.5 h-9 px-2.5 rounded-full text-sm font-semibold hover:bg-ink-100"><Share2 size={19} /></button>
        {post.likes.length > 0 && <span className="ml-auto text-xs text-ink-400 pr-2">{`${post.likes.length} ${post.likes.length === 1 ? 'like' : 'likes'} · ${post.comments.length} comments`}</span>}
      </div>

      <Sheet open={menu} onClose={() => setMenu(false)}>
        <div className="divide-y divide-ink-100">
          {post.userId !== user.id && <MenuBtn icon={Flag} label="Report post" onClick={() => { setMenu(false); setReporting(true) }} />}
          {can(user, 'moderation') && !post.hidden && post.userId !== user.id && <MenuBtn icon={EyeOff} label="Hide post (moderator)" onClick={() => { setMenu(false); act(() => moderatePost(user, post.id, 'hide'), 'Post hidden') }} />}
          {(post.userId === user.id || can(user, 'moderation')) && <MenuBtn icon={Trash2} label="Delete post" danger onClick={remove} />}
          <MenuBtn icon={Share2} label="Share" onClick={() => { setMenu(false); share() }} />
        </div>
      </Sheet>
      <Sheet open={reporting} onClose={() => setReporting(false)} title="Report this post">
        <p className="text-sm text-ink-500 mb-4">Reports are anonymous and reviewed by the society committee.</p>
        <div className="space-y-2">
          {['Spam or scam', 'Offensive or abusive', 'Harassment', 'False information', 'Not relevant to the society'].map((r) => (
            <Button key={r} variant="outline" block className="justify-start" onClick={() => { setReporting(false); act(() => reportPost(user, post.id, r), 'Thanks — the committee will review this post') }}>{r}</Button>
          ))}
        </div>
      </Sheet>
    </Card>
  )
}

const MenuBtn = ({ icon: Icon, label, onClick, danger }) => (
  <button onClick={onClick} className={cls('w-full flex items-center gap-3 py-4 text-[15px] font-semibold', danger ? 'text-red-600' : 'text-ink-900')}><Icon size={20} />{label}</button>
)
