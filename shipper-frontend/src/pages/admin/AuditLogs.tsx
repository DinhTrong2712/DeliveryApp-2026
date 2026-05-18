import { useState, useEffect, useCallback, useRef } from 'react'
import api from '../../lib/api'
import AdminLayout from '../../components/AdminLayout'

// ── Types ──────────────────────────────────────────────────────────────────
interface AuditLogRow {
  id: string
  performedBy: string
  username: string | null
  action: string
  entityType: string
  orderCode: string | null
  oldValue: string | null
  newValue: string | null
  description: string | null
  createdAt: string
}

// ── Action mapping ─────────────────────────────────────────────────────────
const ACTION_LABEL: Record<string, string> = {
  LOGIN: 'Đăng nhập',
  LOGIN_FAILED: 'Đăng nhập thất bại',
  LOGOUT: 'Đăng xuất',
  UPDATE_STATUS: 'Cập nhật trạng thái',
  DELIVERED: 'Đã giao hàng',
  AUTO_RECALC: 'Tính lại tự động',
  COLLECT_CASH: 'Thu tiền mặt',
  CREATE_ORDER: 'Tạo đơn hàng',
  DELETE_ORDER: 'Xóa đơn hàng',
  UPDATE_ORDER: 'Sửa đơn hàng',
  IMPORT: 'Nhập Excel',
  DELETE_ROUTE: 'Xóa đơn gộp',
  UPDATE_ROUTE: 'Cập nhật đơn gộp',
  MANUAL_MATCH: 'Khớp SePay thủ công',
  AUTO_MATCH: 'Khớp SePay tự động',
  UNMATCH: 'Bỏ khớp SePay',
  UPDATE_CONFIG: 'Cập nhật cấu hình',
  UPDATE_SEPAY_APIKEY: 'Cập nhật SePay API key',
  UPDATE_AI_KEY: 'Cập nhật AI key',
  NOTE_PHOTO: 'Thêm/xoá ảnh',
  OVERRIDE_FIELD: 'Ghi đè trường dữ liệu',
}

// Actions that get a solid badge (highlighted)
const BADGE_ACTIONS = new Set([
  'UPDATE_STATUS', 'COLLECT_CASH', 'IMPORT', 'DELETE_ROUTE',
  'UPDATE_ROUTE', 'MANUAL_MATCH', 'AUTO_MATCH', 'UNMATCH',
  'DELETE_ORDER', 'OVERRIDE_FIELD', 'LOGIN_FAILED',
])

