import { useState, useEffect, useCallback } from 'react'
import api from '../../lib/api'
import { formatVND } from '../../lib/formatters'
import AccountantLayout from '../../components/AccountantLayout'

interface Transaction {
  id: string
  transactionCode: string
  amount: number
  content?: string
  gateway?: string
  transactionDate: string
  matchStatus: string
  matchedBy?: string
  orderCode?: string
}

const PAGE_SIZE = 20

const fmtDate = (s: string) => {
  const d = new Date(s)
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function pageWindow(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total]
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '...', current - 1, current, current + 1, '...', total]
}

export default function UnmatchedTx() {
  const [txs, setTxs] = useState<Transaction[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  // Manual match state
  const [matchingId, setMatchingId] = useState<string | null>(null)
  const [orderInput, setOrderInput] = useState('')
  const [matchLoading, setMatchLoading] = useState(false)
  const [matchError, setMatchError] = useState('')

  const fetchTxs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/sepay/transactions', {
        params: { status: 'Unmatched', search: search || undefined, page, pageSize: PAGE_SIZE },
      })
      setTxs(res.data.items)
      setTotal(res.data.total)
    } finally {
      setLoading(false)
    }
  }, [search, page])

  useEffect(() => { fetchTxs() }, [fetchTxs])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setPage(1)
  }

  const handleRefresh = () => {
    setSearchInput('')
    setSearch('')
    setPage(1)
  }

  const handleStartMatch = (id: string) => {
    setMatchingId(id)
    setOrderInput('')
    setMatchError('')
  }

  const handleCancelMatch = () => {
    setMatchingId(null)
    setOrderInput('')
    setMatchError('')
  }

  const handleConfirmMatch = async (txId: string) => {
    if (!orderInput.trim()) return
    setMatchLoading(true)
    setMatchError('')
    try {
      const res = await api.get('/orders', { params: { search: orderInput.trim(), pageSize: 1 } })
      const order = res.data.items[0]
      if (!order) {
        setMatchError('Không tìm thấy đơn hàng')
        return
      }
      await api.post('/sepay/assign', { transactionId: txId, orderId: order.id })
      setMatchingId(null)
      setOrderInput('')
      fetchTxs()
    } catch {
      setMatchError('Gán thất bại, vui lòng thử lại')
    } finally {
      setMatchLoading(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <AccountantLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Khớp giao dịch</h1>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">{total.toLocaleString('vi-VN')} giao dịch chưa khớp</p>
        </div>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Làm mới
        </button>
      </div>

      {/* Search */}
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
            placeholder="Tìm mã giao dịch, nội dung..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
        </form>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">Mã giao dịch</th>
              <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Số tiền</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Nội dung</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400 whitespace-nowrap">Thời gian</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Cổng</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-gray-400">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-16 text-gray-400 dark:text-gray-500">Đang tải...</td>
              </tr>
            ) : txs.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-16 text-gray-400 dark:text-gray-500">Không có giao dịch chưa khớp</td>
              </tr>
            ) : txs.map((tx, i) => (
              <tr
                key={tx.id}
                className={`border-b border-gray-100 dark:border-gray-800 transition-colors ${i === txs.length - 1 ? 'border-b-0' : ''} ${matchingId === tx.id ? 'bg-blue-50' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
              >
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-gray-700 dark:text-gray-300">{tx.transactionCode}</span>
                </td>
                <td className="px-4 py-3 text-right font-semibold text-green-600">
                  {formatVND(tx.amount)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-xs truncate">
                  {tx.content ?? <span className="text-gray-400 dark:text-gray-500">—</span>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-500 whitespace-nowrap">
                  {fmtDate(tx.transactionDate)}
                </td>
                <td className="px-4 py-3">
                  {tx.gateway ? (
                    <span className="inline-block px-2 py-0.5 bg-pink-100 text-pink-700 text-xs rounded-full">
                      {tx.gateway}
                    </span>
                  ) : <span className="text-gray-400 dark:text-gray-500">—</span>}
                </td>
                <td className="px-4 py-3">
                  {matchingId === tx.id ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <input
                          type="text"
                          autoFocus
                          value={orderInput}
                          onChange={e => { setOrderInput(e.target.value); setMatchError('') }}
                          onKeyDown={e => { if (e.key === 'Enter') handleConfirmMatch(tx.id) }}
                          placeholder="Nhập mã đơn (VD: BH24...)"
                          className="w-full border border-blue-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        {matchError && <p className="text-red-500 text-xs mt-1">{matchError}</p>}
                      </div>
                      <button
                        onClick={() => handleConfirmMatch(tx.id)}
                        disabled={matchLoading || !orderInput.trim()}
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
                      >
                        {matchLoading ? '...' : 'Xác nhận'}
                      </button>
                      <button
                        onClick={handleCancelMatch}
                        className="px-3 py-1.5 border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-xs font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 whitespace-nowrap"
                      >
                        Huỷ
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleStartMatch(tx.id)}
                      className="px-3 py-1.5 border border-blue-300 text-blue-600 text-xs font-medium rounded-lg hover:bg-blue-50 transition-colors whitespace-nowrap"
                    >
                      Ghép đơn
                    </button>
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
              Trang {page}/{totalPages} — {total.toLocaleString('vi-VN')} giao dịch
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
