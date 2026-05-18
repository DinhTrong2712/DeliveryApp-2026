import { useState, useEffect } from 'react'
import api from '../../lib/api'
import { ROLES } from '../../lib/constants'
import AdminLayout from '../../components/AdminLayout'

interface User {
  id: string
  username: string
  fullName: string
  role: string
  xlsxName?: string
  isActive: boolean
}

const ROLE_BADGE: Record<string, string> = {
  Admin: 'bg-gray-100 text-gray-700 border border-gray-300',
  Accountant: 'bg-green-100 text-green-700',
  Shipper: 'bg-orange-100 text-orange-700',
}

function Toggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
        active ? 'bg-gray-800' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          active ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [form, setForm] = useState({ username: '', password: '', fullName: '', role: 'Shipper', xlsxName: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toggleError, setToggleError] = useState('')

  const fetchUsers = () => api.get('/admin/users').then(r => setUsers(r.data)).catch(() => {})
  useEffect(() => { fetchUsers() }, [])

  const openAdd = () => {
    setEditUser(null)
    setForm({ username: '', password: '', fullName: '', role: 'Shipper', xlsxName: '' })
    setError('')
    setShowForm(true)
  }

  const openEdit = (u: User) => {
    setEditUser(u)
    setForm({ username: u.username, password: '', fullName: u.fullName, role: u.role, xlsxName: u.xlsxName ?? '' })
    setError('')
    setShowForm(true)
  }

  const handleClose = () => {
    setShowForm(false)
    setEditUser(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editUser) {
        await api.put(`/admin/users/${editUser.id}`, {
          fullName: form.fullName,
          role: form.role,
          xlsxName: form.xlsxName || undefined,
          password: form.password || undefined,
        })
      } else {
        await api.post('/admin/users', {
          username: form.username,
          password: form.password,
          fullName: form.fullName,
          role: form.role,
          xlsxName: form.xlsxName || undefined,
        })
      }
      await fetchUsers()
      handleClose()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } }
      setError(axiosErr.response?.data?.message ?? 'Lỗi khi lưu')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (id: string) => {
    setToggleError('')
    try {
      await api.patch(`/admin/users/${id}/toggle-active`)
      await fetchUsers()
    } catch {
      setToggleError('Không thể thay đổi trạng thái. Thử lại sau.')
    }
  }

  return (
    <AdminLayout>
      {toggleError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
          {toggleError}
        </div>
      )}
      <div className="bg-white rounded-xl border border-gray-200">
        {/* Table header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h1 className="font-semibold text-gray-900 text-lg">Người dùng</h1>
          <button
            onClick={openAdd}
            className="bg-gray-900 text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors"
          >
            Thêm người dùng
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              <th className="px-6 py-3 font-medium text-gray-500">Họ tên</th>
              <th className="px-6 py-3 font-medium text-gray-500">Tên đăng nhập</th>
              <th className="px-6 py-3 font-medium text-gray-500">Vai trò</th>
              <th className="px-6 py-3 font-medium text-gray-500">Tên trên file Excel</th>
              <th className="px-6 py-3 font-medium text-gray-500">Trạng thái</th>
              <th className="px-6 py-3 font-medium text-gray-500">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 font-medium text-gray-900">{u.fullName}</td>
                <td className="px-6 py-4 text-gray-500">{u.username}</td>
                <td className="px-6 py-4">
                  <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-medium ${ROLE_BADGE[u.role] ?? 'bg-gray-100 text-gray-700'}`}>
                    {ROLES[u.role] ?? u.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500">{u.xlsxName ?? '–'}</td>
                <td className="px-6 py-4">
                  <Toggle active={u.isActive} onToggle={() => handleToggle(u.id)} />
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => openEdit(u)}
                    className="text-gray-600 hover:text-gray-900 font-medium transition-colors"
                  >
                    Sửa
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">Chưa có người dùng</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{editUser ? 'Sửa tài khoản' : 'Thêm tài khoản'}</h2>
              <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {!editUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tên đăng nhập *</label>
                  <input
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                    placeholder="username"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mật khẩu {editUser ? <span className="text-gray-400 font-normal">(để trống nếu không đổi)</span> : '*'}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  required={!editUser}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Họ tên *</label>
                <input
                  value={form.fullName}
                  onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                  required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="Nguyễn Văn A"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vai trò *</label>
                <select
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên trên file Excel</label>
                <input
                  value={form.xlsxName}
                  onChange={e => setForm(f => ({ ...f, xlsxName: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="Khớp chính xác với cột Tên nhân viên trong xlsx"
                />
              </div>

              {error && (
                <div className="bg-red-50 text-red-700 px-3 py-2.5 rounded-lg text-sm">{error}</div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Huỷ
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-gray-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-60"
                >
                  {saving ? 'Đang lưu...' : editUser ? 'Cập nhật' : 'Tạo tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
