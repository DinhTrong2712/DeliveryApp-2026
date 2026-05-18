import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../../lib/api'
import { formatVND } from '../../lib/formatters'
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../lib/constants'
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

export default function AccountantOrderPool() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const filterRef = useRef<HTMLDivElement>(null)
  const [showFilter, setShowFilter] = useState(false)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/orders', {
        params: { search: search || undefined, status: status || undefined, page, pageSize: PAGE_SIZE },
      })
      setOrders(res.data.items)
      setTotal(res.data.total)
    } finally {
      setLoading(false)
    }
  }, [search, status, page])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // Close filter dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilter(false)
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

  const handleRefresh = () => {
    setSearchInput('')
    setSearch('')
    setStatus('')
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const activeStatusLabel = status ? ORDER_STATUS_LABELS[status] : null

  return (
    <AccountantLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Đơn hàng</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total.toLocaleString('vi-VN')} đơn hàng</p>
        </div>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Làm mới
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex items-center gap-3 mb-4">
        <form onSubmit={handleSearch} className="flex-1 relative">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Tìm mã đơn, tên khách hàng..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
        </form>

        {/* Status filter dropdown */}
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setShowFilter(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
              status
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
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
            <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-30 py-1">
              <button
                onClick={() => handleStatusFilter('')}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                  !status ? 'font-semibold text-gray-900' : 'text-gray-700'
                }`}
              >
                Tất cả trạng thái
              </button>
              {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
                <button
                  key={k}
                  onClick={() => handleStatusFilter(k)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                    status === k ? 'font-semibold text-gray-900' : 'text-gray-700'
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
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-gray-200 bg-white">
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Mã đơn</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Khách hàng</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Nhân viên</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Trạng thái</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Số tiền</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Đã thu</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Còn lại</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-16 text-gray-400">Đang tải...</td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16 text-gray-400">Không có đơn hàng</td>
              </tr>
            ) : orders.map((o, i) => (
              <tr
                key={o.id}
                className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${i === orders.length - 1 ? 'border-b-0' : ''}`}
              >
                <td className="px-4 py-3">
                  <span className="font-mono text-sm font-semibold text-gray-900">{o.orderCode}</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-900">{o.customerName}</td>
                <td className="px-4 py-3">
                  {o.shipperName ? (
                    <span className="text-sm text-gray-700">{o.shipperName}</span>
                  ) : (
                    <span className="text-sm italic text-gray-400">Chưa phân công</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${ORDER_STATUS_COLORS[o.status] ?? 'bg-gray-100 text-gray-700'}`}>
                    {ORDER_STATUS_LABELS[o.status] ?? o.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{formatVND(o.amount)}</td>
                <td className="px-4 py-3 text-right font-medium text-green-600">{formatVND(o.amountPaid)}</td>
                <td className="px-4 py-3 text-right font-medium">
                  {o.amountRemaining > 0 ? (
                    <span className="text-orange-600">{formatVND(o.amountRemaining)}</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <span className="text-xs text-gray-500">
              Trang {page}/{totalPages} — {total.toLocaleString('vi-VN')} đơn hàng
            </span>
            <div className="flex gap-1">
              <PagBtn label="←" disabled={page <= 1} onClick={() => setPage(p => p - 1)} />
              {pageWindow(page, totalPages).map((p, i) =>
                p === '...'
                  ? <span key={`e${i}`} className="w-8 text-center text-gray-400 text-xs self-center">…</span>
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
          : disabled ? 'text-gray-300 cursor-not-allowed'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  )
}
