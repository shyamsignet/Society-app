import { Suspense, lazy, useEffect, useState } from 'react'
import { getLang, onLangChange } from './i18n'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { can } from './lib/rbac'
import { OverlayProvider, Button, useToast } from './components/ui'
import { CLOUD } from './lib/config'
import { onSyncError, syncStatus, useDBVersion } from './lib/db'
import Onboarding from './pages/Onboarding'
import { CloudOff, LogOut, RefreshCw } from 'lucide-react'
import BottomNav from './components/BottomNav'
import Login from './pages/Login'
import Home from './pages/Home'

const Directory = lazy(() => import('./pages/Directory'))
const Services = lazy(() => import('./pages/Services'))
const Profile = lazy(() => import('./pages/Profile'))
const Notifications = lazy(() => import('./pages/Notifications'))
const Announcements = lazy(() => import('./pages/Announcements'))
const Feed = lazy(() => import('./pages/Feed'))
const Complaints = lazy(() => import('./pages/Complaints'))
const Payments = lazy(() => import('./pages/Payments'))
const Visitors = lazy(() => import('./pages/Visitors'))
const Guard = lazy(() => import('./pages/Guard'))
const Platform = lazy(() => import('./pages/Platform'))
const Facilities = lazy(() => import('./pages/Facilities'))
const Marketplace = lazy(() => import('./pages/Marketplace'))
const Events = lazy(() => import('./pages/Events'))
const Polls = lazy(() => import('./pages/Polls'))
const Emergency = lazy(() => import('./pages/Emergency'))
const Admin = lazy(() => import('./pages/admin/Admin'))

const Loading = () => <div className="h-[60vh] grid place-items-center"><span className="h-8 w-8 rounded-full border-[3px] border-brand-600 border-r-transparent animate-spin" /></div>

function SyncBanner() {
  useDBVersion()
  const toast = useToast()
  useEffect(() => onSyncError((m) => toast(m, 'error')), [])
  if (!CLOUD) return null
  const s = syncStatus()
  if (s.online && !s.pending) return null
  return (
    <div className="sticky top-0 z-50 bg-amber-100 text-amber-900 text-xs font-semibold px-4 py-1.5 flex items-center gap-2 safe-top no-print">
      <CloudOff size={14} /> {s.online ? 'Saving changes…' : 'You are offline – changes will sync when you are back online'}
    </div>
  )
}

function Gate({ children }) {
  const { user, phase, error, logout, enter } = useAuth()
  if (phase === 'loading') return <Loading />
  if (phase === 'signedOut' || (!CLOUD && !user)) return <Login />
  if (phase === 'joining') return <Onboarding />
  if (phase === 'error' || !user) return (
    <div className="min-h-full grid place-items-center p-8 text-center">
      <div>
        <CloudOff size={44} className="mx-auto text-ink-400" />
        <p className="font-bold mt-4">{phase === 'error' ? error : 'Your account is not active in this society.'}</p>
        {!/deactivated/.test(error) && <p className="text-sm text-ink-500 mt-1">Please check your internet connection or contact the society office.</p>}
        <div className="flex gap-2 justify-center mt-6">
          {phase === 'error' && !/deactivated/.test(error) && <Button icon={RefreshCw} onClick={() => enter()}>Try again</Button>}
          <Button variant="outline" icon={LogOut} onClick={logout}>Log out</Button>
        </div>
      </div>
    </div>
  )
  return children
}

function Shell() {
  const { user } = useAuth()
  const loc = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])
  const guard = user.role === 'security'
  const hideNav = /\/new|\/receipt\//.test(loc.pathname)
  return (
    <>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={guard ? <Navigate to="/guard" replace /> : <Home />} />
          <Route path="/directory" element={<Directory />} />
          <Route path="/services" element={<Services />} />
          <Route path="/profile/*" element={<Profile />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/announcements/*" element={<Announcements />} />
          <Route path="/feed/*" element={<Feed />} />
          <Route path="/complaints/*" element={<Complaints />} />
          <Route path="/payments/*" element={<Payments />} />
          <Route path="/visitors/*" element={<Visitors />} />
          <Route path="/guard/*" element={can(user, 'visitors.gate') ? <Guard /> : <Navigate to="/" />} />
          <Route path="/facilities/*" element={<Facilities />} />
          <Route path="/marketplace/*" element={<Marketplace />} />
          <Route path="/events/*" element={<Events />} />
          <Route path="/polls/*" element={<Polls />} />
          <Route path="/emergency" element={<Emergency />} />
          <Route path="/platform" element={<Platform />} />
          <Route path="/admin/*" element={can(user, 'admin.view') ? <Admin /> : <Navigate to="/" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Suspense>
      {!hideNav && <BottomNav guard={guard} />}
    </>
  )
}

export default function App() {
  const [lang, setLangState] = useState(getLang())
  useEffect(() => onLangChange(setLangState), [])
  return (
    <OverlayProvider key={lang}>
      <AuthProvider>
        <SyncBanner />
        <Gate><Shell /></Gate>
      </AuthProvider>
    </OverlayProvider>
  )
}
