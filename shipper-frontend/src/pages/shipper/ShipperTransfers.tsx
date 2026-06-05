import { useState, useEffect, useCallback } from 'react'
import api from '../../lib/api'
import { formatVND } from '../../lib/formatters'
import ShipperLayout from '../../components/ShipperLayout'

interface Transaction {
  id: string
  transactionCode: string
  amount: number
  content?: string
  gateway?: string
  transactionDate: string
}

const PAGE_SIZE = 20

const fmtDateTime = (s: string) => {
  const d = new Date(s)
  return `${d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`
}

export default function ShipperTransfers() {
  const [txs, setTxs] = useState<Transaction[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  // Per-transaction match state
  const [matchingId, setMatchingId] = useState<string | null>(null)
  const [orderInput, setOrderInput] = useState('')
  const [matchLoading, setMatchLoading] = useState(false)
  const [matchError, setMatchError] = useState('')

  const fetchTxs = useCallback(async (p: number, append: boolean) => {
    if (p === 1) setLoading(true)
    else setLoadingMore(true)
    try {
      const res = await api.get('/sepay/unmatched', { params: { page: p, pageSize: PAGE_SIZE } })
      const items: Transaction[] = Array.isArray(res.data) ? res.data : (res.data.items ?? [])
      const serverTotal: number | null = Array.isArray(res.data) ? null : (res.data.total ?? null)
      if (append) {
        setTxs(prev => [...prev, ...items])
      } else {
        setTxs(items)
        setTotal(serverTotal ?? items.length)
      }
      // If server returns a total use it; otherwise infer "more" from page size
      setHasMore(serverTotal !== null ? items.length === PAGE_SIZE : items.length === PAGE_SIZE)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    fetchTxs(1, false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => {
    setPage(1)
    setMatchingId(null)
    fetchTxs(1, false)
  }

  const handleLoadMore = () => {
    const next = page + 1
    setPage(next)
    fetchTxs(next, true)
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
        setMatchLoading(false)
        return
      }
      await api.post('/sepay/assign', { transactionId: txId, orderId: order.id })
      setTxs(prev => prev.filter(t => t.id !== txId))
      setTotal(prev => Math.max(0, prev - 1))
      setHasMore(prev => prev)
      setMatchingId(null)
      setOrderInput('')
    } catch {
      setMatchError('Gán thất bại, vui lòng thử lại')
    } finally {
      setMatchLoading(false)
    }
  }


  return (
    <ShipperLayout>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Chuyển khoản chưa khớp</h1>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">
            {total} giao dịch đang chờ — chọn đơn hàng của bạn để khớp
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors mt-0.5"
        >
          Làm mới
        </button>
      </div>

      {/* Transaction list */}
      <div className="px-4 space-y-3 pb-4">
        {loading ? (
          <div className="py-12 text-center text-gray-400 dark:text-gray-500 text-sm">Đang tải...</div>
        ) : txs.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 py-12 text-center text-gray-400 dark:text-gray-500 text-sm">
            Không có giao dịch chưa khớp
          </div>
        ) : (
          <>
            {txs.map(tx => (
              <div key={tx.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
                {/* Transaction info */}
                <div className="px-4 pt-4 pb-3">
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <span className="font-bold text-sm text-gray-900 dark:text-gray-100 font-mono break-all leading-tight">
                      {tx.transactionCode}
                    </span>
                    <span className="font-bold text-green-600 whitespace-nowrap text-sm flex-shrink-0">
                      {formatVND(tx.amount)}
                    </span>
                  </div>

                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">
                    {tx.gateway && <span className="text-gray-600 dark:text-gray-400">{tx.gateway} · </span>}
                    {fmtDateTime(tx.transactionDate)}
                  </p>

                  {tx.content && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-snug">{tx.content}</p>
                  )}
                </div>

                {/* Match section */}
                <div className="px-4 pb-4">
                  {matchingId === tx.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        autoFocus
                        value={orderInput}
                        onChange={e => { setOrderInput(e.target.value); setMatchError('') }}
                        onKeyDown={e => { if (e.key === 'Enter') handleConfirmMatch(tx.id) }}
                        placeholder="Nhập mã đơn hàng của bạn..."
                        className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {matchError && <p className="text-red-500 text-xs">{matchError}</p>}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleConfirmMatch(tx.id)}
                          disabled={matchLoading || !orderInput.trim()}
                          className="flex-1 bg-blue-600 text-white text-sm font-semibold py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors min-h-[48px]"
                        >
                          {matchLoading ? 'Đang xử lý...' : 'Xác nhận khớp'}
                        </button>
                        <button
                          onClick={handleCancelMatch}
                          className="flex-1 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors min-h-[48px]"
                        >
                          Huỷ
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleStartMatch(tx.id)}
                      className="w-full border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 min-h-[48px]"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      Khớp đơn hàng của tôi
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Load more */}
            {hasMore && (
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="w-full border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors min-h-[48px]"
              >
                {loadingMore ? 'Đang tải...' : `Xem thêm (còn ${total - txs.length})`}
              </button>
            )}
          </>
        )}
      </div>
    </ShipperLayout>
  )
}
