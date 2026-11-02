// Data store used by every screen.
//
// DEMO mode  – the whole sample society lives on this device (IndexedDB).
// CLOUD mode – the society's data lives in Supabase. This module keeps an
//   in-memory copy (also cached on the device so the app opens offline),
//   applies changes instantly ("optimistic"), queues them in an outbox that
//   survives restarts, sends them to the server in batches, and pulls other
//   people's changes via a realtime ping plus a periodic catch-up.
//
// The API (list/get/insert/update/remove) is the same in both modes, so the
// screens and src/lib/actions.js do not need to know which one is active.
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'
import { useSyncExternalStore } from 'react'
import { buildSeed } from './seed'
import { CLOUD } from './config'
import { api, subscribeChanges } from './cloud'

const KEY = 'smart-society-db-v1'
const COLLECTIONS = [
  'societies', 'towers', 'apartments', 'users', 'staff', 'contacts', 'announcements', 'posts',
  'bills', 'payments', 'aptCharges', 'complaints', 'visitors', 'facilities', 'bookings',
  'listings', 'events', 'polls', 'notifications', 'alerts', 'registrations', 'settings'
]
const empty = () => Object.fromEntries(COLLECTIONS.map((c) => [c, []]))

let state = null
let version = 0
let currentSociety = null
const listeners = new Set()
const errorListeners = new Set()
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('smart-society') : null

const emit = () => { version++; listeners.forEach((l) => l()) }
const emitError = (msg) => errorListeners.forEach((l) => l(msg))
export const onSyncError = (f) => { errorListeners.add(f); return () => errorListeners.delete(f) }

/* ---------- persistence (device cache) ---------- */
const cacheKey = () => (CLOUD ? `smart-society-cloud-${currentSociety}` : KEY)
let pending = false
let writing = Promise.resolve()
const flushCache = () => {
  if (!state || (CLOUD && !currentSociety)) return writing
  const key = cacheKey()
  const snapshot = CLOUD ? { state, seq: sync.seq, syncedAt: sync.syncedAt } : state
  writing = writing.then(async () => {
    try {
      await idbSet(key, snapshot)
      if (!CLOUD) channel?.postMessage({ type: 'changed' })
    } catch (e) { console.error('Persist failed', e) }
  })
  return writing
}
const persist = () => {
  if (pending) return
  pending = true
  queueMicrotask(() => { pending = false; flushCache() })
}
if (typeof window !== 'undefined') {
  const onHide = () => { if (state) flushCache() }
  window.addEventListener('pagehide', onHide)
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && onHide())
}

channel && (channel.onmessage = async (e) => {
  if (!CLOUD && e.data?.type === 'changed') {
    const fresh = await idbGet(KEY)
    if (fresh) { state = fresh; emit() }
  }
})

/* ---------- start-up ---------- */
export async function initDB() {
  if (CLOUD) { state = empty(); emit(); return }
  let s = null
  try { s = await idbGet(KEY) } catch { /* private mode */ }
  if (!s) {
    s = buildSeed()
    try { await idbSet(KEY, s) } catch { /* ignore */ }
  }
  COLLECTIONS.forEach((c) => { if (!s[c]) s[c] = [] })
  state = s
  currentSociety = s.societies[0]?.id
  emit()
}

export async function resetDB() {
  if (CLOUD) return
  try { await idbDel(KEY) } catch { /* ignore */ }
  state = buildSeed()
  await idbSet(KEY, state)
  channel?.postMessage({ type: 'changed' })
  emit()
}

/* ---------- cloud sync ---------- */
const sync = { seq: 0, syncedAt: 0, outbox: [], flushing: false, pulling: false, unsub: null, timer: null, online: true }
export const currentSocietyId = () => currentSociety
export const syncStatus = () => ({ pending: sync.outbox.length, online: sync.online, syncedAt: sync.syncedAt })
const outboxKey = () => `smart-society-outbox-${currentSociety}`
const saveOutbox = () => idbSet(outboxKey(), sync.outbox).catch(() => {})

