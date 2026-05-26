import { useCallback, useEffect, useRef, useState } from 'react'
import type { SVGProps } from 'react'
import { Link } from 'react-router-dom'
import iconSrc from '../assets/landing/icon.png'
import overviewImg from '../assets/landing/ld11.jpg'
import peopleImg1 from '../assets/landing/ld12.jpg'
import peopleImg2 from '../assets/landing/ld13.jpg'
import gallery1 from '../assets/landing/hero.jpg'
import gallery2 from '../assets/landing/ld2.jpg'
import gallery3 from '../assets/landing/ld3.jpg'
import gallery4 from '../assets/landing/ld4.jpg'
import gallery5 from '../assets/landing/about.jpg'
import gallery14 from '../assets/landing/ld14.jpg'
import gallery15 from '../assets/landing/ld15.jpg'
import gallery16 from '../assets/landing/ld16.jpg'
import gallery17 from '../assets/landing/ld17.jpg'

const BRAND = '#F26B2C'

// ───────── Reveal-on-scroll (IntersectionObserver) ─────────
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

// ───────── Inline SVG icons (replaces lucide-react) ─────────
const Calendar = (p: SVGProps<SVGSVGElement>) => (
  <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)
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
const Award = (p: SVGProps<SVGSVGElement>) => (
  <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M12 2l2.39 4.84L20 8.27l-4 3.9.94 5.5L12 15.27 7.06 17.67 8 12.17l-4-3.9 5.61-1.43L12 2z" />
  </svg>
)
const ArrowRight = (p: SVGProps<SVGSVGElement>) => (
  <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
  </svg>
)
const ChevronLeft = (p: SVGProps<SVGSVGElement>) => (
  <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
  </svg>
)
const ChevronRight = (p: SVGProps<SVGSVGElement>) => (
  <svg {...p} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
)

// ───────── Data ─────────
const PEOPLE_SECTIONS = [
  {
    title: 'Đội ngũ chuyên nghiệp',
    subtitle: '6–8 nhân viên giao hàng tận tâm',
    description:
      'Mỗi nhân viên giao hàng của Khương Phúc đều được đào tạo bài bản về kỹ năng phục vụ khách hàng và quy trình xử lý đơn hàng. Chúng tôi tin rằng đội ngũ chính là tài sản quý giá nhất của doanh nghiệp.',
    image: peopleImg1,
    imageLeft: false,
  },
  {
    title: 'Văn hóa doanh nghiệp',
    subtitle: 'Kỷ luật · Trách nhiệm · Gắn kết',
    description:
      'Sau gần 20 năm hoạt động, Khương Phúc xây dựng được văn hóa làm việc đề cao sự trung thực, tinh thần trách nhiệm và đoàn kết nội bộ. Đây là nền tảng để chúng tôi duy trì tăng trưởng bền vững.',
    image: peopleImg2,
    imageLeft: true,
  },
]

const GALLERY_ITEMS = [
  { src: gallery4, alt: 'Hoạt động công ty 4' },
  { src: gallery5, alt: 'Hoạt động công ty 5' },
  { src: gallery1, alt: 'Hoạt động công ty 1' },
  { src: gallery15, alt: 'Hoạt động công ty 7' },
  { src: gallery16, alt: 'Hoạt động công ty 8' },
  { src: gallery14, alt: 'Hoạt động công ty 6' },
  { src: gallery2, alt: 'Hoạt động công ty 2' },
  { src: gallery3, alt: 'Hoạt động công ty 3' },
  { src: gallery17, alt: 'Hoạt động công ty 9' },
]

const VISIBLE = 3
const CAROUSEL_STYLES = `
  @keyframes carouselSlideRight {from {transform: translateX(50px); opacity: 0} to {transform: translateX(0); opacity: 1}}
  @keyframes carouselSlideLeft  {from {transform: translateX(-50px); opacity: 0} to {transform: translateX(0); opacity: 1}}
  .carousel-enter-right {animation: carouselSlideRight 0.4s cubic-bezier(0.25,0.46,0.45,0.94) both}
  .carousel-enter-left  {animation: carouselSlideLeft  0.4s cubic-bezier(0.25,0.46,0.45,0.94) both}
`

