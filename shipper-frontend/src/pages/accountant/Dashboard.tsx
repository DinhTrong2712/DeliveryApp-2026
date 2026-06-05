import { useState, useEffect, useCallback } from 'react'
import api from '../../lib/api'
import { formatVND } from '../../lib/formatters'
import { useSignalR } from '../../hooks/useSignalR'
import AccountantLayout from '../../components/AccountantLayout'

interface DashboardData {
  totalOrders: number
  paidFull: number
  waitingTransfer: number
  partial: number
  scheduled: number
  unpaid: number
  unmatchedSePay: number
  totalCashToCollect: number
  lastUpdated: string
}

interface ReportData {
  cash: number
  transfer: number
  debt: number
  byShipper: ShipperRow[]
}

interface ShipperRow {
  shipperName: string
  totalOrders: number
  cashAmount: number
  transferAmount: number
  unpaidCount: number
}

export default function AccountantDashboard() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  const todayStr = new Date().toISOString().split('T')[0]

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [d, r] = await Promise.all([
        api.get('/dashboard'),
        api.get('/reports/daily', { params: { date: todayStr } }),
      ])
      setDashboard(d.data)
      setReport(r.data)
    } finally {
      setLoading(false)
    }
  }, [todayStr])

  useEffect(() => { fetchData() }, [fetchData])

  useSignalR({
    OrderStatusUpdated: fetchData,
    SePayMatched: fetchData,
    UnmatchedTransaction: fetchData,
    ShiftEnded: fetchData,
  }, ['accountants'])

  const totalCollected = (report?.cash ?? 0) + (report?.transfer ?? 0)

  const statCards = [
    {
      label: 'Tiền mặt hôm nay',
      value: formatVND(report?.cash ?? 0),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      iconBg: 'bg-green-100 text-green-600',
      valueCls: 'text-green-700',
    },
    {
      label: 'Chuyển khoản hôm nay',
      value: formatVND(report?.transfer ?? 0),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
      iconBg: 'bg-blue-100 text-blue-600',
      valueCls: 'text-blue-700',
    },
    {
      label: 'Tổng thu hôm nay',
      value: formatVND(totalCollected),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      iconBg: 'bg-purple-100 text-purple-600',
      valueCls: 'text-purple-700',
    },
    {
      label: 'Tồn đọng',
      value: formatVND(report?.debt ?? 0),
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      iconBg: 'bg-red-100 text-red-600',
      valueCls: 'text-red-700',
    },
  ]

  const statusItems = dashboard ? [
    { label: 'Chờ chuyển khoản', count: dashboard.waitingTransfer, cls: 'bg-yellow-100 text-yellow-700' },
    { label: 'Thu một phần', count: dashboard.partial, cls: 'bg-orange-100 text-orange-700' },
    { label: 'Hẹn lại', count: dashboard.scheduled, cls: 'bg-purple-100 text-purple-700' },
    { label: 'Chưa thu được', count: dashboard.unpaid, cls: 'bg-red-100 text-red-700' },
    { label: 'SePay chưa khớp', count: dashboard.unmatchedSePay, cls: 'bg-pink-100 text-pink-700' },
  ] : []

  return (
    <AccountantLayout>
      {/* Page title */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Tổng quan</h1>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={fetchData}
          className="group inline-flex items-center gap-1.5 px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:border-orange-400 dark:hover:border-orange-500/60 hover:text-orange-600 dark:hover:text-orange-400 hover:shadow-sm active:scale-[0.98] transition-all duration-200"
        >
          <svg className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Làm mới
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">Đang tải...</div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {statCards.map((c, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-500 dark:text-gray-500">{c.label}</span>
                  <span className={`p-2 rounded-lg ${c.iconBg}`}>{c.icon}</span>
                </div>
                <p className={`text-xl font-bold ${c.valueCls}`}>{c.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-6">
            {/* Left: shipper breakdown */}
            <div className="col-span-2 space-y-4">
              {/* Status pills */}
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Trạng thái đơn hàng hôm nay</h2>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium">
                    Tổng: {dashboard?.totalOrders ?? 0}
                  </span>
                  <span className="px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-sm font-medium">
                    Đã thu: {dashboard?.paidFull ?? 0}
                  </span>
                  {statusItems.map((s, i) => (
                    <span key={i} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${s.cls}`}>
                      {s.label}: {s.count}
                    </span>
                  ))}
                </div>
              </div>

              {/* Per-shipper table */}
              <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Chi tiết theo nhân viên (hôm nay)</h2>
                </div>
                {report && report.byShipper.length > 0 ? (
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead>
                      <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
                        <th className="text-left px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">Nhân viên</th>
                        <th className="text-center px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">Đơn</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">Tiền mặt</th>
                        <th className="text-right px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">Chuyển khoản</th>
                        <th className="text-center px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">Chưa thu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byShipper.map((s, i) => (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800">
                          <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{s.shipperName}</td>
                          <td className="px-4 py-3 text-center text-gray-600 dark:text-gray-400">{s.totalOrders}</td>
                          <td className="px-4 py-3 text-right text-green-600 font-medium">{formatVND(s.cashAmount)}</td>
                          <td className="px-4 py-3 text-right text-blue-600 font-medium">{formatVND(s.transferAmount)}</td>
                          <td className="px-4 py-3 text-center">
                            {s.unpaidCount > 0 ? (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold">
                                {s.unpaidCount}
                              </span>
                            ) : (
                              <span className="text-gray-400 dark:text-gray-500">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-400 dark:text-gray-500 text-sm">Chưa có dữ liệu hôm nay</div>
                )}
              </div>
            </div>

            {/* Right: alert cards */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Cần xử lý</h2>

              {(dashboard?.unmatchedSePay ?? 0) > 0 && (
                <div className="bg-pink-50 border border-pink-200 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-8 h-8 bg-pink-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-pink-800">SePay chưa khớp</p>
                      <p className="text-xs text-pink-600">{dashboard?.unmatchedSePay} giao dịch</p>
                    </div>
                  </div>
                </div>
              )}

              {(dashboard?.waitingTransfer ?? 0) > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-yellow-800">Chờ chuyển khoản</p>
                      <p className="text-xs text-yellow-600">{dashboard?.waitingTransfer} đơn</p>
                    </div>
                  </div>
                </div>
              )}

              {(dashboard?.unpaid ?? 0) > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-red-800">Chưa thu được</p>
                      <p className="text-xs text-red-600">{dashboard?.unpaid} đơn</p>
                    </div>
                  </div>
                </div>
              )}

              {(dashboard?.unmatchedSePay ?? 0) === 0 && (dashboard?.waitingTransfer ?? 0) === 0 && (dashboard?.unpaid ?? 0) === 0 && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-green-800">Tất cả ổn</p>
                      <p className="text-xs text-green-600">Không có vấn đề cần xử lý</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary card */}
              <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 mt-4">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-3">Tổng đơn</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Tổng đơn</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{dashboard?.totalOrders ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Đã thanh toán</span>
                    <span className="font-semibold text-green-600">{dashboard?.paidFull ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Thu một phần</span>
                    <span className="font-semibold text-orange-600">{dashboard?.partial ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Hẹn lại</span>
                    <span className="font-semibold text-purple-600">{dashboard?.scheduled ?? 0}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </AccountantLayout>
  )
}
