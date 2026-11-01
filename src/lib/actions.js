// Domain operations ("API layer"). UI components call these functions instead
// of touching collections directly. Each function validates input and checks
// permissions, mirroring what server-side endpoints / RLS policies would do.
import { db } from './db'
import { can } from './rbac'
import { translate } from '../i18n'
import { uid, otp6, ymOf, monthLabel, fmtDateTime, fmtShort, inr } from './utils'
import { cleanTower, normFlatNumber, flatKey, newFlatId, towerLabel } from './flats'
import { headsOf } from './eventSplit'

export class AppError extends Error {}
const must = (cond, msg) => { if (!cond) throw new AppError(msg) }
const guard = (user, perm) => must(can(user, perm), 'You do not have permission to do this.')
const req = (v, label) => must(v != null && String(v).trim() !== '', `${label} is required.`)

export const userById = (id) => db.get('users', id)
export const aptById = (id) => db.get('apartments', id)
export const aptNo = (id) => aptById(id)?.number || ''
export const residentsOfApt = (aptId) => db.list('users', (u) => u.apartmentId === aptId && u.status === 'active')

// ---------- Notifications ----------
const PREF_OF = { announcements: 'announcements', alert: null, payments: 'payments', complaints: 'complaints', visitors: 'visitors', bookings: 'bookings', events: 'events', social: 'social', marketplace: 'marketplace', polls: 'events', system: null }
let sessionUserId = null
export const setSessionUser = (id) => { sessionUserId = id }

export function notify(targets, { type, title, body = '', link = '', key }) {
  let users
  if (targets === 'all') users = db.list('users', (u) => u.status === 'active')
  else if (targets?.roles) users = db.list('users', (u) => targets.roles.includes(u.role) && u.status === 'active')
  else users = (Array.isArray(targets) ? targets : [targets]).map(userById).filter(Boolean)
  const pref = PREF_OF[type]
  for (const u of users) {
    if (pref && u.prefs?.[pref] === false) continue
    if (key && db.find('notifications', (n) => n.key === key && n.userId === u.id)) continue
    db.insert('notifications', { id: uid('n_'), userId: u.id, type, title, body, link, read: false, key })
    if (u.id === sessionUserId && u.prefs?.push) devicePush(title, body, link)
  }
}

export async function devicePush(title, body, link) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    const reg = await navigator.serviceWorker?.getRegistration()
    const opts = { body, icon: 'pwa-192.png', badge: 'pwa-192.png', data: { link }, tag: link || title }
    opts.body = translate(body)
    if (reg) reg.showNotification(translate(title), opts)
    else new Notification(translate(title), opts)
  } catch { /* unsupported */ }
}

export const markNotificationRead = (id) => db.update('notifications', id, { read: true })
export const markAllRead = (userId) => db.list('notifications', (n) => n.userId === userId && !n.read).forEach((n) => db.update('notifications', n.id, { read: true }))

// ---------- Auth & registration ----------
export function findUserByPhone(phone) {
  const digits = (phone || '').replace(/\D/g, '').slice(-10)
  return db.list('users').find((u) => u.phone.replace(/\D/g, '').slice(-10) === digits)
}

export function registerApartment({ name, phone, email, apartmentId, occupancy }) {
  req(name, 'Name'); req(phone, 'Mobile number'); req(apartmentId, 'Apartment')
  must(/^\d{10}$/.test(phone.replace(/\D/g, '').slice(-10)), 'Enter a valid 10-digit mobile number.')
  must(!findUserByPhone(phone), 'This mobile number is already registered. Please log in.')
  must(!db.find('registrations', (r) => r.phone.replace(/\D/g, '').slice(-10) === phone.replace(/\D/g, '').slice(-10) && r.status === 'pending'), 'A registration request for this number is already pending.')
  const r = db.insert('registrations', { id: uid('reg_'), name: name.trim(), phone: '+91 ' + phone.replace(/\D/g, '').slice(-10), email, apartmentId, occupancy, status: 'pending' })
  notify({ roles: ['super_admin', 'chairman', 'secretary'] }, { type: 'system', title: 'New registration request', body: `${r.name} · ${aptNo(apartmentId)} (${occupancy})`, link: '/admin/residents' })
  return r
}

export function approveRegistration(user, regId, approve = true) {
  guard(user, 'residents.manage')
  const r = db.get('registrations', regId)
  db.update('registrations', regId, { status: approve ? 'approved' : 'rejected', decidedBy: user.id })
  if (approve) {
    db.insert('users', {
      id: uid('u_'), name: r.name, phone: r.phone, email: r.email || '', apartmentId: r.apartmentId, role: 'resident', status: 'active',
      color: '#0EA5E9', avatar: null, bio: '', family: [], vehicles: [], emergencyContact: null, joinedAt: new Date().toISOString(),
      privacy: { showPhone: false, showEmail: false, showApartment: true, showFamily: false, showInDirectory: true },
      prefs: { announcements: true, payments: true, complaints: true, visitors: true, bookings: true, events: true, social: true, marketplace: true, push: false, email: false, sms: false }
    })
    db.update('apartments', r.apartmentId, { occupancy: r.occupancy })
  }
}

export function updateUser(actor, id, patch) {
  must(actor.id === id || can(actor, 'residents.manage'), 'You can only edit your own profile.')
  if (patch.role) guard(actor, 'residents.manage')
  if (patch.name !== undefined) req(patch.name, 'Name')
  return db.update('users', id, patch)
}

