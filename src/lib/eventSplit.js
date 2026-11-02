// Event attendance and event accounts. Pure functions (no db access).
//
// An RSVP looks like { userId, status, guests, members: [{ id, name, userId? }] }:
// the person who answered + the household members they bring + outside guests.
//
// Money on an event (all arrays on the event record):
//   expenses     [{ id, userId, amount, title, receipt }]        – someone paid for something
//   settlements  [{ id, userId, from, to, amount, kind? }]        – money handed between people
//       kind 'contribution' = money collected for the event (e.g. ₹500 per family up front)
//       no kind              = a settle-up payment after the event
// Settings: split 'person' | 'family', contribution { amount, per: 'family' | 'person' },
//           keepSurplus (leftover stays with the holder for the next event).

export const headsOf = (r) => (r && r.status === 'going' ? 1 + (r.members?.length || 0) + (Number(r.guests) || 0) : 0)
export const goingCount = (e) => (e.rsvps || []).reduce((a, r) => a + headsOf(r), 0)

// userId → the RSVP that already brings them (as a household member)
export function includedBy(e, userId) {
  return (e.rsvps || []).find((r) => r.status === 'going' && r.userId !== userId && (r.members || []).some((m) => m.userId === userId))
}

const paise = (x) => Math.round((Number(x) || 0) * 100)
const sumP = (xs) => xs.reduce((a, x) => a + paise(x.amount), 0)

// Expected up-front contribution for one RSVP (0 when none is set).
export const expectedFrom = (e, r) => {
  const c = e.contribution
  if (!c || !(Number(c.amount) > 0) || r?.status !== 'going') return 0
  return Number(c.amount) * (c.per === 'person' ? headsOf(r) : 1)
}

export function splitEvent(e) {
  const expenses = e.expenses || []
  const settlements = e.settlements || []
  const contributions = settlements.filter((s) => s.kind === 'contribution')
  const going = (e.rsvps || []).filter((r) => r.status === 'going')
  const perFamily = e.split === 'family'

  const collected = sumP(contributions)
  const spent = sumP(expenses)
  const remaining = collected - spent // paise; < 0 = overspent

  // Cash holders: who received contributions (the pot), less what they spent on the event.
  const held = new Map()
  for (const c of contributions) held.set(c.to, (held.get(c.to) || 0) + paise(c.amount))
  for (const x of expenses) held.set(x.userId, (held.get(x.userId) || 0) - paise(x.amount))
  let holders = [...held.entries()].filter(([, v]) => v > 0).map(([userId, v]) => ({ userId, amount: v }))
  const heldTotal = holders.reduce((a, h) => a + h.amount, 0)
  // keep the leftover for the next event: treat it as spent by whoever holds it
  const kept = e.keepSurplus && remaining > 0 ? remaining : 0
  const keptBy = kept ? holders.map((h) => ({ userId: h.userId, amount: Math.round((kept * h.amount) / (heldTotal || 1)) })) : []

  const units = going.map((r) => ({ userId: r.userId, weight: perFamily ? 1 : headsOf(r), heads: headsOf(r) }))
  const totalUnits = units.reduce((a, u) => a + u.weight, 0)
  const cost = spent + kept

  const bal = new Map()
  const add = (id, v) => bal.set(id, (bal.get(id) || 0) + v)
  for (const x of expenses) add(x.userId, paise(x.amount))
  for (const k of keptBy) add(k.userId, k.amount)
  let assigned = 0
  const shares = units.map((u) => { const s = totalUnits ? Math.floor((cost * u.weight) / totalUnits) : 0; assigned += s; return { ...u, share: s } })
  for (let i = 0; assigned < cost && shares.length; i = (i + 1) % shares.length) { shares[i].share += 1; assigned += 1 }
  for (const s of shares) add(s.userId, -s.share)
  for (const s of settlements) { add(s.from, paise(s.amount)); add(s.to, -paise(s.amount)) }
  for (const r of going) if (!bal.has(r.userId)) bal.set(r.userId, 0)

  const people = [...bal.entries()].map(([userId, v]) => {
    const r = going.find((x) => x.userId === userId)
    return {
      userId,
      going: !!r,
      heads: r ? headsOf(r) : 0,
      share: (shares.find((s) => s.userId === userId)?.share || 0) / 100,
      spentFor: sumP(expenses.filter((x) => x.userId === userId)) / 100,
      contributed: sumP(contributions.filter((c) => c.from === userId)) / 100,
      collectedHere: sumP(contributions.filter((c) => c.to === userId)) / 100,
      expected: r ? expectedFrom(e, r) : 0,
      balance: v / 100
    }
  }).sort((a, b) => Number(b.going) - Number(a.going) || b.heads - a.heads)

  // greedy: biggest debtor pays biggest creditor
  const debt = people.filter((p) => p.balance < -0.005).map((p) => ({ id: p.userId, v: -Math.round(p.balance * 100) })).sort((a, b) => b.v - a.v)
  const cred = people.filter((p) => p.balance > 0.005).map((p) => ({ id: p.userId, v: Math.round(p.balance * 100) })).sort((a, b) => b.v - a.v)
  const transfers = []
  for (let i = 0, j = 0; i < debt.length && j < cred.length;) {
    const amt = Math.min(debt[i].v, cred[j].v)
    if (amt > 0) transfers.push({ from: debt[i].id, to: cred[j].id, amount: amt / 100 })
    debt[i].v -= amt; cred[j].v -= amt
    if (!debt[i].v) i++
    if (!cred[j].v) j++
  }
  const heads = units.reduce((a, u) => a + u.heads, 0)
  return {
    total: spent / 100, spent: spent / 100, collected: collected / 100, remaining: remaining / 100, kept: kept / 100,
    holders: holders.map((h) => ({ userId: h.userId, amount: h.amount / 100 })),
    heads, families: units.length, perUnit: totalUnits ? cost / totalUnits / 100 : 0, perFamily,
    people, transfers, hasContributions: contributions.length > 0
  }
}
