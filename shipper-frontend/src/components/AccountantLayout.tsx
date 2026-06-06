import { NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { useState, type ReactNode } from 'react'
import MobileDrawer from './MobileDrawer'
import LampToggle from './LampToggle'
import brandIcon from '../assets/landing/icon.png'

const NAV_TABS = [
  { label: 'Tổng quan', to: '/accountant/dashboard' },
  { label: 'Đơn gộp', to: '/accountant/routes' },
  { label: 'Đơn hàng', to: '/accountant/orders' },
  { label: 'Khớp giao dịch', to: '/accountant/unmatched' },
  { label: 'Báo cáo', to: '/accountant/reports' },
]

export default function AccountantLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleLogout = () => {
    navigate('/login', { replace: true })
    logout()
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-20">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-6 flex items-center h-14 gap-4 md:gap-8">
          <button
            onClick={() => setDrawerOpen(true)}
            className="md:hidden p-2 -ml-2 text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
            aria-label="Mở menu"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex items-center gap-2 flex-shrink-0">
            <img src={brandIcon} alt="Hương Cường" width={28} height={28} className="rounded-md object-cover" draggable={false} />
            <span className="font-bold text-gray-900 dark:text-gray-100 text-sm hidden sm:inline">Sổ Ghi Chép Giao Hàng</span>
            <span className="font-bold text-gray-900 dark:text-gray-100 text-sm sm:hidden">Sổ Ghi Chép</span>
          </div>

          <nav className="hidden md:flex items-center gap-1 flex-1 overflow-x-auto">
            {NAV_TABS.map(tab => (
              <NavLink
                key={tab.to}
                to={tab.to}
                className={({ isActive }) =>
                  `px-3 lg:px-4 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3 flex-shrink-0 ml-auto">
            <LampToggle />
            <span className="text-sm text-gray-600 dark:text-gray-400 truncate max-w-[160px]">{user?.fullName}</span>
            <button
              onClick={handleLogout}
              className="bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 text-sm px-3 py-1.5 rounded-md font-medium hover:bg-gray-700 dark:hover:bg-white transition-colors"
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
