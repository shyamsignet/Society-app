import { useEffect, useState } from 'react'
import { Routes, Route, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Clock, Copy, Wallet, CalendarClock, Receipt, CheckCircle2, ChevronDown, CreditCard, Landmark, Smartphone, ShieldCheck, Download, Share2, XCircle, LayoutDashboard, Printer } from 'lucide-react'
import { Page, Button, Card, Badge, Empty, Sheet, Field, Input, Tabs, useToast } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useData, db } from '../lib/db'
import { can } from '../lib/rbac'
import { reportPayment, billingConfig, billLabel, billTotal, billStatus, payBills, aptNo, userById, AppError } from '../lib/actions'
import { inr, fmtDate, fmtDateTime, monthLabel, cls, shareText } from '../lib/utils'
import { makePdf, saveBlob } from '../lib/pdf'
import { CLOUD } from '../lib/config'
import QRCode from 'qrcode'

export default function Payments() {
  return (
    <Routes>
      <Route index element={<Dashboard />} />
      <Route path="receipt/:id" element={<ReceiptPage />} />
    </Routes>
  )
}

const ST = { paid: ['green', 'Paid'], due: ['amber', 'Due'], overdue: ['red', 'Overdue'], verifying: ['sky', 'Verifying'] }
export const BillBadge = ({ b }) => { const [c, l] = ST[billStatus(b)]; return <Badge color={c} dot>{l}</Badge> }

