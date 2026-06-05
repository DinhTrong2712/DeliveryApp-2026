import { useState, useEffect } from 'react'
import api from '../../lib/api'
import { formatVND } from '../../lib/formatters'
import AccountantLayout from '../../components/AccountantLayout'

interface ShipperRow {
  shipperName: string
  totalOrders: number
  totalAmount: number
  cashAmount: number
  transferAmount: number
  waitingTransferCount: number
  unpaidAmount: number
  scheduledAmount: number
}

interface ReportData {
  totalOrders: number
  totalAmount: number
  cash: number
  transfer: number
  waitingTransferCount: number
  unpaidAmount: number
  scheduledAmount: number
  debt: number
  byShipper: ShipperRow[]
}

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n: number) => formatVND(n)
const dash = (n: number | undefined) =>
  !n ? <span className="text-gray-400 dark:text-gray-500">—</span> : <>{fmt(n)}</>
const dashCount = (n: number | undefined) =>
  !n ? <span className="text-gray-400 dark:text-gray-500">—</span> : <>{n}</>

export default function Reports() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchReport = async (d: string) => {
    setLoading(true)
    try {
      const res = await api.get('/reports/daily', { params: { date: d } })
      setData(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchReport(date) }, [date])

  const handleExport = async () => {
    const res = await api.get('/reports/daily/export', { params: { date }, responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `baocao_${date}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const totalCollected = (data?.cash ?? 0) + (data?.transfer ?? 0)
  const collectionRate = data?.totalAmount
    ? Math.round((totalCollected / data.totalAmount) * 100)
    : 0

  // Per-shipper totals (for footer row)
  const totals = data?.byShipper.reduce(
    (acc, s) => ({
      orders: acc.orders + s.totalOrders,
      totalAmount: acc.totalAmount + s.totalAmount,
      cash: acc.cash + s.cashAmount,
      transfer: acc.transfer + s.transferAmount,
      remaining: acc.remaining + (s.totalAmount - s.cashAmount - s.transferAmount),
      waitingCK: acc.waitingCK + s.waitingTransferCount,
      unpaid: acc.unpaid + s.unpaidAmount,
      scheduled: acc.scheduled + s.scheduledAmount,
    }),
    { orders: 0, totalAmount: 0, cash: 0, transfer: 0, remaining: 0, waitingCK: 0, unpaid: 0, scheduled: 0 }
  )

  const statCards = [
    {
      label: 'Tổng cần thu',
      value: fmt(data?.totalAmount ?? 0),
      sub: `${data?.totalOrders ?? 0} đơn hàng`,
      valueCls: 'text-gray-900 dark:text-gray-100',
      icon: (
        <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: 'Tiền mặt thu được',
      value: fmt(data?.cash ?? 0),
      sub: null,
      valueCls: 'text-green-600',
      icon: (
        <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
      ),
    },
    {
      label: 'Chuyển khoản',
      value: fmt(data?.transfer ?? 0),
      sub: data?.waitingTransferCount ? `${data.waitingTransferCount} đơn đang chờ khớp` : null,
      valueCls: 'text-blue-600',
      icon: (
        <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
    },
    {
      label: 'Chưa thu được',
      value: fmt(data?.unpaidAmount ?? 0),
      sub: 'Từ chối / thu một phần',
      valueCls: (data?.unpaidAmount ?? 0) > 0 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100',
      icon: (
        <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
        </svg>
      ),
    },
    {
      label: 'Nợ hẹn',
      value: fmt(data?.scheduledAmount ?? 0),
      sub: 'Khách hứa thanh toán sau',
      valueCls: (data?.scheduledAmount ?? 0) > 0 ? 'text-orange-600' : 'text-gray-900 dark:text-gray-100',
      icon: (
        <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
  ]

  return (
    <AccountantLayout>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Báo cáo ngày</h1>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
          <button
            onClick={() => fetchReport(date)}
            className="group p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:border-orange-400 dark:hover:border-orange-500/60 hover:text-orange-600 dark:hover:text-orange-400 hover:shadow-sm transition-all duration-200"
            title="Làm mới"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 group inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:border-orange-400 dark:hover:border-orange-500/60 hover:text-orange-600 dark:hover:text-orange-400 hover:shadow-sm active:scale-[0.98] transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Xuất Excel
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">Đang tải...</div>
      ) : !data ? null : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-5 gap-4 mb-4">
            {statCards.map((c, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500 dark:text-gray-500">{c.label}</span>
                  {c.icon}
                </div>
                <p className={`text-lg font-bold leading-tight ${c.valueCls}`}>{c.value}</p>
                {c.sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{c.sub}</p>}
              </div>
            ))}
          </div>

          {/* Summary line */}
          <div className="flex items-center gap-4 text-sm mb-5 px-1">
            <span className="text-gray-600 dark:text-gray-400">
              Tổng đã thu: <span className="font-semibold text-gray-900 dark:text-gray-100">{fmt(totalCollected)}</span>
            </span>
            <span className="text-gray-400 dark:text-gray-500">·</span>
            <span className="text-gray-600 dark:text-gray-400">
              Tỷ lệ: <span className="font-semibold text-gray-900 dark:text-gray-100">{collectionRate}%</span>
            </span>
            <span className="text-gray-400 dark:text-gray-500">·</span>
            <span className="text-gray-600 dark:text-gray-400">
              Tổng công nợ:{' '}
              <span className={`font-semibold ${(data.unpaidAmount + data.scheduledAmount) > 0 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100'}`}>
                {fmt(data.unpaidAmount + data.scheduledAmount)}
              </span>
            </span>
          </div>

          {/* Per-shipper table */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Chi tiết theo nhân viên</h2>
            </div>

            {data.byShipper.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-400 text-xs">
                      <th className="text-left px-4 py-2.5 font-medium">Nhân viên</th>
                      <th className="text-center px-3 py-2.5 font-medium">Đơn</th>
                      <th className="text-right px-3 py-2.5 font-medium">Tổng cần thu</th>
                      <th className="text-right px-3 py-2.5 font-medium">Tiền mặt</th>
                      <th className="text-right px-3 py-2.5 font-medium">Chuyển khoản</th>
                      <th className="text-right px-3 py-2.5 font-medium text-red-500">Còn lại</th>
                      <th className="text-center px-3 py-2.5 font-medium">Đang CK</th>
                      <th className="text-right px-3 py-2.5 font-medium text-red-500">Chưa thu</th>
                      <th className="text-right px-3 py-2.5 font-medium">Nợ</th>
                      <th className="px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.byShipper.map((s, i) => {
                      const remaining = s.totalAmount - s.cashAmount - s.transferAmount
                      return (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{s.shipperName}</td>
                          <td className="px-3 py-3 text-center text-gray-700 dark:text-gray-300">{s.totalOrders}</td>
                          <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">{fmt(s.totalAmount)}</td>
                          <td className="px-3 py-3 text-right text-green-600 font-medium">
                            {dash(s.cashAmount)}
                          </td>
                          <td className="px-3 py-3 text-right text-blue-600 font-medium">
                            {dash(s.transferAmount)}
                          </td>
                          <td className="px-3 py-3 text-right text-red-500 font-medium">
                            {remaining > 0 ? fmt(remaining) : <span className="text-gray-400 dark:text-gray-500">—</span>}
                          </td>
                          <td className="px-3 py-3 text-center text-gray-700 dark:text-gray-300">
                            {dashCount(s.waitingTransferCount)}
                          </td>
                          <td className="px-3 py-3 text-right text-red-500 font-medium">
                            {dash(s.unpaidAmount)}
                          </td>
                          <td className="px-3 py-3 text-right text-gray-600 dark:text-gray-400">
                            {dash(s.scheduledAmount)}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <button
                              onClick={async () => {
                                const res = await api.get('/reports/daily/export', {
                                  params: { date, shipper: s.shipperName },
                                  responseType: 'blob',
                                })
                                const url = URL.createObjectURL(res.data)
                                const a = document.createElement('a')
                                a.href = url
                                a.download = `baocao_${s.shipperName}_${date}.xlsx`
                                document.body.appendChild(a)
                                a.click()
                                document.body.removeChild(a)
                                URL.revokeObjectURL(url)
                              }}
                              className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                              title={`Xuất Excel — ${s.shipperName}`}
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      )
                    })}

                    {/* Total row */}
                    {totals && (
                      <tr className="border-t-2 border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 font-semibold text-sm">
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">Tổng cộng</td>
                        <td className="px-3 py-3 text-center text-gray-900 dark:text-gray-100">{totals.orders}</td>
                        <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">{fmt(totals.totalAmount)}</td>
                        <td className="px-3 py-3 text-right text-green-600">{fmt(totals.cash)}</td>
                        <td className="px-3 py-3 text-right text-blue-600">
                          {totals.transfer > 0 ? fmt(totals.transfer) : <span className="text-blue-400">{fmt(0)}</span>}
                        </td>
                        <td className="px-3 py-3 text-right text-red-500">{fmt(totals.remaining)}</td>
                        <td className="px-3 py-3 text-center text-gray-900 dark:text-gray-100">
                          {totals.waitingCK > 0 ? totals.waitingCK : <span className="text-gray-400 dark:text-gray-500">—</span>}
                        </td>
                        <td className="px-3 py-3 text-right text-red-500">
                          {totals.unpaid > 0 ? fmt(totals.unpaid) : <span className="text-red-400">{fmt(0)}</span>}
                        </td>
                        <td className="px-3 py-3 text-right text-gray-900 dark:text-gray-100">
                          {totals.scheduled > 0 ? fmt(totals.scheduled) : <span className="text-gray-400 dark:text-gray-500">{fmt(0)}</span>}
                        </td>
                        <td />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-gray-400 dark:text-gray-500 text-sm">Không có dữ liệu cho ngày này</div>
            )}
          </div>
        </>
      )}
    </AccountantLayout>
  )
}
