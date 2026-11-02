// Thin wrapper around Supabase. Everything the app sends to the server goes
// through the SQL functions in supabase/setup.sql, which enforce permissions.
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_URL, SUPABASE_ANON_KEY, CLOUD } from './config'

export const supabase = CLOUD
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'smart-society-auth' } })
  : null

export class CloudError extends Error {
  constructor(message, { network = false, code } = {}) { super(message); this.network = network; this.code = code }
}

const FRIENDLY = {
  not_member: 'You are not a member of this society.',
  not_authenticated: 'Please log in again.',
  slot_taken: 'Sorry, this slot was just booked. Please pick another.',
  society_exists: 'That society code is already taken. Please choose another.',
  invalid_society_code: 'Society code: use 3–40 lowercase letters, numbers or dashes.',
  registration_pending: 'Your registration request is already waiting for approval.',
  already_member: 'You are already a member of this society.',
  apartment_not_found: 'Please choose your flat.',
  society_not_found: 'No society found with that code.',
  subscription_expired: 'This society’s SociYo subscription has expired, so the app is read-only. The committee can renew it under Admin → Subscription.',
  invalid_payment: 'Check the amount and the number of months.',
  invalid_subscription: 'Check the plan and status.'
}
const friendly = (msg = '') => {
  if (msg.startsWith('permission_denied')) return 'You do not have permission to do this.'
  return FRIENDLY[msg] || msg
}

async function rpc(fn, args) {
  let res
  try {
    res = await supabase.rpc(fn, args)
  } catch (e) {
    throw new CloudError('No internet connection', { network: true })
  }
  const { data, error } = res
  if (error) {
    const network = !error.code && /fetch|network|Failed|timeout/i.test(error.message || '')
    throw new CloudError(network ? 'No internet connection' : friendly(error.message), { network, code: error.code })
  }
  return data
}

export const api = {
  fetchSociety: (soc) => rpc('fetch_society', { p_society: soc }),
  fetchChanges: (soc, since) => rpc('fetch_changes', { p_society: soc, p_since: since }),
  saveRecords: (soc, rows) => rpc('save_records', { p_society: soc, p_rows: rows }),
  deleteRecord: (soc, c, id) => rpc('delete_record', { p_society: soc, p_collection: c, p_id: id }),
  linkMember: () => rpc('link_member', {}),
  createSociety: (soc, info, admin) => rpc('create_society', { p_society: soc, p_info: info, p_admin: admin }),
  societyDirectory: (soc) => rpc('society_directory', { p_society: soc }),
  submitRegistration: (soc, data) => rpc('submit_registration', { p_society: soc, p_data: data }),
  myRegistrations: () => rpc('my_registrations', {}),
  mySubscription: (soc) => rpc('my_subscription', { p_society: soc }),
  isPlatformAdmin: () => rpc('is_platform_admin', {}),
  platformOverview: () => rpc('platform_overview', {}),
  platformRecordPayment: (soc, { amount, months, method, ref, note }) => rpc('platform_record_payment', { p_society: soc, p_amount: Number(amount), p_months: Number(months), p_method: method || '', p_ref: ref || '', p_note: note || '' }),
  platformUpdateSubscription: (soc, patch) => rpc('platform_update_subscription', { p_society: soc, p_patch: patch }),
  platformSetSettings: (data) => rpc('platform_set_settings', { p_data: data })
}

/* ---------- Auth (OTP by SMS or email) ---------- */
const authErr = (error) => {
  const m = error?.message || 'Something went wrong'
  if (/phone.*(provider|disabled)|sms.*(provider|disabled)|Unsupported phone provider/i.test(m)) return 'SMS login is not set up for this society yet. Please log in with your email instead.'
  if (/rate limit|too many/i.test(m)) return 'Too many attempts. Please wait a minute and try again.'
  if (/expired|invalid/i.test(m)) return 'Incorrect or expired code. Please try again.'
  if (/fetch|network/i.test(m)) return 'No internet connection'
  return m
}
const target = (id) => (id.includes('@') ? { email: id.trim().toLowerCase() } : { phone: '+91' + id.replace(/\D/g, '').slice(-10) })

export async function sendOtp(id) {
  const { error } = await supabase.auth.signInWithOtp({ ...target(id), options: { shouldCreateUser: true } })
  if (error) throw new CloudError(authErr(error))
}
export async function verifyOtp(id, token) {
  const t = target(id)
  const { data, error } = await supabase.auth.verifyOtp({ ...t, token, type: t.email ? 'email' : 'sms' })
  if (error) throw new CloudError(authErr(error))
  return data.session
}
export const getSession = async () => (await supabase.auth.getSession()).data.session
export const signOut = () => supabase.auth.signOut()

/* ---------- Realtime: ping on any change in this society ---------- */
export function subscribeChanges(soc, onPing) {
  const ch = supabase
    .channel('society-' + soc)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'changes', filter: `society_id=eq.${soc}` }, () => onPing())
    .subscribe()
  return () => { try { supabase.removeChannel(ch) } catch { /* ignore */ } }
}

/* ---------- Photos & documents ---------- */
export async function uploadDataUrl(soc, dataUrl, name = 'file') {
  const blob = await (await fetch(dataUrl)).blob()
  const ext = (blob.type.split('/')[1] || 'bin').replace('jpeg', 'jpg').replace(/[^a-z0-9]/g, '')
  const path = `${soc}/${new Date().toISOString().slice(0, 7)}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from('media').upload(path, blob, { contentType: blob.type, upsert: false })
  if (error) throw new CloudError('Upload failed – please check your internet and try again.', { network: true })
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl
}
