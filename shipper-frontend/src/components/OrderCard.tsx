import { Link } from 'react-router-dom'
import { formatVND } from '../lib/formatters'
import { StatusBadge } from './StatusBadge'

interface Order {
  id: string
  orderCode: string
  customerName: string
  amount: number
  amountRemaining: number
  status: string
  shipperName?: string
}

interface Props {
  order: Order
  basePath: string
}

const STATUS_BORDER: Record<string, string> = {
  Pending: 'border-l-blue-500',
  WaitingTransfer: 'border-l-yellow-400',
  PaidCash: 'border-l-green-500',
  PaidTransfer: 'border-l-emerald-500',
  Partial: 'border-l-orange-400',
  Scheduled: 'border-l-purple-400',
  Unpaid: 'border-l-red-500',
  Unassigned: 'border-l-gray-300',
}

export function OrderCard({ order, basePath }: Props) {
  const borderColor = STATUS_BORDER[order.status] ?? 'border-l-gray-300'
  const isPaid = ['PaidCash', 'PaidTransfer'].includes(order.status)

  return (
    <Link to={`${basePath}/${order.id}`}>
      <div
        className={`bg-white rounded-xl shadow-sm border border-gray-100 border-l-4 ${borderColor} p-4 mb-3 active:bg-gray-50 transition-colors flex items-center gap-3`}
      >
        <div className="flex-1 min-w-0">
          {/* Order code + status badge */}
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="font-bold text-gray-900 text-sm">{order.orderCode}</span>
            <StatusBadge status={order.status} />
          </div>
          <p className="text-gray-500 text-sm truncate">{order.customerName}</p>

          {/* Amounts */}
          <div className="flex items-center gap-4 mt-2">
            <div>
              <p className="text-xs text-gray-400">Tổng tiền</p>
              <p className="text-sm font-semibold text-gray-800">{formatVND(order.amount)}</p>
            </div>
            {order.amountRemaining > 0 && !isPaid && (
              <div>
                <p className="text-xs text-gray-400">Còn lại</p>
                <p className="text-sm font-semibold text-red-600">{formatVND(order.amountRemaining)}</p>
              </div>
            )}
            {isPaid && (
              <div>
                <p className="text-xs text-gray-400">Thanh toán</p>
                <p className="text-sm font-semibold text-green-600">Đã thu</p>
              </div>
            )}
          </div>

          {order.shipperName && (
            <p className="text-xs text-gray-400 mt-1.5 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {order.shipperName}
            </p>
          )}
        </div>

        {/* Chevron */}
        <svg className="w-4 h-4 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  )
}
