// Event attendance and shared-expense maths. Pure functions (no db access).
//
// An RSVP looks like { userId, status, guests, members: [{ id, name, userId? }] }:
// the person who answered + the household members they bring + outside guests.

export const headsOf = (r) => (r && r.status === 'going' ? 1 + (r.members?.length || 0) + (Number(r.guests) || 0) : 0)
export const goingCount = (e) => (e.rsvps || []).reduce((a, r) => a + headsOf(r), 0)

// userId → the RSVP that already brings them (as a household member)
export function includedBy(e, userId) {
  return (e.rsvps || []).find((r) => r.status === 'going' && r.userId !== userId && (r.members || []).some((m) => m.userId === userId))
}

const paise = (x) => Math.round((Number(x) || 0) * 100)

// Splits the event's expenses among the RSVPs that are going.
//  split = 'person' (default): each RSVP pays per head (self + family + guests)
//  split = 'family'          : each RSVP pays an equal share
// Returns totals, per-user balances (+ = should get money back, − = owes) in rupees,
// and the fewest transfers that settle everything.
export function splitEvent(e) {
  const expenses = e.expenses || []
  const settlements = e.settlements || []
  const going = (e.rsvps || []).filter((r) => r.status === 'going')
  const perFamily = e.split === 'family'
  const units = going.map((r) => ({ userId: r.userId, weight: perFamily ? 1 : headsOf(r), heads: headsOf(r) }))
  const totalUnits = units.reduce((a, u) => a + u.weight, 0)
  const total = expenses.reduce((a, x) => a + paise(x.amount), 0)

  const bal = new Map()
  const add = (id, v) => bal.set(id, (bal.get(id) || 0) + v)
  for (const x of expenses) add(x.userId, paise(x.amount))
  // shares in paise; the rounding remainder goes to the first payers so the sum is exact
  let assigned = 0
  const shares = units.map((u) => { const s = totalUnits ? Math.floor((total * u.weight) / totalUnits) : 0; assigned += s; return { ...u, share: s } })
  for (let i = 0; assigned < total && shares.length; i = (i + 1) % shares.length) { shares[i].share += 1; assigned += 1 }
  for (const s of shares) add(s.userId, -s.share)
  for (const s of settlements) { add(s.from, paise(s.amount)); add(s.to, -paise(s.amount)) }

  const people = [...bal.entries()].map(([userId, v]) => ({
    userId,
    paid: expenses.filter((x) => x.userId === userId).reduce((a, x) => a + paise(x.amount), 0) / 100,
    share: (shares.find((s) => s.userId === userId)?.share || 0) / 100,
    heads: shares.find((s) => s.userId === userId)?.heads || 0,
    balance: v / 100
  }))

  // greedy: biggest debtor pays biggest creditor
  const debt = people.filter((p) => p.balance < -0.005).map((p) => ({ id: p.userId, v: -paise(p.balance) })).sort((a, b) => b.v - a.v)
  const cred = people.filter((p) => p.balance > 0.005).map((p) => ({ id: p.userId, v: paise(p.balance) })).sort((a, b) => b.v - a.v)
  const transfers = []
  for (let i = 0, j = 0; i < debt.length && j < cred.length;) {
    const amt = Math.min(debt[i].v, cred[j].v)
    if (amt > 0) transfers.push({ from: debt[i].id, to: cred[j].id, amount: amt / 100 })
    debt[i].v -= amt; cred[j].v -= amt
    if (!debt[i].v) i++
    if (!cred[j].v) j++
  }
  const heads = units.reduce((a, u) => a + u.heads, 0)
  return { total: total / 100, heads, families: units.length, perUnit: totalUnits ? total / totalUnits / 100 : 0, perFamily, people, transfers }
}
