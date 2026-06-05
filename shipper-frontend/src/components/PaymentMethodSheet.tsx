import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { formatVND } from '../lib/formatters'

interface OrderLite {
  id: string
  orderCode: string
  customerName: string
  amount: number
  amountPaid: number
  amountRemaining: number
  status: string
}

interface Props {
  order: OrderLite | null
  onClose: () => void
  onSaved: () => void
}

type Method = 'cash' | 'transfer' | 'partial' | 'undelivered' | 'debt'

const METHODS: { value: Method; label: string; desc: string; icon: string; color: string }[] = [
  { value: 'cash',        label: 'Tiền mặt',                desc: 'Khách đã trả đủ bằng tiền mặt',         icon: '💵', color: 'green' },
  { value: 'transfer',    label: 'Chuyển khoản',            desc: 'Khách chuyển khoản qua ngân hàng',      icon: '🏦', color: 'blue' },
  { value: 'partial',     label: 'Chuyển khoản một phần',   desc: 'Khách trả trước một phần',              icon: '➗', color: 'orange' },
  { value: 'undelivered', label: 'Không giao được',         desc: 'Không thể giao đơn (cần lý do)',        icon: '⛔', color: 'red' },
  { value: 'debt',        label: 'Nợ',                       desc: 'Đã giao nhưng khách còn nợ (cần lý do)', icon: '📝', color: 'amber' },
]

const COLOR_RING: Record<string, string> = {
  green:  'border-green-500 bg-green-50',
  blue:   'border-blue-500 bg-blue-50',
  orange: 'border-orange-500 bg-orange-50',
  red:    'border-red-500 bg-red-50',
  amber:  'border-amber-500 bg-amber-50',
}

interface QrInfo {
  qrUrl: string
  bank: string
  accountNo: string
  accountName: string
  amount: number
  addInfo: string
}

