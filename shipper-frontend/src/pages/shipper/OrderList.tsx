import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { OrderCard } from '../../components/OrderCard'
import { useAuthStore } from '../../stores/authStore'
import { useSignalR } from '../../hooks/useSignalR'

interface Order {
  id: string
  orderCode: string
  customerName: string
  amount: number
  amountRemaining: number
  status: string
}

export default function ShipperOrderList() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  const fetchOrders = useCallback(async () => {
    try {
      const res = await api.get('/orders', { params: { pageSize: 100, search } })
      setOrders(res.data.items)
    } catch {
      // handle
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  useSignalR({
    OrderStatusUpdated: () => fetchOrders(),
    SePayMatched: () => fetchOrders(),
  }, ['shipper'])

  const handleLogout = () => { logout(); navigate('/login') }

  const summary = {
    total: orders.length,
    done: orders.filter(o => ['PaidCash', 'PaidTransfer'].includes(o.status)).length,
    pending: orders.filter(o => o.status === 'Pending').length,
    unpaid: orders.filter(o => o.status === 'Unpaid').length,
  }

  const progress = summary.total > 0 ? Math.round((summary.done / summary.total) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky header */}
      <div className="bg-white sticky top-0 z-10 border-b border-gray-100 shadow-sm">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
              {user?.fullName?.charAt(0) ?? '?'}
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm leading-tight">{user?.fullName}</p>
              <p className="text-xs text-gray-400">Nhân viên giao hàng</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 min-h-[44px] px-3 rounded-xl hover:bg-red-50 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Đăng xuất
          </button>
        </div>

        {/* Summary cards */}
        <div className="px-4 pb-2">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-gray-50 rounded-xl py-2.5 px-1">
              <p className="font-bold text-gray-800 text-lg leading-tight">{summary.total}</p>
              <p className="text-gray-500 text-xs mt-0.5">Tổng</p>
            </div>
            <div className="bg-green-50 rounded-xl py-2.5 px-1">
              <p className="font-bold text-green-700 text-lg leading-tight">{summary.done}</p>
              <p className="text-green-600 text-xs mt-0.5">Xong</p>
            </div>
            <div className="bg-blue-50 rounded-xl py-2.5 px-1">
              <p className="font-bold text-blue-700 text-lg leading-tight">{summary.pending}</p>
              <p className="text-blue-600 text-xs mt-0.5">Chờ</p>
            </div>
            <div className="bg-red-50 rounded-xl py-2.5 px-1">
              <p className="font-bold text-red-700 text-lg leading-tight">{summary.unpaid}</p>
              <p className="text-red-600 text-xs mt-0.5">Chưa thu</p>
            </div>
          </div>

          {/* Progress bar */}
          {summary.total > 0 && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Tiến độ hoàn thành</span>
                <span className="font-medium text-gray-600">{progress}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm mã đơn, tên khách..."
              className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
            />
          </div>
        </div>
      </div>

      {/* Order list */}
      <div className="px-4 pt-3 pb-6">
        {loading ? (
          <div className="space-y-3 mt-1">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="skeleton h-4 w-32 mb-2" />
                <div className="skeleton h-3 w-48 mb-3" />
                <div className="skeleton h-3 w-24" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-gray-400">
            <svg className="w-12 h-12 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-sm font-medium">
              {search ? 'Không tìm thấy đơn hàng' : 'Chưa có đơn hàng nào'}
            </p>
            {search && (
              <button onClick={() => setSearch('')} className="mt-2 text-blue-600 text-sm">
                Xóa bộ lọc
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-3 px-1">
              {search ? `Kết quả cho "${search}" · ` : ''}{orders.length} đơn hàng
            </p>
            {orders.map(o => (
              <OrderCard key={o.id} order={o} basePath="/shipper/orders" />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