// ---------- Flats ----------
// Put a person in a flat (or none, for office staff) and record owner/tenant.
export function setMemberFlat(actor, userId, apartmentId, occupancy) {
  guard(actor, 'residents.manage')
  const u = db.get('users', userId)
  must(u, 'Person not found.')
  if (apartmentId) must(aptById(apartmentId), 'Flat not found.')
  db.update('users', userId, { apartmentId: apartmentId || null })
  if (apartmentId && occupancy && aptById(apartmentId).occupancy !== occupancy) db.update('apartments', apartmentId, { occupancy })
}

const ensureTower = (code) => {
  if (!code || db.list('towers').some((t) => t.code === code)) return
  db.insert('towers', { id: newFlatId(code, new Set(db.list('towers').map((t) => t.id))).replace(/^apt_/, 'tw_'), code, name: towerLabel(code), floors: 0 })
}

// Add (id = null) or edit a flat. The record id never changes, so renaming
// a flat keeps its residents, bills and history attached.
export function saveFlat(actor, id, data) {
  guard(actor, 'residents.manage')
  const number = normFlatNumber(data.number)
  req(number, 'Flat number')
  const tower = cleanTower(data.tower)
  const clash = db.list('apartments').find((a) => a.id !== id && flatKey(a.number) === flatKey(number))
  must(!clash, `Flat ${clash?.number} already exists.`)
  const rec = { number, tower, floor: Number(data.floor) || 0, type: (data.type || '').trim(), area: Number(data.area) || 0, occupancy: data.occupancy === 'tenant' ? 'tenant' : 'owner' }
  must(rec.area >= 0 && rec.floor >= -5 && rec.floor <= 200, 'Check the floor and area.')
  ensureTower(tower)
  if (id) return db.update('apartments', id, rec)
  return db.insert('apartments', { id: newFlatId(number, new Set(db.list('apartments').map((a) => a.id))), ...rec })
}

// What still points at a flat (deleting is only allowed when nothing does).
export function flatUsage(id) {
  const n = (col, f = (x) => x.apartmentId === id) => db.list(col, f).length
  return {
    people: n('users'), bills: n('bills'), payments: n('payments'), bookings: n('bookings'), visitors: n('visitors'),
    complaints: n('complaints'), requests: n('registrations', (r) => r.apartmentId === id && r.status === 'pending')
  }
}

