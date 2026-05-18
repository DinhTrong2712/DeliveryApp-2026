import { useState } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import api from '../lib/api'
import { useAuthStore } from '../stores/authStore'

const BRAND = '#F26B2C'
const BRAND_DARK = '#D9521A'

const REMEMBER_KEY = 'remembered_username'

export default function Login() {
  const [username, setUsername] = useState(() => localStorage.getItem(REMEMBER_KEY) ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(() => !!localStorage.getItem(REMEMBER_KEY))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const user = useAuthStore((s) => s.user)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/auth/login', { username, password })
      setAuth(res.data.token, res.data.user)
      if (remember) localStorage.setItem(REMEMBER_KEY, username)
      else localStorage.removeItem(REMEMBER_KEY)
      const role = res.data.user.role
      if (role === 'Shipper') navigate('/shipper/routes')
      else if (role === 'Accountant') navigate('/accountant/dashboard')
      else navigate('/admin/users')
    } catch {
      setError('Tên đăng nhập hoặc mật khẩu không đúng')
    } finally {
      setLoading(false)
    }
  }

  // Redirect if already logged in
  if (user) {
    const dest = user.role === 'Shipper'
      ? '/shipper/routes'
      : user.role === 'Accountant'
        ? '/accountant/dashboard'
        : '/admin/users'
    return <Navigate to={dest} replace />
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel – branding (hidden on mobile) */}
      <div
        className="hidden md:flex flex-col justify-between w-1/2 p-12 text-white"
        style={{ background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 100%)` }}
      >
        <Link to="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity w-fit" title="Về trang chủ">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <span className="font-bold text-lg">DeliveryApp</span>
        </Link>

        <div>
          <h2 className="text-4xl font-bold leading-tight mb-4">
            Quản lý giao hàng<br />thông minh hơn
          </h2>
          <p className="text-orange-100 text-lg">
            Theo dõi đơn hàng, thu tiền và báo cáo — tất cả trong một nơi.
          </p>
        </div>

        <div className="flex gap-4 text-sm text-orange-100">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-white" />
            Cập nhật real-time
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-white" />
            Tối ưu cho mobile
          </div>
        </div>
      </div>

      {/* Right panel – login form */}
      <div className="flex-1 flex flex-col p-6 bg-gray-50 relative">
        {/* Back to home */}
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors w-fit"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Về trang chủ
        </Link>

        <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-sm animate-fade-in">
          {/* Mobile logo */}
          <div className="flex flex-col items-center mb-8 md:hidden">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-lg"
              style={{ backgroundColor: BRAND }}
            >
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Quản lý Giao hàng</h1>
            <p className="text-gray-500 text-sm mt-1">Đăng nhập để tiếp tục</p>
          </div>

          {/* Desktop heading */}
          <div className="hidden md:block mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Đăng nhập</h1>
            <p className="text-gray-500 text-sm mt-1">Nhập thông tin tài khoản của bạn</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tên đăng nhập
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
                    placeholder="Nhập tên đăng nhập"
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Mật khẩu
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl pl-10 pr-11 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-shadow"
                    placeholder="Nhập mật khẩu"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 select-none cursor-pointer text-sm text-gray-600 w-fit">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-offset-0"
                  style={{ accentColor: BRAND }}
                />
                Ghi nhớ đăng nhập
              </label>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm border border-red-100">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{ backgroundColor: BRAND }}
                className="w-full hover:brightness-110 active:brightness-95 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-60 text-base min-h-[48px] flex items-center justify-center gap-2 shadow-sm"
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Đang đăng nhập...
                  </>
                ) : (
                  'Đăng nhập'
                )}
              </button>
            </form>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
