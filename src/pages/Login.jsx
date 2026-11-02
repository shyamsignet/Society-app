import { useState } from 'react'
import { ArrowRight, ShieldCheck, Smartphone, Building2, CheckCircle2, ArrowLeft } from 'lucide-react'
import { Button, Field, Input, Select, Card, useToast, Tabs } from '../components/ui'
import FlatPicker from '../components/FlatPicker'
import { useAuth } from '../lib/auth'
import { db, useData } from '../lib/db'
import { findUserByPhone, registerApartment } from '../lib/actions'

import { otp6 } from '../lib/utils'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { CLOUD, BRAND_NAME } from '../lib/config'
import { sendOtp, verifyOtp } from '../lib/cloud'
import Logo, { BrandLine } from '../components/Logo'

export default function Login() {
  return CLOUD ? <CloudLogin /> : <DemoLogin />
}

export function Hero({ title, sub, emoji }) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-brand-800 via-brand-900 to-[#1C0E1B] text-white px-6 pt-16 pb-24 safe-top">
      <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-coral-500/25 blur-2xl" />
      <div className="absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-brand-200/10 blur-2xl" />
      <div className="relative flex justify-end -mt-8 mb-6"><LanguageSwitcher dark /></div>
      <div className="relative">
        {emoji
          ? <div className="h-14 w-14 rounded-2xl bg-white/10 backdrop-blur grid place-items-center text-3xl mb-5">{emoji}</div>
          : <Logo size={56} className="mb-5 rounded-2xl ring-1 ring-white/15" />}
        <BrandLine mark={!!emoji} tagline={title !== 'Your society, sorted.'} />
        <h1 className="text-[28px] font-extrabold leading-tight mt-1">{title}</h1>
        {sub && <p className="text-brand-200 text-sm mt-1">{sub}</p>}
      </div>
    </div>
  )
}

