import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { StatusBadge } from '../../components/StatusBadge'
import { formatVND, formatDate } from '../../lib/formatters'
import { ORDER_STATUS_LABELS } from '../../lib/constants'

interface OrderDetail {
  id: string
  orderCode: string
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
  photos: { id: string; url: string; caption?: string }[]
  history: { id: string; changedBy: string; fieldChanged: string; oldValue: string; newValue: string; reason?: string; createdAt: string }[]
}

export default function AccountantOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [overrideField, setOverrideField] = useState('')
  const [overrideValue, setOverrideValue] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [accountantNote, setAccountantNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!id) return
    api.get(`/orders/${id}`).then(r => {
      setOrder(r.data)
      setAccountantNote(r.data.accountantNote ?? '')
    })
  }, [id])

  const handleOverride = async () => {
    if (!order || !overrideField || !overrideReason) return
    setSaving(true)
    try {
      await api.patch(`/orders/${order.id}/override`, { field: overrideField, value: overrideValue, reason: overrideReason })
      const res = await api.get(`/orders/${order.id}`)
      setOrder(res.data)
      setOverrideField(''); setOverrideValue(''); setOverrideReason('')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveNote = async () => {
    if (!order) return
    setSaving(true)
    try {
      await api.patch(`/orders/${order.id}/accountant-note`, { note: accountantNote })
    } finally {
      setSaving(false)
    }
  }

  if (!order) return <div className="flex items-center justify-center min-h-screen text-gray-400">Đang tải...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white sticky top-0 z-10 border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="min-h-[48px] min-w-[48px] flex items-center justify-center text-gray-600">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-bold text-gray-900">{order.orderCode}</h1>
      </div>

      <div className="px-4 pt-4 pb-8 space-y-4">
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <p className="text-xl font-bold text-gray-900">{order.customerName}</p>
            <StatusBadge status={order.status} />
          </div>
          <div className="space-y-2 text-base">
            <div className="flex justify-between"><span className="text-gray-500">Tổng tiền</span><span className="font-bold">{formatVND(order.amount)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Đã thu</span><span className="font-medium text-green-600">{formatVND(order.amountPaid)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Còn lại</span><span className="font-medium text-red-600">{formatVND(order.amountRemaining)}</span></div>
            {order.shipperName && <div className="flex justify-between"><span className="text-gray-500">Nhân viên</span><span>{order.shipperName}</span></div>}
            {order.deliveredAt && <div className="flex justify-between text-sm"><span className="text-gray-500">Đã giao lúc</span><span>{formatDate(order.deliveredAt)}</span></div>}
          </div>
        </div>

        {order.shipperNote && (
          <div className="bg-blue-50 rounded-2xl p-4">
            <p className="text-sm font-medium text-blue-800 mb-1">Ghi chú nhân viên</p>
            <p className="text-blue-700">{order.shipperNote}</p>
          </div>
        )}

        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="font-medium text-gray-900 mb-2">Ghi chú kế toán (ẩn với nhân viên)</p>
          <textarea
            value={accountantNote}
            onChange={(e) => setAccountantNote(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Ghi chú nội bộ..."
          />
          <button onClick={handleSaveNote} disabled={saving} className="mt-2 bg-gray-800 text-white px-4 py-2.5 rounded-xl text-sm font-medium min-h-[48px] disabled:opacity-60">
            Lưu ghi chú
          </button>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="font-medium text-gray-900 mb-3">Ghi đè dữ liệu</p>
          <div className="space-y-2">
            <select value={overrideField} onChange={(e) => setOverrideField(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Chọn trường cần sửa</option>
              <option value="Status">Trạng thái</option>
              <option value="AmountPaid">Số tiền đã thu</option>
              <option value="ShipperNote">Ghi chú nhân viên</option>
            </select>
            {overrideField === 'Status' && (
              <select value={overrideValue} onChange={(e) => setOverrideValue(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Chọn trạng thái</option>
                {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            )}
            {overrideField !== 'Status' && overrideField && (
              <input type="text" value={overrideValue} onChange={(e) => setOverrideValue(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Giá trị mới" />
            )}
            <input type="text" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="* Lý do bắt buộc" required />
            <button onClick={handleOverride} disabled={saving || !overrideField || !overrideReason} className="w-full bg-orange-600 text-white py-3 rounded-xl font-medium min-h-[48px] disabled:opacity-60">
              {saving ? 'Đang lưu...' : 'Áp dụng thay đổi'}
            </button>
          </div>
        </div>

        {order.photos.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="font-medium text-gray-900 mb-3">Ảnh chứng từ</p>
            <div className="grid grid-cols-3 gap-2">
              {order.photos.map(p => (
                <img key={p.id} src={p.url} alt={p.caption ?? ''} className="w-full aspect-square object-cover rounded-xl" />
              ))}
            </div>
          </div>
        )}

        {order.history.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="font-medium text-gray-900 mb-3">Lịch sử thay đổi</p>
            <div className="space-y-3">
              {order.history.map(h => (
                <div key={h.id} className="border-l-4 border-blue-200 pl-3 py-1">
                  <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                    <span>{h.changedBy}</span>
                    <span>{formatDate(h.createdAt)}</span>
                  </div>
                  <p className="text-sm text-gray-700">{h.fieldChanged}: <span className="line-through text-red-400">{h.oldValue}</span> → <span className="text-green-600">{h.newValue}</span></p>
                  {h.reason && <p className="text-xs text-gray-500 mt-0.5">Lý do: {h.reason}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
