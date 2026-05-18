import { useState, useEffect, useCallback } from 'react'
import AdminLayout from '../../components/AdminLayout'
import api from '../../lib/api'

// ── Types ──────────────────────────────────────────────────────────────────
interface Stats {
  unmatched: number
  autoMatched: number
  manualMatched: number
}

interface TxRow {
  id: string
  transactionCode: string
  amount: number
  content: string | null
  gateway: string | null
  transactionDate: string
  matchStatus: string
  matchedBy: string | null
  matchedAt: string | null
  orderId: string | null
  orderCode: string | null
}

interface WebhookLogRow {
  id: string
  responseCode: string | null
  errorMessage: string | null
  createdAt: string
  rawBodyPreview: string | null
}

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  n.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })

const fmtDate = (s: string) => {
  const d = new Date(s)
  return d.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const STATUS_LABEL: Record<string, string> = {
  Unmatched: 'Chưa khớp',
  AutoMatched: 'Tự động',
  ManualMatched: 'Thủ công',
}

const STATUS_BADGE: Record<string, string> = {
  Unmatched: 'bg-red-100 text-red-700',
  AutoMatched: 'bg-green-100 text-green-700',
  ManualMatched: 'bg-blue-100 text-blue-700',
}

const FILTER_OPTIONS = [
  { value: '', label: 'Tất cả' },
  { value: 'Unmatched', label: 'Chưa khớp' },
  { value: 'AutoMatched', label: 'Tự động' },
  { value: 'ManualMatched', label: 'Thủ công' },
]

// ── Main Component ─────────────────────────────────────────────────────────
export default function SePayPage() {
  const [tab, setTab] = useState<'transactions' | 'webhooks'>('transactions')

  // Stats
  const [stats, setStats] = useState<Stats>({ unmatched: 0, autoMatched: 0, manualMatched: 0 })

  // Transactions
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [txPage, setTxPage] = useState(1)
  const [txRows, setTxRows] = useState<TxRow[]>([])
  const [txTotal, setTxTotal] = useState(0)
  const [txLoading, setTxLoading] = useState(false)

  // Webhook logs
  const [wPage, setWPage] = useState(1)
  const [wRows, setWRows] = useState<WebhookLogRow[]>([])
  const [wTotal, setWTotal] = useState(0)
  const [wLoading, setWLoading] = useState(false)

  // Manual match modal
  const [matchingTx, setMatchingTx] = useState<TxRow | null>(null)
  const [orderCodeInput, setOrderCodeInput] = useState('')
  const [matchError, setMatchError] = useState('')
  const [matchLoading, setMatchLoading] = useState(false)

  const PAGE_SIZE = 20

  const fetchStats = useCallback(async () => {
    try {
      const r = await api.get('/sepay/stats')
      setStats(r.data)
    } catch { /* ignore */ }
  }, [])

  const fetchTransactions = useCallback(async () => {
    setTxLoading(true)
    try {
      const r = await api.get('/sepay/transactions', {
        params: { page: txPage, pageSize: PAGE_SIZE, status: statusFilter || undefined, search: search || undefined },
      })
      setTxRows(r.data.items)
      setTxTotal(r.data.total)
    } catch { /* ignore */ }
    setTxLoading(false)
  }, [txPage, statusFilter, search])

  const fetchWebhookLogs = useCallback(async () => {
    setWLoading(true)
    try {
      const r = await api.get('/sepay/webhook-logs', { params: { page: wPage, pageSize: PAGE_SIZE } })
      setWRows(r.data.items)
      setWTotal(r.data.total)
    } catch { /* ignore */ }
    setWLoading(false)
  }, [wPage])

  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => { if (tab === 'transactions') fetchTransactions() }, [tab, fetchTransactions])
  useEffect(() => { if (tab === 'webhooks') fetchWebhookLogs() }, [tab, fetchWebhookLogs])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
    setTxPage(1)
  }

  const handleStatusFilter = (v: string) => {
    setStatusFilter(v)
    setTxPage(1)
  }

  const openMatch = (tx: TxRow) => {
    setMatchingTx(tx)
    setOrderCodeInput('')
    setMatchError('')
  }

  const handleUnmatch = async (txId: string) => {
    if (!confirm('Bỏ khớp giao dịch này? Đơn hàng sẽ trở về trạng thái Chờ CK.')) return
    try {
      await api.delete(`/sepay/transactions/${txId}/match`)
      fetchStats()
      fetchTransactions()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Lỗi khi bỏ khớp')
    }
  }

  const handleManualMatch = async () => {
    if (!matchingTx || !orderCodeInput.trim()) return
    setMatchLoading(true)
    setMatchError('')
    try {
      // First resolve order code → id
      const r1 = await api.get('/orders', {
        params: { search: orderCodeInput.trim(), pageSize: 1 },
      })
      const items = r1.data.items ?? []
      const order = items.find((o: { orderCode: string }) =>
        o.orderCode.toLowerCase() === orderCodeInput.trim().toLowerCase()
      )
      if (!order) {
        setMatchError('Không tìm thấy đơn hàng với mã này')
        setMatchLoading(false)
        return
      }

      await api.post('/sepay/assign', { transactionId: matchingTx.id, orderId: order.id })
      setMatchingTx(null)
      fetchStats()
      fetchTransactions()
    } catch (e: unknown) {
      setMatchError(e instanceof Error ? e.message : 'Lỗi không xác định')
    }
    setMatchLoading(false)
  }

  const txPages = Math.max(1, Math.ceil(txTotal / PAGE_SIZE))
  const wPages = Math.max(1, Math.ceil(wTotal / PAGE_SIZE))

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">SePay</h1>
        <p className="text-sm text-gray-500 mt-0.5">Quản lý giao dịch ngân hàng & đối soát đơn hàng</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard
          label="Chưa khớp"
          value={stats.unmatched}
          color="red"
          onClick={() => { handleStatusFilter('Unmatched'); setTab('transactions') }}
        />
        <StatCard
          label="Tự động khớp"
          value={stats.autoMatched}
          color="green"
          onClick={() => { handleStatusFilter('AutoMatched'); setTab('transactions') }}
        />
        <StatCard
          label="Khớp thủ công"
          value={stats.manualMatched}
          color="blue"
          onClick={() => { handleStatusFilter('ManualMatched'); setTab('transactions') }}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4">
        <div className="flex gap-6">
          {(['transactions', 'webhooks'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'transactions' ? 'Giao dịch' : 'Webhook logs'}
            </button>
          ))}
        </div>
      </div>

      {/* Transactions tab */}
      {tab === 'transactions' && (
        <>
          {/* Filter row */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleStatusFilter(opt.value)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    statusFilter === opt.value
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <form onSubmit={handleSearchSubmit} className="flex gap-2 flex-1 max-w-sm">
              <input
                type="text"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Tìm mã GD, nội dung, mã đơn..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
              <button
                type="submit"
                className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-700"
              >
                Tìm
              </button>
              {search && (
                <button
                  type="button"
                  onClick={() => { setSearch(''); setSearchInput(''); setTxPage(1) }}
                  className="text-gray-500 hover:text-gray-700 text-sm"
                >
                  Xóa
                </button>
              )}
            </form>
            <span className="text-sm text-gray-500 ml-auto">{txTotal} giao dịch</span>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Mã giao dịch</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Số tiền</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Nội dung</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Đơn hàng</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Trạng thái</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Thời gian</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {txLoading ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">Đang tải...</td></tr>
                ) : txRows.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">Không có giao dịch</td></tr>
                ) : txRows.map((tx, i) => (
                  <tr key={tx.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i % 2 === 1 ? 'bg-gray-50/30' : ''}`}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{tx.transactionCode}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(tx.amount)}</td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs">
                      <span className="line-clamp-2 text-xs">{tx.content ?? '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      {tx.orderCode ? (
                        <span className="font-medium text-gray-800">{tx.orderCode}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[tx.matchStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABEL[tx.matchStatus] ?? tx.matchStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(tx.transactionDate)}</td>
                    <td className="px-4 py-3">
                      {tx.matchStatus === 'Unmatched' && (
                        <button
                          onClick={() => openMatch(tx)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap"
                        >
                          Ghép đôi
                        </button>
                      )}
                      {tx.matchStatus !== 'Unmatched' && (
                        <button
                          onClick={() => handleUnmatch(tx.id)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium whitespace-nowrap"
                        >
                          Bỏ khớp
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {txPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                <span className="text-xs text-gray-500">
                  Trang {txPage}/{txPages} — {txTotal} kết quả
                </span>
                <div className="flex gap-1">
                  <PageBtn label="←" disabled={txPage <= 1} onClick={() => setTxPage(p => p - 1)} />
                  {Array.from({ length: Math.min(5, txPages) }, (_, i) => {
                    const p = txPage <= 3 ? i + 1 : txPage + i - 2
                    if (p < 1 || p > txPages) return null
                    return (
                      <PageBtn key={p} label={String(p)} active={p === txPage} onClick={() => setTxPage(p)} />
                    )
                  })}
                  <PageBtn label="→" disabled={txPage >= txPages} onClick={() => setTxPage(p => p + 1)} />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Webhook logs tab */}
      {tab === 'webhooks' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
            <span className="text-sm font-semibold text-gray-700">Webhook logs</span>
            <span className="text-xs text-gray-500">{wTotal} bản ghi</span>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Thời gian</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Mã phản hồi</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Lỗi</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Nội dung (preview)</th>
              </tr>
            </thead>
            <tbody>
              {wLoading ? (
                <tr><td colSpan={4} className="text-center py-12 text-gray-400">Đang tải...</td></tr>
              ) : wRows.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-12 text-gray-400">Chưa có webhook log</td></tr>
              ) : wRows.map(log => (
                <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(log.createdAt)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      log.responseCode === '00' ? 'bg-green-100 text-green-700' :
                      log.responseCode === '02' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {log.responseCode ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-red-600">{log.errorMessage ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono max-w-md">
                    <span className="line-clamp-2">{log.rawBodyPreview ?? '—'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {wPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
              <span className="text-xs text-gray-500">Trang {wPage}/{wPages}</span>
              <div className="flex gap-1">
                <PageBtn label="←" disabled={wPage <= 1} onClick={() => setWPage(p => p - 1)} />
                <PageBtn label="→" disabled={wPage >= wPages} onClick={() => setWPage(p => p + 1)} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Manual match modal */}
      {matchingTx && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Ghép đôi thủ công</h2>
            <p className="text-sm text-gray-500 mb-4">
              Giao dịch: <span className="font-mono text-gray-700">{matchingTx.transactionCode}</span>
              {' — '}<span className="font-semibold text-gray-900">{fmt(matchingTx.amount)}</span>
            </p>
            {matchingTx.content && (
              <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 mb-4 font-mono break-all">
                {matchingTx.content}
              </p>
            )}

            <label className="block text-sm font-medium text-gray-700 mb-1">Mã đơn hàng</label>
            <input
              type="text"
              value={orderCodeInput}
              onChange={e => setOrderCodeInput(e.target.value.toUpperCase())}
              placeholder="BH..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 mb-3"
              onKeyDown={e => e.key === 'Enter' && handleManualMatch()}
            />
            {matchError && <p className="text-sm text-red-500 mb-3">{matchError}</p>}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setMatchingTx(null)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                onClick={handleManualMatch}
                disabled={matchLoading || !orderCodeInput.trim()}
                className="px-4 py-2 text-sm rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-700 disabled:opacity-50"
              >
                {matchLoading ? 'Đang ghép...' : 'Xác nhận ghép'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────
function StatCard({
  label, value, color, onClick,
}: {
  label: string
  value: number
  color: 'red' | 'green' | 'blue'
  onClick?: () => void
}) {
  const colors = {
    red: 'border-red-100 bg-red-50 text-red-700',
    green: 'border-green-100 bg-green-50 text-green-700',
    blue: 'border-blue-100 bg-blue-50 text-blue-700',
  }
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border p-4 text-left w-full hover:shadow-sm transition-shadow ${colors[color]}`}
    >
      <p className="text-sm font-medium mb-1">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
    </button>
  )
}

function PageBtn({
  label, disabled, active, onClick,
}: {
  label: string
  disabled?: boolean
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
        active
          ? 'bg-gray-900 text-white'
          : disabled
          ? 'text-gray-300 cursor-not-allowed'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {label}
    </button>
  )
}
