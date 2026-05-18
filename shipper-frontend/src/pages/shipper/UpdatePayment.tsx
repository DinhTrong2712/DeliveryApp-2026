import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../lib/api'

const STATUS_OPTIONS = [
  { value: 'PaidCash', label: 'Thu tiền mặt', needAmount: true },
  { value: 'WaitingTransfer', label: 'Chờ chuyển khoản', needAmount: false },
  { value: 'Partial', label: 'Thu một phần', needAmount: true },
  { value: 'Scheduled', label: 'Hẹn lại', needDate: true },
  { value: 'Unpaid', label: 'Chưa thu được', needReason: true },
]

export default function UpdatePayment() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [status, setStatus] = useState('')
  const [amountPaid, setAmountPaid] = useState('')
  const [unpaidReason, setUnpaidReason] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const selected = STATUS_OPTIONS.find(s => s.value === status)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!status) { setError('Vui lòng chọn trạng thái'); return }
    setLoading(true)
    setError('')
    try {
      await api.patch(`/orders/${id}/status`, {
        status,
        amountPaid: selected?.needAmount ? parseFloat(amountPaid) : undefined,
        unpaidReason: selected?.needReason ? unpaidReason : undefined,
        scheduledDate: selected?.needDate ? scheduledDate : undefined,
        note: note || undefined,
      })
      navigate(`/shipper/orders/${id}`)
    } catch {
      setError('Cập nhật thất bại. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white sticky top-0 z-10 border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="min-h-[48px] min-w-[48px] flex items-center justify-center text-gray-600">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-bold text-gray-900">Cập nhật thanh toán</h1>
      </div>

      <form onSubmit={handleSubmit} className="px-4 pt-4 pb-32 space-y-4">
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="font-medium text-gray-900 mb-3">Trạng thái thanh toán</p>
          <div className="space-y-2">
            {STATUS_OPTIONS.map(opt => (
              <label key={opt.value} className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer min-h-[48px]" style={{ borderColor: status === opt.value ? '#2563eb' : '#e5e7eb', background: status === opt.value ? '#eff6ff' : 'white' }}>
                <input type="radio" name="status" value={opt.value} checked={status === opt.value} onChange={() => setStatus(opt.value)} className="w-5 h-5" />
                <span className="font-medium text-gray-800">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {selected?.needAmount && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <label className="block font-medium text-gray-900 mb-2">Số tiền đã thu (VNĐ)</label>
            <input
              type="number"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
              required
              min={0}
            />
          </div>
        )}

        {selected?.needReason && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <label className="block font-medium text-gray-900 mb-2">Lý do chưa thu</label>
            <textarea
              value={unpaidReason}
              onChange={(e) => setUnpaidReason(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              required
              placeholder="Nhập lý do..."
            />
          </div>
        )}

        {selected?.needDate && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <label className="block font-medium text-gray-900 mb-2">Ngày hẹn</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
        )}

        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <label className="block font-medium text-gray-900 mb-2">Ghi chú (tùy chọn)</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
            placeholder="Thêm ghi chú..."
            maxLength={1000}
          />
        </div>

        {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4">
          <button
            type="submit"
            disabled={loading || !status}
            className="w-full bg-blue-600 text-white font-semibold py-4 rounded-2xl text-base min-h-[48px] disabled:opacity-60"
          >
            {loading ? 'Đang lưu...' : 'Lưu trạng thái'}
          </button>
        </div>
      </form>
    </div>
  )
}
