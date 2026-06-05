import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../../lib/api'
import { formatVND, formatDateOnly, formatDate } from '../../lib/formatters'
import AdminLayout from '../../components/AdminLayout'
import { useAuthStore } from '../../stores/authStore'
import { StatusBadge } from '../../components/StatusBadge'

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Mới nhất' },
  { value: 'amount_asc', label: 'Tiền: ít → nhiều' },
  { value: 'amount_desc', label: 'Tiền: nhiều → ít' },
]

interface RouteSummary {
  routeCode: string
  orderDate: string
  shipperId?: string
  shipperName?: string
  customerCount: number
  totalAmount: number
  totalPaid: number
}

interface RouteOrder {
  id: string
  orderCode: string
  customerName: string
  amount: number
  amountPaid: number
  status: string
  shipperName?: string | null
  unpaidReason?: string | null
  scheduledDate?: string | null
  deliveredAt?: string | null
  shipperNote?: string | null
  createdAt: string
}

interface RouteDetail {
  routeCode: string
  customerCount: number
  totalAmount: number
  totalPaid: number
  items: RouteOrder[]
}

interface Shipper {
  id: string
  fullName: string
}

const today = () => new Date().toISOString().slice(0, 10)
const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const svgProps = { fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' } as const

const IconSearch = () => (
  <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" {...svgProps}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
)

const IconEdit = () => (
  <svg className="w-4 h-4" {...svgProps}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
)

const IconTrash = () => (
  <svg className="w-4 h-4" {...svgProps}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const IconX = () => (
  <svg className="w-5 h-5" {...svgProps}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const IconWarning = () => (
  <svg className="w-5 h-5 text-red-600" {...svgProps}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

function Modal({ onClose, maxWidth = 'max-w-sm', children, closeOnBackdrop = false }: {
  onClose: () => void; maxWidth?: string; children: React.ReactNode; closeOnBackdrop?: boolean
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        className={`bg-white dark:bg-gray-900 rounded-2xl w-full ${maxWidth} shadow-xl ${maxWidth === 'max-w-5xl' ? 'max-h-[90vh] flex flex-col' : ''}`}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

export default function RouteManagement() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'Admin'

  const [routes, setRoutes] = useState<RouteSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const [from, setFrom] = useState(daysAgo(30))
  const [to, setTo] = useState(today())
  const [search, setSearch] = useState('')
  const [allDates, setAllDates] = useState(true)
  const [sort, setSort] = useState('')
  const [showSort, setShowSort] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setShowSort(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const [detail, setDetail] = useState<RouteDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [editRoute, setEditRoute] = useState<RouteSummary | null>(null)
  const [shippers, setShippers] = useState<Shipper[]>([])
  const [selectedShipper, setSelectedShipper] = useState<string>('')
  const [saving, setSaving] = useState(false)

  const [deleteRoute, setDeleteRoute] = useState<RouteSummary | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [error, setError] = useState('')

  const fetchRoutes = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params: Record<string, string> = { search }
      if (!allDates) { params.from = from; params.to = to }
      const res = await api.get('/routes', { params })
      setRoutes(res.data.items)
      setTotal(res.data.total)
    } catch {
      setError('Không thể tải dữ liệu')
    } finally {
      setLoading(false)
    }
  }, [from, to, search, allDates])

  useEffect(() => { fetchRoutes() }, [fetchRoutes])

  const openEdit = async (r: RouteSummary) => {
    setEditRoute(r)
    setSelectedShipper(r.shipperId ?? '')
    if (shippers.length === 0) {
      const res = await api.get('/admin/users')
      setShippers((res.data as { id: string; fullName: string; role: string }[])
        .filter(u => u.role === 'Shipper'))
    }
  }

  const handleSaveEdit = async () => {
    if (!editRoute) return
    setSaving(true)
    try {
      await api.put(`/routes/${encodeURIComponent(editRoute.routeCode)}`, { shipperId: selectedShipper || null })
      await fetchRoutes()
      setEditRoute(null)
    } catch {
      setError('Không thể cập nhật nhân viên')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteRoute) return
    setDeleting(true)
    try {
      await api.delete(`/routes/${encodeURIComponent(deleteRoute.routeCode)}`)
      await fetchRoutes()
      setDeleteRoute(null)
    } catch {
      setError('Không thể xoá đơn gộp')
    } finally {
      setDeleting(false)
    }
  }

  const openDetail = async (routeCode: string) => {
    setLoadingDetail(true)
    setDetail({ routeCode, customerCount: 0, totalAmount: 0, totalPaid: 0, items: [] })
    try {
      const res = await api.get(`/routes/${encodeURIComponent(routeCode)}`)
      setDetail(res.data)
    } catch {
      setError('Không thể tải chi tiết đơn gộp')
      setDetail(null)
    } finally {
      setLoadingDetail(false)
    }
  }

  const NotAssigned = () => <span className="text-orange-500 text-xs">Chưa phân công</span>

  const sortedRoutes = [...routes].sort((a, b) => {
    if (sort === 'amount_asc') return a.totalAmount - b.totalAmount
    if (sort === 'amount_desc') return b.totalAmount - a.totalAmount
    return 0
  })

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-semibold text-gray-900 dark:text-gray-100 text-xl">Quản lý đơn gộp</h1>
        <span className="text-sm text-gray-500 dark:text-gray-500">{total} đơn gộp</span>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-3 mb-4 flex flex-wrap items-center gap-3">
        {!allDates && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-500">Từ</span>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-500">Đến</span>
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
            </div>
          </>
        )}

        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <IconSearch />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm mã đơn gộp..."
            className="flex-1 text-sm focus:outline-none text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500" />
        </div>

        <button onClick={() => setAllDates(v => !v)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
            allDates ? 'bg-gray-900 text-white border-gray-900' : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}>
          Tất cả ngày
        </button>

        <div className="relative" ref={sortRef}>
          <button
            onClick={() => setShowSort(v => !v)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              sort ? 'bg-gray-900 text-white border-gray-900' : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
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
                  onClick={() => { setSort(opt.value); setShowSort(false) }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                    sort === opt.value ? 'font-semibold text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-left">
              <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-500">Mã đơn gộp</th>
              <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-500">Ngày đơn hàng</th>
              <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-500">Nhân viên</th>
              <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-500 text-center">Số KH</th>
              <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-500 text-right">Tổng cần thu</th>
              <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-500 text-right">Đã thu</th>
              <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-500" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400 dark:text-gray-500">Đang tải...</td></tr>
            ) : sortedRoutes.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400 dark:text-gray-500">Không có đơn gộp</td></tr>
            ) : sortedRoutes.map(r => (
              <tr key={r.routeCode} onClick={() => openDetail(r.routeCode)}
                className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer">
                <td className="px-5 py-3.5 font-semibold text-gray-800 dark:text-gray-200">{r.routeCode}</td>
                <td className="px-5 py-3.5 text-gray-500 dark:text-gray-500">{formatDateOnly(r.orderDate)}</td>
                <td className="px-5 py-3.5 text-gray-700 dark:text-gray-300">{r.shipperName ?? <NotAssigned />}</td>
                <td className="px-5 py-3.5 text-center text-gray-700 dark:text-gray-300">{r.customerCount}</td>
                <td className="px-5 py-3.5 text-right text-gray-800 dark:text-gray-200">{formatVND(r.totalAmount)}</td>
                <td className="px-5 py-3.5 text-right font-medium text-green-600">{formatVND(r.totalPaid)}</td>
                <td className="px-5 py-3.5" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => openEdit(r)} title="Sửa nhân viên"
                      className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
                      <IconEdit />
                    </button>
                    {isAdmin && (
                      <button onClick={() => setDeleteRoute(r)} title="Xoá đơn gộp"
                        className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-600 transition-colors rounded-md hover:bg-red-50">
                        <IconTrash />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>

          {sortedRoutes.length > 0 && !loading && (
            <tfoot className="border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
              <tr>
                <td colSpan={4} className="px-5 py-3 text-sm font-medium text-gray-600 dark:text-gray-400">Tổng ({total} đơn gộp)</td>
                <td className="px-5 py-3 text-right font-semibold text-gray-800 dark:text-gray-200">
                  {formatVND(sortedRoutes.reduce((s, r) => s + r.totalAmount, 0))}
                </td>
                <td className="px-5 py-3 text-right font-semibold text-green-600">
                  {formatVND(sortedRoutes.reduce((s, r) => s + r.totalPaid, 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {editRoute && (
        <Modal onClose={() => setEditRoute(null)}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Đổi nhân viên</h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{editRoute.routeCode} · {editRoute.customerCount} KH</p>
            </div>
            <button onClick={() => setEditRoute(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <IconX />
            </button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nhân viên giao hàng</label>
              <select value={selectedShipper} onChange={e => setSelectedShipper(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="">— Chưa phân công —</option>
                {shippers.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setEditRoute(null)}
                className="flex-1 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Huỷ
              </button>
              <button onClick={handleSaveEdit} disabled={saving}
                className="flex-1 bg-gray-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-60">
                {saving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {detail && (
        <Modal onClose={() => setDetail(null)} maxWidth="max-w-5xl" closeOnBackdrop>
          <div className="flex items-start justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-lg">Chi tiết đơn gộp</h2>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">
                <span className="font-mono font-medium text-gray-800 dark:text-gray-200">{detail.routeCode}</span>
                {!loadingDetail && detail.items.length > 0 && (
                  <>
                    <span className="mx-2 text-gray-300 dark:text-gray-600">·</span>
                    <span>{detail.customerCount} đơn hàng</span>
                    <span className="mx-2 text-gray-300 dark:text-gray-600">·</span>
                    <span>Cần thu <span className="font-medium text-gray-800 dark:text-gray-200">{formatVND(detail.totalAmount)}</span></span>
                    <span className="mx-2 text-gray-300 dark:text-gray-600">·</span>
                    <span>Đã thu <span className="font-medium text-green-600">{formatVND(detail.totalPaid)}</span></span>
                  </>
                )}
              </p>
            </div>
            <button onClick={() => setDetail(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
              <IconX />
            </button>
          </div>

          <div className="overflow-auto flex-1">
            {loadingDetail ? (
              <div className="px-6 py-16 text-center text-gray-400 dark:text-gray-500 text-sm">Đang tải...</div>
            ) : detail.items.length === 0 ? (
              <div className="px-6 py-16 text-center text-gray-400 dark:text-gray-500 text-sm">Không có đơn hàng nào</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-950 sticky top-0">
                  <tr className="border-b border-gray-100 dark:border-gray-800 text-left">
                    <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-500">Mã đơn</th>
                    <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-500">Khách hàng</th>
                    <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-500">Trạng thái</th>
                    <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-500">Nhân viên</th>
                    <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-500 text-right">Cần thu</th>
                    <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-500 text-right">Đã thu</th>
                    <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-500">Giao lúc</th>
                    <th className="px-5 py-3 font-medium text-gray-500 dark:text-gray-500">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map(o => (
                    <tr key={o.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-5 py-3 font-mono text-xs text-gray-800 dark:text-gray-200">{o.orderCode}</td>
                      <td className="px-5 py-3 text-gray-700 dark:text-gray-300">{o.customerName}</td>
                      <td className="px-5 py-3"><StatusBadge status={o.status} /></td>
                      <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{o.shipperName ?? <NotAssigned />}</td>
                      <td className="px-5 py-3 text-right text-gray-800 dark:text-gray-200">{formatVND(o.amount)}</td>
                      <td className="px-5 py-3 text-right font-medium text-green-600">{formatVND(o.amountPaid)}</td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-500 text-xs">{o.deliveredAt ? formatDate(o.deliveredAt) : '—'}</td>
                      <td className="px-5 py-3 text-gray-500 dark:text-gray-500 text-xs max-w-[200px] truncate" title={o.shipperNote ?? o.unpaidReason ?? ''}>
                        {o.shipperNote ?? o.unpaidReason ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 flex justify-end">
            <button onClick={() => setDetail(null)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800">
              Đóng
            </button>
          </div>
        </Modal>
      )}

      {deleteRoute && (
        <Modal onClose={() => setDeleteRoute(null)}>
          <div className="px-6 py-5">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <IconWarning />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">Xoá đơn gộp?</h2>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                  Toàn bộ <strong>{deleteRoute.customerCount}</strong> đơn hàng trong <strong>{deleteRoute.routeCode}</strong> sẽ bị xoá vĩnh viễn.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteRoute(null)}
                className="flex-1 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Huỷ
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-60">
                {deleting ? 'Đang xoá...' : 'Xoá'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </AdminLayout>
  )
}
