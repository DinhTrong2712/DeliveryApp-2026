import { ORDER_STATUS_COLORS, ORDER_STATUS_LABELS } from '../lib/constants'

interface Props {
  status: string
}

const STATUS_DOT: Record<string, string> = {
  Pending: 'bg-blue-500',
  WaitingTransfer: 'bg-yellow-400',
  PaidCash: 'bg-green-500',
  PaidTransfer: 'bg-emerald-500',
  Partial: 'bg-orange-400',
  Scheduled: 'bg-purple-400',
  Unpaid: 'bg-red-500',
  Unassigned: 'bg-gray-400',
}

export function StatusBadge({ status }: Props) {
  const label = ORDER_STATUS_LABELS[status] ?? status
  const color = ORDER_STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-700'
  const dot = STATUS_DOT[status] ?? 'bg-gray-400'
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot} flex-shrink-0`} />
      {label}
    </span>
  )
}