const ACTION_OPTIONS = [
  { value: '', label: 'Tất cả thao tác' },
  { value: 'LOGIN', label: 'Đăng nhập' },
  { value: 'LOGIN_FAILED', label: 'Đăng nhập thất bại' },
  { value: 'LOGOUT', label: 'Đăng xuất' },
  { value: 'UPDATE_STATUS', label: 'Cập nhật trạng thái' },
  { value: 'COLLECT_CASH', label: 'Thu tiền mặt' },
  { value: 'DELIVERED', label: 'Đã giao hàng' },
  { value: 'UPDATE_ORDER', label: 'Sửa đơn hàng' },
  { value: 'OVERRIDE_FIELD', label: 'Ghi đè trường dữ liệu' },
  { value: 'IMPORT', label: 'Nhập Excel' },
  { value: 'DELETE_ROUTE', label: 'Xóa đơn gộp' },
  { value: 'UPDATE_ROUTE', label: 'Cập nhật đơn gộp' },
  { value: 'AUTO_MATCH', label: 'Khớp SePay tự động' },
  { value: 'MANUAL_MATCH', label: 'Khớp SePay thủ công' },
  { value: 'UNMATCH', label: 'Bỏ khớp SePay' },
  { value: 'NOTE_PHOTO', label: 'Thêm/xoá ảnh' },
  { value: 'UPDATE_CONFIG', label: 'Cập nhật cấu hình' },
]

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtDate = (s: string) => {
  const d = new Date(s)
  return d.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function ActionCell({ action }: { action: string }) {
  const label = ACTION_LABEL[action] ?? action
  if (BADGE_ACTIONS.has(action)) {
    return (
      <span className="inline-block bg-gray-900 text-white text-xs font-medium px-2.5 py-1 rounded-md whitespace-nowrap">
        {label}
      </span>
    )
  }
  return <span className="text-sm text-gray-700">{label}</span>
}

function ChangeCell({ oldVal, newVal }: { oldVal: string | null; newVal: string | null }) {
  if (!oldVal && !newVal) return <span className="text-gray-400">—</span>
  if (oldVal && newVal) {
    return (
      <span className="text-sm text-gray-700">
        <span className="text-gray-400">{oldVal}</span>
        <span className="text-gray-400 mx-1">→</span>
        <span className="font-medium">{newVal}</span>
      </span>
    )
  }
  return <span className="text-sm text-gray-700">{newVal ?? oldVal}</span>
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [showFilter, setShowFilter] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)
  const PAGE_SIZE = 20

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/admin/audit-logs', {
        params: { page, pageSize: PAGE_SIZE, search: search || undefined, action: actionFilter || undefined },
      })
      setLogs(res.data.items)
      setTotal(res.data.total)
    } finally {
      setLoading(false)
    }
  }, [page, search, actionFilter])

  useEffect(() => { fetchLogs() }, [fetchLogs])

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

  const handleActionFilter = (v: string) => {
    setActionFilter(v)
    setPage(1)
    setShowFilter(false)
  }

  const handleRefresh = () => {
    setSearch('')
    setSearchInput('')
    setActionFilter('')
    setPage(1)
    // State changes above will trigger useEffect → fetchLogs automatically
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const activeFilterLabel = ACTION_OPTIONS.find(o => o.value === actionFilter)?.label

  return (
    <AdminLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Lịch sử thao tác</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total.toLocaleString('vi-VN')} bản ghi</p>
        </div>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Làm mới
        </button>
      </div>

      {/* Search + Filter row */}
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
            placeholder="Tìm mã đơn hàng, tên người dùng..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
        </form>

        {/* Filter dropdown */}
        <div className="relative" ref={filterRef}>
          <button
            onClick={() => setShowFilter(v => !v)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium transition-colors ${
              actionFilter
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M7 8h10M10 12h4" />
            </svg>
            {actionFilter ? activeFilterLabel : 'Bộ lọc'}
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showFilter && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-30 py-1">
              {ACTION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleActionFilter(opt.value)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors ${
                    actionFilter === opt.value ? 'font-semibold text-gray-900' : 'text-gray-700'
                  }`}
                >
                  {opt.label}
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
              <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Thời gian</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Người thực hiện</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Đơn hàng</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Thao tác</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Thay đổi</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-16 text-gray-400">Đang tải...</td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-16 text-gray-400">Không có bản ghi</td>
              </tr>
            ) : logs.map((log, i) => (
              <tr
                key={log.id}
                className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  i === logs.length - 1 ? 'border-b-0' : ''
                }`}
              >
                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                  {fmtDate(log.createdAt)}
                </td>
                <td className="px-4 py-3">
                  {log.performedBy === 'Hệ thống' ? (
                    <span className="italic text-gray-400 text-sm">Hệ thống</span>
                  ) : (
                    <span className="font-bold text-gray-900 text-sm">{log.performedBy}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {log.orderCode ? (
                    <span className="font-mono text-sm italic text-gray-500">{log.orderCode}</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <ActionCell action={log.action} />
                </td>
                <td className="px-4 py-3">
                  <ChangeCell oldVal={log.oldValue} newVal={log.newValue} />
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {log.description ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
            <span className="text-xs text-gray-500">
              Trang {page}/{totalPages} — {total.toLocaleString('vi-VN')} bản ghi
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
    </AdminLayout>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────
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

function pageWindow(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total]
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
  return [1, '...', current - 1, current, current + 1, '...', total]
}
