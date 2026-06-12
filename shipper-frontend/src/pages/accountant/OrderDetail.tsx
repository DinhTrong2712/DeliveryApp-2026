import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { StatusBadge } from '../../components/StatusBadge'
import { formatVND, formatDate } from '../../lib/formatters'
import { ORDER_STATUS_LABELS } from '../../lib/constants'
import AccountantLayout from '../../components/AccountantLayout'

interface OrderTxn {
  id: string
  transactionCode: string
  amount: number
  gateway?: string
  referenceCode?: string
  content?: string
  transactionDate: string
  matchStatus: string
  matchedBy?: string
  matchedAt?: string
}

interface OrderDetail {
  id: string
  orderCode: string
  routeCode?: string
  customerName: string
  amount: number
  amountPaid: number
  amountRemaining: number
  status: string
  unpaidReason?: string
  scheduledDate?: string
  deliveredAt?: string
  shipperNote?: string
  accountantNote?: string
  shipperName?: string
  originNote?: string
  createdAt: string
  updatedAt: string
  photos: { id: string; url: string; caption?: string }[]
  history: { id: string; changedBy: string; fieldChanged: string; oldValue: string; newValue: string; reason?: string; createdAt: string }[]
  transactions: OrderTxn[]
}

interface QrInfo {
  qrUrl: string
  bank: string
  accountNo: string
  accountName: string
  amount: number
  orderCode: string
}

// Khoản thu đã đối soát = các giao dịch chuyển khoản đã khớp với đơn này.
const isMatched = (t: OrderTxn) => t.matchStatus !== 'Unmatched'
const isAuto = (t: OrderTxn) => !!t.matchedBy && /auto|sepay|hệ thống|he thong/i.test(t.matchedBy)

