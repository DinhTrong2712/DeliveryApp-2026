import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import { formatVND } from '../../lib/formatters'
import AccountantLayout from '../../components/AccountantLayout'

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Mới nhất' },
  { value: 'amount_asc', label: 'Tiền: ít → nhiều' },
  { value: 'amount_desc', label: 'Tiền: nhiều → ít' },
]

interface RouteSummary {
  routeCode: string
  orderDate: string
  shipperId: string | null
  shipperName: string | null
  customerCount: number
  totalAmount: number
  totalPaid: number
}

const fmtDate = (s: string) => {
  const d = new Date(s)
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function AccountantRoutes() {
  const [routes, setRoutes] = useState<RouteSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [sort, setSort] = useState('')
  const [showSort, setShowSort] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSort(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchRoutes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/routes', {
        params: {
          search: search || undefined,
          from: from || undefined,
          to: to || undefined,
        },
      })
      setRoutes(res.data.items)
      setTotal(res.data.total)
    } finally {
      setLoading(false)
    }
  }, [search, from, to])

  useEffect(() => { fetchRoutes() }, [fetchRoutes])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
  }

  const handleRefresh = () => {
    setSearchInput('')
    setSearch('')
    setFrom('')
    setTo('')
    setSort('')
  }

  const sortedRoutes = [...routes].sort((a, b) => {
    if (sort === 'amount_asc') return a.totalAmount - b.totalAmount
    if (sort === 'amount_desc') return b.totalAmount - a.totalAmount
    return 0
  })

  return (
    <AccountantLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Đơn gộp</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total.toLocaleString('vi-VN')} đơn gộp</p>
        </div>
        <button
          onClick={() => navigate('/accountant/import')}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
          Nhập đơn hàng
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        {/* Search */}
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
            placeholder="Tìm mã đơn gộp..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
        </form>

        {/* Date range */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={e => setFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
          <span className="text-gray-400 text-sm">—</span>
          <input
            type="date"
            value={to}
            onChange={e => setTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
        </div>

        {/* Sort */}
        <div className="relative" ref={sortRef}>
          <button
            onClick={() => setShowSort(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
              sort
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
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
            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-30 py-1">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.value || 'default'}
                  onClick={() => { setSort(opt.value); setShowSort(false) }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                    sort === opt.value ? 'font-semibold text-gray-900' : 'text-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleRefresh}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Làm mới
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-gray-200 bg-white">
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Mã đơn gộp</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Ngày</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Nhân viên</th>
              <th className="text-center px-4 py-3 font-semibold text-gray-600">Số KH</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Tổng cần thu</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Đã thu</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600">Còn lại</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-16 text-gray-400">Đang tải...</td>
              </tr>
            ) : sortedRoutes.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16 text-gray-400">Không có đơn gộp</td>
              </tr>
            ) : sortedRoutes.map((r, i) => {
              const remaining = r.totalAmount - r.totalPaid
              return (
                <tr
                  key={r.routeCode}
                  className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${i === sortedRoutes.length - 1 ? 'border-b-0' : ''}`}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-semibold text-gray-900">{r.routeCode}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {fmtDate(r.orderDate)}
                  </td>
                  <td className="px-4 py-3">
                    {r.shipperName ? (
                      <span className="text-sm font-medium text-gray-900">{r.shipperName}</span>
                    ) : (
                      <span className="text-sm italic text-gray-400">Chưa phân công</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-7 h-7 bg-gray-100 rounded-full text-xs font-semibold text-gray-700">
                      {r.customerCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatVND(r.totalAmount)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-green-600">
                    {formatVND(r.totalPaid)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {remaining > 0 ? (
                      <span className="text-orange-600">{formatVND(remaining)}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </AccountantLayout>
  )
}
