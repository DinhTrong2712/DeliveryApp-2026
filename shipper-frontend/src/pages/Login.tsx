import { useState } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import api from '../lib/api'
import { useAuthStore } from '../stores/authStore'
import loginHero from '../assets/login-hero.webp'
import HuongCuongLogo from '../components/HuongCuongLogo'

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

  if (user) {
    const dest = user.role === 'Shipper'
      ? '/shipper/routes'
      : user.role === 'Accountant'
        ? '/accountant/dashboard'
        : '/admin/users'
    return <Navigate to={dest} replace />
  }

  return (
    <div className="min-h-screen flex bg-[#FFF8F2] dark:bg-gray-950">
      {/* ─────────── Left: Hero illustration (desktop only) ─────────── */}
      <div className="hidden md:block relative w-1/2 h-screen overflow-hidden bg-gradient-to-b from-[#FCE0CB] via-[#FFE9D6] to-[#FFF8F2]">
        <img
          src={loginHero}
          alt="Nhân viên giao hàng Hương Cường"
          className="absolute inset-0 w-full h-full object-cover object-center"
          loading="eager"
          decoding="async"
        />

        {/* Soft warm overlay — phủ nhẹ để branding text dễ đọc */}
        <div className="absolute inset-0 bg-gradient-to-tr from-[#7A2A05]/30 via-transparent to-transparent" />

        {/* Top bar: logo */}
        <Link
          to="/"
          className="absolute top-7 left-7 inline-flex items-center px-3 py-1.5 rounded-full bg-white/85 backdrop-blur-md text-gray-900 shadow-sm hover:bg-white transition-colors"
          title="Về trang chủ"
        >
          <HuongCuongLogo size={26} />
        </Link>

        {/* Bottom caption */}
        <div className="absolute bottom-0 inset-x-0 p-9 text-white">
          <h2 className="text-3xl font-bold leading-tight drop-shadow-sm">
            Mỗi đơn hàng là<br />
            một chuyến đi tin cậy.
          </h2>
          <p className="mt-2 text-sm text-white/85 max-w-sm">
            Hệ thống quản lý giao hàng nội bộ của
            Công ty TNHH Khương Phúc — NPP Hương Cường.
          </p>

          <div className="flex items-center gap-4 mt-5 text-xs text-white/90">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              Cập nhật real-time
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              Tối ưu cho mobile
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
              Đối soát tự động
            </span>
          </div>
        </div>
      </div>

      {/* ─────────── Right: Login form ─────────── */}
      <div className="flex-1 md:w-1/2 flex flex-col px-5 md:px-10 py-6 md:py-10 relative">
        {/* Mobile back link */}
        <Link
          to="/"
          className="md:hidden inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors w-fit"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Về trang chủ
        </Link>

        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-sm">
            {/* Mobile logo */}
            <div className="flex flex-col items-center mb-8 md:hidden">
              <HuongCuongLogo size={48} className="mb-2" />
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">Hệ thống quản lý giao hàng nội bộ</p>
            </div>

            {/* Heading */}
            <div className="mb-7 hidden md:block">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 text-[11px] font-semibold uppercase tracking-wider mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                Chào mừng trở lại
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">Đăng nhập</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1.5">
                Nhập thông tin tài khoản để tiếp tục.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Tên đăng nhập
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl pl-10 pr-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:bg-white dark:focus:bg-gray-900 transition-all"
                    placeholder="Nhập tên đăng nhập"
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Mật khẩu
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl pl-10 pr-12 py-3 text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 focus:bg-white dark:focus:bg-gray-900 transition-all"
                    placeholder="Nhập mật khẩu"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1 transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
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

              {/* Remember */}
              <label className="flex items-center gap-2 select-none cursor-pointer text-sm text-gray-600 dark:text-gray-400 w-fit">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 focus:ring-2 focus:ring-offset-0"
                  style={{ accentColor: BRAND }}
                />
                Ghi nhớ đăng nhập
              </label>

              {/* Error */}
              {error && (
                <div role="alert" className="flex items-center gap-2 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm border border-red-100 dark:border-red-900/50">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                style={{ background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 100%)` }}
                className="w-full text-white font-semibold py-3.5 rounded-xl transition-[transform,filter] hover:brightness-110 active:brightness-95 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed text-base min-h-[48px] flex items-center justify-center gap-2 shadow-md shadow-orange-500/20"
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
                  <>
                    Đăng nhập
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            {/* Footer */}
            <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-8">
              © {new Date().getFullYear()} Công ty TNHH Khương Phúc — NPP Hương Cường
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
