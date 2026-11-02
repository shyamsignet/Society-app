import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { db, useData, connectSociety, disconnectSociety } from './db'
import { setSessionUser, runReminders } from './actions'
import { CLOUD } from './config'
import { api, getSession, signOut, supabase } from './cloud'

// demo and society mode can live on the same site (/demo/), so they keep separate sessions
const KEY = CLOUD ? 'smart-society-session' : 'smart-society-demo-session'
const SOC_KEY = 'smart-society-last-society'
const AuthCtx = createContext(null)
const store = {
  get: (k) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch { /* ignore */ } }
}

// phase (cloud): loading → signedOut | joining | ready ;  demo: always 'ready' or 'signedOut'
export function AuthProvider({ children }) {
  const [userId, setUserId] = useState(() => (CLOUD ? null : store.get(KEY)))
  const [phase, setPhase] = useState(CLOUD ? 'loading' : 'ready')
  const [error, setError] = useState('')
  const user = useData((d) => (userId ? d.get('users', userId) : null))

  useEffect(() => {
    setSessionUser(user?.id || null)
    if (user && phase === 'ready') runReminders(user)
  }, [user?.id, phase])

  // Called after a successful OTP login, after creating a society, and on app start.
  const enter = useCallback(async (preferSociety) => {
    setError('')
    setPhase('loading')
    try {
      let members
      try { members = await api.linkMember() } catch (e) {
        if (!e.network) throw e
        // offline start: reuse the last society from the device cache
        const soc = store.get(SOC_KEY), uid = store.get(KEY)
        if (soc && uid) { await connectSociety(soc); setUserId(uid); setPhase('ready'); return }
        throw e
      }
      const active = members.filter((m) => m.status === 'active')
      const m = active.find((x) => x.societyId === (preferSociety || store.get(SOC_KEY))) || active[0]
      if (!m) {
        if (members.length) { setError('Your account has been deactivated by the society office. Please contact them if this is a mistake.'); setPhase('error'); return }
        setPhase('joining'); return
      }
      await connectSociety(m.societyId)
      store.set(SOC_KEY, m.societyId)
      store.set(KEY, m.userId)
      setUserId(m.userId)
      setPhase('ready')
    } catch (e) {
      setError(e.message || 'Could not connect. Please try again.')
      setPhase('error')
    }
  }, [])

  useEffect(() => {
    if (!CLOUD) return
    getSession().then((s) => (s ? enter() : setPhase('signedOut'))).catch(() => setPhase('signedOut'))
    const { data } = supabase.auth.onAuthStateChange((evt) => { if (evt === 'SIGNED_OUT') { setUserId(null); setPhase('signedOut') } })
    return () => data.subscription.unsubscribe()
  }, [enter])

  const login = (id) => { // demo mode only
    store.set(KEY, id)
    setUserId(id)
  }
  const logout = async () => {
    store.set(KEY, null)
    setUserId(null)
    if (CLOUD) { disconnectSociety(); store.set(SOC_KEY, null); await signOut(); setPhase('signedOut') }
  }

  const active = user && user.status === 'active' ? user : null
  return (
    <AuthCtx.Provider value={{ user: phase === 'ready' ? active : null, phase, error, login, logout, enter, society: db.society() || {} }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
