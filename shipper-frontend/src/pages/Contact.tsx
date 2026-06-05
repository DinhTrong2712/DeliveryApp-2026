import { useEffect, useRef, useState } from 'react'
import type { SVGProps } from 'react'
import { Link } from 'react-router-dom'
import iconSrc from '../assets/landing/icon.png'

const BRAND = '#F26B2C'

const ADDRESS = 'TDP Kim Thái, Phường Phổ Yên, Thái Nguyên'
const PHONE_1 = '0974 058 400'
const PHONE_2 = '0988 599 747'
const EMAIL = 'khuongmv304@gmail.com'
const MAP_EMBED =
  'https://maps.google.com/maps?q=' +
  encodeURIComponent('Công Ty TNHH Khương Phúc, Phổ Yên, Thái Nguyên') +
  '&output=embed'

function Reveal({
  children,
  direction = 'up',
  delay = 0,
  className = '',
}: {
  children: React.ReactNode
  direction?: 'up' | 'left' | 'right'
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true)
            io.unobserve(el)
          }
        }),
      { rootMargin: '0px 0px -10% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const offset =
    direction === 'left'
      ? '-translate-x-8'
      : direction === 'right'
      ? 'translate-x-8'
      : 'translate-y-8'

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-out ${
        visible
          ? 'opacity-100 translate-x-0 translate-y-0'
          : `opacity-0 ${offset}`
      } ${className}`}
    >
      {children}
    </div>
  )
}

const MapPin = (p: SVGProps<SVGSVGElement>) => (
  <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)
const Phone = (p: SVGProps<SVGSVGElement>) => (
  <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
  </svg>
)
const Mail = (p: SVGProps<SVGSVGElement>) => (
  <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
)
const Clock = (p: SVGProps<SVGSVGElement>) => (
  <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 2m6-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const INFO_CARDS = [
  {
    Icon: MapPin,
    label: 'Địa chỉ',
    lines: [ADDRESS],
  },
  {
    Icon: Phone,
    label: 'Điện thoại',
    lines: [PHONE_1, PHONE_2],
  },
  {
    Icon: Mail,
    label: 'Email',
    lines: [EMAIL],
  },
  {
    Icon: Clock,
    label: 'Giờ làm việc',
    lines: ['Thứ 2 - Thứ 6: 7:00 – 17:30', 'Chủ nhật: Nghỉ'],
  },
]

const SCHEDULE = [
  { day: 'Thứ 2 – Thứ 6', time: '7:00 – 17:30' },
  { day: 'Thứ 7', time: '7:00 – 12:00' },
  { day: 'Chủ nhật', time: 'Nghỉ' },
]

export default function Contact() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 scroll-smooth">
      {/* HEADER */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all ${
          scrolled
            ? 'bg-white/95 backdrop-blur shadow-sm'
            : 'bg-white/80 backdrop-blur-sm'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={iconSrc} alt="Hương Cường" width={36} height={36} className="rounded-xl object-cover" />
            <div className="leading-none">
              <div className="font-extrabold text-[15px] tracking-wide text-gray-900 dark:text-gray-100">HƯƠNG</div>
              <div className="font-extrabold text-[15px] tracking-wide" style={{ color: BRAND }}>
                CƯỜNG
              </div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            <Link
              to="/"
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-orange-600 rounded-full hover:bg-orange-50 transition-colors"
            >
              Trang chủ
            </Link>
            <Link
              to="/about"
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-orange-600 rounded-full hover:bg-orange-50 transition-colors"
            >
              Về chúng tôi
            </Link>
            <Link
              to="/contact"
              className="px-4 py-2 text-sm font-medium rounded-full transition-colors"
              style={{ color: BRAND, backgroundColor: `${BRAND}1A` }}
            >
              Liên hệ
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 border-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold transition-colors hover:bg-orange-50 whitespace-nowrap"
              style={{ borderColor: BRAND, color: BRAND }}
            >
              <svg className="w-4 h-4 sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Đăng nhập nội bộ</span>
              <span className="sm:hidden">Đăng nhập</span>
            </Link>
            <a
              href={`tel:${PHONE_2.replace(/\s/g, '')}`}
              className="hidden sm:inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity whitespace-nowrap"
              style={{ backgroundColor: BRAND }}
            >
              Liên hệ ngay
            </a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative pt-40 pb-24 bg-gray-900 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `linear-gradient(135deg, ${BRAND}33 0%, transparent 60%)` }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: BRAND }}>
              Chúng tôi luôn sẵn sàng hỗ trợ
            </p>
            <h1 className="text-4xl sm:text-5xl font-black text-white mb-5">Liên Hệ Với Chúng Tôi</h1>
            <p className="text-gray-400 dark:text-gray-500 max-w-xl mx-auto text-sm leading-relaxed">
              Liên hệ trực tiếp qua điện thoại hoặc ghé thăm văn phòng của chúng tôi tại TP. Phổ Yên,
              Thái Nguyên.
            </p>
          </Reveal>
        </div>
      </section>

      {/* BREADCRUMB */}
      <div className="bg-gray-50 dark:bg-gray-950 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
          <Link to="/" className="hover:text-[#F26B2C] transition-colors">
            Trang chủ
          </Link>
          <span>/</span>
          <span className="text-gray-700 dark:text-gray-300 font-medium">Liên hệ</span>
        </div>
      </div>

      {/* 4 INFO CARDS */}
      <section className="py-12 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {INFO_CARDS.map((card, i) => (
              <Reveal key={card.label} delay={i * 80}>
                <div className="h-full rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow p-6">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                    style={{ backgroundColor: `${BRAND}1A` }}
                  >
                    <card.Icon className="w-5 h-5" style={{ color: BRAND }} />
                  </div>
                  <p className="text-[11px] font-bold tracking-widest uppercase text-gray-400 dark:text-gray-500 mb-2">
                    {card.label}
                  </p>
                  {card.lines.map((line) => (
                    <p key={line} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      {line}
                    </p>
                  ))}
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* MAP + WORKING HOURS */}
      <section className="pb-20 bg-gray-50 dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-gray-100 mb-8">
              Vị Trí Của Chúng Tôi
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* MAP */}
            <Reveal direction="left" className="lg:col-span-2">
              <div className="relative rounded-2xl overflow-hidden shadow-sm border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 h-[440px]">
                <iframe
                  title="Bản đồ Công Ty TNHH Khương Phúc"
                  src={MAP_EMBED}
                  className="w-full h-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
            </Reveal>

            {/* WORKING HOURS CARD */}
            <Reveal direction="right">
              <div className="h-full rounded-2xl bg-white dark:bg-gray-900 shadow-sm border border-gray-100 dark:border-gray-800 p-6 flex flex-col">
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${BRAND}1A` }}
                  >
                    <Clock className="w-5 h-5" style={{ color: BRAND }} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Giờ Làm Việc</h3>
                </div>

                <ul className="space-y-3 mb-6">
                  {SCHEDULE.map((row) => (
                    <li
                      key={row.day}
                      className="flex items-center justify-between text-sm border-b border-dashed border-gray-100 dark:border-gray-800 pb-3 last:border-0 last:pb-0"
                    >
                      <span className="text-gray-600 dark:text-gray-400">{row.day}</span>
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{row.time}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto space-y-2 pt-5 border-t border-gray-100 dark:border-gray-800">
                  <a
                    href={`tel:${PHONE_1.replace(/\s/g, '')}`}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-orange-50 hover:bg-orange-100 transition-colors"
                  >
                    <Phone className="w-4 h-4" style={{ color: BRAND }} />
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{PHONE_1}</span>
                  </a>
                  <a
                    href={`tel:${PHONE_2.replace(/\s/g, '')}`}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-orange-50 hover:bg-orange-100 transition-colors"
                  >
                    <Phone className="w-4 h-4" style={{ color: BRAND }} />
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{PHONE_2}</span>
                  </a>
                  <a
                    href={`mailto:${EMAIL}`}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-orange-50 hover:bg-orange-100 transition-colors"
                  >
                    <Mail className="w-4 h-4" style={{ color: BRAND }} />
                    <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{EMAIL}</span>
                  </a>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-gray-300 dark:text-gray-600 pt-14 pb-8">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-10">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <img
                  src={iconSrc}
                  alt="Hương Cường"
                  width={36}
                  height={36}
                  className="rounded-xl object-cover"
                />
                <div className="leading-none">
                  <div className="font-extrabold text-base text-white">HƯƠNG</div>
                  <div className="font-extrabold text-base" style={{ color: BRAND }}>
                    CƯỜNG
                  </div>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-gray-400 dark:text-gray-500 max-w-md">
                Công ty TNHH Khương Phúc – NPP Hương Cường. Nhà phân phối FMCG hàng đầu khu vực
                Thái Nguyên, gần 20 năm kinh nghiệm phục vụ hơn 3.000 đại lý.
              </p>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Liên kết</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/" className="hover:text-white transition-colors">
                    Trang chủ
                  </Link>
                </li>
                <li>
                  <Link to="/about" className="hover:text-white transition-colors">
                    Về chúng tôi
                  </Link>
                </li>
                <li>
                  <Link to="/contact" className="hover:text-white transition-colors">
                    Liên hệ
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="hover:text-white transition-colors">
                    Đăng nhập nội bộ
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4">Thông tin liên hệ</h4>
              <ul className="space-y-2 text-sm text-gray-400 dark:text-gray-500">
                <li>📞 {PHONE_2}</li>
                <li>✉️ {EMAIL}</li>
                <li>📍 {ADDRESS}</li>
                <li>🕐 7:00 – 17:30 (T2 – T7)</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row justify-between items-center gap-3 text-sm text-gray-500 dark:text-gray-500">
            <p>
              © {new Date().getFullYear()} Công ty TNHH Khương Phúc. Tất cả quyền được bảo lưu.
            </p>
            <p>Thiết kế hệ thống quản lý nội bộ DeliveryApp</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