export default function AccountantOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [order, setOrder] = useState<OrderDetail | null>(null)

  // Sửa ghi chú kế toán
  const [editingNote, setEditingNote] = useState(false)
  const [accountantNote, setAccountantNote] = useState('')

  // Cập nhật thanh toán (ghi đè)
  const [action, setAction] = useState('')
  const [overrideValue, setOverrideValue] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [saving, setSaving] = useState(false)

  // QR
  const [qr, setQr] = useState<QrInfo | null>(null)
  const [showQr, setShowQr] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    const r = await api.get(`/orders/${id}`)
    setOrder(r.data)
    setAccountantNote(r.data.accountantNote ?? '')
  }, [id])

  useEffect(() => { load() }, [load])

  const openQr = async () => {
    setShowQr(true)
    if (qr || !id) return
    try {
      const res = await api.get(`/orders/${id}/qr`)
      setQr(res.data)
    } catch { /* chưa cấu hình ngân hàng */ }
  }

  const handleSaveNote = async () => {
    if (!order) return
    setSaving(true)
    try {
      await api.patch(`/orders/${order.id}/accountant-note`, { note: accountantNote })
      setEditingNote(false)
      await load()
    } finally { setSaving(false) }
  }

  const handleApply = async () => {
    if (!order || !action || !overrideReason.trim()) return
    setSaving(true)
    try {
      await api.patch(`/orders/${order.id}/override`, { field: action, value: overrideValue, reason: overrideReason })
      setAction(''); setOverrideValue(''); setOverrideReason('')
      await load()
    } finally { setSaving(false) }
  }

  if (!order) {
    return (
      <AccountantLayout>
        <div className="flex items-center justify-center py-32 text-gray-400 dark:text-gray-500">Đang tải...</div>
      </AccountantLayout>
    )
  }

  const fullyPaid = order.amountRemaining <= 0
  const matchedTxns = order.transactions.filter(isMatched)

  return (
    <AccountantLayout>
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-start gap-3 min-w-0">
          <button
            onClick={() => navigate(-1)}
            className="mt-0.5 flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
            aria-label="Quay lại"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-mono text-xl font-bold text-gray-900 dark:text-gray-100 break-all">{order.orderCode}</h1>
              {fullyPaid
                ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />Đã thu đủ</span>
                : <StatusBadge status={order.status} />}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Nhập lúc {formatDate(order.createdAt)} · Cập nhật {formatDate(order.updatedAt)}
            </p>
          </div>
        </div>
        <button
          onClick={openQr}
          className="flex-shrink-0 inline-flex items-center gap-2 px-3.5 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h6v6H4V4zM14 4h6v6h-6V4zM4 14h6v6H4v-6zM14 14h2v2h-2v-2zM18 14h2v2h-2v-2zM16 16h2v2h-2v-2zM18 18h2v2h-2v-2zM14 18h2v2h-2v-2z" />
          </svg>
          QR
        </button>
      </div>

      {/* ── Two-column body ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
        {/* LEFT (3/5) */}
        <div className="lg:col-span-3 space-y-5">
          {/* Thông tin đơn hàng */}
          <Card title="Thông tin đơn hàng">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
              <Field label="Khách hàng" value={order.customerName} strong />
              <Field label="Nhân viên giao" value={order.shipperName ?? 'Chưa phân công'} muted={!order.shipperName} />
              <Field label="Mã tuyến" value={order.routeCode ?? '—'} mono />
              <Field label="Thời gian giao" value={order.deliveredAt ? formatDate(order.deliveredAt) : 'Chưa giao'} muted={!order.deliveredAt} />
              <div className="sm:col-span-2">
                <Field label="Diễn giải gốc" value={order.originNote ?? '—'} muted={!order.originNote} />
              </div>
            </div>
          </Card>

          {/* Ghi chú */}
          <Card
            title="Ghi chú"
            action={!editingNote && (
              <button onClick={() => setEditingNote(true)} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                Sửa
              </button>
            )}
          >
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Ghi chú nhân viên</p>
                <p className={order.shipperNote ? 'text-gray-800 dark:text-gray-200' : 'italic text-gray-400 dark:text-gray-500'}>
                  {order.shipperNote || 'Chưa có ghi chú'}
                </p>
              </div>
              <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Ghi chú kế toán <span className="text-gray-300 dark:text-gray-600">(ẩn với nhân viên)</span></p>
                {editingNote ? (
                  <div className="space-y-2">
                    <textarea
                      value={accountantNote}
                      onChange={e => setAccountantNote(e.target.value)}
                      rows={3}
                      autoFocus
                      className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ghi chú nội bộ..."
                    />
                    <div className="flex gap-2">
                      <button onClick={handleSaveNote} disabled={saving} className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60">
                        {saving ? 'Đang lưu...' : 'Lưu'}
                      </button>
                      <button onClick={() => { setEditingNote(false); setAccountantNote(order.accountantNote ?? '') }} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
                        Huỷ
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className={order.accountantNote ? 'text-gray-800 dark:text-gray-200' : 'italic text-gray-400 dark:text-gray-500'}>
                    {order.accountantNote || 'Chưa có ghi chú'}
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* Lịch sử */}
          {order.history.length > 0 && (
            <Card title={`Lịch sử (${order.history.length})`}>
              <ol className="space-y-4">
                {order.history.map(h => (
                  <li key={h.id} className="relative pl-5">
                    <span className="absolute left-0 top-1.5 w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                    <div className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">
                      {formatDate(h.createdAt)} · {h.changedBy || 'Hệ thống'}
                    </div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{h.fieldChanged}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      <span className="line-through text-gray-400 dark:text-gray-500">{h.oldValue || '—'}</span>
                      <span className="mx-1.5">→</span>
                      <span className="text-gray-700 dark:text-gray-300 font-medium">{h.newValue || '—'}</span>
                    </p>
                    {h.reason && <p className="text-xs italic text-gray-400 dark:text-gray-500 mt-0.5">"{h.reason}"</p>}
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>

        {/* RIGHT (2/5) */}
        <div className="lg:col-span-2 space-y-5">
          {/* Thanh toán */}
          <Card title="Thanh toán">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Cần thu" value={formatVND(order.amount)} />
              <Stat label="Đã thu" value={formatVND(order.amountPaid)} tone="green" />
              <Stat label="Còn lại" value={formatVND(order.amountRemaining)} tone={order.amountRemaining > 0 ? 'red' : 'muted'} />
            </div>
          </Card>

          {/* Cập nhật thanh toán */}
          <Card title="Cập nhật thanh toán">
            <div className="space-y-2.5">
              <select
                value={action}
                onChange={e => { setAction(e.target.value); setOverrideValue('') }}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Chọn hành động...</option>
                <option value="Status">Đổi trạng thái</option>
                <option value="AmountPaid">Sửa số tiền đã thu</option>
              </select>

              {action === 'Status' && (
                <select value={overrideValue} onChange={e => setOverrideValue(e.target.value)} className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Chọn trạng thái</option>
                  {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              )}
              {action === 'AmountPaid' && (
                <input type="number" value={overrideValue} onChange={e => setOverrideValue(e.target.value)} className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Số tiền đã thu" />
              )}
              {action && (
                <>
                  <input type="text" value={overrideReason} onChange={e => setOverrideReason(e.target.value)} className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="* Lý do (bắt buộc)" />
                  <button onClick={handleApply} disabled={saving || !overrideReason.trim() || !overrideValue} className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors">
                    {saving ? 'Đang lưu...' : 'Áp dụng thay đổi'}
                  </button>
                </>
              )}
            </div>
          </Card>

          {/* Khoản thu */}
          <Card title={`Khoản thu (${matchedTxns.length})`}>
            {matchedTxns.length === 0 ? (
              <p className="text-sm italic text-gray-400 dark:text-gray-500">Chưa có khoản thu nào</p>
            ) : (
              <div className="space-y-3">
                {matchedTxns.map(t => (
                  <div key={t.id} className="flex items-start gap-3">
                    <span className="mt-0.5 w-8 h-8 flex-shrink-0 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatVND(t.amount)} <span className="font-normal text-gray-500 dark:text-gray-400">Chuyển khoản</span></p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 truncate">{t.gateway ?? 'Ngân hàng'} · {t.referenceCode ?? t.transactionCode}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(t.transactionDate)}</p>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center border-t border-gray-100 dark:border-gray-800 pt-3 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Tổng đã thu</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatVND(matchedTxns.reduce((s, t) => s + t.amount, 0))}</span>
                </div>
              </div>
            )}
          </Card>

          {/* Giao dịch ngân hàng */}
          {order.transactions.length > 0 && (
            <Card title={`Giao dịch ngân hàng (${order.transactions.length})`}>
              <div className="space-y-3">
                {order.transactions.map(t => (
                  <div key={t.id} className="flex items-start justify-between gap-3 border-b border-gray-100 dark:border-gray-800 last:border-0 pb-3 last:pb-0">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">{t.referenceCode ?? t.transactionCode}</p>
                      {t.content && <p className="text-xs text-gray-500 dark:text-gray-500 truncate">{t.content}</p>}
                      <p className="text-xs text-gray-400 dark:text-gray-500">{t.gateway ?? 'Ngân hàng'} · {formatDate(t.transactionDate)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatVND(t.amount)}</p>
                      {isMatched(t) && (
                        <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${isAuto(t) ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400'}`}>
                          {isAuto(t) ? 'Tự động' : 'Thủ công'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex justify-between items-center border-t border-gray-100 dark:border-gray-800 pt-3 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Tổng chuyển khoản</span>
                  <span className="font-bold text-gray-900 dark:text-gray-100">{formatVND(order.transactions.reduce((s, t) => s + t.amount, 0))}</span>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* ── QR modal ── */}
      {showQr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowQr(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 max-w-xs w-full text-center" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 dark:text-gray-100">Mã QR chuyển khoản</h3>
              <button onClick={() => setShowQr(false)} className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {qr ? (
              <>
                <img src={qr.qrUrl} alt="VietQR" className="w-full rounded-xl border border-gray-100 dark:border-gray-800" />
                <p className="mt-3 font-semibold text-gray-800 dark:text-gray-200">{qr.accountName}</p>
                <p className="text-sm text-gray-500 dark:text-gray-500">{qr.accountNo} · {qr.bank}</p>
                <p className="text-sm font-bold text-blue-600 mt-1">{formatVND(qr.amount)}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Nội dung: <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{qr.orderCode}</span></p>
              </>
            ) : (
              <p className="py-8 text-sm text-gray-400 dark:text-gray-500">Chưa cấu hình tài khoản ngân hàng hoặc đang tải...</p>
            )}
          </div>
        </div>
      )}
    </AccountantLayout>
  )
}

/* ───────── small presentational helpers ───────── */

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-gray-900 dark:text-gray-100">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Field({ label, value, strong, mono, muted }: { label: string; value: string; strong?: boolean; mono?: boolean; muted?: boolean }) {
  return (
    <div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{label}</p>
      <p className={[
        muted ? 'text-gray-400 dark:text-gray-500 italic' : strong ? 'text-gray-900 dark:text-gray-100 font-semibold' : 'text-gray-800 dark:text-gray-200',
        mono ? 'font-mono text-sm' : '',
      ].join(' ')}>{value}</p>
    </div>
  )
}

function Stat({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'green' | 'red' | 'muted' }) {
  const valueColor = {
    default: 'text-gray-900 dark:text-gray-100',
    green: 'text-emerald-600 dark:text-emerald-400',
    red: 'text-red-600 dark:text-red-400',
    muted: 'text-gray-400 dark:text-gray-500',
  }[tone]
  const bg = tone === 'green' ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-gray-50 dark:bg-gray-950'
  return (
    <div className={`rounded-xl ${bg} px-3 py-3 text-center`}>
      <p className="text-[11px] text-gray-500 dark:text-gray-500 mb-1">{label}</p>
      <p className={`text-sm font-bold leading-tight ${valueColor}`}>{value}</p>
    </div>
  )
}
