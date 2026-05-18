import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useState, type ReactNode } from 'react'
import MobileDrawer from './MobileDrawer'

const NAV_TABS = [
  { label: 'Người dùng', to: '/admin/users' },
  { label: 'Đơn gộp', to: '/admin/routes' },
  { label: 'SePay', to: '/admin/sepay' },
  { label: 'Lịch sử', to: '/admin/audit-logs' },
  { label: 'Cài đặt', to: '/admin/config' },
]

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-6 flex items-center h-14 gap-4 md:gap-8">
          <button
            onClick={() => setDrawerOpen(true)}
            className="md:hidden p-2 -ml-2 text-gray-700 hover:text-gray-900"
            aria-label="Mở menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 bg-orange-500 rounded-md flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-sm">Sổ Ghi Chép</span>
          </div>

          <nav className="hidden md:flex items-center gap-1 flex-1 overflow-x-auto">
            {NAV_TABS.map(tab => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  `px-3 lg:px-4 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3 flex-shrink-0 ml-auto">
            <span className="text-sm text-gray-600 truncate max-w-[160px]">{user?.fullName}</span>
            <button
              onClick={handleLogout}
              className="bg-gray-900 text-white text-sm px-3 py-1.5 rounded-md font-medium hover:bg-gray-700 transition-colors"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        tabs={NAV_TABS}
        userFullName={user?.fullName}
        onLogout={handleLogout}
      />

      <main className="max-w-screen-2xl mx-auto px-4 md:px-6 py-4 md:py-6">
        {children}
      </main>
    </div>
  )
}
