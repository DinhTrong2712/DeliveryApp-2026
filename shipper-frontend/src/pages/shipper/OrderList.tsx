import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { OrderCard } from '../../components/OrderCard'
import { useAuthStore } from '../../stores/authStore'
import { useSignalR } from '../../hooks/useSignalR'

const SORT_OPTIONS = [
  { value: 'default', label: 'Mặc định' },
  { value: 'amount_asc', label: 'Tiền: ít → nhiều' },
  { value: 'amount_desc', label: 'Tiền: nhiều → ít' },
]

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
  const [sort, setSort] = useState('default')
  const [showSort, setShowSort] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSort(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

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

  // SignalR realtime updates
  useSignalR({
    OrderStatusUpdated: () => fetchOrders(),
    SePayMatched: () => fetchOrders(),
    OrderAssigned: () => fetchOrders(),
  }, ['shipper'])

  // Fallback polling: refresh every 30s to catch missed SignalR events
  useEffect(() => {
    const interval = setInterval(() => {
      fetchOrders()
    }, 30000) // 30 seconds
    return () => clearInterval(interval)
  }, [fetchOrders])

  // Auto-refresh when app regains focus (user switches back to tab/app)
  useEffect(() => {
    const handleFocus = () => {
      fetchOrders()
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchOrders])

  const handleLogout = () => { logout(); navigate('/login') }

  const summary = {
    total: orders.length,
    done: orders.filter(o => ['PaidCash', 'PaidTransfer'].includes(o.status)).length,
    pending: orders.filter(o => o.status === 'Pending').length,
    unpaid: orders.filter(o => o.status === 'Unpaid').length,
  }

  const progress = summary.total > 0 ? Math.round((summary.done / summary.total) * 100) : 0

  const sortedOrders = [...orders].sort((a, b) => {
    if (sort === 'amount_asc') return a.amount - b.amount
    if (sort === 'amount_desc') return b.amount - a.amount
    return 0
  })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sticky header */}
      <div className="bg-white dark:bg-gray-900 sticky top-0 z-10 border-b border-gray-100 dark:border-gray-800 shadow-sm">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
              {user?.fullName?.charAt(0) ?? '?'}
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-gray-100 text-sm leading-tight">{user?.fullName}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Nhân viên giao hàng</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-500 hover:text-red-600 min-h-[44px] px-3 rounded-xl hover:bg-red-50 transition-colors"
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
            <div className="bg-gray-50 dark:bg-gray-950 rounded-xl py-2.5 px-1">
              <p className="font-bold text-gray-800 dark:text-gray-200 text-lg leading-tight">{summary.total}</p>
              <p className="text-gray-500 dark:text-gray-500 text-xs mt-0.5">Tổng</p>
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
              <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mb-1">
                <span>Tiến độ hoàn thành</span>
                <span className="font-medium text-gray-600 dark:text-gray-400">{progress}%</span>
              </div>
              <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Search + sort */}
        <div className="px-4 pb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm mã đơn, tên khách..."
              className="w-full border border-gray-200 dark:border-gray-800 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-gray-950"
            />
          </div>
          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setShowSort(v => !v)}
              className="flex items-center gap-1 px-3 py-2.5 border border-gray-200 dark:border-gray-800 rounded-xl text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-950 hover:bg-gray-100 dark:hover:bg-gray-800 whitespace-nowrap"
            >
              <svg className="w-4 h-4 text-gray-500 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9M3 12h5m4 0l4 4m0 0l4-4m-4 4V4" />
              </svg>
              {SORT_OPTIONS.find(o => o.value === sort)?.label ?? 'Sắp xếp'}
            </button>
            {showSort && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg z-30 py-1">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setSort(opt.value); setShowSort(false) }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 ${sort === opt.value ? 'bg-orange-50 dark:bg-orange-500/10 font-semibold text-orange-700 dark:text-orange-400' : 'text-gray-700 dark:text-gray-300'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Order list */}
      <div className="px-4 pt-3 pb-6">
        {loading ? (
          <div className="space-y-3 mt-1">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4">
                <div className="skeleton h-4 w-32 mb-2" />
                <div className="skeleton h-3 w-48 mb-3" />
                <div className="skeleton h-3 w-24" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-gray-400 dark:text-gray-500">
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
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 px-1">
              {search ? `Kết quả cho "${search}" · ` : ''}{sortedOrders.length} đơn hàng
            </p>
            {sortedOrders.map(o => (
              <OrderCard key={o.id} order={o} basePath="/shipper/orders" />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
