// Realistic demo data for "Palm Grove Residency", Pune.
// All dates are generated relative to "now" so the demo always looks current.
import { artImage, daysFromNow, hoursAgo, ymOf, addMonths } from './utils'

const SID = 'soc_palmgrove'

const FIRST = ['Priya', 'Rajesh', 'Meera', 'Anil', 'Farah', 'Vikram', 'Sneha', 'Arjun', 'Kavita', 'Rohan', 'Neha', 'Sanjay', 'Pooja', 'Amit', 'Divya', 'Karan', 'Anjali', 'Rahul', 'Lakshmi', 'Imran', 'Shreya', 'Nikhil', 'Ritu', 'Harish', 'Swati', 'Deepak', 'Aisha', 'Manoj', 'Tanvi', 'Gaurav']
const LAST = ['Sharma', 'Kulkarni', 'Iyer', 'Deshpande', 'Khan', 'Mehta', 'Joshi', 'Nair', 'Reddy', 'Gupta', 'Patil', 'Bose', 'Kapoor', 'Verma', 'Menon', 'Singh', 'Rao', 'Shah', 'Pillai', 'Sheikh', 'Bhat', 'Chopra', 'Agarwal', 'Kamat', 'Gokhale', 'Pandey', 'Siddiqui', 'Jain', 'Desai', 'Saxena']
const COLORS = ['#F97316', '#0EA5E9', '#8B5CF6', '#EC4899', '#14B8A6', '#EAB308', '#6366F1', '#EF4444', '#22C55E', '#06B6D4']

