import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { formatVND } from '../../lib/formatters'
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../lib/constants'
import { useSignalR } from '../../hooks/useSignalR'
import ShipperLayout from '../../components/ShipperLayout'

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
]

export default function ShipperRoutes() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [date, setDate] = useState(todayStr())
  const [allDays, setAllDays] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('default')
  const [showSort, setShowSort] = useState(false)
  const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set())
  const sortRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Close sort dropdown on outside click
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
    return 0
  })

  // Stats
  const statsRoutes = groups.filter(g => g.routeCode !== '__standalone__')
  const totalRoutes = statsRoutes.length
  const completedRoutes = statsRoutes.filter(g => g.completedCount === g.orders.length && g.orders.length > 0).length
  const totalRemaining = groups.reduce((s, g) => s + g.remaining, 0)

  const toggleExpand = (code: string) => {
    setExpandedRoutes(prev => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  return (
    <ShipperLayout>
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 px-4 pt-4 pb-3">
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{totalRoutes}</p>
          <p className="text-xs text-gray-500 mt-0.5">Đơn gộp</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{completedRoutes}</p>
          <p className="text-xs text-gray-500 mt-0.5">Hoàn thành</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-xl font-bold text-orange-500">{formatVND(totalRemaining)}</p>
          <p className="text-xs text-gray-500 mt-0.5">Còn lại</p>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 pb-3 flex items-center gap-2">
        {/* Date picker */}
        <input
          type="date"
          value={date}
          onChange={e => { setDate(e.target.value); setAllDays(false) }}
          className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 w-36"
        />

        {/* All days toggle */}
        <button
          onClick={() => setAllDays(v => !v)}
          className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors border ${
            allDays
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
        >
          Tất cả ngày
        </button>

        {/* Search */}
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm mã đơn gộp..."
            className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
        </div>

        {/* Sort dropdown */}
        <div className="relative" ref={sortRef}>
          <button
            onClick={() => setShowSort(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white hover:bg-gray-50 whitespace-nowrap"
          >
            {SORT_OPTIONS.find(o => o.value === sort)?.label ?? 'Mặc định'}
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showSort && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-30 py-1">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { setSort(opt.value); setShowSort(false) }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${sort === opt.value ? 'font-semibold text-gray-900' : 'text-gray-700'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Date label */}
      {!allDays && (
        <div className="px-4 pb-2">
          <p className="text-xs text-gray-500">{fmtDateLabel(date + 'T00:00:00')}</p>
        </div>
      )}

      {/* Content */}
      <div className="px-4 pb-4 space-y-3">
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-200 py-12 text-center text-gray-400 text-sm">
            Đang tải...
          </div>
        ) : sortedGroups.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 py-12 text-center text-gray-400 text-sm">
            {allDays ? 'Chưa có đơn gộp nào.' : 'Ngày này chưa có đơn gộp nào.'}
          </div>
        ) : (
          sortedGroups.map(g => {
            const isExpanded = expandedRoutes.has(g.routeCode)
            const isDone = g.completedCount === g.orders.length && g.orders.length > 0
            const isStandalone = g.routeCode === '__standalone__'

            return (
              <div key={g.routeCode} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Route header */}
                <button
                  onClick={() => toggleExpand(g.routeCode)}
                  className="w-full text-left px-4 py-4 flex items-center gap-3"
                >
                  {/* Status indicator */}
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    isDone ? 'bg-green-500' : g.remaining > 0 ? 'bg-orange-400' : 'bg-gray-300'
                  }`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm ${isStandalone ? 'text-gray-500 italic' : 'text-gray-900'}`}>
                        {isStandalone ? 'Đơn lẻ' : g.routeCode}
                      </span>
                      <span className="text-xs text-gray-400">
                        {g.completedCount}/{g.orders.length} đơn
                      </span>
                      {isDone && (
                        <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                          Xong
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                      <span>Tổng: <span className="font-medium text-gray-700">{formatVND(g.totalAmount)}</span></span>
                      {g.remaining > 0 && (
                        <span>Còn lại: <span className="font-semibold text-orange-500">{formatVND(g.remaining)}</span></span>
                      )}
                      {isDone && (
                        <span className="text-green-600 font-medium">Đã thu: {formatVND(g.totalPaid)}</span>
                      )}
                    </div>
                  </div>

                  <svg
                    className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Orders expanded */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {g.orders.map((o, i) => (
                      <button
                        key={o.id}
                        onClick={() => navigate(`/shipper/orders/${o.id}`)}
                        className={`w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                          i < g.orders.length - 1 ? 'border-b border-gray-100' : ''
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-semibold text-sm text-gray-900">{o.orderCode}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${ORDER_STATUS_COLORS[o.status] ?? 'bg-gray-100 text-gray-700'}`}>
                              {ORDER_STATUS_LABELS[o.status] ?? o.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 truncate">{o.customerName}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs">
                            <span className="text-gray-600">{formatVND(o.amount)}</span>
                            {o.amountRemaining > 0 && !['PaidCash', 'PaidTransfer'].includes(o.status) && (
                              <span className="text-orange-500 font-medium">Còn: {formatVND(o.amountRemaining)}</span>
                            )}
                          </div>
                        </div>
                        <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </ShipperLayout>
  )
}