function Dashboard() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const [tab, setTab] = useState('dues')
  const [open, setOpen] = useState(null)
  const bills = useData((d) => d.list('bills', (b) => b.apartmentId === user.apartmentId).sort((a, b) => b.month.localeCompare(a.month)))
  const payments = useData((d) => d.list('payments', (p) => p.apartmentId === user.apartmentId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
  const unpaid = bills.filter((b) => b.status !== 'paid' && billStatus(b) !== 'verifying')
  const verifying = payments.filter((p) => p.status === 'pending')
  const [sel, setSel] = useState(() => unpaid.map((b) => b.id))
  const [pay, setPay] = useState(false)
  useEffect(() => { if (sp.get('pay') && unpaid.length) { setSel(unpaid.map((b) => b.id)); setPay(true); setSp({}, { replace: true }) } }, [])

  if (!user.apartmentId) return (
    <Page title="Maintenance" back>
      <Empty icon={Wallet} title="No apartment linked" text="Maintenance dues are linked to apartments." action={can(user, 'billing.manage') && <Button icon={LayoutDashboard} onClick={() => nav('/admin/billing')}>Open billing admin</Button>} />
    </Page>
  )
  const total = unpaid.reduce((a, b) => a + billTotal(b), 0)
  const selTotal = unpaid.filter((b) => sel.includes(b.id)).reduce((a, b) => a + billTotal(b), 0)
  const late = unpaid.reduce((a, b) => a + (b.lateFee || 0), 0)
  const nextDue = unpaid.map((b) => b.dueDate).sort()[0]
  const last = payments.find((p) => p.status === 'success')
  const overdue = unpaid.some((b) => billStatus(b) === 'overdue')

  return (
    <Page title="Maintenance" subtitle={aptNo(user.apartmentId)} back actions={can(user, 'billing.manage') && <Button size="sm" variant="secondary" onClick={() => nav('/admin/billing')}>Admin</Button>}>
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-800 to-brand-900 text-white p-5 mt-2 shadow-float">
        <div className="absolute -right-8 -bottom-10 h-40 w-40 rounded-full bg-accent-500/20 blur-xl" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <span className="text-sm text-brand-200">Outstanding amount</span>
            <span className={cls('text-[11px] font-bold uppercase rounded-full px-2.5 py-1', !total ? 'bg-accent-500' : overdue ? 'bg-red-500' : 'bg-amber-400 text-ink-900')}>{!total ? 'All clear' : overdue ? 'Overdue' : 'Due'}</span>
          </div>
          <div className="text-[34px] font-extrabold mt-1">{inr(total)}</div>
          {late > 0 && <div className="text-xs text-red-200">Includes {inr(late)} late payment charges</div>}
          <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
            <div className="bg-white/10 rounded-2xl p-3"><div className="text-[11px] text-brand-200 flex items-center gap-1"><CalendarClock size={12} /> Next due</div><div className="font-bold mt-0.5">{nextDue ? fmtDate(nextDue) : '—'}</div></div>
            <div className="bg-white/10 rounded-2xl p-3"><div className="text-[11px] text-brand-200 flex items-center gap-1"><Receipt size={12} /> Last payment</div><div className="font-bold mt-0.5">{last ? `${inr(last.amount)}` : '—'}</div><div className="text-[10px] text-brand-200">{last && fmtDate(last.createdAt)}</div></div>
          </div>
          {verifying.length > 0 && <div className="mt-4 rounded-2xl bg-white/10 p-3 text-sm"><b>{inr(verifying.reduce((a, p) => a + p.amount, 0))}</b> <span>reported – waiting for the treasurer to verify</span></div>}
          {total > 0 && <Button variant="success" size="lg" block className="mt-4" onClick={() => { setSel(unpaid.map((b) => b.id)); setPay(true) }}>{`Pay ${inr(total)}`}</Button>}
        </div>
      </div>

      <Tabs className="mt-5" value={tab} onChange={setTab} tabs={[{ value: 'dues', label: `Bills` }, { value: 'history', label: 'Payment history' }]} />

      {tab === 'dues' && (
        <div className="space-y-3 mt-4">
          {bills.map((b) => (
            <Card key={b.id} className="overflow-hidden">
              <button className="w-full p-4 flex items-center gap-3 text-left" onClick={() => setOpen(open === b.id ? null : b.id)}>
                {b.status !== 'paid' && billStatus(b) !== 'verifying' ? (
                  <input type="checkbox" checked={sel.includes(b.id)} onClick={(e) => e.stopPropagation()} onChange={(e) => setSel(e.target.checked ? [...sel, b.id] : sel.filter((x) => x !== b.id))} className="h-5 w-5 accent-[#16A34A]" />
                ) : <CheckCircle2 className="text-accent-500" size={20} />}
                <div className="flex-1 min-w-0">
                  <div className="font-bold">{billLabel(b)}</div>
                  <div className="text-xs text-ink-500">{b.status === 'paid' ? `Paid on ${fmtDate(b.paidAt)}` : `Due ${fmtDate(b.dueDate)}`}</div>
                </div>
                <div className="text-right"><div className="font-extrabold">{inr(billTotal(b))}</div><BillBadge b={b} /></div>
                <ChevronDown size={18} className={cls('text-ink-400 transition', open === b.id && 'rotate-180')} />
              </button>
              {open === b.id && (
                <div className="px-4 pb-4 pt-1 border-t border-ink-100 text-sm animate-fade-in">
                  {b.items.map((i, k) => <Line key={k} l={i.label} v={inr(i.amount)} />)}
                  {b.lateFee > 0 && <Line l="Late payment charge" v={inr(b.lateFee)} red />}
                  {(b.adjustments || []).map((a, k) => <Line key={'a' + k} l={`Adjustment: ${a.label}`} v={(a.amount < 0 ? '−' : '') + inr(Math.abs(a.amount))} green={a.amount < 0} />)}
                  <div className="flex justify-between font-extrabold pt-2 mt-2 border-t border-dashed border-ink-200"><span>Total</span><span>{inr(billTotal(b))}</span></div>
                  {b.paymentId && <Button size="sm" variant="secondary" className="mt-3" icon={Receipt} onClick={() => nav(`receipt/${b.paymentId}`)}>View receipt</Button>}
                </div>
              )}
            </Card>
          ))}
          {!bills.length && <Empty icon={Receipt} title="No bills yet" />}
          {unpaid.length > 0 && <div className="h-16" />}
        </div>
      )}

      {tab === 'history' && (
        <div className="space-y-2 mt-4">
          {payments.map((p) => (
            <Card key={p.id} className="p-4 flex items-center gap-3" onClick={() => p.status === 'success' && nav(`receipt/${p.id}`)}>
              <div className={cls('h-11 w-11 rounded-2xl grid place-items-center', p.status === 'success' ? 'bg-accent-50 text-accent-700' : p.status === 'pending' ? 'bg-sky-50 text-sky-700' : 'bg-red-50 text-red-600')}>{p.status === 'success' ? <CheckCircle2 size={20} /> : p.status === 'pending' ? <Clock size={20} /> : <XCircle size={20} />}</div>
              <div className="flex-1 min-w-0">
                <div className="font-bold">{p.billIds.map((id) => { const b = db.get('bills', id); return b ? (b.title || monthLabel(b.month).split(' ')[0]) : '' }).join(', ')}</div>
                <div className="text-xs text-ink-500 truncate">{fmtDateTime(p.createdAt)} · {p.method}</div>
              </div>
              <div className="text-right"><div className="font-extrabold">{inr(p.amount)}</div>{p.status === 'success' ? <div className="text-[11px] text-brand-600 font-semibold flex items-center gap-1 justify-end"><Download size={11} /> Receipt</div> : <Badge color={p.status === 'pending' ? 'sky' : 'red'}>{p.status === 'pending' ? 'Verifying' : 'Not verified'}</Badge>}</div>
            </Card>
          ))}
          {!payments.length && <Empty icon={Receipt} title="No payments yet" />}
        </div>
      )}

      {tab === 'dues' && unpaid.length > 0 && !pay && (
        <div className="fixed bottom-16 inset-x-0 mx-auto max-w-[520px] z-30 p-3 bg-white/95 backdrop-blur border-t border-ink-200 flex items-center gap-3">
          <div className="flex-1"><div className="text-xs text-ink-500">{sel.length} bill(s) selected</div><div className="font-extrabold text-lg">{inr(selTotal)}</div></div>
          <Button variant="success" disabled={!sel.length} onClick={() => setPay(true)}>Proceed to pay</Button>
        </div>
      )}
      {CLOUD
        ? <SocietyPaySheet open={pay} onClose={() => setPay(false)} bills={unpaid.filter((b) => sel.includes(b.id))} amount={selTotal} />
        : <PaySheet open={pay} onClose={() => setPay(false)} bills={unpaid.filter((b) => sel.includes(b.id))} amount={selTotal} />}
    </Page>
  )
}

const Line = ({ l, v, red, green }) => <div className={cls('flex justify-between py-1', red ? 'text-red-600' : green ? 'text-accent-700' : 'text-ink-700')}><span className="pr-3">{l}</span><span className="font-semibold">{v}</span></div>

const METHODS = [
  { id: 'upi', label: 'UPI', sub: 'Google Pay, PhonePe, Paytm, BHIM', icon: Smartphone },
  { id: 'card', label: 'Credit / Debit card', sub: 'Visa, Mastercard, RuPay', icon: CreditCard },
  { id: 'nb', label: 'Net Banking', sub: 'All major Indian banks', icon: Landmark }
]

// Cloud mode: pay the society directly (UPI / bank), then report the reference.
function SocietyPaySheet({ open, onClose, bills, amount }) {
  const { user, society } = useAuth()
  const toast = useToast()
  const cfg = billingConfig()
  const [method, setMethod] = useState('UPI')
  const [ref, setRef] = useState('')
  const [done, setDone] = useState(false)
  const [qr, setQr] = useState('')
  const note = `Maintenance ${aptNo(user.apartmentId)} ${bills.map((b) => billLabel(b)).join(', ')}`.slice(0, 60)
  const upi = cfg.upiId ? `upi://pay?pa=${encodeURIComponent(cfg.upiId)}&pn=${encodeURIComponent(cfg.payeeName || society.name || '')}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}` : ''
  useEffect(() => { if (open) { setDone(false); setRef('') } }, [open])
  useEffect(() => { if (upi) QRCode.toDataURL(upi, { width: 360, margin: 1 }).then(setQr) }, [upi])
  const submit = () => {
    try { reportPayment(user, bills.map((b) => b.id), { method, ref }); setDone(true) } catch (e) { toast(e.message, 'error') }
  }
  return (
    <Sheet open={open} onClose={onClose} title={done ? undefined : 'Pay maintenance'}>
      {done ? (
        <div className="py-8 text-center">
          <Clock size={56} className="mx-auto text-sky-500 animate-pop" />
          <div className="text-xl font-extrabold mt-4">Sent for verification</div>
          <p className="text-sm text-ink-500 mt-2">The treasurer will confirm your payment of {inr(amount)}. You’ll get a notification and a receipt once it’s verified.</p>
          <Button block className="mt-6" onClick={onClose}>Done</Button>
        </div>
      ) : (
        <>
          <div className="rounded-2xl bg-ink-100 p-4 flex items-center justify-between mb-4">
            <div><div className="text-xs text-ink-500">{`${bills.length} bill(s) · ${aptNo(user.apartmentId)}`}</div><div className="text-2xl font-extrabold">{inr(amount)}</div></div>
            <div className="text-[11px] text-ink-500 text-right">{bills.map((b) => billLabel(b)).join(', ')}</div>
          </div>
          <div className="text-sm font-bold mb-2">1. Pay the society</div>
          {cfg.upiId ? (
            <>
              <a href={upi} className="flex items-center justify-center gap-2 h-[52px] rounded-2xl bg-accent-500 text-white font-semibold text-[15px] shadow-sm active:scale-[.98] transition"><Smartphone size={18} /> Pay with UPI app</a>
              <div className="flex items-center gap-3 mt-3 rounded-2xl border border-ink-200 p-3">
                {qr && <img src={qr} alt="UPI QR code" className="h-24 w-24" />}
                <div className="text-xs text-ink-500 min-w-0">
                  <div>Or scan from another phone, or pay to UPI ID:</div>
                  <button className="font-bold text-ink-900 text-sm mt-1 flex items-center gap-1 break-all text-left" onClick={async () => { try { await navigator.clipboard.writeText(cfg.upiId); toast('Copied') } catch { /* ignore */ } }}>{cfg.upiId} <Copy size={13} /></button>
                  <div className="mt-1">{cfg.payeeName || society.name}</div>
                </div>
              </div>
            </>
          ) : !cfg.bankDetails && <p className="text-sm text-ink-500 rounded-2xl bg-amber-50 p-3">The society has not added its UPI or bank details yet. Please pay at the society office, or ask the treasurer.</p>}
          {cfg.bankDetails && <div className="mt-3 rounded-2xl border border-ink-200 p-3 text-xs text-ink-700 whitespace-pre-line"><div className="font-bold text-ink-900 mb-1">Bank transfer (NEFT / IMPS)</div>{cfg.bankDetails}</div>}
          <div className="text-sm font-bold mt-5 mb-2">2. Tell us you have paid</div>
          <div className="grid grid-cols-3 gap-2 mb-3">{['UPI', 'Bank transfer', 'Cheque'].map((m) => <button key={m} onClick={() => setMethod(m)} className={cls('h-10 rounded-xl text-xs font-semibold border', method === m ? 'bg-brand-800 text-white border-brand-800' : 'border-ink-200')}>{m}</button>)}</div>
          <Field label={method === 'UPI' ? 'UPI reference (UTR) number' : method === 'Cheque' ? 'Cheque number' : 'Bank reference number'} hint={method === 'UPI' ? 'The 12-digit number shown in your UPI app after paying' : ''}>
            <Input value={ref} onChange={(e) => setRef(e.target.value.trim())} placeholder={method === 'UPI' ? '412345678901' : ''} />
          </Field>
          <Button variant="success" size="lg" block icon={CheckCircle2} disabled={ref.length < 6} onClick={submit}>I have paid</Button>
        </>
      )}
    </Sheet>
  )
}

function PaySheet({ open, onClose, bills, amount }) {
  const { user } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState('method')
  const [method, setMethod] = useState('upi')
  const [upiApp, setUpiApp] = useState('Google Pay')
  const [upiId, setUpiId] = useState('')
  const [card, setCard] = useState({ no: '', exp: '', cvv: '', name: user.name })
  const [bank, setBank] = useState('HDFC Bank')
  const [result, setResult] = useState(null)
  useEffect(() => { if (open) { setStep('method'); setResult(null) } }, [open])

  const go = () => {
    if (method === 'card') {
      const n = card.no.replace(/\s/g, '')
      if (n.length < 15 || !/^\d{2}\/\d{2}$/.test(card.exp) || card.cvv.length < 3) return toast('Please enter valid card details', 'error')
    }
    if (method === 'upi' && upiApp === 'UPI ID' && !/^[\w.-]+@[\w]+$/.test(upiId)) return toast('Enter a valid UPI ID (e.g. name@okhdfc)', 'error')
    setStep('processing')
    setTimeout(() => {
      try {
        if (method === 'card' && card.no.replace(/\s/g, '').endsWith('0002')) throw new AppError('Your bank declined this transaction (test card). No money was deducted.')
        const label = method === 'upi' ? `UPI · ${upiApp === 'UPI ID' ? upiId : upiApp}` : method === 'card' ? `Card •••• ${card.no.replace(/\s/g, '').slice(-4)}` : `Net Banking · ${bank}`
        const p = payBills(user, bills.map((b) => b.id), label)
        setResult({ ok: true, p })
      } catch (e) { setResult({ ok: false, msg: e.message }) }
      setStep('done')
    }, 2200)
  }
  const fmtCard = (v) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()

  return (
    <Sheet open={open} onClose={step === 'processing' ? undefined : onClose} title={step === 'method' ? 'Pay maintenance' : undefined}>
      {step === 'method' && (
        <>
          <div className="rounded-2xl bg-ink-100 p-4 flex items-center justify-between mb-4">
            <div><div className="text-xs text-ink-500">{bills.length} bill(s) · {aptNo(user.apartmentId)}</div><div className="text-2xl font-extrabold">{inr(amount)}</div></div>
            <div className="text-[11px] text-ink-500 text-right">{bills.map((b) => billLabel(b)).join(', ')}</div>
          </div>
          <div className="space-y-2">
            {METHODS.map((m) => (
              <button key={m.id} onClick={() => setMethod(m.id)} className={cls('w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 text-left transition', method === m.id ? 'border-brand-600 bg-brand-50/50' : 'border-ink-200')}>
                <m.icon className="text-brand-700" />
                <div className="flex-1"><div className="font-semibold text-sm">{m.label}</div><div className="text-xs text-ink-500">{m.sub}</div></div>
                <span className={cls('h-5 w-5 rounded-full border-2', method === m.id ? 'border-brand-600 bg-brand-600 ring-4 ring-inset ring-white' : 'border-ink-300')} />
              </button>
            ))}
          </div>
          <div className="mt-4">
            {method === 'upi' && (
              <>
                <div className="grid grid-cols-4 gap-2">{['Google Pay', 'PhonePe', 'Paytm', 'UPI ID'].map((a) => <button key={a} onClick={() => setUpiApp(a)} className={cls('h-11 rounded-xl text-xs font-semibold border', upiApp === a ? 'bg-brand-800 text-white border-brand-800' : 'border-ink-200')}>{a}</button>)}</div>
                {upiApp === 'UPI ID' && <Input className="mt-3" placeholder="yourname@okhdfcbank" value={upiId} onChange={(e) => setUpiId(e.target.value.trim())} />}
              </>
            )}
            {method === 'card' && (
              <>
                <Field label="Card number" hint="Test mode: any number works; ending in 0002 simulates a decline."><Input inputMode="numeric" placeholder="4111 1111 1111 1111" value={card.no} onChange={(e) => setCard({ ...card, no: fmtCard(e.target.value) })} /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Expiry"><Input placeholder="MM/YY" maxLength={5} value={card.exp} onChange={(e) => setCard({ ...card, exp: e.target.value.replace(/[^\d]/g, '').slice(0, 4).replace(/(\d{2})(\d)/, '$1/$2') })} /></Field>
                  <Field label="CVV"><Input type="password" inputMode="numeric" maxLength={4} value={card.cvv} onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '') })} /></Field>
                </div>
              </>
            )}
            {method === 'nb' && <select value={bank} onChange={(e) => setBank(e.target.value)} className="w-full h-12 rounded-xl border border-ink-200 px-3">{['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra Bank', 'Bank of Maharashtra'].map((b) => <option key={b}>{b}</option>)}</select>}
          </div>
          <Button variant="success" size="lg" block className="mt-5" icon={ShieldCheck} onClick={go}>{`Pay ${inr(amount)} securely`}</Button>
          <p className="text-[11px] text-center text-ink-400 mt-3">Test mode · simulated payment gateway · no real money is charged</p>
        </>
      )}
      {step === 'processing' && (
        <div className="py-14 text-center">
          <span className="inline-block h-14 w-14 rounded-full border-4 border-accent-500 border-r-transparent animate-spin" />
          <div className="font-bold mt-5">Processing payment…</div>
          <div className="text-sm text-ink-500 mt-1">{method === 'upi' ? `Approve the request in ${upiApp === 'UPI ID' ? 'your UPI app' : upiApp}` : 'Contacting your bank'}</div>
          <div className="text-xs text-ink-400 mt-4">Please do not close this screen</div>
        </div>
      )}
      {step === 'done' && result && (
        <div className="py-8 text-center">
          {result.ok ? (
            <>
              <div className="mx-auto h-20 w-20 rounded-full bg-accent-500 text-white grid place-items-center animate-pop shadow-[0_0_0_12px_rgba(34,197,94,.15)]"><CheckCircle2 size={44} /></div>
              <div className="text-xl font-extrabold mt-5">Payment successful</div>
              <div className="text-3xl font-extrabold mt-2">{inr(result.p.amount)}</div>
              <div className="text-xs text-ink-500 mt-1">Ref {result.p.ref} · {fmtDateTime(result.p.createdAt)}</div>
              <div className="flex gap-2 mt-6">
                <Button variant="outline" block onClick={onClose}>Done</Button>
                <Button block icon={Receipt} onClick={() => { onClose(); nav(`/payments/receipt/${result.p.id}`) }}>View receipt</Button>
              </div>
            </>
          ) : (
            <>
              <XCircle size={72} className="mx-auto text-red-500 animate-pop" />
              <div className="text-xl font-extrabold mt-4">Payment failed</div>
              <p className="text-sm text-ink-500 mt-2">{result.msg}</p>
              <Button block className="mt-6" onClick={() => setStep('method')}>Try again</Button>
            </>
          )}
        </div>
      )}
    </Sheet>
  )
}