export function buildSeed() {
  const now = new Date()
  const curYM = ymOf(now)
  const s = {
    societies: [{
      id: SID, name: 'Palm Grove Residency', short: 'Palm Grove', city: 'Baner, Pune',
      address: 'Survey No. 42, Baner–Pashan Link Road, Baner, Pune 411045',
      regNo: 'PNA/PNA(4)/HSG/(TC)/1234/2016', logoEmoji: '🌴', createdAt: hoursAgo(9000)
    }],
    towers: ['A', 'B', 'C'].map((t) => ({ id: 'tw_' + t, societyId: SID, name: 'Tower ' + t, code: t, floors: 6 })),
    apartments: [], users: [], staff: [], contacts: [], announcements: [], posts: [], bills: [], payments: [],
    aptCharges: [], complaints: [], visitors: [], facilities: [], bookings: [], listings: [], events: [],
    polls: [], notifications: [], alerts: [], registrations: [], settings: []
  }

  // Apartments: 3 towers × 6 floors × 4 units
  for (const t of ['A', 'B', 'C']) for (let f = 1; f <= 6; f++) for (let u = 1; u <= 4; u++) {
    const no = `${t}-${f}0${u}`
    const big = u === 1 || u === 4
    s.apartments.push({ id: 'apt_' + no, societyId: SID, number: no, tower: t, floor: f, type: big ? '3 BHK' : '2 BHK', area: big ? 1450 : 1050, occupancy: 'owner', createdAt: hoursAgo(9000) })
  }

  const defaultPrivacy = { showPhone: false, showEmail: false, showApartment: true, showFamily: false, showInDirectory: true }
  const defaultPrefs = { announcements: true, payments: true, complaints: true, visitors: true, bookings: true, events: true, social: true, marketplace: true, push: false, email: false, sms: false }
  const mkUser = (id, name, apt, role, extra = {}) => ({
    id, societyId: SID, name, apartmentId: apt ? 'apt_' + apt : null, role, status: 'active',
    phone: '+91 98' + String(Math.abs(hash(id)) % 100000000).padStart(8, '0'),
    email: name.toLowerCase().replace(/[^a-z]/g, '.') + '@example.com',
    color: COLORS[Math.abs(hash(id)) % COLORS.length], avatar: null, bio: '',
    privacy: { ...defaultPrivacy }, prefs: { ...defaultPrefs }, family: [], vehicles: [],
    emergencyContact: null, joinedAt: hoursAgo(24 * (100 + (Math.abs(hash(id)) % 900))), ...extra, createdAt: hoursAgo(5000)
  })

  s.users.push(
    mkUser('u_priya', 'Priya Sharma', 'A-302', 'resident', {
      phone: '+91 98220 11302', email: 'priya.sharma@example.com', bio: 'Yoga lover · Runs the Sunday book club 📚',
      privacy: { ...defaultPrivacy, showPhone: true },
      family: [
        { id: 'f1', name: 'Rohit Sharma', relation: 'Spouse', phone: '+91 98220 22302', access: 'full' },
        { id: 'f2', name: 'Aarav Sharma', relation: 'Son', phone: '', access: 'limited' },
        { id: 'f3', name: 'Kamla Sharma', relation: 'Mother', phone: '+91 98220 33302', access: 'limited' }
      ],
      vehicles: [{ id: 'v1', number: 'MH 12 QW 4521', type: 'Car', model: 'Hyundai Creta', slot: 'P-A12' }, { id: 'v2', number: 'MH 12 KL 8890', type: 'Two-wheeler', model: 'Honda Activa', slot: 'T-A31' }],
      emergencyContact: { name: 'Rohit Sharma', relation: 'Spouse', phone: '+91 98220 22302' }
    }),
    mkUser('u_rajesh', 'Rajesh Kulkarni', 'B-401', 'chairman', { phone: '+91 98230 40401', privacy: { ...defaultPrivacy, showPhone: true, showEmail: true } }),
    mkUser('u_meera', 'Meera Iyer', 'C-202', 'secretary', { phone: '+91 98230 20202', privacy: { ...defaultPrivacy, showPhone: true } }),
    mkUser('u_anil', 'Anil Deshpande', 'A-501', 'treasurer', { phone: '+91 98230 50501', privacy: { ...defaultPrivacy, showPhone: true } }),
    mkUser('u_farah', 'Farah Khan', 'B-103', 'committee', { privacy: { ...defaultPrivacy, showPhone: true } }),
    mkUser('u_suresh', 'Suresh Patil', null, 'facility_manager', { phone: '+91 97300 11122', privacy: { ...defaultPrivacy, showPhone: true } }),
    mkUser('u_ramesh', 'Ramesh Yadav', null, 'security', { phone: '+91 97300 55511' }),
    mkUser('u_admin', 'Society Office', null, 'super_admin', { phone: '+91 20 2729 0000', email: 'office@palmgrove.example.com' })
  )

  // Other residents spread across apartments
  const taken = new Set(['A-302', 'B-401', 'C-202', 'A-501', 'B-103'])
  let n = 0
  for (const apt of s.apartments) {
    if (taken.has(apt.number)) continue
    if (n >= 46) break
    if ((hash(apt.number) % 7) === 0) continue // some vacant / unregistered
    const name = `${FIRST[(n + 5) % FIRST.length]} ${LAST[(n * 7 + 3) % LAST.length]}`
    const u = mkUser('u_r' + n, name, apt.number, 'resident')
    if (n % 3 === 0) u.privacy.showPhone = true
    if (n % 9 === 4) { apt.occupancy = 'tenant' }
    s.users.push(u)
    n++
  }
  const R = (i) => s.users.find((u) => u.id === 'u_r' + i)

  s.registrations.push(
    { id: 'reg1', societyId: SID, name: 'Varun Malhotra', phone: '+91 99870 66104', email: 'varun.m@example.com', apartmentId: 'apt_C-604', occupancy: 'tenant', status: 'pending', createdAt: hoursAgo(20) },
    { id: 'reg2', societyId: SID, name: 'Isha Banerjee', phone: '+91 99870 12203', email: 'isha.b@example.com', apartmentId: 'apt_B-203', occupancy: 'owner', status: 'pending', createdAt: hoursAgo(50) }
  )

  s.staff = [
    { id: 'st1', name: 'Mahesh Jadhav', role: 'Plumber', phone: '+91 97300 22001', skills: ['Plumbing', 'Water Supply'] },
    { id: 'st2', name: 'Ganesh More', role: 'Electrician', phone: '+91 97300 22002', skills: ['Electrical'] },
    { id: 'st3', name: 'Sunita Kamble', role: 'Housekeeping Supervisor', phone: '+91 97300 22003', skills: ['Cleaning', 'Common Area'] },
    { id: 'st4', name: 'Otis Elevators (AMC)', role: 'Lift Technician', phone: '1800 266 6847', skills: ['Lift'] },
    { id: 'st5', name: 'Ramesh Yadav', role: 'Security Supervisor', phone: '+91 97300 55511', skills: ['Security', 'Parking', 'Noise'] },
    { id: 'st6', name: 'Suresh Patil', role: 'Facility Manager', phone: '+91 97300 11122', skills: ['Other', 'Common Area'] }
  ].map((x) => ({ ...x, societyId: SID }))

  s.contacts = [
    { id: 'c1', group: 'Society', name: 'Management Office', phone: '+91 20 2729 0000', note: 'Mon–Sat · 9 AM – 6 PM', icon: 'building' },
    { id: 'c2', group: 'Society', name: 'Security Desk (Main Gate)', phone: '+91 97300 55500', note: '24 × 7', icon: 'shield' },
    { id: 'c3', group: 'Society', name: 'Facility Manager – Suresh Patil', phone: '+91 97300 11122', note: 'Maintenance & facilities', icon: 'wrench' },
    { id: 'c4', group: 'Maintenance', name: 'Ganesh More – Electrician', phone: '+91 97300 22002', note: '8 AM – 8 PM', icon: 'zap' },
    { id: 'c5', group: 'Maintenance', name: 'Mahesh Jadhav – Plumber', phone: '+91 97300 22001', note: '8 AM – 8 PM', icon: 'droplet' },
    { id: 'c6', group: 'Maintenance', name: 'Sunita Kamble – Housekeeping', phone: '+91 97300 22003', note: '7 AM – 5 PM', icon: 'sparkles' },
    { id: 'c7', group: 'Maintenance', name: 'Otis Lift Helpline', phone: '1800 266 6847', note: 'AMC emergency line', icon: 'arrow-up-down' },
    { id: 'c8', group: 'Emergency', name: 'National Emergency', phone: '112', note: 'All emergencies', icon: 'siren' },
    { id: 'c9', group: 'Emergency', name: 'Ambulance', phone: '108', note: 'Medical emergency', icon: 'ambulance' },
    { id: 'c10', group: 'Emergency', name: 'Fire Brigade', phone: '101', note: 'Fire emergency', icon: 'flame' },
    { id: 'c11', group: 'Emergency', name: 'Police', phone: '100', note: 'Baner Police Station', icon: 'badge' },
    { id: 'c12', group: 'Emergency', name: 'Jupiter Hospital, Baner', phone: '+91 20 2799 2799', note: '2.1 km away', icon: 'hospital' }
  ].map((x) => ({ ...x, societyId: SID }))

  // Announcements
  s.announcements = [
    { id: 'an1', title: 'Water supply interruption tomorrow', body: 'Due to PMC pipeline maintenance, water supply will be interrupted tomorrow from 10:00 AM to 4:00 PM in all towers. Please store sufficient water. Tanker backup has been arranged for emergencies.', priority: 'urgent', pinned: true, requiresAck: true, expiresAt: daysFromNow(2), authorId: 'u_meera', attachments: [{ name: 'PMC_Notice.pdf', type: 'pdf', size: '182 KB' }], readBy: ['u_rajesh'], ackBy: ['u_rajesh', 'u_anil'], createdAt: hoursAgo(3) },
    { id: 'an2', title: 'Annual General Meeting – 2026', body: 'The AGM will be held on Sunday at 11:00 AM in the Community Hall. Agenda: FY accounts approval, sinking fund utilisation, election of new committee and CCTV upgrade proposal. One member per flat must attend.', priority: 'important', pinned: true, requiresAck: true, expiresAt: daysFromNow(9), authorId: 'u_rajesh', attachments: [{ name: 'AGM_Agenda_2026.pdf', type: 'pdf', size: '240 KB' }], readBy: [], ackBy: [], createdAt: hoursAgo(26) },
    { id: 'an3', title: 'Lift maintenance schedule – Tower B', body: 'Lift L2 in Tower B will be under scheduled AMC maintenance on Thursday from 2 PM to 5 PM. Lift L1 will remain operational.', priority: 'important', pinned: false, requiresAck: false, expiresAt: daysFromNow(4), authorId: 'u_suresh', attachments: [], readBy: [], ackBy: [], createdAt: hoursAgo(30) },
    { id: 'an4', title: 'Visitor parking restrictions', body: 'From 1st of next month, visitor parking will be allowed only in the marked V-zone near Gate 2. Vehicles parked in resident slots will be clamped.', priority: 'general', pinned: false, requiresAck: false, expiresAt: daysFromNow(20), authorId: 'u_meera', attachments: [{ name: 'Parking_Layout.png', type: 'image', size: '96 KB', url: artImage('🅿️', '#0EA5E9', '#3B1F3A', 'V-Zone · Gate 2') }], readBy: ['u_priya'], ackBy: [], createdAt: hoursAgo(72) },
    { id: 'an5', title: 'Diwali celebrations 🪔', body: 'Join us for Diwali Milan in the central lawn – rangoli competition, kids’ fancy dress, dinner and a green-crackers-only celebration. Contribution ₹500 per family.', priority: 'general', pinned: false, requiresAck: false, expiresAt: daysFromNow(14), authorId: 'u_farah', attachments: [], readBy: [], ackBy: [], createdAt: hoursAgo(96) },
    { id: 'an6', title: 'Pest control drive in common areas', body: 'Quarterly pest control will be done in basements, staircases and garbage rooms this Saturday 8 AM–12 PM. Keep pets indoors.', priority: 'general', pinned: false, requiresAck: false, expiresAt: daysFromNow(-1), authorId: 'u_suresh', attachments: [], readBy: [], ackBy: [], createdAt: hoursAgo(200) }
  ].map((x) => ({ ...x, societyId: SID }))

  // Community feed
  const cm = (id, userId, text, h) => ({ id, userId, text, createdAt: hoursAgo(h) })
  s.posts = [
    { id: 'p1', userId: 'u_r3', category: 'celebrations', text: 'Our little one turned 5 today! 🎂 Thank you to all the kids from Tower C who came over — the building feels like family. ❤️', media: [{ type: 'image', url: artImage('🎂', '#EC4899', '#F97316') }], likes: ['u_priya', 'u_r4', 'u_r7', 'u_farah', 'u_r11'], comments: [cm('c1', 'u_priya', 'Happy birthday little champ! 🎉', 2), cm('c2', 'u_farah', 'So sweet! Many happy returns', 1.5)], reports: [], createdAt: hoursAgo(4) },
    { id: 'p2', userId: 'u_r8', category: 'recommendations', text: 'Can anyone recommend a reliable AC service technician? Our split AC is leaking water. Prefer someone who has serviced in our society before.', media: [], likes: ['u_r2'], comments: [cm('c3', 'u_r12', 'Try CoolCare Services — Sameer bhai, 98765 43210. Very honest pricing.', 5), cm('c4', 'u_anil', 'Seconding CoolCare, they did all 3 ACs in our flat.', 4)], reports: [], createdAt: hoursAgo(7) },
    { id: 'p3', userId: 'u_farah', category: 'events', text: 'Rangoli competition registrations are open for Diwali Milan! 🎨 Teams of 2–4. Theme: “Our Green Society”. Register in the Events tab.', media: [{ type: 'image', url: artImage('🎨', '#8B5CF6', '#EC4899', 'Rangoli Competition') }], likes: ['u_priya', 'u_r1', 'u_r5', 'u_meera', 'u_r9', 'u_r14', 'u_r20'], comments: [], reports: [], createdAt: hoursAgo(20) },
    { id: 'p4', userId: 'u_r5', category: 'lost_found', text: 'FOUND: A set of car keys (Maruti, with a blue keychain) near the Tower B entrance. Handed over to the security desk.', media: [{ type: 'image', url: artImage('🔑', '#0EA5E9', '#14B8A6') }], likes: ['u_r6'], comments: [cm('c5', 'u_r16', 'Thank you so much! These are mine 🙏 Collected.', 18)], reports: [], createdAt: hoursAgo(28) },
    { id: 'p5', userId: 'u_r10', category: 'buy_sell', text: 'Selling a kids’ bicycle (Hero, 16 inch) in excellent condition. ₹2,500. DM or call — C-104.', media: [{ type: 'image', url: artImage('🚲', '#22C55E', '#0EA5E9') }], likes: [], comments: [], reports: [], createdAt: hoursAgo(34) },
    { id: 'p6', userId: 'u_r14', category: 'help', text: 'My elderly father needs help getting to the hospital tomorrow at 9 AM for a routine check-up. Is anyone heading towards Aundh who could give a lift? Will be very grateful 🙏', media: [], likes: ['u_priya', 'u_r2', 'u_r3'], comments: [cm('c6', 'u_r19', 'I go to Aundh daily at 8:45. Happy to help — will message you.', 30)], reports: [], createdAt: hoursAgo(40) },
    { id: 'p7', userId: 'u_priya', category: 'general', text: 'Sunday book club this week is reading “The Midnight Library”. Clubhouse reading room, 6 PM. Everyone welcome, chai is on me ☕📚', media: [{ type: 'image', url: artImage('📚', '#3B1F3A', '#8B5CF6') }], likes: ['u_r1', 'u_r4', 'u_meera'], comments: [], reports: [], createdAt: hoursAgo(52) },
    { id: 'p8', userId: 'u_r20', category: 'general', text: 'Morning view from the C-wing terrace. Pune winters are here! 🌄', media: [{ type: 'image', url: artImage('🌄', '#F97316', '#EAB308') }], likes: ['u_r1', 'u_r2', 'u_r3', 'u_r4', 'u_r5', 'u_r6', 'u_r7', 'u_r8', 'u_priya'], comments: [cm('c7', 'u_r7', 'Beautiful!', 60)], reports: [], createdAt: hoursAgo(70) },
    { id: 'p9', userId: 'u_r22', category: 'general', text: 'Selling followers cheap!!! Click this link to win ₹10,000 now', media: [], likes: [], comments: [], reports: [{ userId: 'u_r1', reason: 'Spam', at: hoursAgo(80) }, { userId: 'u_r6', reason: 'Spam', at: hoursAgo(79) }], createdAt: hoursAgo(82) }
  ].map((x) => ({ ...x, societyId: SID, hidden: false, showApartment: true }))

  // Maintenance config & bills
  s.settings.push(
    { id: 'billing', societyId: SID, value: { ratePerSqft: 3.5, dueDay: 10, lateFeeType: 'flat', lateFee: 250, items: [{ id: 'i1', label: 'Sinking Fund', amount: 500 }, { id: 'i2', label: 'Water Charges', amount: 450 }, { id: 'i3', label: 'Repair & Maintenance Fund', amount: 300 }] } },
    { id: 'ticketSeq', societyId: SID, value: 1042 },
    { id: 'poll.rules', societyId: SID, value: { defaultEligibility: 'apartment' } }
  )
  s.aptCharges = [
    { id: 'ac1', societyId: SID, apartmentId: 'apt_A-302', label: 'Additional parking slot', amount: 600 },
    { id: 'ac2', societyId: SID, apartmentId: 'apt_C-401', label: 'Terrace usage charge', amount: 800 }
  ]
  const cfg = s.settings[0].value
  const occupied = new Set(s.users.filter((u) => u.apartmentId).map((u) => u.apartmentId))
  for (let back = 5; back >= 0; back--) {
    const ym = addMonths(curYM, -back)
    const [y, m] = ym.split('-').map(Number)
    for (const apt of s.apartments) {
      if (!occupied.has(apt.id)) continue
      const items = [{ label: `Maintenance (${apt.area} sq.ft × ₹${cfg.ratePerSqft})`, amount: Math.round(apt.area * cfg.ratePerSqft) }, ...cfg.items.map((i) => ({ label: i.label, amount: i.amount })), ...s.aptCharges.filter((c) => c.apartmentId === apt.id).map((c) => ({ label: c.label, amount: c.amount }))]
      const amount = items.reduce((a, b) => a + b.amount, 0)
      const id = `bill_${ym}_${apt.number}`
      const dueDate = new Date(y, m - 1, cfg.dueDay, 23, 59).toISOString()
      const h = Math.abs(hash(id))
      let paid = back > 0 ? h % 11 !== 0 : h % 3 === 0
      if (apt.number === 'A-302') paid = back > 0
      if (apt.number === 'A-302' && back === 1) paid = true
      const bill = { id, societyId: SID, apartmentId: apt.id, month: ym, items, adjustments: [], lateFee: 0, amount, dueDate, status: paid ? 'paid' : 'unpaid', createdAt: new Date(y, m - 1, 1, 9).toISOString() }
      if (!paid && back > 0) { bill.lateFee = cfg.lateFee }
      if (paid) {
        const at = new Date(y, m - 1, 2 + (h % 8), 10 + (h % 9), h % 60).toISOString()
        const method = ['UPI', 'UPI', 'Card', 'Net Banking', 'UPI'][h % 5]
        const pid = 'pay_' + id.slice(5)
        s.payments.push({ id: pid, societyId: SID, billIds: [id], apartmentId: apt.id, userId: null, amount, method, ref: 'TXN' + (h % 1e10).toString().padStart(10, '0'), receiptNo: `PGR/${ym.replace('-', '')}/${apt.number}`, status: 'success', createdAt: at })
        bill.paidAt = at; bill.paymentId = pid
      }
      s.bills.push(bill)
    }
  }

  // Complaints
  const hist = (arr) => arr.map(([status, h, by, note]) => ({ status, at: hoursAgo(h), by, note }))
  s.complaints = [
    { id: 'cp1', ticket: 'PG-1038', title: 'Kitchen sink pipe leaking', description: 'Water leaking from the pipe below the kitchen sink. Cabinet floor is getting damaged.', category: 'Plumbing', location: { type: 'apartment', value: 'A-302' }, priority: 'high', contact: { method: 'phone', value: '+91 98220 11302', window: 'After 6 PM' }, media: [{ type: 'image', url: artImage('🚰', '#0EA5E9', '#3B1F3A') }], userId: 'u_priya', apartmentId: 'apt_A-302', status: 'in_progress', assigneeId: 'st1', history: hist([['submitted', 30, 'u_priya'], ['acknowledged', 28, 'u_suresh', 'Assigned to Mahesh (plumber)'], ['in_progress', 6, 'u_suresh', 'Plumber visited, replacement part ordered']]), comments: [{ id: 'cc1', userId: 'u_suresh', text: 'Part will arrive tomorrow morning. Mahesh will visit by 11 AM.', createdAt: hoursAgo(6) }], internalNotes: [{ id: 'n1', userId: 'u_suresh', text: 'Vendor quote ₹850 for trap replacement.', createdAt: hoursAgo(6) }], createdAt: hoursAgo(30) },
    { id: 'cp2', ticket: 'PG-1031', title: 'Corridor light not working – 3rd floor', description: 'Tube light outside A-303/A-304 has not worked for 3 days.', category: 'Electrical', location: { type: 'floor', value: 'Tower A · Floor 3' }, priority: 'medium', contact: { method: 'app' }, media: [], userId: 'u_priya', apartmentId: 'apt_A-302', status: 'resolved', assigneeId: 'st2', history: hist([['submitted', 200, 'u_priya'], ['acknowledged', 196, 'u_suresh'], ['in_progress', 180, 'u_suresh'], ['resolved', 170, 'u_suresh', 'LED panel replaced']]), comments: [], internalNotes: [], createdAt: hoursAgo(200) },
    { id: 'cp3', ticket: 'PG-1019', title: 'Gym treadmill belt slipping', description: 'Treadmill #2 belt slips at higher speeds — unsafe.', category: 'Common Area', location: { type: 'common', value: 'Clubhouse Gym' }, priority: 'medium', contact: { method: 'app' }, media: [], userId: 'u_priya', apartmentId: 'apt_A-302', status: 'closed', assigneeId: 'st6', rating: 4, feedback: 'Fixed quickly, thanks!', history: hist([['submitted', 600, 'u_priya'], ['acknowledged', 590, 'u_suresh'], ['in_progress', 560, 'u_suresh'], ['resolved', 520, 'u_suresh'], ['closed', 500, 'u_priya', 'Rated 4★']]), comments: [], internalNotes: [], createdAt: hoursAgo(600) },
    { id: 'cp4', ticket: 'PG-1041', title: 'Lift L2 stuck between floors', description: 'Lift in Tower B stopped between 4th and 5th floor for 5 minutes this morning. Happened twice this week.', category: 'Lift', location: { type: 'common', value: 'Tower B · Lift L2' }, priority: 'urgent', contact: { method: 'app' }, media: [], userId: 'u_r9', apartmentId: null, status: 'acknowledged', assigneeId: 'st4', history: hist([['submitted', 10, 'u_r9'], ['acknowledged', 8, 'u_suresh', 'Otis technician called']]), comments: [], internalNotes: [], createdAt: hoursAgo(10) },
    { id: 'cp5', ticket: 'PG-1042', title: 'Loud music after 11 PM', description: 'Loud music from a flat on the 5th floor of Tower C past midnight on weekdays.', category: 'Noise', location: { type: 'floor', value: 'Tower C · Floor 5' }, priority: 'medium', contact: { method: 'app' }, media: [], userId: 'u_r15', apartmentId: null, status: 'submitted', assigneeId: null, history: hist([['submitted', 2, 'u_r15']]), comments: [], internalNotes: [], createdAt: hoursAgo(2) },
    { id: 'cp6', ticket: 'PG-1036', title: 'Garbage not collected – B wing', description: 'Dry waste not collected from B-wing garbage room for 2 days.', category: 'Cleaning', location: { type: 'common', value: 'Tower B · Garbage room' }, priority: 'high', contact: { method: 'app' }, media: [], userId: 'u_r4', apartmentId: null, status: 'submitted', assigneeId: null, history: hist([['submitted', 76, 'u_r4']]), comments: [], internalNotes: [], createdAt: hoursAgo(76) },
    { id: 'cp7', ticket: 'PG-1034', title: 'Unknown car in my parking slot', description: 'White Swift (MH14 XX 2211) parked in slot P-C08 since yesterday.', category: 'Parking', location: { type: 'common', value: 'Basement · P-C08' }, priority: 'high', contact: { method: 'app' }, media: [], userId: 'u_r18', apartmentId: null, status: 'in_progress', assigneeId: 'st5', history: hist([['submitted', 100, 'u_r18'], ['acknowledged', 98, 'u_ramesh'], ['in_progress', 96, 'u_ramesh', 'Owner traced, informed']]), comments: [], internalNotes: [], createdAt: hoursAgo(100) },
    { id: 'cp8', ticket: 'PG-1027', title: 'Low water pressure', description: 'Very low pressure in bathrooms during morning hours.', category: 'Water Supply', location: { type: 'apartment', value: 'C-603' }, priority: 'medium', contact: { method: 'app' }, media: [], userId: 'u_r30', apartmentId: null, status: 'resolved', assigneeId: 'st1', history: hist([['submitted', 400, 'u_r30'], ['acknowledged', 380, 'u_suresh'], ['in_progress', 300, 'u_suresh'], ['resolved', 250, 'u_suresh', 'Booster pump serviced']]), comments: [], internalNotes: [], createdAt: hoursAgo(400) }
  ].map((x) => ({ ...x, societyId: SID, kind: 'complaint' }))
  s.complaints.forEach((c) => { if (!c.apartmentId) c.apartmentId = s.users.find((u) => u.id === c.userId)?.apartmentId || null })

  // Visitors
  const v = (o) => ({ societyId: SID, apartmentId: 'apt_A-302', hostId: 'u_priya', phone: '', vehicle: '', ...o })
  s.visitors = [
    v({ id: 'vi1', name: 'Swiggy – Delivery', type: 'delivery', company: 'Swiggy', status: 'pending', purpose: 'Food delivery', createdAt: hoursAgo(0.02), guardId: 'u_ramesh' }),
    v({ id: 'vi2', name: 'Neha & Vivek Gupta', type: 'guest', status: 'preapproved', otp: '482913', expectedAt: daysFromNow(0, 19, 30), validTill: daysFromNow(1, 0), guests: 2, purpose: 'Dinner', createdAt: hoursAgo(5) }),
    v({ id: 'vi3', name: 'Urban Company – Cleaning', type: 'service', company: 'Urban Company', status: 'exited', otp: '119204', entryAt: hoursAgo(28), exitAt: hoursAgo(25), purpose: 'Deep cleaning', createdAt: hoursAgo(30) }),
    v({ id: 'vi4', name: 'Amazon – Delivery', type: 'delivery', company: 'Amazon', status: 'exited', entryAt: hoursAgo(48), exitAt: hoursAgo(47.9), purpose: 'Parcel', createdAt: hoursAgo(48) }),
    v({ id: 'vi5', name: 'Uber – Rakesh', type: 'cab', company: 'Uber', vehicle: 'MH 12 AB 1234', status: 'exited', entryAt: hoursAgo(55), exitAt: hoursAgo(54.8), purpose: 'Pickup', createdAt: hoursAgo(55) }),
    v({ id: 'vi6', name: 'Anita Kulkarni', type: 'guest', status: 'rejected', purpose: 'Unknown', createdAt: hoursAgo(80) }),
    v({ id: 'vi7', name: 'Zomato – Delivery', type: 'delivery', company: 'Zomato', apartmentId: 'apt_B-302', hostId: 'u_r10', status: 'inside', entryAt: hoursAgo(0.2), purpose: 'Food delivery', createdAt: hoursAgo(0.2) }),
    v({ id: 'vi8', name: 'Ravi – Carpenter', type: 'service', apartmentId: 'apt_C-203', hostId: 'u_r20', status: 'inside', entryAt: hoursAgo(2), purpose: 'Wardrobe repair', createdAt: hoursAgo(2) }),
    v({ id: 'vi9', name: 'Sunil Mehta', type: 'guest', apartmentId: 'apt_A-104', hostId: 'u_r2', status: 'exited', entryAt: hoursAgo(26), exitAt: hoursAgo(22), purpose: 'Family visit', createdAt: hoursAgo(26) })
  ]
  for (let i = 0; i < 24; i++) {
    const host = R(i % 40) || R(1)
    const at = hoursAgo(24 * (1 + (i % 7)) + (i * 3) % 12)
    const types = ['delivery', 'guest', 'cab', 'service', 'delivery']
    const t = types[i % 5]
    const comp = { delivery: ['Amazon', 'Flipkart', 'Swiggy', 'Zepto', 'BigBasket'][i % 5], cab: 'Ola', service: 'Urban Company' }[t]
    s.visitors.push(v({ id: 'vh' + i, name: t === 'guest' ? `${FIRST[(i + 11) % 30]} ${LAST[(i + 2) % 30]}` : `${comp} – ${t === 'cab' ? 'Cab' : t === 'service' ? 'Service' : 'Delivery'}`, type: t, company: comp || '', apartmentId: host.apartmentId, hostId: host.id, status: 'exited', entryAt: at, exitAt: new Date(new Date(at).getTime() + 1800000).toISOString(), purpose: t, createdAt: at }))
  }

  // Facilities
  s.facilities = [
    { id: 'fa1', name: 'Clubhouse', emoji: '🏛️', capacity: 60, charge: 0, chargeUnit: 'slot', open: 8, close: 22, slotHours: 2, requiresApproval: false, rules: ['Max 2 slots per flat per week', 'Keep the space clean'], color: '#6366F1' },
    { id: 'fa2', name: 'Gym', emoji: '🏋️', capacity: 12, charge: 0, chargeUnit: 'slot', open: 6, close: 22, slotHours: 1, requiresApproval: false, rules: ['Sports shoes mandatory', 'Children below 14 not allowed', 'Wipe equipment after use'], color: '#EF4444' },
    { id: 'fa3', name: 'Swimming Pool', emoji: '🏊', capacity: 20, charge: 0, chargeUnit: 'slot', open: 6, close: 20, slotHours: 1, requiresApproval: false, rules: ['Swimming costume & cap mandatory', 'Shower before entering', 'Children must be accompanied'], color: '#0EA5E9' },
    { id: 'fa4', name: 'Community Hall', emoji: '🎉', capacity: 150, charge: 3000, chargeUnit: 'slot', open: 9, close: 23, slotHours: 4, requiresApproval: true, rules: ['Refundable deposit ₹5,000', 'Music till 10 PM only', 'Booking subject to committee approval'], color: '#F97316' },
    { id: 'fa5', name: 'Badminton Court', emoji: '🏸', capacity: 4, charge: 0, chargeUnit: 'slot', open: 6, close: 22, slotHours: 1, requiresApproval: false, rules: ['Non-marking shoes only', 'Max 1 hour per booking'], color: '#22C55E' },
    { id: 'fa6', name: 'Guest Room', emoji: '🛏️', capacity: 3, charge: 1500, chargeUnit: 'day', open: 12, close: 12, slotHours: 24, requiresApproval: true, rules: ['Check-in 12 PM, check-out 11 AM', 'Guest ID proof mandatory'], color: '#8B5CF6' },
    { id: 'fa7', name: 'Party Hall', emoji: '🥳', capacity: 40, charge: 1500, chargeUnit: 'slot', open: 10, close: 22, slotHours: 3, requiresApproval: true, rules: ['No alcohol', 'Decorations must be removed after use'], color: '#EC4899' },
    { id: 'fa8', name: 'Rooftop Area', emoji: '🌇', capacity: 30, charge: 500, chargeUnit: 'slot', open: 16, close: 22, slotHours: 2, requiresApproval: true, rules: ['No open flames', 'Children must be supervised'], color: '#EAB308' }
  ].map((x) => ({ ...x, societyId: SID, active: true }))

  const bk = (id, facilityId, userId, d, startH, status, note = '') => {
    const f = s.facilities.find((x) => x.id === facilityId)
    const start = new Date(daysFromNow(d, startH)).toISOString()
    const end = new Date(new Date(start).getTime() + f.slotHours * 3600000).toISOString()
    const u = s.users.find((x) => x.id === userId)
    return { id, societyId: SID, facilityId, userId, apartmentId: u?.apartmentId, start, end, status, note, amount: f.charge, createdAt: hoursAgo(10) }
  }
  s.bookings = [
    bk('bk1', 'fa5', 'u_priya', 1, 7, 'confirmed'),
    bk('bk2', 'fa4', 'u_priya', 6, 17, 'pending', 'Aarav’s birthday party'),
    bk('bk3', 'fa2', 'u_priya', -2, 6, 'confirmed'),
    bk('bk4', 'fa4', 'u_r12', 3, 9, 'pending', 'Satyanarayan Pooja'),
    bk('bk5', 'fa1', 'u_r5', 0, 18, 'confirmed', 'Book club'),
    bk('bk6', 'fa5', 'u_r7', 1, 8, 'confirmed'),
    bk('bk7', 'fa7', 'u_r22', 2, 16, 'pending', 'Anniversary dinner'),
    bk('bk8', 'fa3', 'u_r9', 0, 7, 'confirmed'),
    bk('bk9', 'fa2', 'u_r3', -5, 7, 'confirmed'),
    bk('bk10', 'fa1', 'u_r13', -8, 10, 'confirmed'),
    bk('bk11', 'fa6', 'u_r18', -12, 12, 'confirmed')
  ]

  // Marketplace
  const L = (o) => ({ societyId: SID, status: 'active', expiresAt: daysFromNow(25), ...o })
  s.listings = [
    L({ id: 'l1', type: 'sell', title: '3-seater fabric sofa', description: 'Grey 3-seater sofa from Urban Ladder, 2 years old. Minor wear on one arm. Self pick-up.', price: 9500, userId: 'u_r6', media: [artImage('🛋️', '#64748B', '#3B1F3A')], createdAt: hoursAgo(12) }),
    L({ id: 'l2', type: 'rent', title: '2 BHK for rent – B-504', description: 'Semi-furnished 2 BHK, east facing, 1 covered parking. Available from 1st December. Family preferred.', price: 32000, priceUnit: '/month', userId: 'u_r11', media: [artImage('🏠', '#3B1F3A', '#0EA5E9', '2 BHK · Semi-furnished')], createdAt: hoursAgo(30) }),
    L({ id: 'l3', type: 'free', title: 'Kids’ story books (20+)', description: 'Giving away story books for ages 4–8. Good condition. First come, first served.', price: 0, userId: 'u_priya', media: [artImage('📖', '#F97316', '#EC4899')], createdAt: hoursAgo(40) }),
    L({ id: 'l4', type: 'service', title: 'Home tuitions – Maths & Science (Gr 6–10)', description: 'Retired teacher, 25 years of experience. Weekday evenings at my place.', price: 2500, priceUnit: '/month', userId: 'u_r17', media: [artImage('🧮', '#8B5CF6', '#6366F1')], createdAt: hoursAgo(60) }),
    L({ id: 'l5', type: 'sell', title: 'Samsung 7kg front-load washing machine', description: 'Working perfectly, selling due to relocation. 4 years old, serviced recently.', price: 11000, userId: 'u_r23', media: [artImage('🧺', '#0EA5E9', '#22C55E')], createdAt: hoursAgo(75) }),
    L({ id: 'l6', type: 'service', title: 'Homemade tiffin service', description: 'Fresh Maharashtrian veg tiffin – lunch & dinner. ₹120 per meal, monthly plans available.', price: 120, priceUnit: '/meal', userId: 'u_r26', media: [artImage('🍱', '#EAB308', '#F97316')], createdAt: hoursAgo(90) }),
    L({ id: 'l7', type: 'sell', title: 'Study table with chair', description: 'Solid wood study table with drawer and ergonomic chair.', price: 4000, userId: 'u_r29', media: [artImage('🪑', '#14B8A6', '#3B1F3A')], status: 'sold', createdAt: hoursAgo(150) }),
    L({ id: 'l8', type: 'wanted', title: 'Looking for a used treadmill', description: 'Budget up to ₹15,000. Must be in working condition.', price: 15000, userId: 'u_r1', media: [], createdAt: hoursAgo(100) })
  ]

  // Events
  const E = (o) => ({ societyId: SID, rsvps: [], gallery: [], reminders: [], ...o })
  const rs = (ids, status = 'going') => ids.map((userId, i) => ({ userId, status, guests: i % 3 }))
  s.events = [
    E({ id: 'e1', title: 'Diwali Milan 2026', category: 'Festival', emoji: '🪔', description: 'Rangoli competition, kids’ fancy dress, live music, and community dinner. Green crackers only.', start: daysFromNow(10, 18), end: daysFromNow(10, 23), venue: 'Central Lawn', organizerId: 'u_farah', capacity: 400, cover: artImage('🪔', '#F97316', '#EAB308', 'Diwali Milan'), rsvps: rs(['u_r1', 'u_r2', 'u_r3', 'u_r4', 'u_r5', 'u_r6', 'u_r7', 'u_r8', 'u_rajesh', 'u_meera', 'u_anil', 'u_r9', 'u_r10', 'u_r12', 'u_r14']), createdAt: hoursAgo(96) }),
    E({ id: 'e2', title: 'Annual General Meeting', category: 'Meeting', emoji: '🗳️', description: 'FY accounts, committee elections, CCTV upgrade proposal. One member per flat must attend.', start: daysFromNow(6, 11), end: daysFromNow(6, 13), venue: 'Community Hall', organizerId: 'u_rajesh', capacity: 150, cover: artImage('🗳️', '#3B1F3A', '#6366F1', 'AGM 2026'), rsvps: rs(['u_priya', 'u_r1', 'u_r4', 'u_anil', 'u_meera', 'u_farah']), createdAt: hoursAgo(26) }),
    E({ id: 'e3', title: 'Inter-tower Cricket Tournament', category: 'Sports', emoji: '🏏', description: 'Tower A vs B vs C – tennis ball cricket, 8-over matches. Register your team by Friday.', start: daysFromNow(3, 7), end: daysFromNow(3, 12), venue: 'Sports Ground', organizerId: 'u_r5', capacity: 60, cover: artImage('🏏', '#22C55E', '#3B1F3A', 'Cricket Tournament'), rsvps: rs(['u_r5', 'u_r7', 'u_r9', 'u_r13', 'u_r19', 'u_r21']), createdAt: hoursAgo(48) }),
    E({ id: 'e4', title: 'Kids’ Art & Craft Workshop', category: 'Kids', emoji: '🎨', description: 'Clay modelling and diya painting for children aged 4–12. Materials provided.', start: daysFromNow(1, 16), end: daysFromNow(1, 18), venue: 'Clubhouse', organizerId: 'u_priya', capacity: 30, cover: artImage('🧸', '#EC4899', '#8B5CF6', 'Kids’ Workshop'), rsvps: rs(['u_r3', 'u_r8', 'u_r11']), createdAt: hoursAgo(20) }),
    E({ id: 'e5', title: 'Ganesh Chaturthi Utsav', category: 'Festival', emoji: '🐘', description: 'Ten days of celebrations, aarti and cultural programmes.', start: daysFromNow(-60, 18), end: daysFromNow(-50, 22), venue: 'Central Lawn', organizerId: 'u_rajesh', capacity: 500, cover: artImage('🌺', '#F97316', '#EF4444', 'Ganeshotsav'), rsvps: rs(['u_priya', 'u_r1', 'u_r2', 'u_r3', 'u_r4', 'u_r5', 'u_r6', 'u_r7', 'u_r8', 'u_r9', 'u_r10']), gallery: [{ id: 'g1', url: artImage('🐘', '#F97316', '#EF4444'), userId: 'u_rajesh' }, { id: 'g2', url: artImage('🌺', '#EC4899', '#F97316'), userId: 'u_priya' }, { id: 'g3', url: artImage('🪔', '#EAB308', '#F97316'), userId: 'u_r3' }, { id: 'g4', url: artImage('🥁', '#8B5CF6', '#EF4444'), userId: 'u_r6' }], createdAt: hoursAgo(1600) }),
    E({ id: 'e6', title: 'Independence Day Flag Hoisting', category: 'National', emoji: '🇮🇳', description: 'Flag hoisting followed by cultural programme and breakfast.', start: daysFromNow(-78, 8), end: daysFromNow(-78, 10), venue: 'Main Gate Plaza', organizerId: 'u_meera', capacity: 300, cover: artImage('🇮🇳', '#F97316', '#22C55E', 'Independence Day'), rsvps: rs(['u_priya', 'u_r1', 'u_r2', 'u_r4']), gallery: [{ id: 'g5', url: artImage('🇮🇳', '#F97316', '#22C55E'), userId: 'u_meera' }, { id: 'g6', url: artImage('🎶', '#0EA5E9', '#22C55E'), userId: 'u_r2' }], createdAt: hoursAgo(2000) })
  ]

  // Polls
  s.polls = [
    { id: 'po1', question: 'Which date works best for Diwali Milan?', description: 'Committee will finalise based on majority.', options: [{ id: 'o1', text: 'Saturday, 7 Nov' }, { id: 'o2', text: 'Sunday, 8 Nov' }, { id: 'o3', text: 'Saturday, 14 Nov' }], multi: false, anonymous: false, eligibility: 'apartment', closesAt: daysFromNow(3), createdBy: 'u_meera', votes: [{ voterKey: 'apt_B-401', userId: 'u_rajesh', optionIds: ['o2'] }, { voterKey: 'apt_C-202', userId: 'u_meera', optionIds: ['o2'] }, { voterKey: 'apt_A-501', userId: 'u_anil', optionIds: ['o1'] }, ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => ({ voterKey: R(i).apartmentId, userId: R(i).id, optionIds: [['o1', 'o2', 'o2', 'o3'][i % 4]] }))], createdAt: hoursAgo(40) },
    { id: 'po2', question: 'Which new facilities should we add next year?', description: 'Select all that you would use. Budget approval at AGM.', options: [{ id: 'o1', text: 'EV charging stations' }, { id: 'o2', text: 'Indoor games room' }, { id: 'o3', text: 'Solar panels on terraces' }, { id: 'o4', text: 'Pet park' }, { id: 'o5', text: 'Co-working space' }], multi: true, anonymous: true, eligibility: 'resident', closesAt: daysFromNow(12), createdBy: 'u_rajesh', votes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 14, 16, 18, 20].map((i) => ({ voterKey: R(i).id, userId: R(i).id, optionIds: [['o1', 'o3'], ['o1'], ['o2', 'o4'], ['o3', 'o5'], ['o1', 'o3', 'o4']][i % 5] })), createdAt: hoursAgo(60) },
    { id: 'po3', question: 'How satisfied are you with housekeeping services?', description: '', options: [{ id: 'o1', text: 'Very satisfied' }, { id: 'o2', text: 'Satisfied' }, { id: 'o3', text: 'Needs improvement' }, { id: 'o4', text: 'Poor' }], multi: false, anonymous: true, eligibility: 'resident', closesAt: daysFromNow(-4), createdBy: 'u_meera', votes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((i) => ({ voterKey: R(i).id, userId: R(i).id, optionIds: [['o1', 'o2', 'o2', 'o3', 'o2', 'o4'][i % 6]] })), createdAt: hoursAgo(400) }
  ].map((x) => ({ ...x, societyId: SID }))

  // Notifications for the demo resident
  const N = (id, userId, type, title, body, link, h, read = false) => ({ id, societyId: SID, userId, type, title, body, link, read, createdAt: hoursAgo(h) })
  s.notifications = [
    N('n1', 'u_priya', 'visitors', 'Visitor waiting at the gate', 'Swiggy – Delivery is at the main gate for A-302. Approve entry?', '/visitors', 0.02),
    N('n2', 'u_priya', 'announcements', 'Urgent: Water supply interruption', 'Water supply will be interrupted tomorrow 10 AM–4 PM.', '/announcements/an1', 3),
    N('n3', 'u_priya', 'complaints', 'Complaint PG-1038 is In Progress', 'Plumber visited, replacement part ordered.', '/complaints/cp1', 6),
    N('n4', 'u_priya', 'social', 'Farah Khan liked your post', 'Sunday book club this week…', '/feed/post/p7', 20, true),
    N('n5', 'u_priya', 'payments', `Maintenance bill generated`, `Your bill for this month is ready. Due on the 10th.`, '/payments', 30),
    N('n6', 'u_priya', 'bookings', 'Booking confirmed', 'Badminton Court · tomorrow 7–8 AM', '/facilities', 34, true),
    N('n7', 'u_priya', 'events', 'Upcoming: Kids’ Art & Craft Workshop', 'Tomorrow at 4 PM in the Clubhouse.', '/events/e4', 40, true),
    N('n8', 'u_rajesh', 'complaints', 'New urgent complaint', 'PG-1041 · Lift L2 stuck between floors', '/admin/complaints', 10),
    N('n9', 'u_ramesh', 'visitors', 'Expected guest today', 'Neha & Vivek Gupta for A-302 around 7:30 PM', '/guard', 5)
  ]

  return s
}

function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return h
}
