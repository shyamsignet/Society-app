// Security tests for supabase/setup.sql against a local PostgreSQL
// (load supabase/test/supabase-stub.sql first).  Usage:
//   PGDATABASE=society_test node supabase/test/security.test.cjs
const { Client } = require('pg')
const db = new Client()
let pass = 0, fail = 0
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  ✓', name) } else { fail++; console.log('  ✗', name, extra) } }

async function as(authId, sql, params = []) {
  await db.query('begin')
  try {
    await db.query('set local role authenticated')
    await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(authId ? { sub: authId, role: 'authenticated' } : { role: 'anon' })])
    const r = await db.query(sql, params)
    await db.query('commit')
    return { ok: true, rows: r.rows }
  } catch (e) { await db.query('rollback'); return { ok: false, err: e.message } }
}
const rpc = (who, fn, ...args) => as(who, `select public.${fn}(${args.map((_, i) => '$' + (i + 1)).join(',')}) as r`, args.map((a) => (a !== null && typeof a === 'object' ? JSON.stringify(a) : a))).then((x) => (x.ok ? { ok: true, r: x.rows[0].r } : x))
const save = (who, col, id, data) => rpc(who, 'save_record', 'testsoc', col, id, data, false)
const recs = (res, col) => (res.r.records || []).filter((x) => x.c === col).map((x) => x.d)

