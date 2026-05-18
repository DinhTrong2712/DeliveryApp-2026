import { NavLink } from 'react-router-dom'
import { useEffect } from 'react'

export interface DrawerTab {
  label: string
  to: string
}

interface MobileDrawerProps {
  open: boolean
  onClose: () => void
  tabs: DrawerTab[]
  userFullName?: string
  onLogout: () => void
}

export default function MobileDrawer({ open, onClose, tabs, userFullName, onLogout }: MobileDrawerProps) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open) return null

  return (
    <div className="md:hidden fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-white shadow-xl flex flex-col">
        <div className="h-14 px-4 flex items-center justify-between border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-orange-500 rounded-md flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-sm">Sổ Ghi Chép</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-gray-500 hover:text-gray-900"
            aria-label="Đóng menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {tabs.map(tab => (
            <NavLink
              key={tab.to}
              to={tab.to}
              onClick={onClose}
              className={({ isActive }) =>
                `block px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-gray-200 p-4 space-y-3">
          {userFullName && (
            <div className="text-sm text-gray-600 truncate">{userFullName}</div>
          )}
          <button
            onClick={() => { onClose(); onLogout() }}
            className="w-full bg-gray-900 text-white text-sm px-3 py-2 rounded-md font-medium hover:bg-gray-700 transition-colors"
          >
            Đăng xuất
          </button>
        </div>
      </aside>
    </div>
  )
}