export default function PaymentMethodSheet({ order, onClose, onSaved }: Props) {
  const [method, setMethod] = useState<Method | ''>('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [note, setNote] = useState('')
  const [qrAddInfo, setQrAddInfo] = useState('')
  const [qrAccount, setQrAccount] = useState<1 | 2>(1)
  const [qr, setQr] = useState<QrInfo | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrError, setQrError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<string>('')
  const navigate = useNavigate()

  useEffect(() => {
    if (order) {
      setMethod('')
      setAmount(String(order.amountRemaining || order.amount))
      setReason('')
      setEventDate('')
      setNote('')
      setQrAddInfo(order.orderCode)
      setQrAccount(1)
      setQr(null)
      setQrError('')
      setError('')
      setSuccess('')
    }
  }, [order])

  const isTransfer = method === 'transfer' || method === 'partial'

  useEffect(() => {
    if (method === 'undelivered') {
      setEventDate(new Date().toISOString().split('T')[0])
    } else if (method === 'debt') {
      const d = new Date()
      d.setDate(d.getDate() + 7)
      setEventDate(d.toISOString().split('T')[0])
    } else {
      setEventDate('')
    }
  }, [method])

  useEffect(() => {
    if (!order || !isTransfer) { setQr(null); return }
    const n = parseFloat(amount)
    if (!Number.isFinite(n) || n <= 0) { setQr(null); return }
    const timer = setTimeout(async () => {
      setQrLoading(true)
      setQrError('')
      try {
        const res = await api.get(`/orders/${order.id}/qr`, {
          params: { account: qrAccount, amount: n, addInfo: qrAddInfo || order.orderCode },
        })
        setQr(res.data)
      } catch (e: unknown) {
        const err = e as { response?: { data?: { message?: string } } }
        setQr(null)
        setQrError(err?.response?.data?.message ?? 'Không tạo được QR. Kiểm tra cấu hình VietQR.')
      } finally {
        setQrLoading(false)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [order, isTransfer, amount, qrAddInfo, qrAccount])

  if (!order) return null

  const needAmount = method === 'cash' || method === 'partial'
  const needReason = method === 'undelivered' || method === 'debt'

  const handleSubmit = async () => {
    if (!method) { setError('Vui lòng chọn phương thức thanh toán'); return }
    if (needAmount) {
      const n = parseFloat(amount)
      if (!Number.isFinite(n) || n <= 0) { setError('Vui lòng nhập số tiền hợp lệ'); return }
      if (method === 'partial' && n >= order.amount) { setError('Số tiền một phần phải nhỏ hơn tổng đơn'); return }
    }
    if (needReason && !reason.trim()) { setError('Vui lòng nhập lý do'); return }
    if (needReason && !eventDate) {
      setError(method === 'debt' ? 'Vui lòng chọn hạn nợ' : 'Vui lòng chọn ngày không giao được')
      return
    }

    setLoading(true)
    setError('')
    try {
      const markDelivered = method !== 'undelivered'
      if (markDelivered) {
        await api.patch(`/orders/${order.id}/delivered`).catch(() => {})
      }

      let status = ''
      let amountPaid: number | undefined
      let unpaidReason: string | undefined

      if (method === 'cash')        { status = 'PaidCash';        amountPaid = parseFloat(amount) }
      else if (method === 'transfer')   { status = 'WaitingTransfer' }
      else if (method === 'partial')    { status = 'Partial';     amountPaid = parseFloat(amount) }
      else if (method === 'undelivered'){ status = 'Unpaid';      unpaidReason = `[Không giao được] ${reason.trim()}` }
      else if (method === 'debt')       { status = 'Unpaid';      unpaidReason = `[Nợ] ${reason.trim()}` }

      await api.patch(`/orders/${order.id}/status`, {
        status,
        amountPaid,
        unpaidReason,
        scheduledDate: needReason && eventDate ? eventDate : undefined,
        note: note.trim() || undefined,
      })

      const dateLbl = eventDate ? new Date(eventDate).toLocaleDateString('vi-VN') : ''
      const successMsg =
        method === 'cash'        ? `Đã ghi nhận thu tiền mặt ${formatVND(parseFloat(amount))}` :
        method === 'transfer'    ? 'Đã chuyển sang chờ chuyển khoản' :
        method === 'partial'     ? `Đã ghi nhận thu một phần ${formatVND(parseFloat(amount))}` :
        method === 'undelivered' ? `Không giao được ngày ${dateLbl}` :
        method === 'debt'        ? `Ghi nợ — hạn trả ${dateLbl}` :
        'Cập nhật thành công'
      setSuccess(successMsg)
      setLoading(false)
      onSaved()
      setTimeout(() => {
        onClose()
      }, 1300)
    } catch {
      setError('Cập nhật thất bại. Vui lòng thử lại.')
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div className="absolute inset-0 bg-black/40" />
        <div className="relative w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl p-8 flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <svg className="w-12 h-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">Cập nhật thành công</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{success}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Đơn {order.orderCode} · {order.customerName}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={loading ? undefined : onClose}
      />

      <div className="relative w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-5 pt-4 pb-3 flex items-center justify-between rounded-t-3xl">
          <div className="min-w-0">
            <p className="text-xs text-gray-400 dark:text-gray-500">Đơn {order.orderCode}</p>
            <p className="font-bold text-gray-900 dark:text-gray-100 truncate">{order.customerName}</p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="bg-gray-50 dark:bg-gray-950 rounded-2xl p-4 flex justify-between items-center">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-500">Cần thu</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{formatVND(order.amountRemaining)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 dark:text-gray-500">Tổng đơn</p>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{formatVND(order.amount)}</p>
            </div>
          </div>

          <div>
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-2">Phương thức thanh toán</p>
            <div className="space-y-2">
              {METHODS.map(m => {
                const selected = method === m.value
                return (
                  <button
                    key={m.value}
                    onClick={() => setMethod(m.value)}
                    type="button"
                    className={`w-full text-left flex items-center gap-3 p-3 rounded-2xl border-2 transition-all min-h-[60px] ${
                      selected
                        ? COLOR_RING[m.color]
                        : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <span className="text-2xl">{m.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm ${selected ? 'text-gray-900 dark:text-gray-100' : 'text-gray-800 dark:text-gray-200'}`}>{m.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 truncate">{m.desc}</p>
                    </div>
                    {selected && (
                      <svg className="w-5 h-5 text-gray-700 dark:text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {(needAmount || isTransfer) && (
            <div>
              <label className="block font-semibold text-gray-900 dark:text-gray-100 text-sm mb-2">
                {method === 'transfer' ? 'Số tiền chuyển khoản (VNĐ)' : 'Số tiền đã thu (VNĐ)'}
              </label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0"
                min={0}
              />
            </div>
          )}

          {isTransfer && (
            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-gray-900 dark:text-gray-100 text-sm mb-2">
                  Nội dung chuyển khoản
                </label>
                <input
                  type="text"
                  value={qrAddInfo}
                  onChange={e => setQrAddInfo(e.target.value)}
                  maxLength={50}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  placeholder={order.orderCode}
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  SePay tự khớp khi nội dung chứa <span className="font-mono font-semibold text-gray-600 dark:text-gray-400">{order.orderCode}</span>
                </p>
              </div>

              <div>
                <label className="block font-semibold text-gray-900 dark:text-gray-100 text-sm mb-2">Tài khoản nhận</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setQrAccount(1)}
                    className={`py-2.5 rounded-xl border-2 text-sm font-medium transition-colors ${
                      qrAccount === 1 ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Tài khoản 1
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrAccount(2)}
                    className={`py-2.5 rounded-xl border-2 text-sm font-medium transition-colors ${
                      qrAccount === 2 ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Tài khoản 2
                  </button>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-900 border-2 border-blue-100 rounded-2xl p-4">
                <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-3 flex items-center gap-2">
                  <span>📲</span> Mã QR cho khách quét
                </p>
                {qrLoading && (
                  <div className="h-56 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
                    Đang tạo QR...
                  </div>
                )}
                {!qrLoading && qrError && (
                  <div className="h-56 flex items-center justify-center text-red-500 text-sm text-center px-4">
                    {qrError}
                  </div>
                )}
                {!qrLoading && !qrError && qr && (
                  <div className="flex flex-col items-center gap-3">
                    <img
                      src={qr.qrUrl}
                      alt="VietQR"
                      className="w-56 h-56 rounded-xl border border-gray-100 dark:border-gray-800"
                    />
                    <div className="text-center space-y-0.5">
                      <p className="font-semibold text-gray-800 dark:text-gray-200">{qr.accountName}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-500">{qr.accountNo} · {qr.bank}</p>
                      <p className="text-lg font-bold text-blue-600">{formatVND(qr.amount)}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        Nội dung: <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{qr.addInfo}</span>
                      </p>
                    </div>
                  </div>
                )}
                {!qrLoading && !qrError && !qr && (
                  <div className="h-32 flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs text-center px-4">
                    Nhập số tiền để tạo QR
                  </div>
                )}
              </div>
            </div>
          )}

          {needReason && (
            <div className="space-y-3">
              <div>
                <label className="block font-semibold text-gray-900 dark:text-gray-100 text-sm mb-2">
                  {method === 'debt' ? 'Hạn trả nợ' : 'Ngày không giao được'} <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={e => setEventDate(e.target.value)}
                  min={method === 'debt' ? new Date().toISOString().split('T')[0] : undefined}
                  max={method === 'undelivered' ? new Date().toISOString().split('T')[0] : undefined}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {method === 'debt'
                    ? 'Ngày khách hẹn sẽ trả nốt khoản còn lại'
                    : 'Ngày shipper không giao được đơn'}
                </p>
              </div>

              <div>
                <label className="block font-semibold text-gray-900 dark:text-gray-100 text-sm mb-2">
                  Lý do <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={3}
                  maxLength={400}
                  className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={method === 'undelivered' ? 'Vd: Khách không có nhà, không liên lạc được...' : 'Vd: Khách hẹn trả vào cuối tháng, đã đồng ý...'}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block font-semibold text-gray-900 dark:text-gray-100 text-sm mb-2">
              Ghi chú thêm (tùy chọn)
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              maxLength={500}
              className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Thêm ghi chú..."
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 px-5 py-3 space-y-2">
          <button
            onClick={handleSubmit}
            disabled={loading || !method}
            className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-2xl text-base min-h-[48px] disabled:opacity-60"
          >
            {loading ? 'Đang lưu...' : 'Xác nhận'}
          </button>
          <button
            onClick={() => { onClose(); navigate(`/shipper/orders/${order.id}`) }}
            disabled={loading}
            className="w-full text-gray-600 dark:text-gray-400 font-medium py-2.5 rounded-2xl text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Xem chi tiết đơn →
          </button>
        </div>
      </div>
    </div>
  )
}