;(async () => {
  await db.connect()
  await db.query("truncate public.records, public.members, public.changes, public.subscriptions, public.subscription_payments, public.platform_admins; delete from auth.users")
  const mk = async (phone, email = null) => (await db.query('insert into auth.users(phone,email) values($1,$2) returning id', [phone, email])).rows[0].id
  const ADMIN = await mk('919000000001'), RES = await mk('919000000002'), FAM = await mk('919000000003'), OUT = await mk('919000000009')
  const TREAS = await mk('919000000004'), GUARD = await mk('919000000005'), CHAIR = await mk('919000000006'), RES2 = await mk('919000000007')
  const soon = new Date(Date.now() + 86400000), later = new Date(Date.now() + 90000000)

  console.log('Setup & membership')
  ok('anonymous cannot read a society', !(await rpc(null, 'fetch_society', 'testsoc')).ok)
  ok('creating a society works', (await rpc(ADMIN, 'create_society', 'testsoc', { name: 'Test Society', city: 'Pune' }, { id: 'u_admin', name: 'Admin' })).ok)
  ok('society code must be unique', !(await rpc(OUT, 'create_society', 'testsoc', { name: 'X' }, { name: 'X' })).ok)
  const seed = await rpc(ADMIN, 'save_records', 'testsoc', [
    { c: 'towers', id: 'tw_A', d: { code: 'A', name: 'Tower A' } },
    ...['A-101', 'A-102', 'A-103'].map((n) => ({ c: 'apartments', id: 'apt_' + n, d: { number: n, tower: 'A', area: 1000 } })),
    { c: 'users', id: 'u_res', d: { name: 'Resi Dent', phone: '+91 90000 00002', apartmentId: 'apt_A-101', role: 'resident', status: 'active', privacy: { showPhone: false } } },
    { c: 'users', id: 'u_fam', d: { name: 'Fam Ily', phone: '+91 90000 00003', apartmentId: 'apt_A-101', role: 'resident', status: 'active' } },
    { c: 'users', id: 'u_res2', d: { name: 'Other Res', phone: '9000000007', apartmentId: 'apt_A-102', role: 'resident', status: 'active', privacy: { showPhone: true }, vehicles: [{ number: 'MH12' }] } },
    { c: 'users', id: 'u_treas', d: { name: 'Trea Surer', phone: '9000000004', apartmentId: 'apt_A-103', role: 'treasurer', status: 'active' } },
    { c: 'users', id: 'u_guard', d: { name: 'Gu Ard', phone: '9000000005', role: 'security', status: 'active' } },
    { c: 'users', id: 'u_chair', d: { name: 'Chair Man', phone: '9000000006', apartmentId: 'apt_A-103', role: 'chairman', status: 'active' } },
    { c: 'facilities', id: 'fa_court', d: { name: 'Court', requiresApproval: false, active: true } },
    { c: 'facilities', id: 'fa_hall', d: { name: 'Hall', requiresApproval: true, active: true } },
    { c: 'bills', id: 'b1', d: { apartmentId: 'apt_A-101', amount: 3000, status: 'unpaid' } },
    { c: 'bills', id: 'b2', d: { apartmentId: 'apt_A-102', amount: 3000, status: 'unpaid' } },
    { c: 'polls', id: 'po_flat', d: { question: 'Q?', eligibility: 'apartment', closesAt: later.toISOString(), votes: [], createdBy: 'u_admin' } },
    { c: 'polls', id: 'po_closed', d: { question: 'Old?', eligibility: 'resident', closesAt: '2020-01-01T00:00:00Z', votes: [], createdBy: 'u_admin' } },
    { c: 'announcements', id: 'an1', d: { title: 'Notice', body: 'Hello', readBy: [], ackBy: [] } },
    { c: 'complaints', id: 'cp_other', d: { userId: 'u_res2', apartmentId: 'apt_A-102', title: 'Theirs', status: 'submitted', internalNotes: [] } }
  ])
  ok('admin bulk-loads flats, residents, bills', seed.ok && seed.r === 18, seed.err)
  for (const id of [RES, FAM, TREAS, GUARD, CHAIR, RES2]) await rpc(id, 'link_member')
  const lm = await rpc(RES, 'link_member')
  ok('resident login is linked by phone number', lm.ok && lm.r[0]?.userId === 'u_res' && lm.r[0]?.role === 'resident', JSON.stringify(lm))
  const lo = await rpc(OUT, 'link_member')
  ok('unknown phone gets no membership', lo.ok && lo.r.length === 0)
  ok('non-member cannot read society data', !(await rpc(OUT, 'fetch_society', 'testsoc')).ok)
  ok('non-member can see flat list to register', (await rpc(OUT, 'society_directory', 'testsoc')).r?.apartments?.length === 3)
  ok('non-member can submit a registration', (await rpc(OUT, 'submit_registration', 'testsoc', { name: 'New Person', apartmentId: 'apt_A-102', occupancy: 'tenant' })).ok)
  ok('duplicate pending registration is blocked', !(await rpc(OUT, 'submit_registration', 'testsoc', { name: 'New Person', apartmentId: 'apt_A-102' })).ok)
  ok('member cannot register again', !(await rpc(RES, 'submit_registration', 'testsoc', { name: 'X', apartmentId: 'apt_A-101' })).ok)

  console.log('Privacy (what a resident can read)')
  const fr = await rpc(RES, 'fetch_society', 'testsoc')
  const users = recs(fr, 'users')
  ok('resident sees own bills only', recs(fr, 'bills').length === 1 && recs(fr, 'bills')[0].apartmentId === 'apt_A-101')
  ok('hidden phone numbers are removed', !('phone' in users.find((u) => u.id === 'u_treas')))
  ok('phone shown when the person allows it', users.find((u) => u.id === 'u_res2').phone === '9000000007')
  ok("others' vehicles are never sent", !('vehicles' in users.find((u) => u.id === 'u_res2')))
  ok('own flat members see each other fully', users.find((u) => u.id === 'u_fam').phone)
  ok("others' complaints are hidden", recs(fr, 'complaints').length === 0)
  ok('registrations hidden from residents', recs(fr, 'registrations').length === 0)
  const fg = await rpc(GUARD, 'fetch_society', 'testsoc')
  ok('security guard can see residents’ phones', recs(fg, 'users').find((u) => u.id === 'u_treas').phone)
  ok('treasurer sees all bills', recs(await rpc(TREAS, 'fetch_society', 'testsoc'), 'bills').length === 2)
  ok('chairman sees registrations', recs(await rpc(CHAIR, 'fetch_society', 'testsoc'), 'registrations').length === 1)

  console.log('Write rules')
  ok('resident cannot create bills', !(await save(RES, 'bills', 'b9', { apartmentId: 'apt_A-101', amount: 1 })).ok)
  ok('resident cannot make themselves chairman', !(await save(RES, 'users', 'u_res', { role: 'chairman' })).ok)
  ok('resident can edit own name', (await save(RES, 'users', 'u_res', { name: 'Resi D.' })).ok)
  ok("resident cannot edit someone else's profile", !(await save(RES, 'users', 'u_res2', { name: 'Hacked' })).ok)
  ok('chairman cannot create a super admin', !(await save(CHAIR, 'users', 'u_x', { name: 'X', role: 'super_admin' })).ok)
  ok('chairman can change a role', (await save(CHAIR, 'users', 'u_res2', { role: 'committee' })).ok)
  const m2 = await rpc(RES2, 'link_member')
  ok('role change reaches the login immediately', m2.r[0].role === 'committee')
  ok('resident can post', (await save(RES, 'posts', 'p1', { userId: 'u_res', text: 'Hi', likes: [], comments: [], reports: [] })).ok)
  ok('cannot post as someone else', !(await save(RES, 'posts', 'p2', { userId: 'u_res2', text: 'Fake' })).ok)
  ok('neighbour can like', (await save(TREAS, 'posts', 'p1', { likes: ['u_treas'] })).ok)
  ok("cannot add someone else's like", !(await save(TREAS, 'posts', 'p1', { likes: ['u_treas', 'u_guard'] })).ok)
  ok("neighbour cannot edit the post's text", !(await save(TREAS, 'posts', 'p1', { text: 'Edited' })).ok)
  ok('neighbour can comment as themselves', (await save(TREAS, 'posts', 'p1', { comments: [{ id: 'c1', userId: 'u_treas', text: 'Nice' }] })).ok)
  ok('cannot comment as someone else', !(await save(TREAS, 'posts', 'p1', { comments: [{ id: 'c1', userId: 'u_treas', text: 'Nice' }, { id: 'c2', userId: 'u_res', text: 'x' }] })).ok)
  ok("cannot delete someone else's post", !(await rpc(TREAS, 'delete_record', 'testsoc', 'posts', 'p1')).ok)
  ok('committee member can delete (moderate) a post', (await rpc(RES2, 'delete_record', 'testsoc', 'posts', 'p1')).ok)
  ok('resident can mark a notice read', (await save(RES, 'announcements', 'an1', { readBy: ['u_res'] })).ok)
  ok('resident cannot change a notice', !(await save(RES, 'announcements', 'an1', { title: 'Changed' })).ok)
  ok('treasurer cannot publish notices', !(await save(TREAS, 'announcements', 'an2', { title: 'T', body: 'B' })).ok)

  console.log('Money, votes, bookings, visitors')
  ok('resident cannot mark own bill paid', !(await save(RES, 'bills', 'b1', { status: 'paid', paidAt: new Date().toISOString(), updatedAt: new Date().toISOString() })).ok)
  ok('resident can report a payment (pending verification)', (await save(RES, 'payments', 'pay1', { billIds: ['b1'], apartmentId: 'apt_A-101', userId: 'u_res', amount: 3000, method: 'UPI', ref: '412345678901', status: 'pending' })).ok)
  ok('resident cannot record a payment as successful', !(await save(RES, 'payments', 'pay2', { billIds: ['b1'], apartmentId: 'apt_A-101', userId: 'u_res', amount: 3000, status: 'success' })).ok)
  ok("resident cannot report payment for another flat", !(await save(RES, 'payments', 'pay3', { billIds: ['b2'], apartmentId: 'apt_A-102', userId: 'u_res', amount: 3000, status: 'pending' })).ok)
  ok('resident cannot approve their own payment', !(await save(RES, 'payments', 'pay1', { status: 'success' })).ok)
  ok('treasurer verifies: bill paid + payment success', (await rpc(TREAS, 'save_records', 'testsoc', [{ c: 'bills', id: 'b1', d: { status: 'paid', paymentId: 'pay1', updatedAt: new Date().toISOString() } }, { c: 'payments', id: 'pay1', d: { status: 'success' } }])).ok)
  ok('updatedAt cannot be used to sneak other changes', !(await save(RES, 'announcements', 'an1', { title: 'x', updatedAt: new Date().toISOString() })).ok)
  ok('resident cannot change the bill amount', !(await save(RES, 'bills', 'b1', { amount: 1 })).ok)
  ok('vote counted once per flat', (await save(RES, 'polls', 'po_flat', { votes: [{ voterKey: 'apt_A-101', userId: 'u_res', optionIds: ['o1'] }] })).ok)
  ok('family member of same flat cannot vote again', !(await save(FAM, 'polls', 'po_flat', { votes: [{ voterKey: 'apt_A-101', userId: 'u_res', optionIds: ['o1'] }, { voterKey: 'apt_A-101', userId: 'u_fam', optionIds: ['o2'] }] })).ok)
  ok('cannot vote with a fake voter key', !(await save(RES2, 'polls', 'po_flat', { votes: [{ voterKey: 'apt_A-101', userId: 'u_res', optionIds: ['o1'] }, { voterKey: 'apt_A-103', userId: 'u_res2', optionIds: ['o2'] }] })).ok)
  ok('cannot vote on a closed poll', !(await save(RES, 'polls', 'po_closed', { votes: [{ voterKey: 'u_res', userId: 'u_res', optionIds: ['o1'] }] })).ok)
  const bk = (id, fac, status, who = RES, user = 'u_res', apt = 'apt_A-101') => save(who, 'bookings', id, { facilityId: fac, userId: user, apartmentId: apt, status, start: soon.toISOString(), end: new Date(soon.getTime() + 3600000).toISOString() })
  ok('booking a free slot works', (await bk('bk1', 'fa_court', 'confirmed')).ok)
  const dbl = await bk('bk2', 'fa_court', 'confirmed', RES2, 'u_res2', 'apt_A-102')
  ok('double booking is refused by the database', !dbl.ok && /slot_taken/.test(dbl.err), dbl.err)
  ok('cannot self-confirm a hall that needs approval', !(await bk('bk3', 'fa_hall', 'confirmed')).ok)
  ok('hall request goes in as pending', (await bk('bk4', 'fa_hall', 'pending')).ok)
  ok('guard can register a walk-in for any flat', (await save(GUARD, 'visitors', 'v1', { apartmentId: 'apt_A-101', name: 'Swiggy', status: 'pending' })).ok)
  ok('resident can approve own visitor', (await save(RES, 'visitors', 'v1', { status: 'approved', respondedBy: 'u_res' })).ok)
  ok("resident cannot approve another flat's visitor", !(await save(RES2, 'visitors', 'v1', { status: 'rejected' })).ok)
  ok('resident cannot mark visitor as inside', !(await save(RES, 'visitors', 'v1', { status: 'inside' })).ok)
  ok('resident can create a complaint', (await save(RES, 'complaints', 'cp1', { userId: 'u_res', apartmentId: 'apt_A-101', title: 'Leak', status: 'submitted', assigneeId: null, history: [] })).ok)
  ok('resident cannot resolve own complaint', !(await save(RES, 'complaints', 'cp1', { status: 'resolved' })).ok)
  ok('internal notes never reach the resident', (await save(CHAIR, 'complaints', 'cp1', { internalNotes: [{ text: 'secret' }] })).ok &&
    !('internalNotes' in recs(await rpc(RES, 'fetch_society', 'testsoc'), 'complaints')[0]))
  ok('anyone can notify a neighbour', (await save(RES, 'notifications', 'n1', { userId: 'u_res2', title: 'Hi' })).ok)
  ok("cannot read others' notifications", recs(await rpc(RES, 'fetch_society', 'testsoc'), 'notifications').length === 0)

  console.log('Family logins')
  ok('resident adds a family member with a login', (await save(RES, 'users', 'u_kid', { name: 'Kid', email: 'kid@x.in', apartmentId: 'apt_A-101', role: 'resident', status: 'active', familyOf: 'u_res', access: 'limited' })).ok)
  ok('resident edits their family member (name, access)', (await save(RES, 'users', 'u_kid', { name: 'Kiddo', access: 'full' })).ok)
  ok('resident switches a family login off', (await save(RES, 'users', 'u_kid', { status: 'inactive' })).ok)
  ok('…and on again', (await save(RES, 'users', 'u_kid', { status: 'active' })).ok)
  ok('resident cannot give their family member a committee role', !(await save(RES, 'users', 'u_kid', { role: 'chairman' })).ok)
  ok('resident cannot move a family member to another flat', !(await save(RES, 'users', 'u_kid', { apartmentId: 'apt_A-102' })).ok)
  ok("flatmate cannot edit someone else's family member", !(await save(FAM, 'users', 'u_kid', { name: 'Hacked' })).ok)

  console.log('Events & shared expenses')
  ok('committee creates an event', (await save(CHAIR, 'events', 'ev1', { title: 'Diwali', organizerId: 'u_chair', rsvps: [], gallery: [], reminders: [], expenses: [], settlements: [] })).ok)
  ok('resident RSVPs with family members and guests', (await save(RES, 'events', 'ev1', { rsvps: [{ userId: 'u_res', status: 'going', guests: 1, members: [{ id: 'f1', name: 'Kid' }] }] })).ok)
  ok('resident adds an expense they paid', (await save(RES, 'events', 'ev1', { expenses: [{ id: 'x1', userId: 'u_res', amount: 900, title: 'Sweets' }] })).ok)
  ok('cannot add an expense in someone else\'s name', !(await save(FAM, 'events', 'ev1', { expenses: [{ id: 'x1', userId: 'u_res', amount: 900, title: 'Sweets' }, { id: 'x2', userId: 'u_res', amount: 5000, title: 'Fake' }] })).ok)
  ok('cannot delete someone else\'s expense', !(await save(FAM, 'events', 'ev1', { expenses: [] })).ok)
  ok('cannot record a payment between two other people', !(await save(FAM, 'events', 'ev1', { settlements: [{ id: 's1', userId: 'u_fam', from: 'u_res', to: 'u_chair', amount: 100 }] })).ok)
  ok('can record a payment you made', (await save(FAM, 'events', 'ev1', { settlements: [{ id: 's2', userId: 'u_fam', from: 'u_fam', to: 'u_res', amount: 300 }] })).ok)
  ok('resident records a contribution they gave', (await save(FAM, 'events', 'ev1', { settlements: [{ id: 's2', userId: 'u_fam', from: 'u_fam', to: 'u_res', amount: 300 }, { id: 'c1', kind: 'contribution', userId: 'u_fam', from: 'u_fam', to: 'u_chair', amount: 500 }] })).ok)
  ok("cannot record a contribution between two other people", !(await save(FAM, 'events', 'ev1', { settlements: [{ id: 's2', userId: 'u_fam', from: 'u_fam', to: 'u_res', amount: 300 }, { id: 'c1', kind: 'contribution', userId: 'u_fam', from: 'u_fam', to: 'u_chair', amount: 500 }, { id: 'c2', kind: 'contribution', userId: 'u_fam', from: 'u_res', to: 'u_chair', amount: 500 }] })).ok)
  ok('only the organiser sets the contribution amount', !(await save(FAM, 'events', 'ev1', { contribution: { amount: 1, per: 'family' } })).ok)
  ok('organiser can remove a wrong expense', (await save(CHAIR, 'events', 'ev1', { expenses: [] })).ok)

  console.log('Subscriptions')
  const PLAT = await mk('919000000099')
  await db.query('insert into public.platform_admins(auth_id) values($1)', [PLAT])
  const sub0 = await rpc(CHAIR, 'my_subscription', 'testsoc')
  ok('a new society starts on a 30-day trial', sub0.ok && sub0.r.state === 'ok' && sub0.r.plan === 'yearly' && Number(sub0.r.pricePerFlat) === 20 && !!sub0.r.trialEnds, JSON.stringify(sub0).slice(0, 200))
  ok('subscription tables cannot be read directly', !(await as(CHAIR, 'select * from public.subscriptions')).ok)
  ok('society admin cannot extend their own subscription', !(await rpc(ADMIN, 'platform_record_payment', 'testsoc', 5760, 12, 'UPI', 'x', '')).ok)
  ok('society admin cannot see other societies', !(await rpc(ADMIN, 'platform_overview')).ok)
  ok('platform owner sees every society', (await rpc(PLAT, 'platform_overview')).r?.societies?.some((x) => x.id === 'testsoc'))
  const pay = await rpc(PLAT, 'platform_record_payment', 'testsoc', 720, 12, 'UPI', 'UTR123', 'first year')
  ok('platform owner records a payment and an invoice number is issued', pay.ok && /^SY\/\d{4}-\d{2}\/\d{4}$/.test(pay.r.invoice_no) && pay.r.months === 12, JSON.stringify(pay).slice(0, 200))
  const sub1 = await rpc(CHAIR, 'my_subscription', 'testsoc')
  ok('…which extends paid-until by a year', sub1.ok && new Date(sub1.r.paidUntil) > new Date(Date.now() + 360 * 86400000) && sub1.r.payments.length === 1)
  ok('residents do not see invoices', (await rpc(RES, 'my_subscription', 'testsoc')).r?.payments?.length === 0)
  const past = (d) => new Date(Date.now() - d * 86400000).toISOString()
  await rpc(PLAT, 'platform_update_subscription', 'testsoc', { trialEnds: past(5), paidUntil: past(5) })
  ok('just expired: grace period, still writable', (await rpc(CHAIR, 'my_subscription', 'testsoc')).r?.state === 'grace' && (await save(CHAIR, 'announcements', 'an_g', { title: 'x', body: 'y', readBy: [], ackBy: [] })).ok)
  await rpc(PLAT, 'platform_update_subscription', 'testsoc', { trialEnds: past(30), paidUntil: past(30) })
  const lockedW = await save(CHAIR, 'announcements', 'an_l', { title: 'x', body: 'y', readBy: [], ackBy: [] })
  ok('after the grace period the society is read-only', (await rpc(CHAIR, 'my_subscription', 'testsoc')).r?.state === 'locked' && !lockedW.ok && /subscription_expired/.test(lockedW.err), lockedW.err)
  ok('…but everyone can still read their data', (await rpc(RES, 'fetch_society', 'testsoc')).ok)
  ok('deleting is blocked too', !(await rpc(CHAIR, 'delete_record', 'testsoc', 'announcements', 'an_g')).ok)
  await rpc(PLAT, 'platform_update_subscription', 'testsoc', { plan: 'complimentary' })
  ok('complimentary plan never expires', (await rpc(CHAIR, 'my_subscription', 'testsoc')).r?.state === 'ok')
  await rpc(PLAT, 'platform_update_subscription', 'testsoc', { plan: 'yearly', status: 'suspended' })
  ok('suspended society is read-only', (await rpc(CHAIR, 'my_subscription', 'testsoc')).r?.state === 'locked')
  await rpc(PLAT, 'platform_update_subscription', 'testsoc', { status: 'active', paidUntil: new Date(Date.now() + 86400000 * 30).toISOString() })

  console.log('Sync & lockout')
  const s0 = (await rpc(RES2, 'fetch_society', 'testsoc')).r.seq
  await save(CHAIR, 'announcements', 'an3', { title: 'New', body: 'x', readBy: [], ackBy: [] })
  const ch = await rpc(RES2, 'fetch_changes', 'testsoc', s0)
  ok('change feed returns only what changed', ch.ok && ch.r.records.length === 1 && ch.r.records[0].d.id === 'an3', JSON.stringify(ch).slice(0, 200))
  await rpc(CHAIR, 'delete_record', 'testsoc', 'announcements', 'an3')
  const ch2 = await rpc(RES2, 'fetch_changes', 'testsoc', ch.r.seq)
  ok('deletes are reported', ch2.r.deleted.length === 1)
  ok('deactivating a resident…', (await save(CHAIR, 'users', 'u_res2', { status: 'inactive' })).ok)
  ok('…locks them out immediately', !(await rpc(RES2, 'fetch_society', 'testsoc')).ok)
  ok('tables cannot be read directly', !(await as(RES, 'select * from public.records')).ok)

  console.log(`\n${pass} passed, ${fail} failed`)
  await db.end()
  process.exit(fail ? 1 : 0)
})()