function applyRemote(col, rec) {
  const rows = state[col] || []
  const i = rows.findIndex((r) => r.id === rec.id)
  const next = i >= 0 ? rows.map((r, j) => (j === i ? rec : r)) : [rec, ...rows]
  state = { ...state, [col]: next }
}
function removeLocal(col, id) { state = { ...state, [col]: (state[col] || []).filter((r) => r.id !== id) } }

// Re-apply edits that are still waiting in the outbox on top of server data.
function rebaseOutbox() {
  for (const op of sync.outbox) {
    if (op.op === 'delete') removeLocal(op.c, op.id)
    else {
      const cur = (state[op.c] || []).find((r) => r.id === op.id)
      applyRemote(op.c, op.replace || !cur ? { ...op.d } : { ...cur, ...op.d })
    }
  }
}

function loadRecords(records) {
  const s = empty()
  for (const { c, d } of records) (s[c] = s[c] || []).push(d)
  for (const c of Object.keys(s)) s[c].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  state = s
}

export async function connectSociety(soc) {
  disconnectSociety()
  currentSociety = soc
  state = empty()
  // 1) instant start from the device cache (works offline)
  try {
    const cached = await idbGet(cacheKey())
    if (cached?.state) { state = { ...empty(), ...cached.state }; sync.seq = cached.seq || 0; sync.syncedAt = cached.syncedAt || 0 }
    sync.outbox = (await idbGet(outboxKey())) || []
  } catch { /* ignore */ }
  rebaseOutbox()
  emit()
  // 2) fresh copy from the server
  try {
    await fullFetch()
  } catch (e) {
    if (!e.network) throw e
    sync.online = false
    if (!state.users.length) throw e // nothing cached – cannot start offline
  }
  // 3) live updates
  sync.unsub = subscribeChanges(soc, () => pull())
  sync.timer = setInterval(() => { if (document.visibilityState === 'visible') { pull(); flushOutbox() } }, 30000)
  window.addEventListener('online', onOnline)
  window.addEventListener('focus', onOnline)
  flushOutbox()
}
const onOnline = () => { pull(); flushOutbox() }

export function disconnectSociety() {
  sync.unsub?.(); sync.unsub = null
  clearInterval(sync.timer)
  window.removeEventListener('online', onOnline)
  window.removeEventListener('focus', onOnline)
}

async function fullFetch() {
  const res = await api.fetchSociety(currentSociety)
  loadRecords(res.records)
  sync.seq = res.seq
  sync.syncedAt = Date.now()
  sync.online = true
  rebaseOutbox()
  persist(); emit()
  return res
}

async function pull() {
  if (!CLOUD || !currentSociety || sync.pulling) return
  sync.pulling = true
  try {
    // A phone that has been away for days just reloads everything.
    if (Date.now() - sync.syncedAt > 3 * 86400000) { await fullFetch(); return }
    const res = await api.fetchChanges(currentSociety, sync.seq)
    for (const { c, d } of res.records) applyRemote(c, d)
    for (const { c, id } of res.deleted) removeLocal(c, id)
    sync.seq = res.seq
    sync.syncedAt = Date.now()
    sync.online = true
    if (res.records.length || res.deleted.length) { rebaseOutbox(); persist(); emit() }
  } catch (e) {
    if (e.network) sync.online = false
    else if (e.message?.includes('not a member')) emitError('Your access to this society has been removed.')
  } finally { sync.pulling = false }
}

function enqueue(op) {
  // merge consecutive edits to the same record into one request
  const last = sync.outbox[sync.outbox.length - 1]
  if (last && op.op === 'save' && last.op === 'save' && last.c === op.c && last.id === op.id) {
    last.d = last.replace || op.replace ? { ...last.d, ...op.d } : { ...last.d, ...op.d }
    last.replace = last.replace || op.replace
  } else sync.outbox.push(op)
  saveOutbox()
  queueMicrotask(flushOutbox)
}

