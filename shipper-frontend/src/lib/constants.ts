export const ORDER_STATUS_LABELS: Record<string, string> = {
  Unassigned: 'Chưa phân công',
  Pending: 'Chờ giao',
  WaitingTransfer: 'Chờ chuyển khoản',
  PaidCash: 'Đã thu tiền mặt',
  PaidTransfer: 'Đã chuyển khoản',
  Partial: 'Thu một phần',
  Scheduled: 'Hẹn lại',
  Unpaid: 'Chưa thu được',
}

export const ORDER_STATUS_COLORS: Record<string, string> = {
  Unassigned: 'bg-gray-100 text-gray-700',
  Pending: 'bg-blue-100 text-blue-700',
  WaitingTransfer: 'bg-yellow-100 text-yellow-700',
  PaidCash: 'bg-green-100 text-green-700',
  PaidTransfer: 'bg-emerald-100 text-emerald-700',
  Partial: 'bg-orange-100 text-orange-700',
  Scheduled: 'bg-purple-100 text-purple-700',
  Unpaid: 'bg-red-100 text-red-700',
}

export const ROLES: Record<string, string> = {
  Admin: 'Quản trị viên',
  Accountant: 'Kế toán',
  Shipper: 'Nhân viên giao hàng',
}
