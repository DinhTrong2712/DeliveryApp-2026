import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { formatVND } from '../../lib/formatters'
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../lib/constants'
import { useSignalR } from '../../hooks/useSignalR'
import AccountantLayout from '../../components/AccountantLayout'

interface Order {
  id: string
  orderCode: string
  customerName: string
  amount: number
  amountPaid: number
  amountRemaining: number
  status: string
  shipperName?: string
}

const PAGE_SIZE = 20

function pageWindow(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total]
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '...', current - 1, current, current + 1, '...', total]
}

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Mới nhất' },
  { value: 'amount_asc', label: 'Tiền: ít → nhiều' },
  { value: 'amount_desc', label: 'Tiền: nhiều → ít' },
]

export default function AccountantOrderPool() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [sort, setSort] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const filterRef = useRef<HTMLDivElement>(null)
  const sortRef = useRef<HTMLDivElement>(null)
  const [showFilter, setShowFilter] = useState(false)
  const [showSort, setShowSort] = useState(false)
  const navigate = useNavigate()

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/orders', {
        params: { search: search || undefined, status: status || undefined, sort: sort || undefined, page, pageSize: PAGE_SIZE },
      })
      setOrders(res.data.items)
      setTotal(res.data.total)
    } finally {
      setLoading(false)
    }
  }, [search, status, sort, page])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // SignalR realtime updates
  useSignalR({
    OrderStatusUpdated: fetchOrders,
    SePayMatched: fetchOrders,
    OrderAssigned: fetchOrders,  // ✅ Reload khi import đơn mới
    UnmatchedTransaction: fetchOrders,
  }, ['accountants'])

  // Close filter dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilter(false)
      }
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSort(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const handleStatusFilter = (v: string) => {
    setStatus(v)
    setPage(1)
    setShowFilter(false)
  }

  const handleSortChange = (v: string) => {
    setSort(v)
    setPage(1)
    setShowSort(false)
  }

  const handleRefresh = () => {
    setSearchInput('')
    setSearch('')
    setStatus('')
    setSort('')
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const activeStatusLabel = status ? ORDER_STATUS_LABELS[status] : null

  return (
    <AccountantLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Đơn hàng</h1>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">{total.toLocaleString('vi-VN')} đơn hàng</p>
        </div>
        <button
          onClick={handleRefresh}
          className="group inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:border-orange-400 dark:hover:border-orange-500/60 hover:text-orange-600 dark:hover:text-orange-400 hover:shadow-sm active:scale-[0.98] transition-all duration-200"
        >
          <svg className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Làm mới
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-3 mb-4">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Tìm mã đơn, tên khách hàng..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
        </form>

        {/* Sort dropdown */}
        <div className="relative" ref={sortRef}>
          <button
            onClick={() => setShowSort(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
              sort
                ? 'border-orange-500 bg-orange-500 text-white shadow-sm shadow-orange-500/20'
                : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9M3 12h5m4 0l4 4m0 0l4-4m-4 4V4" />
            </svg>
            {SORT_OPTIONS.find(o => o.value === sort)?.label ?? 'Sắp xếp'}
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showSort && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg z-30 py-1">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.value || 'default'}
                  onClick={() => handleSortChange(opt.value)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                    sort === opt.value ? 'bg-orange-50 dark:bg-orange-500/10 font-semibold text-orange-700 dark:text-orange-400' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Status filter dropdown */}
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setShowFilter(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
              status
                ? 'border-orange-500 bg-orange-500 text-white shadow-sm shadow-orange-500/20'
                : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 8h10M10 12h4" />
            </svg>
            {status ? activeStatusLabel : 'Trạng thái'}
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showFilter && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg z-30 py-1">
              <button
                onClick={() => handleStatusFilter('')}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                  !status ? 'bg-orange-50 dark:bg-orange-500/10 font-semibold text-orange-700 dark:text-orange-400' : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                Tất cả trạng thái
              </button>
              {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => handleStatusFilter(k)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                    status === k ? 'bg-orange-50 dark:bg-orange-500/10 font-semibold text-orange-700 dark:text-orange-400' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Mã đơn</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Khách hàng</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Nhân viên</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Trạng thái</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Số tiền</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Đã thu</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Còn lại</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-16 text-gray-400 dark:text-gray-500">Đang tải...</td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16 text-gray-400 dark:text-gray-500">Không có đơn hàng</td>
              </tr>
            ) : orders.map((o, i) => (
              <tr
                key={o.id}
                onClick={() => navigate(`/accountant/orders/${o.id}`)}
                className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer ${i === orders.length - 1 ? 'border-b-0' : ''}`}
              >
                <td className="px-4 py-3">
                  <span className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">{o.orderCode}</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{o.customerName}</td>
                <td className="px-4 py-3">
                  {o.shipperName ? (
                    <span className="text-sm text-gray-700 dark:text-gray-300">{o.shipperName}</span>
                  ) : (
                    <span className="text-sm italic text-gray-400 dark:text-gray-500">Chưa phân công</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${ORDER_STATUS_COLORS[o.status] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
                    {ORDER_STATUS_LABELS[o.status] ?? o.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">{formatVND(o.amount)}</td>
                <td className="px-4 py-3 text-right font-medium text-green-600">{formatVND(o.amountPaid)}</td>
                <td className="px-4 py-3 text-right font-medium">
                  {o.amountRemaining > 0 ? (
                    <span className="text-orange-600">{formatVND(o.amountRemaining)}</span>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
            <span className="text-xs text-gray-500 dark:text-gray-500">
              Trang {page}/{totalPages} — {total.toLocaleString('vi-VN')} đơn hàng
            </span>
            <div className="flex gap-1">
              <PagBtn label="←" disabled={page <= 1} onClick={() => setPage(p => p - 1)} />
              {pageWindow(page, totalPages).map((p, i) =>
                p === '...'
                  ? <span key={`e${i}`} className="w-8 text-center text-gray-400 dark:text-gray-500 text-xs self-center">…</span>
                  : <PagBtn key={p} label={String(p)} active={p === page} onClick={() => setPage(p as number)} />
              )}
              <PagBtn label="→" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} />
            </div>
          </div>
        )}
      </div>
    </AccountantLayout>
  )
}

function PagBtn({ label, disabled, active, onClick }: {
  label: string; disabled?: boolean; active?: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
        active ? 'bg-gray-900 text-white'
          : disabled ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
    >
      {label}
    </button>
  )
}