export async function flushOutbox() {
  if (!CLOUD || sync.flushing || !sync.outbox.length || !currentSociety) return
  sync.flushing = true
  try {
    while (sync.outbox.length) {
      const head = sync.outbox[0]
      if (head.op === 'delete') {
        try { await api.deleteRecord(currentSociety, head.c, head.id) } catch (e) { if (e.network) throw e; reject([head], e) }
        sync.outbox.shift(); saveOutbox(); continue
      }
      const batch = []
      for (const op of sync.outbox) { if (op.op !== 'save' || batch.length >= 200) break; batch.push(op) }
      const rows = batch.map((op) => ({ c: op.c, id: op.id, d: op.d, replace: !!op.replace }))
      try {
        await api.saveRecords(currentSociety, rows)
        sync.outbox.splice(0, batch.length)
      } catch (e) {
        if (e.network) throw e
        if (batch.length === 1) { sync.outbox.shift(); reject(batch, e) }
        else { // find the bad one(s): send individually
          for (const op of batch) {
            try { await api.saveRecords(currentSociety, [{ c: op.c, id: op.id, d: op.d, replace: !!op.replace }]) } catch (e2) { if (e2.network) throw e2; reject([op], e2) }
            sync.outbox.shift()
          }
        }
      }
      saveOutbox()
    }
    sync.online = true
  } catch (e) {
    sync.online = false // offline: keep everything queued, retry later
  } finally {
    sync.flushing = false
    emit()
  }
}

// The server refused a change: tell the user and restore the true data.
function reject(ops, e) {
  console.warn('Server rejected', ops, e.message)
  emitError(e.message || 'Could not save your change.')
  fullFetch().catch(() => {})
}

/* ---------- public API (same in both modes) ---------- */
const scoped = (rows) => rows.filter((r) => !r.societyId || r.societyId === currentSociety)
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

export const db = {
  get societyId() { return currentSociety },
  setSociety(id) { currentSociety = id; emit() },
  society() { return state?.societies.find((s) => s.id === currentSociety) },
  list(col, filter) {
    const rows = scoped(state?.[col] || [])
    return filter ? rows.filter(filter) : rows
  },
  get(col, id) { return (state?.[col] || []).find((r) => r.id === id) },
  find(col, filter) { return scoped(state?.[col] || []).find(filter) },
  insert(col, row) {
    const rec = { societyId: currentSociety, createdAt: new Date().toISOString(), ...row }
    state = { ...state, [col]: [rec, ...state[col].filter((r) => r.id !== rec.id)] }
    if (CLOUD) enqueue({ op: 'save', c: col, id: rec.id, d: rec, replace: true })
    persist(); emit()
    return rec
  },
  update(col, id, patch) {
    let out, changed = {}
    state = {
      ...state,
      [col]: state[col].map((r) => {
        if (r.id !== id) return r
        out = { ...r, ...(typeof patch === 'function' ? patch(r) : patch), updatedAt: new Date().toISOString() }
        for (const k of Object.keys(out)) if (!same(out[k], r[k])) changed[k] = out[k]
        return out
      })
    }
    if (CLOUD && out) enqueue({ op: 'save', c: col, id, d: changed })
    persist(); emit()
    return out
  },
  remove(col, id) {
    state = { ...state, [col]: state[col].filter((r) => r.id !== id) }
    if (CLOUD) enqueue({ op: 'delete', c: col, id })
    persist(); emit()
  },
  setting(key, fallback) {
    return state?.settings.find((s) => s.id === key && (!s.societyId || s.societyId === currentSociety))?.value ?? fallback
  },
  setSetting(key, value) {
    const exists = state.settings.find((s) => s.id === key && (!s.societyId || s.societyId === currentSociety))
    if (exists) db.update('settings', key, { value })
    else db.insert('settings', { id: key, value })
  },
  // bulk insert/replace (setup wizard, imports) – one server request per 200 rows
  insertMany(col, rows) { rows.forEach((r) => db.insert(col, r)) },
  refresh: () => (CLOUD ? fullFetch() : Promise.resolve())
}

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l) }
export const useDBVersion = () => useSyncExternalStore(subscribe, () => version)

// Re-render whenever the DB changes; the selector is cheap (in-memory arrays).
export function useData(selector) {
  useDBVersion()
  return state ? selector(db) : undefined
}
