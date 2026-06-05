import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { StatusBadge } from '../../components/StatusBadge'
import { formatVND, formatDate } from '../../lib/formatters'

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
  lockedAt?: string
  photos: { id: string; url: string; caption?: string }[]
}

interface QrInfo {
  qrUrl: string
  bank: string
  accountNo: string
  accountName: string
  amount: number
  orderCode: string
}

export default function ShipperOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [qr, setQr] = useState<QrInfo | null>(null)

  useEffect(() => {
    if (!id) return
    api.get(`/orders/${id}`).then(r => {
      setOrder(r.data)
      if (r.data.status === 'WaitingTransfer') {
        api.get(`/orders/${id}/qr`).then(q => setQr(q.data)).catch(() => {})
      }
    }).finally(() => setLoading(false))
  }, [id])

  const handleDelivered = async () => {
    if (!order) return
    await api.patch(`/orders/${order.id}/delivered`)
    navigate(`/shipper/orders/${order.id}/payment`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-500 dark:text-gray-500">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="skeleton h-5 w-32" />
        </div>
        <div className="px-4 pt-4 space-y-3">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm">
            <div className="skeleton h-5 w-48 mb-3" />
            <div className="skeleton h-4 w-32 mb-4" />
            <div className="skeleton h-4 w-full mb-2" />
            <div className="skeleton h-4 w-3/4" />
          </div>
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-gray-400 dark:text-gray-500 gap-3">
        <svg className="w-10 h-10 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm font-medium text-red-500">Không tìm thấy đơn hàng</p>
        <button onClick={() => navigate(-1)} className="text-blue-600 text-sm">Quay lại</button>
      </div>
    )
  }

  const isLocked = !!order.lockedAt
  const isDelivered = !!order.deliveredAt
  const isPaid = ['PaidCash', 'PaidTransfer'].includes(order.status)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 sticky top-0 z-10 border-b border-gray-100 dark:border-gray-800 shadow-sm px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 -ml-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-gray-900 dark:text-gray-100 text-base truncate">{order.orderCode}</h1>
          {order.routeCode && <p className="text-xs text-gray-400 dark:text-gray-500">Tuyến {order.routeCode}</p>}
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="px-4 pt-4 pb-36 space-y-3">
        {/* Customer & amounts card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm overflow-hidden">
          {/* Customer name */}
          <div className="px-5 pt-5 pb-4 border-b border-gray-50 dark:border-gray-800">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Khách hàng</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{order.customerName}</p>
          </div>

          {/* Amounts */}
          <div className="px-5 py-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-500 dark:text-gray-500 text-sm">Tổng tiền đơn</span>
              <span className="font-bold text-gray-900 dark:text-gray-100 text-lg">{formatVND(order.amount)}</span>
            </div>
            {order.amountPaid > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500 dark:text-gray-500 text-sm">Đã thu được</span>
                <span className="font-semibold text-green-600">{formatVND(order.amountPaid)}</span>
              </div>
            )}
            {order.amountRemaining > 0 && (
              <>
                <div className="border-t border-dashed border-gray-100 dark:border-gray-800" />
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">Còn phải thu</span>
                  <span className="font-bold text-red-600 text-lg">{formatVND(order.amountRemaining)}</span>
                </div>
              </>
            )}
            {order.deliveredAt && (
              <div className="flex justify-between items-center text-sm pt-1 border-t border-gray-50 dark:border-gray-800">
                <span className="text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Giao lúc
                </span>
                <span className="text-gray-600 dark:text-gray-400">{formatDate(order.deliveredAt)}</span>
              </div>
            )}
          </div>
        </div>

        {/* QR chuyển khoản */}
        {order.status === 'WaitingTransfer' && qr && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-4">
            <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Mã QR chuyển khoản</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">Khách quét mã để chuyển khoản tự động</p>
            <div className="flex flex-col items-center gap-3">
              <img
                src={qr.qrUrl}
                alt="VietQR"
                className="w-56 h-56 rounded-xl border border-gray-100 dark:border-gray-800"
              />
              <div className="text-center space-y-0.5">
                <p className="font-semibold text-gray-800 dark:text-gray-200">{qr.accountName}</p>
                <p className="text-sm text-gray-500 dark:text-gray-500">{qr.accountNo} · {qr.bank}</p>
                <p className="text-sm font-bold text-blue-600">{formatVND(qr.amount)}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">Nội dung: <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{qr.orderCode}</span></p>
              </div>
            </div>
          </div>
        )}

        {/* Note */}
        {order.shipperNote && (
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3">
            <svg className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <div>
              <p className="text-xs font-semibold text-blue-700 mb-0.5">Ghi chú</p>
              <p className="text-sm text-blue-700">{order.shipperNote}</p>
            </div>
          </div>
        )}

        {/* Locked notice */}
        {isLocked && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
            <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-0.5">Đơn đã khoá</p>
              <p className="text-sm text-amber-600">Đơn hàng này đã được kế toán khoá, không thể chỉnh sửa.</p>
            </div>
          </div>
        )}

        {/* Photos */}
        {order.photos.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Ảnh chứng từ</p>
              <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">{order.photos.length}/5</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {order.photos.map(p => (
                <div key={p.id} className="relative aspect-square">
                  <img
                    src={p.url}
                    alt={p.caption ?? ''}
                    className="w-full h-full object-cover rounded-xl"
                  />
                  {p.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-xs px-1.5 py-1 rounded-b-xl truncate">
                      {p.caption}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      {!isLocked && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 p-4 space-y-2.5 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          {!isDelivered && (
            <button
              onClick={handleDelivered}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-2xl text-base min-h-[48px] transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Xác nhận đã giao hàng
            </button>
          )}
          {isDelivered && !isPaid && (
            <button
              onClick={() => navigate(`/shipper/orders/${order.id}/payment`)}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-4 rounded-2xl text-base min-h-[48px] transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Cập nhật thanh toán
            </button>
          )}
          <button
            onClick={() => navigate(`/shipper/orders/${order.id}/photo`)}
            className="w-full border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 font-semibold py-3.5 rounded-2xl text-base min-h-[48px] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Ảnh & Ghi chú
          </button>
        </div>
      )}
    </div>
  )
}
