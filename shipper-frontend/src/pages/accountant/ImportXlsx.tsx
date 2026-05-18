import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import { formatVND } from '../../lib/formatters'
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../lib/constants'

interface PreviewItem {
  orderCode: string
  routeCode?: string
  customerName: string
  shipperName?: string
  amount: number
  amountPaid: number
  status: string
  originNote?: string
}

interface ColMapping {
  field: string
  label: string
  column: number
  headerFound: string
  required: boolean
}

interface Preview {
  preview: PreviewItem[]
  summary: { total: number; matched: number; unmatched: number; totalAmount: number }
  warnings: string[]
  importId: string
  columnMappings: ColMapping[]
  headerRow: number
}

interface ImportResult {
  imported: number
  updated: number
  skipped: number
  items: PreviewItem[]
}

const HEADER_HINTS = [
  { label: 'Mã đơn hàng *', hint: '"Mã giao dịch", "Mã đơn", "Order Code"...' },
  { label: 'Tên khách hàng *', hint: '"Tên KH", "Khách hàng", "Customer"...' },
  { label: 'Số tiền *', hint: '"Số tiền", "Tiền COD", "Amount"...' },
  { label: 'Tên nhân viên', hint: '"Nhân viên", "Người giao", "Shipper"...' },
  { label: 'Mã GD gộp', hint: '"Mã tuyến", "Route Code"...' },
  { label: 'Diễn giải / Ghi chú', hint: '"Nội dung", "Note", "Mô tả"...' },
]