export function deleteFlat(actor, id) {
  guard(actor, 'residents.manage')
  const a = aptById(id)
  must(a, 'Flat not found.')
  const NAMES = { people: ['resident', 'residents'], bills: ['bill', 'bills'], payments: ['payment', 'payments'], bookings: ['booking', 'bookings'], visitors: ['visitor entry', 'visitor entries'], complaints: ['complaint', 'complaints'], requests: ['pending join request', 'pending join requests'] }
  const used = Object.entries(flatUsage(id)).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${NAMES[k][v === 1 ? 0 : 1]}`)
  must(!used.length, `${a.number} cannot be deleted – it still has ${used.join(', ')}. Move or remove those first, or just rename the flat.`)
  db.remove('apartments', id)
  if (a.tower && !db.list('apartments').some((x) => x.tower === a.tower)) {
    const t = db.list('towers').find((x) => x.code === a.tower)
    if (t) db.remove('towers', t.id)
  }
}

// ---------- Announcements ----------
export function publishAnnouncement(user, data) {
  guard(user, 'announcement.publish')
  req(data.title, 'Title'); req(data.body, 'Message')
  const a = db.insert('announcements', { id: uid('an_'), authorId: user.id, readBy: [user.id], ackBy: [], attachments: [], pinned: false, requiresAck: false, priority: 'general', ...data })
  notify('all', { type: 'announcements', title: `${a.priority === 'urgent' ? '🔴 Urgent: ' : a.priority === 'important' ? 'Important: ' : ''}${a.title}`, body: a.body.slice(0, 120), link: `/announcements/${a.id}` })
  return a
}
export const markAnnouncementRead = (user, id) => {
  const a = db.get('announcements', id)
  if (a && !a.readBy.includes(user.id)) db.update('announcements', id, { readBy: [...a.readBy, user.id] })
}
export const acknowledgeAnnouncement = (user, id) => {
  const a = db.get('announcements', id)
  if (a && !a.ackBy.includes(user.id)) db.update('announcements', id, { ackBy: [...a.ackBy, user.id], readBy: a.readBy.includes(user.id) ? a.readBy : [...a.readBy, user.id] })
}
export const updateAnnouncement = (user, id, patch) => { guard(user, 'announcement.publish'); return db.update('announcements', id, patch) }
export const deleteAnnouncement = (user, id) => { guard(user, 'announcement.publish'); db.remove('announcements', id) }
export const isActiveAnnouncement = (a) => !a.expiresAt || new Date(a.expiresAt) > new Date()

// ---------- Feed ----------
export const POST_CATEGORIES = [
  { id: 'general', label: 'General', emoji: '💬' },
  { id: 'events', label: 'Community Events', emoji: '🎉' },
  { id: 'recommendations', label: 'Recommendations', emoji: '⭐' },
  { id: 'lost_found', label: 'Lost & Found', emoji: '🔎' },
  { id: 'buy_sell', label: 'Buy/Sell', emoji: '🏷️' },
  { id: 'help', label: 'Help & Support', emoji: '🤝' },
  { id: 'celebrations', label: 'Celebrations', emoji: '🎊' }
]
export function createPost(user, { text, category, media = [], showApartment = true }) {
  must((text && text.trim()) || media.length, 'Write something or add a photo/video.')
  return db.insert('posts', { id: uid('p_'), userId: user.id, text: (text || '').trim(), category: category || 'general', media, likes: [], comments: [], reports: [], hidden: false, showApartment })
}
export function toggleLike(user, postId) {
  const p = db.get('posts', postId)
  const liked = p.likes.includes(user.id)
  db.update('posts', postId, { likes: liked ? p.likes.filter((x) => x !== user.id) : [...p.likes, user.id] })
  if (!liked && p.userId !== user.id) notify(p.userId, { type: 'social', title: `${user.name} liked your post`, body: p.text.slice(0, 80), link: `/feed/post/${p.id}`, key: `like-${p.id}-${user.id}` })
}
export function addComment(user, postId, text) {
  req(text, 'Comment')
  const p = db.get('posts', postId)
  db.update('posts', postId, { comments: [...p.comments, { id: uid('c_'), userId: user.id, text: text.trim(), createdAt: new Date().toISOString() }] })
  if (p.userId !== user.id) notify(p.userId, { type: 'social', title: `${user.name} commented on your post`, body: text.slice(0, 80), link: `/feed/post/${p.id}` })
}
export function reportPost(user, postId, reason) {
  const p = db.get('posts', postId)
  must(!p.reports.some((r) => r.userId === user.id), 'You have already reported this post.')
  db.update('posts', postId, { reports: [...p.reports, { userId: user.id, reason, at: new Date().toISOString() }] })
  if (p.reports.length === 0) notify({ roles: ['secretary', 'committee', 'super_admin'] }, { type: 'system', title: 'Post reported', body: `Reason: ${reason}`, link: '/admin/moderation' })
}
export function moderatePost(user, postId, action) {
  const p = db.get('posts', postId)
  must(p.userId === user.id || can(user, 'moderation'), 'You do not have permission to do this.')
  if (action === 'delete') db.remove('posts', postId)
  else if (action === 'hide') db.update('posts', postId, { hidden: true, moderatedBy: user.id })
  else if (action === 'restore') db.update('posts', postId, { hidden: false, reports: [] })
}

// ---------- Complaints ----------
export const COMPLAINT_CATEGORIES = ['Plumbing', 'Electrical', 'Lift', 'Cleaning', 'Security', 'Parking', 'Water Supply', 'Noise', 'Common Area', 'Other']
export const SERVICE_CATEGORIES = ['Carpentry', 'Painting', 'Pest Control', 'Appliance Repair', 'Deep Cleaning', 'Plumbing', 'Electrical', 'Other']
export const STATUS_FLOW = ['submitted', 'acknowledged', 'in_progress', 'resolved', 'closed']
export const STATUS_LABEL = { submitted: 'Submitted', acknowledged: 'Acknowledged', in_progress: 'In Progress', resolved: 'Resolved', closed: 'Closed', reopened: 'Reopened' }
export const SLA_HOURS = { urgent: 12, high: 48, medium: 96, low: 168 }

export const isOverdue = (c) => !['resolved', 'closed'].includes(c.status) && (Date.now() - new Date(c.createdAt).getTime()) / 3600000 > SLA_HOURS[c.priority || 'medium']

const prefix = () => db.society()?.prefix || 'PG'
function nextTicket() {
  const n = db.setting('ticketSeq', 1000) + 1
  db.setSetting('ticketSeq', n)
  return `${prefix()}-${n}`
}
export function createComplaint(user, data) {
  req(data.title, 'Title'); req(data.description, 'Description'); req(data.category, 'Category')
  must(data.title.trim().length >= 5, 'Title should be at least 5 characters.')
  const c = db.insert('complaints', {
    id: uid('cp_'), ticket: nextTicket(), kind: data.kind || 'complaint', userId: user.id, apartmentId: user.apartmentId,
    status: 'submitted', assigneeId: null, priority: 'medium', media: [], comments: [], internalNotes: [],
    history: [{ status: 'submitted', at: new Date().toISOString(), by: user.id }], ...data
  })
  notify({ roles: ['facility_manager', 'secretary', 'super_admin'] }, { type: 'complaints', title: `New ${c.kind === 'service' ? 'service request' : 'complaint'} ${c.ticket}`, body: `${c.category} · ${c.title}`, link: `/complaints/${c.id}` })
  return c
}
export function setComplaintStatus(user, id, status, note = '') {
  const c = db.get('complaints', id)
  const owner = c.userId === user.id
  if (status === 'reopened' || (status === 'closed' && owner)) must(owner || can(user, 'complaints.manage'), 'Not allowed.')
  else guard(user, 'complaints.manage')
  const s = status === 'reopened' ? 'submitted' : status
  const patch = { status: s, history: [...c.history, { status, at: new Date().toISOString(), by: user.id, note }] }
  if (status === 'resolved') patch.resolvedAt = new Date().toISOString()
  if (status === 'acknowledged' && !c.acknowledgedAt) patch.acknowledgedAt = new Date().toISOString()
  if (status === 'reopened') { patch.reopenCount = (c.reopenCount || 0) + 1; patch.rating = null }
  db.update('complaints', id, patch)
  if (!owner) notify(c.userId, { type: 'complaints', title: `${c.ticket} is now ${STATUS_LABEL[status]}`, body: note || c.title, link: `/complaints/${c.id}` })
  else if (status === 'reopened') notify({ roles: ['facility_manager', 'secretary'] }, { type: 'complaints', title: `${c.ticket} reopened by resident`, body: note || c.title, link: `/complaints/${c.id}` })
}
export function assignComplaint(user, id, staffId) {
  guard(user, 'complaints.manage')
  const c = db.get('complaints', id)
  const st = db.get('staff', staffId)
  db.update('complaints', id, { assigneeId: staffId, history: [...c.history, { status: 'assigned', at: new Date().toISOString(), by: user.id, note: `Assigned to ${st?.name}` }] })
  if (c.status === 'submitted') setComplaintStatus(user, id, 'acknowledged', `Assigned to ${st?.name} (${st?.role})`)
}
export function addComplaintComment(user, id, text, internal = false) {
  req(text, 'Comment')
  const c = db.get('complaints', id)
  if (internal) guard(user, 'complaints.manage')
  else must(c.userId === user.id || can(user, 'complaints.manage'), 'Not allowed.')
  const entry = { id: uid('cc_'), userId: user.id, text: text.trim(), createdAt: new Date().toISOString() }
  db.update('complaints', id, internal ? { internalNotes: [...c.internalNotes, entry] } : { comments: [...c.comments, entry] })
  if (!internal && c.userId !== user.id) notify(c.userId, { type: 'complaints', title: `New update on ${c.ticket}`, body: text.slice(0, 100), link: `/complaints/${c.id}` })
}
export function rateComplaint(user, id, rating, feedback) {
  const c = db.get('complaints', id)
  must(c.userId === user.id, 'Only the person who raised this can rate it.')
  must(rating >= 1 && rating <= 5, 'Choose a rating.')
  db.update('complaints', id, { rating, feedback, status: 'closed', history: [...c.history, { status: 'closed', at: new Date().toISOString(), by: user.id, note: `Rated ${rating}★` }] })
}

// ---------- Maintenance billing ----------
export const billLabel = (b) => b.title || monthLabel(b.month)
export const billTotal = (b) => b.amount + (b.lateFee || 0) + (b.adjustments || []).reduce((a, x) => a + x.amount, 0)
export const pendingPaymentFor = (billId) => db.find('payments', (p) => p.status === 'pending' && p.billIds?.includes(billId))
export const billStatus = (b) => (b.status === 'paid' ? 'paid' : pendingPaymentFor(b.id) ? 'verifying' : new Date(b.dueDate) < new Date() ? 'overdue' : 'due')
export const billingConfig = () => db.setting('billing', { ratePerSqft: 3, dueDay: 10, lateFee: 200, lateFeeType: 'flat', items: [] })

export function saveBillingConfig(user, cfg) {
  guard(user, 'billing.manage')
  must(cfg.ratePerSqft >= 0, 'Rate per sq.ft must be positive.')
  must(cfg.ratePerSqft > 0 || cfg.items.some((i) => Number(i.amount) > 0), 'Set a rate per sq.ft or at least one fixed charge.')
  must(cfg.dueDay >= 1 && cfg.dueDay <= 28, 'Due day must be between 1 and 28.')
  db.setSetting('billing', cfg)
}
export function generateBills(user, ym = ymOf()) {
  guard(user, 'billing.manage')
  const cfg = billingConfig()
  const [y, m] = ym.split('-').map(Number)
  const occupied = new Set(db.list('users', (u) => u.apartmentId && u.status === 'active').map((u) => u.apartmentId))
  let created = 0
  for (const apt of db.list('apartments')) {
    if (!occupied.has(apt.id)) continue
    const id = `bill_${ym}_${apt.number}`
    if (db.get('bills', id)) continue
    const items = [
      { label: `Maintenance (${apt.area} sq.ft × ₹${cfg.ratePerSqft})`, amount: Math.round(apt.area * cfg.ratePerSqft) },
      ...cfg.items.map((i) => ({ label: i.label, amount: Number(i.amount) })),
      ...db.list('aptCharges', (c) => c.apartmentId === apt.id).map((c) => ({ label: c.label, amount: Number(c.amount) }))
    ].filter((i) => i.amount > 0)
    db.insert('bills', { id, apartmentId: apt.id, month: ym, items, adjustments: [], lateFee: 0, amount: items.reduce((a, b) => a + b.amount, 0), dueDate: new Date(y, m - 1, cfg.dueDay, 23, 59).toISOString(), status: 'unpaid' })
    created++
    residentsOfApt(apt.id).forEach((u) => notify(u.id, { type: 'payments', title: `Maintenance bill for ${monthLabel(ym)}`, body: `Your bill is ready. Due by ${fmtShort(new Date(y, m - 1, cfg.dueDay).toISOString())}.`, link: '/payments', key: `bill-${id}` }))
  }
  return created
}
export function applyLateFees(user) {
  guard(user, 'billing.manage')
  const cfg = billingConfig()
  let n = 0
  db.list('bills', (b) => billStatus(b) === 'overdue' && !b.lateFee).forEach((b) => {
    const fee = cfg.lateFeeType === 'percent' ? Math.round((b.amount * cfg.lateFee) / 100) : Number(cfg.lateFee)
    db.update('bills', b.id, { lateFee: fee }); n++
    residentsOfApt(b.apartmentId).forEach((u) => notify(u.id, { type: 'payments', title: 'Late payment charge applied', body: `${inr(fee)} added to your ${monthLabel(b.month)} bill.`, link: '/payments' }))
  })
  return n
}
export function addAdjustment(user, billId, label, amount) {
  guard(user, 'billing.manage'); req(label, 'Reason')
  must(!isNaN(amount) && Number(amount) !== 0, 'Enter a non-zero amount.')
  const b = db.get('bills', billId)
  must(b.status !== 'paid', 'Bill is already paid.')
  db.update('bills', billId, { adjustments: [...(b.adjustments || []), { label, amount: Number(amount), by: user.id, at: new Date().toISOString() }] })
}
export function waiveLateFee(user, billId) { guard(user, 'billing.manage'); db.update('bills', billId, { lateFee: 0 }) }

export function payBills(user, billIds, method, { offline = false, actor } = {}) {
  must(billIds.length, 'Select at least one bill.')
  must(offline || user?.access !== 'limited', 'Your family account has limited access. Ask the primary member to pay.')
  if (offline) guard(actor, 'billing.manage')
  const bills = billIds.map((id) => db.get('bills', id))
  must(bills.every((b) => b && b.status !== 'paid'), 'One or more bills are already paid.')
  const amount = bills.reduce((a, b) => a + billTotal(b), 0)
  const now = new Date()
  const apt = aptById(bills[0].apartmentId)
  const pay = db.insert('payments', {
    id: uid('pay_'), billIds, apartmentId: bills[0].apartmentId, userId: user?.id || null, amount, method,
    ref: (offline ? 'CASH' : 'TXN') + Date.now().toString().slice(-10), receiptNo: `${prefix()}R/${ymOf(now).replace('-', '')}/${apt.number}/${Math.floor(Math.random() * 900 + 100)}`,
    status: 'success', recordedBy: offline ? actor.id : null
  })
  bills.forEach((b) => db.update('bills', b.id, { status: 'paid', paidAt: now.toISOString(), paymentId: pay.id }))
  residentsOfApt(apt.id).forEach((u) => notify(u.id, { type: 'payments', title: 'Payment successful ✅', body: `${inr(amount)} received for ${apt.number}. Receipt ${pay.receiptNo}`, link: `/payments/receipt/${pay.id}` }))
  return pay
}

// Resident paid by UPI / bank transfer to the society account and reports it.
// The bill stays unpaid until the treasurer verifies the money arrived.
export function reportPayment(user, billIds, { method, ref }) {
  must(billIds.length, 'Select at least one bill.')
  must(user.access !== 'limited', 'Your family account has limited access. Ask the primary member to pay.')
  const r = String(ref || '').trim()
  must(/^[A-Za-z0-9/-]{6,30}$/.test(r), 'Enter the UPI reference (12-digit UTR) or bank reference number.')
  const bills = billIds.map((id) => db.get('bills', id))
  must(bills.every((b) => b && b.status !== 'paid' && b.apartmentId === user.apartmentId), 'One or more bills are already paid.')
  must(!bills.some((b) => pendingPaymentFor(b.id)), 'A payment for this bill is already waiting for verification.')
  const amount = bills.reduce((a, b) => a + billTotal(b), 0)
  const pay = db.insert('payments', { id: uid('pay_'), billIds, apartmentId: user.apartmentId, userId: user.id, amount, method, ref: r, status: 'pending' })
  notify({ roles: ['treasurer', 'chairman', 'super_admin'] }, { type: 'payments', title: 'Payment to verify', body: `${aptNo(user.apartmentId)} paid ${inr(amount)} by ${method} · Ref ${r}`, link: '/admin/billing' })
  return pay
}

export function verifyPayment(actor, payId, approve, reason = '') {
  guard(actor, 'billing.manage')
  const p = db.get('payments', payId)
  must(p && p.status === 'pending', 'This payment has already been handled.')
  const apt = aptById(p.apartmentId)
  const now = new Date().toISOString()
  if (approve) {
    const receiptNo = `${prefix()}R/${ymOf().replace('-', '')}/${apt.number}/${Math.floor(Math.random() * 900 + 100)}`
    p.billIds.forEach((id) => db.update('bills', id, { status: 'paid', paidAt: now, paymentId: p.id }))
    db.update('payments', p.id, { status: 'success', receiptNo, verifiedBy: actor.id, verifiedAt: now })
    residentsOfApt(apt.id).forEach((u) => notify(u.id, { type: 'payments', title: 'Payment received ✅', body: `${inr(p.amount)} received for ${apt.number}. Receipt ${receiptNo}`, link: `/payments/receipt/${p.id}` }))
  } else {
    db.update('payments', p.id, { status: 'rejected', reason, verifiedBy: actor.id, verifiedAt: now })
    residentsOfApt(apt.id).forEach((u) => notify(u.id, { type: 'payments', title: 'Payment could not be verified', body: reason || `We could not find ${inr(p.amount)} with reference ${p.ref}. Please contact the treasurer.`, link: '/payments' }))
  }
}

// ---------- Visitors ----------
export const VISITOR_TYPES = { guest: 'Guest', delivery: 'Delivery', cab: 'Cab', service: 'Service Provider' }
export function preapproveVisitor(user, data) {
  req(data.name, 'Visitor name'); req(data.expectedAt, 'Expected date & time')
  must(user.apartmentId, 'Only residents can invite visitors.')
  const v = db.insert('visitors', { id: uid('vi_'), type: 'guest', guests: 1, ...data, apartmentId: user.apartmentId, hostId: user.id, status: 'preapproved', otp: otp6() })
  notify({ roles: ['security'] }, { type: 'visitors', title: 'Pre-approved visitor', body: `${v.name} for ${aptNo(v.apartmentId)} · ${fmtDateTime(v.expectedAt)}`, link: '/guard' })
  return v
}
export function guardRegisterVisitor(guardUser, data) {
  guard(guardUser, 'visitors.gate')
  req(data.name, 'Visitor name'); req(data.apartmentId, 'Apartment')
  const host = residentsOfApt(data.apartmentId)[0]
  const v = db.insert('visitors', { id: uid('vi_'), ...data, hostId: host?.id || null, status: 'pending', guardId: guardUser.id })
  residentsOfApt(data.apartmentId).forEach((u) => notify(u.id, { type: 'visitors', title: `${VISITOR_TYPES[v.type]} at the gate`, body: `${v.name}${v.company ? ' (' + v.company + ')' : ''} wants to visit ${aptNo(v.apartmentId)}. Tap to approve.`, link: '/visitors' }))
  return v
}
export function respondVisitor(user, id, approve) {
  const v = db.get('visitors', id)
  must(v.apartmentId === user.apartmentId || can(user, 'visitors.gate'), 'Not allowed.')
  must(v.status === 'pending', 'This request has already been handled.')
  db.update('visitors', id, { status: approve ? 'approved' : 'rejected', respondedBy: user.id, respondedAt: new Date().toISOString() })
  notify({ roles: ['security'] }, { type: 'visitors', title: `${approve ? '✅ Approved' : '⛔ Rejected'}: ${v.name}`, body: `${aptNo(v.apartmentId)} ${approve ? 'approved entry' : 'denied entry'}`, link: '/guard' })
}
export function verifyVisitorCode(guardUser, code) {
  guard(guardUser, 'visitors.gate')
  const raw = String(code || '').trim()
  const m = raw.match(/SSV:([^:]+):(\d{6})/)
  const otp = m ? m[2] : raw.replace(/\D/g, '')
  must(/^\d{6}$/.test(otp), 'Enter a valid 6-digit code.')
  const v = db.find('visitors', (x) => x.otp === otp && x.status === 'preapproved')
  must(v, 'No active invitation found for this code.')
  must(!v.validTill || new Date(v.validTill) > new Date(), 'This invitation has expired.')
  return v
}
export function markEntry(guardUser, id) {
  guard(guardUser, 'visitors.gate')
  const v = db.get('visitors', id)
  must(['preapproved', 'approved'].includes(v.status), 'Visitor is not approved for entry.')
  db.update('visitors', id, { status: 'inside', entryAt: new Date().toISOString(), guardId: guardUser.id })
  residentsOfApt(v.apartmentId).forEach((u) => notify(u.id, { type: 'visitors', title: `${v.name} has arrived`, body: `Entered via main gate at ${fmtDateTime(new Date().toISOString())}`, link: '/visitors' }))
}
export function markExit(guardUser, id) {
  guard(guardUser, 'visitors.gate')
  db.update('visitors', id, { status: 'exited', exitAt: new Date().toISOString() })
}
export function cancelInvite(user, id) {
  const v = db.get('visitors', id)
  must(v.hostId === user.id, 'Not allowed.')
  db.update('visitors', id, { status: 'cancelled' })
}

// ---------- Facilities ----------
export const overlaps = (a1, a2, b1, b2) => new Date(a1) < new Date(b2) && new Date(b1) < new Date(a2)
export const activeBookings = (facilityId) => db.list('bookings', (b) => b.facilityId === facilityId && ['pending', 'confirmed'].includes(b.status))
export function createBooking(user, { facilityId, start, end, note }) {
  must(user.apartmentId, 'Only residents can book facilities.')
  must(user.access !== 'limited', 'Your family account has limited access. Ask the primary member to book.')
  const f = db.get('facilities', facilityId)
  must(f?.active, 'Facility is not available.')
  must(new Date(start) > new Date(), 'Please choose a future slot.')
  const clash = activeBookings(facilityId).find((b) => overlaps(start, end, b.start, b.end))
  must(!clash, 'Sorry, this slot was just booked. Please pick another.')
  const weekAgo = Date.now() - 7 * 86400000
  const mine = db.list('bookings', (b) => b.facilityId === facilityId && b.apartmentId === user.apartmentId && ['pending', 'confirmed'].includes(b.status) && new Date(b.start) > weekAgo)
  must(mine.length < 3, 'Booking limit reached: max 3 active bookings per flat per facility each week.')
  const b = db.insert('bookings', { id: uid('bk_'), facilityId, userId: user.id, apartmentId: user.apartmentId, start, end, note, amount: f.charge, status: f.requiresApproval ? 'pending' : 'confirmed' })
  if (f.requiresApproval) notify({ roles: ['facility_manager', 'secretary'] }, { type: 'bookings', title: 'Booking awaiting approval', body: `${f.name} · ${aptNo(user.apartmentId)} · ${fmtDateTime(start)}`, link: '/admin/bookings' })
  notify(user.id, { type: 'bookings', title: f.requiresApproval ? 'Booking request sent' : 'Booking confirmed ✅', body: `${f.name} · ${fmtDateTime(start)}`, link: '/facilities' })
  return b
}
export function cancelBooking(user, id) {
  const b = db.get('bookings', id)
  must(b.userId === user.id || b.apartmentId === user.apartmentId || can(user, 'facilities.manage'), 'Not allowed.')
  db.update('bookings', id, { status: 'cancelled', cancelledBy: user.id })
}
export function decideBooking(user, id, approve, reason = '') {
  guard(user, 'facilities.manage')
  const b = db.get('bookings', id)
  const f = db.get('facilities', b.facilityId)
  db.update('bookings', id, { status: approve ? 'confirmed' : 'rejected', decidedBy: user.id, reason })
  notify(b.userId, { type: 'bookings', title: approve ? `Booking approved: ${f.name}` : `Booking declined: ${f.name}`, body: approve ? fmtDateTime(b.start) : reason || 'Please contact the office.', link: '/facilities' })
}
export function saveFacility(user, id, patch) { guard(user, 'facilities.manage'); return db.update('facilities', id, patch) }

// ---------- Marketplace ----------
export const LISTING_TYPES = { sell: 'For Sale', rent: 'For Rent', service: 'Service', free: 'Free', wanted: 'Wanted' }
export function createListing(user, data) {
  req(data.title, 'Title'); req(data.description, 'Description')
  must(data.type === 'free' || Number(data.price) >= 0, 'Enter a valid price.')
  return db.insert('listings', { id: uid('l_'), userId: user.id, status: 'active', media: [], ...data, price: data.type === 'free' ? 0 : Number(data.price || 0) })
}
export function updateListing(user, id, patch) {
  const l = db.get('listings', id)
  must(l.userId === user.id || can(user, 'moderation'), 'Not allowed.')
  return db.update('listings', id, patch)
}

// ---------- Events ----------
export function createEvent(user, data) {
  guard(user, 'events.create')
  req(data.title, 'Title'); req(data.start, 'Start time'); req(data.venue, 'Venue')
  must(!data.end || new Date(data.end) > new Date(data.start), 'End time must be after start time.')
  const e = db.insert('events', { id: uid('e_'), organizerId: user.id, rsvps: [{ userId: user.id, status: 'going', guests: 0, members: [] }], gallery: [], reminders: [], expenses: [], settlements: [], emoji: '🎉', ...data })
  notify('all', { type: 'events', title: `New event: ${e.title}`, body: `${fmtDateTime(e.start)} · ${e.venue}`, link: `/events/${e.id}` })
  return e
}
// Everyone in my flat I could bring along: flatmates with their own login, and
// family members listed on profiles (those without a login of their own).
export function household(user) {
  if (!user?.apartmentId) return []
  const mates = db.list('users', (u) => u.apartmentId === user.apartmentId && u.id !== user.id && u.status === 'active')
  const out = mates.map((u) => ({ id: u.id, name: u.name, userId: u.id, relation: u.familyOf === user.id ? 'Family' : '' }))
  const seen = new Set(out.map((m) => m.name.trim().toLowerCase()))
  for (const owner of [user, ...mates]) for (const f of owner.family || []) {
    const key = (f.name || '').trim().toLowerCase()
    if (!key || f.hasLogin || seen.has(key)) continue
    seen.add(key)
    out.push({ id: f.id, name: f.name, relation: f.relation || '' })
  }
  return out
}

// status: 'going' | 'maybe' | null (remove). members: household members coming with me.
export function rsvpEvent(user, id, status, { guests = 0, members = [] } = {}) {
  const e = db.get('events', id)
  must(e, 'Event not found.')
  guests = Math.max(0, Math.min(50, Math.floor(Number(guests) || 0)))
  members = status === 'going' ? members.map((m) => ({ id: m.id, name: m.name, ...(m.userId ? { userId: m.userId } : {}) })) : []
  const others = e.rsvps.filter((r) => r.userId !== user.id)
  const taken = others.filter((r) => r.status === 'going').reduce((a, r) => a + headsOf(r), 0)
  if (status === 'going' && e.capacity) must(taken + 1 + members.length + guests <= e.capacity, `Sorry, only ${Math.max(0, e.capacity - taken)} place(s) left.`)
  db.update('events', id, { rsvps: status ? [...others, { userId: user.id, status, guests: status === 'going' ? guests : 0, members }] : others })
}

// ---------- Event expenses (shared costs, split among attendees) ----------
const eventAdmin = (user, e) => e.organizerId === user.id || can(user, 'announcement.publish')
export function addEventExpense(user, id, { amount, title, receipt }) {
  const e = db.get('events', id)
  must(e, 'Event not found.')
  const amt = Math.round(Number(amount) * 100) / 100
  must(amt > 0 && amt <= 10000000, 'Enter the amount you paid.')
  req(title, 'What was it for')
  const x = { id: uid('ex_'), userId: user.id, amount: amt, title: String(title).trim().slice(0, 80), receipt: receipt || null, at: new Date().toISOString() }
  db.update('events', id, { expenses: [...(e.expenses || []), x] })
  const ids = e.rsvps.filter((r) => r.status === 'going' && r.userId !== user.id).map((r) => r.userId)
  if (ids.length) notify(ids, { type: 'events', title: `${user.name} added ${inr(amt)} to ${e.title}`, body: x.title, link: `/events/${id}` })
  return x
}
export function removeEventExpense(user, id, expId) {
  const e = db.get('events', id)
  const x = (e.expenses || []).find((y) => y.id === expId)
  must(x, 'Expense not found.')
  must(x.userId === user.id || eventAdmin(user, e), 'Only the person who added it or the organiser can remove it.')
  db.update('events', id, { expenses: e.expenses.filter((y) => y.id !== expId) })
}
export function recordSettlement(user, id, { from, to, amount }) {
  const e = db.get('events', id)
  must(from === user.id || to === user.id, 'You can only record a payment you made or received.')
  const amt = Math.round(Number(amount) * 100) / 100
  must(amt > 0, 'Enter the amount.')
  db.update('events', id, { settlements: [...(e.settlements || []), { id: uid('st_'), userId: user.id, from, to, amount: amt, at: new Date().toISOString() }] })
  const other = from === user.id ? to : from
  notify(other, { type: 'events', title: from === user.id ? `${user.name} paid you ${inr(amt)} for ${e.title}` : `${user.name} confirmed your payment of ${inr(amt)} for ${e.title}`, link: `/events/${id}` })
}
export function removeSettlement(user, id, stId) {
  const e = db.get('events', id)
  const s = (e.settlements || []).find((y) => y.id === stId)
  must(s && (s.userId === user.id || eventAdmin(user, e)), 'Not allowed.')
  db.update('events', id, { settlements: e.settlements.filter((y) => y.id !== stId) })
}
export function setEventSplit(user, id, split) {
  const e = db.get('events', id)
  must(eventAdmin(user, e), 'Only the organiser can change how costs are split.')
  db.update('events', id, { split: split === 'family' ? 'family' : 'person' })
}
export function toggleReminder(user, id) {
  const e = db.get('events', id)
  const on = e.reminders.includes(user.id)
  db.update('events', id, { reminders: on ? e.reminders.filter((x) => x !== user.id) : [...e.reminders, user.id] })
  return !on
}
export function addEventPhotos(user, id, urls) {
  const e = db.get('events', id)
  db.update('events', id, { gallery: [...e.gallery, ...urls.map((url) => ({ id: uid('g_'), url, userId: user.id }))] })
}

// ---------- Polls ----------
export const voterKey = (poll, user) => (poll.eligibility === 'apartment' ? user.apartmentId : user.id)
export const pollOpen = (p) => new Date(p.closesAt) > new Date()
export function canVote(poll, user) {
  if (!user.apartmentId) return { ok: false, reason: 'Only residents can vote.' }
  if (poll.eligibility === 'owners' && aptById(user.apartmentId)?.occupancy === 'tenant') return { ok: false, reason: 'Only owners are eligible for this poll.' }
  if (!pollOpen(poll)) return { ok: false, reason: 'This poll is closed.' }
  const key = poll.eligibility === 'owners' ? user.apartmentId : voterKey(poll, user)
  const v = poll.votes.find((x) => x.voterKey === key)
  if (v) return { ok: false, reason: v.userId === user.id ? 'You have voted.' : `Your flat has already voted (${userById(v.userId)?.name?.split(' ')[0] || 'family member'}).`, voted: v }
  return { ok: true }
}
export function createPoll(user, data) {
  guard(user, 'polls.create')
  req(data.question, 'Question')
  const opts = data.options.map((t) => t.trim()).filter(Boolean)
  must(opts.length >= 2, 'Add at least two options.')
  must(new Set(opts).size === opts.length, 'Options must be unique.')
  must(new Date(data.closesAt) > new Date(), 'Closing date must be in the future.')
  const p = db.insert('polls', { id: uid('po_'), createdBy: user.id, votes: [], ...data, options: opts.map((text, i) => ({ id: 'o' + (i + 1), text })) })
  notify('all', { type: 'polls', title: `New poll: ${p.question}`, body: `Closes ${fmtShort(p.closesAt)}`, link: '/polls' })
  return p
}
export function castVote(user, pollId, optionIds) {
  const p = db.get('polls', pollId)
  const chk = canVote(p, user)
  must(chk.ok, chk.reason)
  must(optionIds.length >= 1, 'Select an option.')
  must(p.multi || optionIds.length === 1, 'Only one option allowed.')
  const key = p.eligibility === 'owners' ? user.apartmentId : voterKey(p, user)
  db.update('polls', pollId, { votes: [...p.votes, { voterKey: key, userId: user.id, optionIds, at: new Date().toISOString() }] })
}
export function closePoll(user, id) { guard(user, 'polls.create'); db.update('polls', id, { closesAt: new Date().toISOString() }) }

// ---------- Emergency ----------
export function sendEmergencyAlert(user, { title, message, severity }) {
  guard(user, 'emergency.alert')
  req(title, 'Alert title'); req(message, 'Message')
  const a = db.insert('alerts', { id: uid('al_'), title, message, severity: severity || 'high', by: user.id, active: true })
  notify('all', { type: 'alert', title: `🚨 ${title}`, body: message, link: '/emergency' })
  return a
}
export function resolveAlert(user, id) { guard(user, 'emergency.alert'); db.update('alerts', id, { active: false, resolvedAt: new Date().toISOString() }) }

// ---------- Scheduled reminders (run on app open) ----------
export function runReminders(user) {
  if (!user) return
  const now = Date.now()
  if (user.apartmentId) {
    db.list('bills', (b) => b.apartmentId === user.apartmentId && b.status !== 'paid').forEach((b) => {
      const days = (new Date(b.dueDate).getTime() - now) / 86400000
      if (days >= 0 && days <= 5) notify(user.id, { type: 'payments', title: 'Maintenance due soon', body: `${inr(billTotal(b))} for ${monthLabel(b.month)} is due ${fmtShort(b.dueDate)}.`, link: '/payments', key: `due-${b.id}` })
      else if (days < 0) notify(user.id, { type: 'payments', title: 'Maintenance overdue', body: `${inr(billTotal(b))} for ${monthLabel(b.month)} is overdue. Please pay to avoid further charges.`, link: '/payments', key: `overdue-${b.id}` })
    })
  }
  db.list('events', (e) => e.reminders.includes(user.id) || e.rsvps.some((r) => r.userId === user.id && r.status === 'going')).forEach((e) => {
    const h = (new Date(e.start).getTime() - now) / 3600000
    if (h > 0 && h <= 24) notify(user.id, { type: 'events', title: `Reminder: ${e.title}`, body: `Starts ${fmtDateTime(e.start)} · ${e.venue}`, link: `/events/${e.id}`, key: `rem-${e.id}` })
  })
}