function CloudLogin() {
  const { enter } = useAuth()
  const [mode, setMode] = useState('phone')
  const [step, setStep] = useState('id')
  const [id, setId] = useState('')
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  // Supabase sends 6–10 digit codes depending on the project's "OTP length" setting.
  const codeOk = code.length >= 6 && code.length <= 10
  const valid = mode === 'phone' ? id.replace(/\D/g, '').length === 10 : /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(id.trim())
  const send = async () => {
    setErr('')
    if (!valid) return setErr(mode === 'phone' ? 'Enter your 10-digit mobile number' : 'Enter a valid email address')
    setBusy(true)
    try { await sendOtp(id); setStep('otp'); setCode('') } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const verify = async () => {
    setErr(''); setBusy(true)
    try { await verifyOtp(id, code); await enter() } catch (e) { setErr(e.message); setBusy(false) }
  }
  return (
    <div className="min-h-full flex flex-col">
      <Hero title={BRAND_NAME || 'Your society, sorted.'} />
      <div className="flex-1 -mt-14 px-4 pb-10 relative">
        <Card className="p-5">
          {step === 'id' ? (
            <>
              <h2 className="text-lg font-bold">Welcome home 👋</h2>
              <p className="text-sm text-ink-500 mb-4">Log in with your registered mobile number</p>
              <Tabs className="mb-4" value={mode} onChange={(v) => { setMode(v); setId(''); setErr('') }} tabs={[{ value: 'phone', label: 'Mobile' }, { value: 'email', label: 'Email' }]} />
              <Field error={err}>
                {mode === 'phone' ? (
                  <div className="flex gap-2">
                    <span className="h-12 px-3 rounded-xl border border-ink-200 grid place-items-center text-[15px] font-semibold text-ink-700">+91</span>
                    <Input inputMode="numeric" maxLength={10} placeholder="10-digit mobile" value={id} onChange={(e) => setId(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && send()} />
                  </div>
                ) : <Input type="email" inputMode="email" placeholder="you@example.com" value={id} onChange={(e) => setId(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />}
              </Field>
              <Button block size="lg" icon={Smartphone} loading={busy} onClick={send}>Send OTP</Button>
              <p className="text-xs text-ink-500 mt-4 text-center">New to the app? Log in with your mobile number first — you can then join your society or set up a new one.</p>
            </>
          ) : (
            <>
              <button onClick={() => setStep('id')} className="flex items-center gap-1 text-sm text-ink-500 mb-3"><ArrowLeft size={16} /> Change number</button>
              <h2 className="text-lg font-bold">Enter verification code</h2>
              <p className="text-sm text-ink-500 mb-5">{mode === 'phone' ? `Sent to +91 ${id}` : `Sent to ${id}`}</p>
              <Field error={err}>
                <Input autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={10} placeholder="• • • • • •" className="text-center tracking-[0.4em] text-xl font-bold" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && codeOk && verify()} />
              </Field>
              <Button block size="lg" icon={ShieldCheck} loading={busy} onClick={verify} disabled={!codeOk}>Verify & continue</Button>
              <button onClick={send} disabled={busy} className="w-full mt-4 text-sm font-semibold text-brand-600">Resend code</button>
            </>
          )}
        </Card>
        <a href="./demo/" className="mt-4 flex items-center justify-center gap-2 h-12 rounded-2xl border border-brand-200 bg-white/70 text-sm font-semibold text-brand-700"><span>Try the demo with a sample society</span> <ArrowRight size={16} /></a>
      </div>
    </div>
  )
}

const DEMOS = [
  { id: 'u_priya', label: 'Resident', who: 'Priya Sharma · A-302' },
  { id: 'u_rajesh', label: 'Chairman', who: 'Rajesh Kulkarni · B-401' },
  { id: 'u_anil', label: 'Treasurer', who: 'Anil Deshpande · A-501' },
  { id: 'u_suresh', label: 'Facility Manager', who: 'Suresh Patil' },
  { id: 'u_ramesh', label: 'Security Guard', who: 'Ramesh Yadav · Main Gate' },
  { id: 'u_admin', label: 'Super Admin', who: 'Society Office' }
]

function DemoLogin() {
  const { login } = useAuth()
  const toast = useToast()
  const society = useData((d) => d.society())
  const [step, setStep] = useState('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(null)
  const [err, setErr] = useState('')

  const sendOtp = () => {
    setErr('')
    const digits = phone.replace(/\D/g, '')
    if (digits.length !== 10) return setErr('Enter your 10-digit mobile number')
    const u = findUserByPhone(digits)
    if (!u) {
      const pending = db.find('registrations', (r) => r.phone.replace(/\D/g, '').endsWith(digits) && r.status === 'pending')
      return setErr(pending ? 'Your registration is awaiting approval by the society office.' : 'This number is not registered with the society. Register your apartment below.')
    }
    const o = otp6()
    setSent({ otp: o, userId: u.id })
    setStep('otp')
    toast(`Demo mode: your OTP is ${o}`, 'info')
  }
  const verify = () => {
    if (code !== sent.otp) return setErr('Incorrect OTP. Please try again.')
    login(sent.userId)
  }

  return (
    <div className="min-h-full flex flex-col">
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-800 via-brand-900 to-[#1C0E1B] text-white px-6 pt-16 pb-24 safe-top">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-coral-500/25 blur-2xl" />
        <div className="absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-brand-200/10 blur-2xl" />
        <div className="relative flex justify-end -mt-8 mb-6"><LanguageSwitcher dark /></div>
        <div className="relative">
          <div className="h-14 w-14 rounded-2xl bg-white/10 backdrop-blur grid place-items-center text-3xl mb-5">{society?.logoEmoji}</div>
          <BrandLine />
          <h1 className="text-[28px] font-extrabold leading-tight mt-1">{society?.name}</h1>
          <p className="text-brand-200 text-sm mt-1">{society?.city}</p>
        </div>
      </div>

      <div className="flex-1 -mt-14 px-4 pb-10 relative">
        <Card className="p-5">
          {step === 'phone' && (
            <>
              <h2 className="text-lg font-bold">Welcome home 👋</h2>
              <p className="text-sm text-ink-500 mb-5">Log in with your registered mobile number</p>
              <Field label="Mobile number" error={err}>
                <div className="flex gap-2">
                  <span className="h-12 px-3 rounded-xl border border-ink-200 grid place-items-center text-[15px] font-semibold text-ink-700">+91</span>
                  <Input inputMode="numeric" maxLength={10} placeholder="98220 11302" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && sendOtp()} />
                </div>
              </Field>
              <Button block size="lg" icon={Smartphone} onClick={sendOtp}>Send OTP</Button>
              <button onClick={() => { setErr(''); setStep('register') }} className="w-full mt-4 text-sm font-semibold text-brand-600">New here? Register your apartment →</button>
            </>
          )}
          {step === 'otp' && (
            <>
              <button onClick={() => setStep('phone')} className="flex items-center gap-1 text-sm text-ink-500 mb-3"><ArrowLeft size={16} /> Change number</button>
              <h2 className="text-lg font-bold">Enter verification code</h2>
              <p className="text-sm text-ink-500 mb-5">Sent to +91 {phone}</p>
              <Field error={err} hint={`Demo mode – no SMS is sent. Use ${sent.otp}`}>
                <Input autoFocus inputMode="numeric" maxLength={6} placeholder="• • • • • •" className="text-center tracking-[0.6em] text-xl font-bold" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && verify()} />
              </Field>
              <Button block size="lg" icon={ShieldCheck} onClick={verify} disabled={code.length !== 6}>Verify & continue</Button>
            </>
          )}
          {step === 'register' && <Register onBack={() => setStep('phone')} />}
        </Card>

        {step !== 'register' && (
          <>
            <div className="flex items-center gap-3 my-6"><span className="h-px flex-1 bg-ink-200" /><span className="text-xs font-semibold text-ink-400 uppercase tracking-wider">Try a demo account</span><span className="h-px flex-1 bg-ink-200" /></div>
            <div className="grid grid-cols-2 gap-2.5">
              {DEMOS.map((d) => (
                <button key={d.id} onClick={() => login(d.id)} className="text-left p-3 rounded-2xl bg-white shadow-card active:scale-[.98] transition">
                  <div className="text-[13px] font-bold text-brand-800 flex items-center justify-between">{d.label}<ArrowRight size={14} /></div>
                  <div className="text-[11px] text-ink-500 mt-0.5 truncate">{d.who}</div>
                </button>
              ))}
            </div>
            <p className="text-center text-xs text-ink-400 mt-6">Demo with sample data – stored only on this device. Tap “Log out / switch demo account” in Profile to try another role.</p>
          </>
        )}
      </div>
    </div>
  )
}

function Register({ onBack }) {
  const [f, setF] = useState({ name: '', phone: '', email: '', apartmentId: '', occupancy: 'owner' })
  const [err, setErr] = useState('')
  const [done, setDone] = useState(null)
  const apts = useData((d) => d.list('apartments'))
  const set = (k) => (e) => setF({ ...f, [k]: e.target ? e.target.value : e })
  const submit = () => {
    setErr('')
    try { setDone(registerApartment(f)) } catch (e) { setErr(e.message) }
  }
  if (done) return (
    <div className="text-center py-4">
      <CheckCircle2 size={56} className="mx-auto text-accent-500 animate-pop" />
      <h2 className="text-lg font-bold mt-3">Request submitted</h2>
      <p className="text-sm text-ink-500 mt-1">The society office will verify your details for {db.get('apartments', done.apartmentId).number}. You’ll be able to log in once approved.</p>
      <p className="text-xs text-ink-400 mt-3">Tip: log in as <b>Chairman</b> or <b>Super Admin</b> → Admin → Residents to approve it.</p>
      <Button className="mt-5" variant="secondary" onClick={onBack}>Back to login</Button>
    </div>
  )
  return (
    <>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-ink-500 mb-3"><ArrowLeft size={16} /> Back</button>
      <h2 className="text-lg font-bold flex items-center gap-2"><Building2 size={20} /> Register your apartment</h2>
      <p className="text-sm text-ink-500 mb-5">Your request will be verified by the society office.</p>
      <Field label="Full name"><Input value={f.name} onChange={set('name')} placeholder="As per sale deed / rent agreement" /></Field>
      <Field label="Mobile number"><Input inputMode="numeric" maxLength={10} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, '') })} placeholder="10-digit mobile" /></Field>
      <Field label="Email (optional)"><Input type="email" value={f.email} onChange={set('email')} placeholder="you@example.com" /></Field>
      <FlatPicker apartments={apts} value={f.apartmentId} onChange={(id) => setF((x) => ({ ...x, apartmentId: id }))} flatLabel="Apartment" option={(a) => `${a.number} · ${a.type}`} />
      <Field label="I am the"><Tabs tabs={[{ value: 'owner', label: 'Owner' }, { value: 'tenant', label: 'Tenant' }]} value={f.occupancy} onChange={set('occupancy')} /></Field>
      {err && <p className="text-sm text-red-600 mb-3">{err}</p>}
      <Button block size="lg" onClick={submit}>Submit for approval</Button>
    </>
  )
}