export function receiptPdf(society, p) {
  const apt = db.get('apartments', p.apartmentId)
  const bills = p.billIds.map((id) => db.get('bills', id)).filter(Boolean)
  const payer = userById(p.userId)
  return makePdf((d) => {
    d.rect(0, 0, 595, 110, '#13254A')
    d.text(40, 48, society.name, { size: 22, bold: true, color: '#FFFFFF' })
    d.text(40, 70, society.address, { size: 9, color: '#B3C2E3' })
    d.text(40, 86, `Reg. No. ${society.regNo}`, { size: 9, color: '#B3C2E3' })
    d.text(40, 150, 'MAINTENANCE PAYMENT RECEIPT', { size: 13, bold: true, color: '#16A34A' })
    const rows = [['Receipt No.', p.receiptNo], ['Date', new Date(p.createdAt).toLocaleString('en-IN')], ['Apartment', `${apt.number} (${apt.type}, ${apt.area} sq.ft)`], ['Paid by', payer?.name || 'Recorded by office'], ['Payment method', p.method], ['Transaction ref.', p.ref]]
    rows.forEach(([k, v], i) => { d.text(40, 182 + i * 20, k, { size: 10, color: '#64748B' }); d.text(180, 182 + i * 20, v, { size: 10, bold: true }) })
    let y = 320
    d.rect(40, y - 16, 515, 26, '#F1F5F9')
    d.text(50, y, 'Description', { size: 10, bold: true }); d.text(545, y, 'Amount', { size: 10, bold: true, align: 'right' })
    y += 28
    bills.forEach((b) => {
      d.text(50, y, billLabel(b), { size: 10, bold: true }); y += 18
      b.items.forEach((i) => { d.text(62, y, i.label, { size: 9, color: '#334155' }); d.text(545, y, inr(i.amount), { size: 9, align: 'right' }); y += 16 })
      if (b.lateFee) { d.text(62, y, 'Late payment charge', { size: 9, color: '#DC2626' }); d.text(545, y, inr(b.lateFee), { size: 9, align: 'right' }); y += 16 }
      ;(b.adjustments || []).forEach((a) => { d.text(62, y, 'Adjustment: ' + a.label, { size: 9 }); d.text(545, y, inr(a.amount), { size: 9, align: 'right' }); y += 16 })
      y += 6
    })
    d.line(40, y, 555, y, '#CBD5E1')
    d.text(50, y + 24, 'Total paid', { size: 13, bold: true }); d.text(545, y + 24, inr(p.amount), { size: 13, bold: true, align: 'right' })
    d.text(40, y + 80, 'This is a computer-generated receipt and does not require a signature. Issued via Sociyo.', { size: 9, color: '#64748B' })
    d.text(40, y + 96, 'Thank you for your timely payment!', { size: 9, color: '#64748B' })
  })
}

