import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { formatVND } from '../../lib/formatters'
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../lib/constants'
import { useSignalR } from '../../hooks/useSignalR'
import ShipperLayout from '../../components/ShipperLayout'
import PaymentMethodSheet from '../../components/PaymentMethodSheet'

interface Order {
  id: string
  orderCode: string
  routeCode?: string
  customerName: string
  amount: number
  amountPaid: number
  amountRemaining: number
  status: string
  createdAt?: string
}

interface RouteGroup {
  routeCode: string
  orders: Order[]
  totalAmount: number
  totalPaid: number
  remaining: number
  completedCount: number
  date: string
}

const todayStr = () => new Date().toISOString().split('T')[0]

const fmtDateLabel = (s: string) =>
  new Date(s).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })

const SORT_OPTIONS = [
  { value: 'default', label: 'Mặc định' },
  { value: 'remaining', label: 'Còn lại nhiều nhất' },
  { value: 'done', label: 'Hoàn thành trước' },
  { value: 'amount_asc', label: 'Tiền: ít → nhiều' },
  { value: 'amount_desc', label: 'Tiền: nhiều → ít' },
]

export default function ShipperRoutes() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(todayStr())
  const [allDays, setAllDays] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('default')
  const [showSort, setShowSort] = useState(false)
  const [routeDetail, setRouteDetail] = useState<RouteGroup | null>(null)
  const [detailSort, setDetailSort] = useState<string>('')
  const [showDetailSort, setShowDetailSort] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const sortRef = useRef<HTMLDivElement>(null)
  const detailSortRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Close sort dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSort(false)
      }
      if (detailSortRef.current && !detailSortRef.current.contains(e.target as Node)) {
        setShowDetailSort(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { pageSize: 200 }
      if (!allDays) params.date = date
      const res = await api.get('/orders', { params })
      setOrders(res.data.items)
    } finally {
      setLoading(false)
    }
  }, [date, allDays])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  useSignalR({ OrderStatusUpdated: fetchOrders, SePayMatched: fetchOrders }, ['shipper'])

  // Group orders by routeCode
  const groups: RouteGroup[] = (() => {
    const routeMap = new Map<string, Order[]>()
    const standalone: Order[] = []

    for (const o of orders) {
      if (o.routeCode) {
        if (!routeMap.has(o.routeCode)) routeMap.set(o.routeCode, [])
        routeMap.get(o.routeCode)!.push(o)
      } else {
        standalone.push(o)
      }
    }

    const result: RouteGroup[] = []

    routeMap.forEach((routeOrders, routeCode) => {
      const totalAmount = routeOrders.reduce((s, o) => s + o.amount, 0)
      const totalPaid = routeOrders.reduce((s, o) => s + o.amountPaid, 0)
      const remaining = routeOrders.reduce((s, o) => s + o.amountRemaining, 0)
      const completedCount = routeOrders.filter(o => ['PaidCash', 'PaidTransfer'].includes(o.status)).length
      const firstOrder = routeOrders[0]
      result.push({
        routeCode,
        orders: routeOrders,
        totalAmount,
        totalPaid,
        remaining,
        completedCount,
        date: firstOrder.createdAt ?? new Date().toISOString(),
      })
    })

    // Standalone orders as a single pseudo-group
    if (standalone.length > 0) {
      const totalAmount = standalone.reduce((s, o) => s + o.amount, 0)
      const totalPaid = standalone.reduce((s, o) => s + o.amountPaid, 0)
      const remaining = standalone.reduce((s, o) => s + o.amountRemaining, 0)
      const completedCount = standalone.filter(o => ['PaidCash', 'PaidTransfer'].includes(o.status)).length
      result.push({
        routeCode: '__standalone__',
        orders: standalone,
        totalAmount,
        totalPaid,
        remaining,
        completedCount,
        date: standalone[0].createdAt ?? new Date().toISOString(),
      })
    }

    return result
  })()

  const filteredGroups = groups.filter(g =>
    !search || g.routeCode.toLowerCase().includes(search.toLowerCase())
  )

  const sortedGroups = [...filteredGroups].sort((a, b) => {
    if (sort === 'remaining') return b.remaining - a.remaining
    if (sort === 'done') return (b.completedCount / (b.orders.length || 1)) - (a.completedCount / (a.orders.length || 1))
    if (sort === 'amount_asc') return a.totalAmount - b.totalAmount
    if (sort === 'amount_desc') return b.totalAmount - a.totalAmount
    return 0
  })

  // Stats
  const statsRoutes = groups.filter(g => g.routeCode !== '__standalone__')
  const totalRoutes = statsRoutes.length
  const completedRoutes = statsRoutes.filter(g => g.completedCount === g.orders.length && g.orders.length > 0).length
  const totalRemaining = groups.reduce((s, g) => s + g.remaining, 0)

  // Keep modal in sync with fresh orders
  useEffect(() => {
    if (!routeDetail) return
    const updated = groups.find(g => g.routeCode === routeDetail.routeCode)
    if (updated && updated !== routeDetail) setRouteDetail(updated)
    if (!updated) setRouteDetail(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders])

  const detailOrders = routeDetail
    ? [...routeDetail.orders].sort((a, b) => {
        if (detailSort === 'amount_asc') return a.amount - b.amount
        if (detailSort === 'amount_desc') return b.amount - a.amount
        return 0
      })
    : []

  return (
    <ShipperLayout>
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 px-4 pt-4 pb-3">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalRoutes}</p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">Đơn gộp</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{completedRoutes}</p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">Hoàn thành</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-3 text-center">
          <p className="text-xl font-bold text-orange-500">{formatVND(totalRemaining)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">Còn lại</p>
        </div>
      </div>

      {/* Filters — wraps on narrow screens */}
      <div className="px-4 pb-3 space-y-2">
        <div className="flex items-center gap-2">
          {/* Date picker */}
          <input
            type="date"
            value={date}
            onChange={e => { setDate(e.target.value); setAllDays(false) }}
            className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 h-10 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 flex-1 min-w-0"
          />

          {/* All days toggle */}
          <button
            onClick={() => setAllDays(v => !v)}
            className={`px-3 h-10 rounded-lg text-xs font-medium transition-colors border whitespace-nowrap ${
              allDays
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            Tất cả ngày
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="flex-1 relative min-w-0">
            <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none">
              <svg className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm mã đơn gộp..."
              className="w-full pl-8 pr-3 h-10 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>

          {/* Sort dropdown */}
          <div className="relative flex-shrink-0" ref={sortRef}>
            <button
              onClick={() => setShowSort(v => !v)}
              className="flex items-center gap-1.5 px-3 h-10 border border-gray-300 dark:border-gray-700 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5 text-gray-500 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9M3 12h5m4 0l4 4m0 0l4-4m-4 4V4" />
              </svg>
              {SORT_OPTIONS.find(o => o.value === sort)?.label ?? 'Mặc định'}
              <svg className="w-3 h-3 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          {showSort && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg z-30 py-1">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setSort(opt.value); setShowSort(false) }}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 ${sort === opt.value ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Date label */}
      {!allDays && (
        <div className="px-4 pb-2">
          <p className="text-xs text-gray-500 dark:text-gray-500">{fmtDateLabel(date + 'T00:00:00')}</p>
        </div>
      )}

      {/* Content */}
      <div className="px-4 pb-4 space-y-3">
        {loading ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 py-12 text-center text-gray-400 dark:text-gray-500 text-sm">
            Đang tải...
          </div>
        ) : sortedGroups.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 py-12 text-center text-gray-400 dark:text-gray-500 text-sm">
            {allDays ? 'Chưa có đơn gộp nào.' : 'Ngày này chưa có đơn gộp nào.'}
          </div>
        ) : (
          sortedGroups.map(g => {
            const isDone = g.completedCount === g.orders.length && g.orders.length > 0
            const isStandalone = g.routeCode === '__standalone__'

            return (
              <button
                key={g.routeCode}
                onClick={() => { setRouteDetail(g); setDetailSort('') }}
                className="w-full text-left bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {/* Status indicator */}
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  isDone ? 'bg-green-500' : g.remaining > 0 ? 'bg-orange-400' : 'bg-gray-300'
                }`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-sm ${isStandalone ? 'text-gray-500 dark:text-gray-500 italic' : 'text-gray-900 dark:text-gray-100'}`}>
                      {isStandalone ? 'Đơn lẻ' : g.routeCode}
                    </span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {g.completedCount}/{g.orders.length} đơn
                    </span>
                    {isDone && (
                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                        Xong
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-500">
                    <span>Tổng: <span className="font-medium text-gray-700 dark:text-gray-300">{formatVND(g.totalAmount)}</span></span>
                    {g.remaining > 0 && (
                      <span>Còn lại: <span className="font-semibold text-orange-500">{formatVND(g.remaining)}</span></span>
                    )}
                    {isDone && (
                      <span className="text-green-600 font-medium">Đã thu: {formatVND(g.totalPaid)}</span>
                    )}
                  </div>
                </div>

                <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )
          })
        )}
      </div>

      {/* Route detail modal — full-screen bottom sheet on mobile, centered on desktop */}
      {routeDetail && (
        <div
          className="fixed inset-0 bg-black/50 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setRouteDetail(null)}
        >
          <div
            className="bg-white dark:bg-gray-900 w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl shadow-xl flex flex-col h-[92dvh] sm:h-auto sm:max-h-[85vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Drag handle (mobile only) */}
            <div className="sm:hidden flex justify-center pt-2 pb-1 flex-shrink-0">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* Header — sticky */}
            <div className="flex items-start justify-between gap-3 px-4 sm:px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-base truncate">
                  {routeDetail.routeCode === '__standalone__' ? 'Đơn lẻ' : routeDetail.routeCode}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 leading-snug">
                  {routeDetail.orders.length} đơn · {routeDetail.completedCount} xong
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs">
                  <span className="text-gray-500 dark:text-gray-500">
                    Tổng <span className="font-semibold text-gray-800 dark:text-gray-200">{formatVND(routeDetail.totalAmount)}</span>
                  </span>
                  {routeDetail.remaining > 0 && (
                    <span className="text-gray-500 dark:text-gray-500">
                      Còn <span className="font-semibold text-orange-500">{formatVND(routeDetail.remaining)}</span>
                    </span>
                  )}
                  {routeDetail.totalPaid > 0 && (
                    <span className="text-gray-500 dark:text-gray-500">
                      Đã thu <span className="font-semibold text-green-600">{formatVND(routeDetail.totalPaid)}</span>
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setRouteDetail(null)}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-2 -mr-2 -mt-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Đóng"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Sort toolbar — sticky */}
            <div className="px-4 sm:px-5 py-2 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2 flex-shrink-0 bg-gray-50/60">
              <span className="text-xs text-gray-500 dark:text-gray-500">Danh sách đơn</span>
              <div className="relative" ref={detailSortRef}>
                <button
                  onClick={() => setShowDetailSort(v => !v)}
                  className={`flex items-center gap-1.5 px-3 h-9 border rounded-lg text-xs font-medium transition-colors ${
                    detailSort ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9M3 12h5m4 0l4 4m0 0l4-4m-4 4V4" />
                  </svg>
                  {detailSort === 'amount_asc' ? 'Ít → nhiều'
                    : detailSort === 'amount_desc' ? 'Nhiều → ít'
                    : 'Sắp xếp'}
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showDetailSort && (
                  <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg z-50 py-1">
                    {[
                      { value: '', label: 'Mặc định' },
                      { value: 'amount_asc', label: 'Tiền: ít → nhiều' },
                      { value: 'amount_desc', label: 'Tiền: nhiều → ít' },
                    ].map(opt => (
                      <button
                        key={opt.value || 'default'}
                        onClick={() => { setDetailSort(opt.value); setShowDetailSort(false) }}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 ${
                          detailSort === opt.value ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Orders — scrollable, with safe-area padding for iOS home indicator */}
            <div className="overflow-y-auto flex-1 overscroll-contain pb-[env(safe-area-inset-bottom)]">
              {detailOrders.length === 0 ? (
                <div className="py-12 text-center text-gray-400 dark:text-gray-500 text-sm">Không có đơn hàng</div>
              ) : detailOrders.map((o, i) => {
                const alreadyPaid = ['PaidCash', 'PaidTransfer'].includes(o.status)
                const handleClick = () => {
                  if (alreadyPaid) navigate(`/shipper/orders/${o.id}`)
                  else { setRouteDetail(null); setSelectedOrder(o) }
                }
                return (
                  <button
                    key={o.id}
                    onClick={handleClick}
                    className={`w-full text-left px-4 sm:px-5 py-4 min-h-[64px] flex items-center gap-3 active:bg-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                      i < detailOrders.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{o.orderCode}</span>
                        <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${ORDER_STATUS_COLORS[o.status] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
                          {ORDER_STATUS_LABELS[o.status] ?? o.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-500 truncate">{o.customerName}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs flex-wrap">
                        <span className="text-gray-700 dark:text-gray-300 font-medium">{formatVND(o.amount)}</span>
                        {o.amountRemaining > 0 && !alreadyPaid && (
                          <span className="text-orange-500 font-medium">Còn: {formatVND(o.amountRemaining)}</span>
                        )}
                      </div>
                    </div>
                    <svg className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <PaymentMethodSheet
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onSaved={fetchOrders}
      />
    </ShipperLayout>
  )
}