const Dash = () => <span className="text-gray-300">—</span>
const NotMatched = ({ text = 'Chưa phân công' }: { text?: string }) => (
  <span className="text-orange-500 text-xs">{text}</span>
)
const StatusPill = ({ status }: { status: string }) => (
  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${ORDER_STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-600'}`}>
    {ORDER_STATUS_LABELS[status] ?? status}
  </span>
)

function OrderRow({ item, unmatchedLabel }: { item: PreviewItem; unmatchedLabel: string }) {
  const remaining = item.amount - item.amountPaid
  return (
    <tr className="border-t border-gray-50 hover:bg-gray-50">
      <td className="px-4 py-2.5 font-mono text-xs text-gray-700">{item.orderCode}</td>
      <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{item.routeCode ?? '—'}</td>
      <td className="px-4 py-2.5 text-gray-800">{item.customerName}</td>
      <td className="px-4 py-2.5 text-gray-600">{item.shipperName ?? <NotMatched text={unmatchedLabel} />}</td>
      <td className="px-4 py-2.5 text-right font-medium text-gray-800">{formatVND(item.amount)}</td>
      <td className="px-4 py-2.5 text-right font-semibold text-green-600">
        {item.amountPaid > 0 ? formatVND(item.amountPaid) : <Dash />}
      </td>
      <td className="px-4 py-2.5 text-right font-semibold text-orange-500">
        {remaining > 0 ? formatVND(remaining) : <Dash />}
      </td>
      <td className="px-4 py-2.5"><StatusPill status={item.status} /></td>
      <td className="px-4 py-2.5 text-gray-500 text-xs max-w-[260px] truncate" title={item.originNote ?? ''}>
        {item.originNote ?? <Dash />}
      </td>
    </tr>
  )
}

function OrderTable({ items, unmatchedLabel, showFooter }: {
  items: PreviewItem[]; unmatchedLabel: string; showFooter: boolean
}) {
  const totalAmount = items.reduce((s, i) => s + i.amount, 0)
  const totalPaid = items.reduce((s, i) => s + i.amountPaid, 0)
  const totalRemaining = totalAmount - totalPaid

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr className="text-left">
            <th className="px-4 py-2 font-medium text-gray-500">Mã đơn</th>
            <th className="px-4 py-2 font-medium text-gray-500">Đơn gộp</th>
            <th className="px-4 py-2 font-medium text-gray-500">Khách hàng</th>
            <th className="px-4 py-2 font-medium text-gray-500">Nhân viên</th>
            <th className="px-4 py-2 font-medium text-gray-500 text-right">Tổng tiền</th>
            <th className="px-4 py-2 font-medium text-gray-500 text-right">Đã thu</th>
            <th className="px-4 py-2 font-medium text-gray-500 text-right">Còn lại</th>
            <th className="px-4 py-2 font-medium text-gray-500">Trạng thái</th>
            <th className="px-4 py-2 font-medium text-gray-500">Diễn giải</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => <OrderRow key={i} item={item} unmatchedLabel={unmatchedLabel} />)}
        </tbody>
        {showFooter && (
          <tfoot className="bg-gray-50 border-t border-gray-100">
            <tr>
              <td colSpan={4} className="px-4 py-2 text-xs text-gray-500 font-medium">Tổng cộng</td>
              <td className="px-4 py-2 text-right font-bold text-gray-800">{formatVND(totalAmount)}</td>
              <td className="px-4 py-2 text-right font-bold text-green-600">{formatVND(totalPaid)}</td>
              <td className="px-4 py-2 text-right font-bold text-orange-500">{formatVND(totalRemaining)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

export default function ImportXlsx() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState('')

  const reset = () => {
    setPreview(null)
    setResult(null)
    setError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setError('')
    setPreview(null)
    setResult(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.post('/import', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      setPreview(res.data)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Không thể đọc file. Kiểm tra định dạng .xlsx')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!preview) return
    setConfirming(true)
    setError('')
    try {
      const res = await api.post('/import/confirm', { importId: preview.importId })
      setResult(res.data)
      setPreview(null)
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Xác nhận thất bại')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white sticky top-0 z-10 border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <Link to="/accountant/dashboard" className="min-h-[48px] min-w-[48px] flex items-center justify-center text-gray-600">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="font-bold text-gray-900">Import đơn hàng (.xlsx)</h1>
      </div>

      <div className="px-4 pt-4 pb-8 space-y-4">

        {!preview && !result && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-sm text-gray-700 font-medium mb-1">Hệ thống tự động nhận dạng cột</p>
            <p className="text-xs text-gray-500 mb-2">File Excel cần có hàng tiêu đề. Các cột bắt buộc (<span className="text-red-500 font-bold">*</span>):</p>
            <div className="space-y-1 mb-3">
              {HEADER_HINTS.map(r => (
                <div key={r.label} className="flex items-baseline gap-2 text-xs">
                  <span className="text-gray-700 font-medium min-w-[130px]">{r.label}</span>
                  <span className="text-gray-400">{r.hint}</span>
                </div>
              ))}
            </div>
            <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleFile} />
            <button onClick={() => fileRef.current?.click()} disabled={loading}
              className="w-full border-2 border-dashed border-blue-300 rounded-xl py-8 text-blue-600 font-medium min-h-[48px] disabled:opacity-60 hover:bg-blue-50 transition-colors">
              {loading ? 'Đang phân tích...' : 'Chọn file .xlsx'}
            </button>
          </div>
        )}

        {error && <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}

        {result && (
          <>
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
              <p className="font-bold text-green-700 text-lg mb-1">Import thành công!</p>
              <div className="flex gap-4 text-sm flex-wrap">
                <span className="text-green-600">Mới: <strong>{result.imported}</strong> đơn</span>
                {result.updated > 0 && <span className="text-blue-600">Cập nhật NV: <strong>{result.updated}</strong> đơn</span>}
                {result.skipped > 0 && <span className="text-gray-500">Bỏ qua: <strong>{result.skipped}</strong> đơn</span>}
                <span className="text-green-600">
                  Tổng tiền: <strong>{formatVND(result.items.reduce((s, i) => s + i.amount, 0))}</strong>
                </span>
              </div>
            </div>

            {result.items.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <p className="font-semibold text-gray-900">Danh sách đơn đã import ({result.items.length})</p>
                  <Link to="/accountant/orders" className="text-blue-600 text-sm font-medium hover:underline">
                    Xem tất cả đơn →
                  </Link>
                </div>
                <OrderTable items={result.items} unmatchedLabel="Chưa phân công" showFooter />
              </div>
            )}

            <button onClick={reset}
              className="w-full border border-gray-300 text-gray-700 py-3 rounded-xl font-medium min-h-[48px] hover:bg-gray-50 transition-colors">
              Import file khác
            </button>
          </>
        )}

        {preview && (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="font-semibold text-gray-900 mb-2">Cột đã nhận dạng tự động</p>
              <p className="text-xs text-gray-400 mb-3">Header tìm thấy ở hàng {preview.headerRow} trong file Excel</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left border-b border-gray-100">
                      <th className="pb-1.5 font-medium text-gray-500">Trường</th>
                      <th className="pb-1.5 font-medium text-gray-500">Cột #</th>
                      <th className="pb-1.5 font-medium text-gray-500">Header trong file</th>
                      <th className="pb-1.5 font-medium text-gray-500">Bắt buộc</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.columnMappings.map(m => (
                      <tr key={m.field} className="border-t border-gray-50">
                        <td className="py-1.5 text-gray-700 font-medium">{m.label}</td>
                        <td className="py-1.5 text-gray-500 font-mono">{m.column}</td>
                        <td className="py-1.5 text-blue-700 font-mono">{m.headerFound || '—'}</td>
                        <td className="py-1.5">
                          {m.required ? <span className="text-red-500 font-bold">*</span> : <Dash />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="font-semibold text-gray-900 mb-3">Tóm tắt xem trước</p>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-2xl font-bold text-blue-700">{preview.summary.total}</p>
                  <p className="text-xs text-blue-600">Tổng đơn</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3">
                  <p className="text-2xl font-bold text-green-700">{preview.summary.matched}</p>
                  <p className="text-xs text-green-600">Đã khớp NV</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-3">
                  <p className="text-2xl font-bold text-orange-700">{preview.summary.unmatched}</p>
                  <p className="text-xs text-orange-600">Chưa khớp</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3">
                  <p className="text-lg font-bold text-emerald-700">{formatVND(preview.summary.totalAmount)}</p>
                  <p className="text-xs text-emerald-600">Tổng tiền</p>
                </div>
              </div>
            </div>

            {preview.warnings.length > 0 && (
              <div className="bg-yellow-50 rounded-2xl p-4">
                <p className="font-medium text-yellow-800 mb-2">⚠ Cảnh báo</p>
                {preview.warnings.map((w, i) => <p key={i} className="text-yellow-700 text-sm">{w}</p>)}
              </div>
            )}

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <p className="font-medium text-gray-900 px-4 pt-4 mb-2">
                Xem trước ({preview.preview.length} đơn)
              </p>
              <OrderTable items={preview.preview} unmatchedLabel="Chưa khớp" showFooter={false} />
            </div>

            <div className="flex gap-3">
              <button onClick={reset}
                className="flex-1 border border-gray-300 text-gray-700 py-3.5 rounded-xl font-medium min-h-[48px] hover:bg-gray-50 transition-colors">
                Huỷ
              </button>
              <button onClick={handleConfirm} disabled={confirming}
                className="flex-1 bg-blue-600 text-white py-3.5 rounded-xl font-medium min-h-[48px] disabled:opacity-60 hover:bg-blue-700 transition-colors">
                {confirming ? 'Đang import...' : `Xác nhận import ${preview.summary.total} đơn`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