function ReceiptPage() {
  const { id } = useParams()
  const { society } = useAuth()
  const toast = useToast()
  const p = useData((d) => d.get('payments', id))
  if (!p) return <Page title="Receipt" back><Empty title="Receipt not found" /></Page>
  const apt = db.get('apartments', p.apartmentId)
  const bills = p.billIds.map((x) => db.get('bills', x)).filter(Boolean)
  const download = () => { saveBlob(receiptPdf(society, p), `Receipt_${p.receiptNo.replace(/\//g, '-')}.pdf`); toast('Receipt downloaded') }
  const share = async () => {
    const file = new File([receiptPdf(society, p)], `Receipt_${apt.number}.pdf`, { type: 'application/pdf' })
    try { if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], title: 'Maintenance receipt' }) } catch { return }
    const r = await shareText({ title: 'Receipt', text: `${society.name} – Maintenance receipt ${p.receiptNo}: ${inr(p.amount)} paid on ${fmtDate(p.createdAt)} for ${apt.number}.` })
    if (r === 'copied') toast('Receipt details copied')
  }
  return (
    <Page title="Receipt" back>
      <Card className="mt-2 overflow-hidden">
        <div className="bg-brand-800 text-white p-5">
          <div className="text-lg font-extrabold">{society.name}</div>
          <div className="text-[11px] text-brand-200">{society.address}</div>
        </div>
        <div className="p-5">
          <div className="text-center">
            <CheckCircle2 size={40} className="mx-auto text-accent-500" />
            <div className="text-3xl font-extrabold mt-2">{inr(p.amount)}</div>
            <div className="text-xs text-ink-500">Paid on {fmtDateTime(p.createdAt)}</div>
          </div>
          <div className="mt-5 space-y-2 text-sm">
            {[['Receipt no.', p.receiptNo], ['Apartment', `${apt.number} · ${apt.type}`], ['Paid by', userById(p.userId)?.name || 'Recorded by office'], ['Method', p.method], ['Transaction ref.', p.ref]].map(([k, v]) => <div key={k} className="flex justify-between gap-4"><span className="text-ink-500">{k}</span><span className="font-semibold text-right">{v}</span></div>)}
          </div>
          <div className="border-t border-dashed border-ink-200 my-4" />
          {bills.map((b) => (
            <div key={b.id} className="mb-3 text-sm">
              <div className="font-bold mb-1">{billLabel(b)}</div>
              {b.items.map((i, k) => <Line key={k} l={i.label} v={inr(i.amount)} />)}
              {b.lateFee > 0 && <Line l="Late payment charge" v={inr(b.lateFee)} red />}
              {(b.adjustments || []).map((a, k) => <Line key={k} l={a.label} v={inr(a.amount)} />)}
            </div>
          ))}
          <div className="flex justify-between font-extrabold text-base border-t border-ink-200 pt-3"><span>Total</span><span>{inr(p.amount)}</span></div>
        </div>
      </Card>
      <div className="grid grid-cols-3 gap-2 mt-4 no-print">
        <Button variant="primary" icon={Download} onClick={download}>PDF</Button>
        <Button variant="outline" icon={Share2} onClick={share}>Share</Button>
        <Button variant="outline" icon={Printer} onClick={() => window.print()}>Print</Button>
      </div>
    </Page>
  )
}