function GalleryCarousel() {
  const [start, setStart] = useState(0)
  const [paused, setPaused] = useState(false)
  const [direction, setDirection] = useState<'next' | 'prev'>('next')
  const [animKey, setAnimKey] = useState(0)
  const total = GALLERY_ITEMS.length

  const navigate = useCallback(
    (dir: 'next' | 'prev') => {
      setDirection(dir)
      setAnimKey((k) => k + 1)
      setStart((s) => (dir === 'next' ? (s + 1) % total : (s - 1 + total) % total))
    },
    [total],
  )

  useEffect(() => {
    if (paused) return
    const id = setInterval(() => navigate('next'), 3500)
    return () => clearInterval(id)
  }, [paused, navigate])

  const visible = Array.from(
    { length: VISIBLE },
    (_, i) => GALLERY_ITEMS[(start + i) % total],
  )
  const enterClass = direction === 'next' ? 'carousel-enter-right' : 'carousel-enter-left'

  return (
    <section className="py-20 bg-gray-50">
      <style>{CAROUSEL_STYLES}</style>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center mb-12">
          <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: BRAND }}>
            Ảnh thực tế
          </p>
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900">Hoạt Động Công Ty</h2>
        </Reveal>

        <div
          className="relative"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {visible.map((item, i) => (
              <div
                key={`${animKey}-${i}`}
                className={`group overflow-hidden rounded-2xl shadow-sm hover:shadow-xl transition-shadow ${enterClass}`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <img
                  src={item.src}
                  alt={item.alt}
                  className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="eager"
                  decoding="async"
                />
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate('prev')}
            className="absolute -left-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-md hover:bg-[#F26B2C] hover:text-white text-gray-700 flex items-center justify-center transition-colors"
            aria-label="Ảnh trước"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => navigate('next')}
            className="absolute -right-5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-md hover:bg-[#F26B2C] hover:text-white text-gray-700 flex items-center justify-center transition-colors"
            aria-label="Ảnh tiếp"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex justify-center gap-2 mt-8">
          {GALLERY_ITEMS.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                setDirection(i > start ? 'next' : 'prev')
                setAnimKey((k) => k + 1)
                setStart(i)
              }}
              className={`rounded-full transition-all duration-300 ${
                i === start ? 'w-6 h-2' : 'w-2 h-2 bg-gray-300 hover:bg-gray-400'
              }`}
              style={i === start ? { backgroundColor: BRAND } : undefined}
              aria-label={`Ảnh ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

// ───────── Page ─────────
export default function About() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-white text-gray-900 scroll-smooth">
      {/* HEADER — same shape as Home for visual continuity */}
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
              <div className="font-extrabold text-[15px] tracking-wide text-gray-900">HƯƠNG</div>
              <div className="font-extrabold text-[15px] tracking-wide" style={{ color: BRAND }}>
                CƯỜNG
              </div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            <Link
              to="/"
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-orange-600 rounded-full hover:bg-orange-50 transition-colors"
            >
              Trang chủ
            </Link>
            <Link
              to="/about"
              className="px-4 py-2 text-sm font-medium rounded-full transition-colors"
              style={{ color: BRAND, backgroundColor: `${BRAND}1A` }}
            >
              Về chúng tôi
            </Link>
            <Link
              to="/contact"
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-orange-600 rounded-full hover:bg-orange-50 transition-colors"
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
            <Link
              to="/contact"
              className="hidden sm:inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity whitespace-nowrap"
              style={{ backgroundColor: BRAND }}
            >
              Liên hệ ngay
            </Link>
          </div>
        </div>
      </header>

      {/* PAGE HERO — pt-40 offsets the fixed header (64px) + adds hero padding */}
      <section className="relative pt-40 pb-24 bg-gray-900 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `linear-gradient(135deg, ${BRAND}33 0%, transparent 60%)` }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Reveal>
            <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: BRAND }}>
              Câu chuyện của chúng tôi
            </p>
            <h1 className="text-4xl sm:text-5xl font-black text-white mb-5">Về Chúng Tôi</h1>
            <p className="text-gray-400 max-w-xl mx-auto text-sm leading-relaxed">
              Khương Phúc — hành trình gần 20 năm xây dựng niềm tin với hơn 3.000 đại lý phân phối
              tại khu vực Thái Nguyên.
            </p>
          </Reveal>
        </div>
      </section>

      {/* BREADCRUMB */}
      <div className="bg-gray-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-2 text-xs text-gray-500">
          <Link to="/" className="hover:text-[#F26B2C] transition-colors">
            Trang chủ
          </Link>
          <span>/</span>
          <span className="text-gray-700 font-medium">Về chúng tôi</span>
        </div>
      </div>

      {/* OVERVIEW */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <Reveal direction="left">
              <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: BRAND }}>
                Thành lập năm 2008
              </p>
              <h2 className="text-3xl sm:text-4xl font-black text-gray-900 mb-6">
                Gần Hai Thập Kỷ
                <br />
                Kiến Tạo Giá Trị
              </h2>
              <p className="text-gray-500 text-sm leading-relaxed mb-4">
                Được thành lập từ năm 2008 tại Phường Ba Hàng, TP. Phổ Yên, Thái Nguyên, Công ty
                TNHH Khương Phúc (tiền thân là DNTN Khương Phúc) đã trải qua gần 20 năm xây dựng và
                phát triển.
              </p>
              <p className="text-gray-500 text-sm leading-relaxed mb-4">
                Với tư duy nhạy bén cùng nỗ lực không ngừng của Ban lãnh đạo và tập thể cán bộ nhân
                viên, chúng tôi tự hào khẳng định vị thế là một trong những doanh nghiệp uy tín
                hàng đầu trong lĩnh vực phân phối FMCG và bán lẻ tại khu vực, với hơn 3.000 đại lý
                từ Phổ Yên, Sông Công đến Phú Bình.
              </p>
              <p
                className="text-sm leading-relaxed mb-8 font-medium text-gray-700 bg-orange-50 border rounded-xl px-4 py-3"
                style={{ borderColor: `${BRAND}33` }}
              >
                🏷️ <span className="font-bold" style={{ color: BRAND }}>Công ty TNHH Khương Phúc</span>{' '}
                là đơn vị sở hữu thương hiệu{' '}
                <span className="font-bold text-gray-900">Nhà Phân Phối Hương Cường</span>.
              </p>

              <div className="grid grid-cols-2 gap-5 mb-8">
                {[
                  { Icon: Calendar, label: 'Thành lập', value: 'Năm 2008' },
                  { Icon: MapPin, label: 'Trụ sở', value: 'Phổ Yên, TN' },
                  { Icon: Phone, label: 'Điện thoại', value: '0974 058 400' },
                  { Icon: Award, label: 'Đối tác', value: '3.000+ đại lý' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3 p-4 rounded-xl bg-gray-50">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${BRAND}1A` }}
                    >
                      <item.Icon className="w-5 h-5" style={{ color: BRAND }} />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-semibold">{item.label}</p>
                      <p className="text-sm font-bold text-gray-900">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Link
                to="/contact"
                className="inline-flex items-center gap-2 px-6 py-3 text-white font-semibold rounded-xl transition-colors text-sm hover:opacity-95"
                style={{ backgroundColor: BRAND }}
              >
                Liên hệ hợp tác <ArrowRight className="w-4 h-4" />
              </Link>
            </Reveal>

            <Reveal direction="right">
              <div className="relative">
                <img
                  src={overviewImg}
                  alt="Lịch sử Công ty Khương Phúc"
                  className="rounded-2xl w-full object-cover shadow-xl"
                  loading="lazy"
                  decoding="async"
                />
                <div
                  className="absolute -bottom-6 -left-6 text-white rounded-2xl px-6 py-5 shadow-lg"
                  style={{ backgroundColor: BRAND }}
                >
                  <p className="text-3xl font-black">~20</p>
                  <p className="text-xs font-medium opacity-90">Năm kinh nghiệm</p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* PEOPLE */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal className="text-center mb-16">
            <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: BRAND }}>
              Tài sản quan trọng nhất
            </p>
            <h2 className="text-3xl sm:text-4xl font-black text-gray-900">Con Người Là Nền Tảng</h2>
          </Reveal>

          <div className="space-y-20">
            {PEOPLE_SECTIONS.map((item) => (
              <Reveal key={item.title} delay={100}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                  <div className={item.imageLeft ? 'lg:order-1' : 'lg:order-2'}>
                    <img
                      src={item.image}
                      alt={item.title}
                      className="rounded-2xl w-full object-cover shadow-lg"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div className={item.imageLeft ? 'lg:order-2' : 'lg:order-1'}>
                    <p
                      className="text-xs font-bold tracking-widest uppercase mb-3"
                      style={{ color: BRAND }}
                    >
                      {item.subtitle}
                    </p>
                    <h3 className="text-2xl sm:text-3xl font-black text-gray-900 mb-5">
                      {item.title}
                    </h3>
                    <p className="text-gray-500 leading-relaxed text-sm">{item.description}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* GALLERY */}
      <GalleryCarousel />

      {/* FOOTER */}
      <footer className="bg-gray-900 text-gray-300 pt-14 pb-8">
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
              <p className="text-sm leading-relaxed text-gray-400 max-w-md">
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
              <ul className="space-y-2 text-sm text-gray-400">
                <li>📞 0988 599 747</li>
                <li>✉️ khuongmv304@gmail.com</li>
                <li>📍 TDP Kim Thái, Phường Phổ Yên, Thái Nguyên</li>
                <li>🕐 7:00 – 17:30 (T2 – T7)</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row justify-between items-center gap-3 text-sm text-gray-500">
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
