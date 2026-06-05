import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import iconSrc from '../assets/landing/icon.png'
import heroImg from '../assets/landing/hero.jpg'
import aboutImg from '../assets/landing/about.jpg'
import abbottLogo from '../assets/landing/abbott.png'
import nutifoodLogo from '../assets/landing/nutifood.jpg'
import orionLogo from '../assets/landing/orion.png'
import bibicaLogo from '../assets/landing/bibica.webp'
import danisaLogo from '../assets/landing/danisa.png'

const BRAND = '#F26B2C'

function Logo({ size = 36 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <img
        src={iconSrc}
        alt="Hương Cường"
        width={size}
        height={size}
        className="rounded-xl object-cover"
      />
      <div className="leading-none">
        <div className="font-extrabold text-[15px] tracking-wide text-gray-900 dark:text-gray-100">HƯƠNG</div>
        <div className="font-extrabold text-[15px] tracking-wide" style={{ color: BRAND }}>CƯỜNG</div>
      </div>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-5 md:py-7 border-r border-white/20 last:border-r-0 px-4">
      <div className="text-white text-3xl md:text-5xl font-extrabold tracking-tight drop-shadow-sm">
        {value}
      </div>
      <div className="text-white/90 text-xs md:text-sm mt-1">{label}</div>
    </div>
  )
}

function PartnerLogo({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="h-24 md:h-28 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-center shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-4">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="max-h-full max-w-full object-contain"
      />
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode
  title: string
  desc: string
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-lg transition-shadow">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
        style={{ backgroundColor: `${BRAND}1A`, color: BRAND }}
      >
        {icon}
      </div>
      <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">{desc}</p>
    </div>
  )
}

export default function Home() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 scroll-smooth">
      {/* ===================== HEADER ===================== */}
      <header
        className={`fixed top-0 inset-x-0 z-50 transition-all ${
          scrolled
            ? 'bg-white/95 backdrop-blur shadow-sm'
            : 'bg-white/80 backdrop-blur-sm'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <a href="#home" className="flex items-center">
            <Logo />
          </a>

          <nav className="hidden md:flex items-center gap-1">
            <a
              href="#home"
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-orange-600 rounded-full hover:bg-orange-50 transition-colors"
            >
              Trang chủ
            </a>
            <Link
              to="/about"
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-orange-600 rounded-full hover:bg-orange-50 transition-colors"
            >
              Về chúng tôi
            </Link>
            <Link
              to="/contact"
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-orange-600 rounded-full hover:bg-orange-50 transition-colors"
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

      {/* ===================== HERO ===================== */}
      <section
        id="home"
        className="relative min-h-[100svh] flex items-center text-white overflow-hidden pt-16"
        style={{
          background:
            'linear-gradient(115deg, rgba(20,18,16,0.92) 0%, rgba(20,18,16,0.75) 50%, rgba(20,18,16,0.55) 100%), radial-gradient(circle at 80% 50%, #3a2a1a 0%, #1a1410 60%)',
        }}
      >
        {/* Decorative warehouse pattern */}
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="boxes" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
                <rect x="2" y="2" width="36" height="36" fill="none" stroke="#F26B2C" strokeWidth="0.4" />
                <rect x="42" y="2" width="36" height="36" fill="none" stroke="#F26B2C" strokeWidth="0.4" />
                <rect x="2" y="42" width="36" height="36" fill="none" stroke="#F26B2C" strokeWidth="0.4" />
                <rect x="42" y="42" width="36" height="36" fill="none" stroke="#F26B2C" strokeWidth="0.4" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#boxes)" />
          </svg>
        </div>

        {/* Hero photo (right side) — fades into dark background on left */}
        <div className="hidden lg:block absolute right-0 bottom-0 top-16 w-1/2 pointer-events-none overflow-hidden">
          <img
            src={heroImg}
            alt=""
            className="w-full h-full object-cover opacity-80"
            style={{
              maskImage:
                'linear-gradient(to left, black 55%, transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(to left, black 55%, transparent 100%)',
            }}
          />
        </div>

        {/* Hero content */}
        <div className="relative max-w-7xl mx-auto px-4 md:px-8 w-full py-12 md:py-20">
          <div className="max-w-2xl">
            <p className="text-sm md:text-base font-semibold mb-3">
              Công ty TNHH Khương Phúc{' '}
              <span style={{ color: BRAND }}>– NPP Hương Cường</span>
            </p>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-[1.05] tracking-tight mb-6">
              NHÀ PHÂN PHỐI{' '}
              <span style={{ color: BRAND }}>FMCG</span>
              <br />
              HÀNG ĐẦU
              <br />
              KHU VỰC THÁI NGUYÊN
            </h1>
            <p className="text-base md:text-lg text-gray-200 mb-8 max-w-lg leading-relaxed">
              Gần 20 năm kinh nghiệm phân phối bánh kẹo và hàng tiêu dùng với mạng lưới hơn 3.000 đại lý —
              từ tạp hóa đến khu công nghiệp Samsung.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                to="/about"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white shadow-lg hover:shadow-xl hover:opacity-95 transition-all"
                style={{ backgroundColor: BRAND }}
              >
                Tìm hiểu thêm
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold border-2 border-white/40 text-white hover:bg-white/10 transition-colors"
              >
                Liên hệ ngay
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <a
          href="#stats"
          className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/60 hover:text-white transition-colors"
          aria-label="Cuộn xuống"
        >
          <svg className="w-6 h-6 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </a>
      </section>

      {/* ===================== STATS BAR ===================== */}
      <section id="stats" style={{ backgroundColor: BRAND }}>
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4">
          <Stat value="~20" label="Năm kinh nghiệm" />
          <Stat value="3.000+" label="Đối tác đại lý" />
          <Stat value=">300" label="Đơn hàng/ngày" />
          <Stat value="15-20" label="Tuyến giao hàng" />
        </div>
      </section>

      {/* ===================== PARTNERS ===================== */}
      <section id="partners" className="py-20 md:py-24 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center mb-12">
            <p className="text-xs md:text-sm font-bold tracking-[0.2em] mb-3" style={{ color: BRAND }}>
              GẦN 20 NĂM HỢP TÁC
            </p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-gray-100 mb-4">
              Đối Tác Chiến Lược
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
              Chúng tôi tự hào là nhà phân phối tin tưởng bởi các thương hiệu FMCG hàng đầu Việt Nam và quốc tế.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 md:gap-5">
            <PartnerLogo src={abbottLogo} alt="Abbott" />
            <PartnerLogo src={nutifoodLogo} alt="Nutifood" />
            <PartnerLogo src={orionLogo} alt="ORION" />
            <PartnerLogo src={bibicaLogo} alt="Bibica" />
            <PartnerLogo src={danisaLogo} alt="Danisa" />
          </div>
        </div>
      </section>

      {/* ===================== ABOUT ===================== */}
      <section id="about" className="py-20 md:py-24 bg-gray-50 dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
            <div>
              <p className="text-xs md:text-sm font-bold tracking-[0.2em] mb-3" style={{ color: BRAND }}>
                VỀ CHÚNG TÔI
              </p>
              <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-gray-100 mb-6 leading-tight">
                Hai thập kỷ đồng hành cùng ngành phân phối FMCG Thái Nguyên
              </h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                <strong>Công ty TNHH Khương Phúc – NPP Hương Cường</strong> được thành lập với sứ mệnh đưa hàng
                tiêu dùng nhanh chất lượng cao đến từng đại lý, cửa hàng tạp hóa và người tiêu dùng cuối tại
                khu vực Thái Nguyên.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                Với mạng lưới <strong>hơn 3.000 đối tác đại lý</strong>, đội ngũ <strong>15–20 nhân viên giao
                hàng chuyên nghiệp</strong> và quy trình vận hành công nghệ hóa, chúng tôi cam kết giao đúng,
                giao đủ, giao đúng giờ — từ các tuyến nội thành đến khu công nghiệp Samsung.
              </p>
              <div className="flex flex-wrap gap-3 mt-6">
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 rounded-full text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-800">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: BRAND }} />
                  Bánh kẹo
                </span>
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 rounded-full text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-800">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: BRAND }} />
                  Sữa & dinh dưỡng
                </span>
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-900 rounded-full text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-800">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: BRAND }} />
                  Hàng tiêu dùng nhanh
                </span>
              </div>
            </div>

            <div className="relative">
              <div className="aspect-[4/3] rounded-3xl shadow-xl overflow-hidden relative">
                <img
                  src={aboutImg}
                  alt="Kho hàng & đội ngũ giao hàng Hương Cường"
                  className="w-full h-full object-cover"
                />
              </div>
              <div
                className="absolute -bottom-6 -left-6 bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-5 border border-gray-100 dark:border-gray-800 hidden md:block"
              >
                <div className="text-3xl font-extrabold" style={{ color: BRAND }}>~20</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Năm phân phối FMCG</div>
              </div>
            </div>
          </div>

          {/* Feature cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <FeatureCard
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h3.05a2.5 2.5 0 012.45 2v6a1 1 0 01-1 1h-1.05" />
                </svg>
              }
              title="Giao hàng đúng giờ"
              desc="Đội ngũ shipper chuyên nghiệp với 15–20 tuyến giao hàng cố định, đảm bảo hàng đến tay đại lý đúng lịch hẹn."
            />
            <FeatureCard
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              }
              title="Mạng lưới rộng khắp"
              desc="Phủ sóng toàn tỉnh Thái Nguyên với hơn 3.000 đại lý, cửa hàng tạp hóa và đối tác doanh nghiệp."
            />
            <FeatureCard
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              }
              title="Hàng chính hãng 100%"
              desc="Là nhà phân phối ủy quyền của Abbott, Nutifood, Orion, Bibica, Danisa — đảm bảo chất lượng và xuất xứ rõ ràng."
            />
            <FeatureCard
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              }
              title="Quy trình công nghệ hóa"
              desc="Quản lý đơn hàng, tuyến giao và thanh toán bằng phần mềm nội bộ — minh bạch, nhanh chóng, không sai sót."
            />
            <FeatureCard
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
              title="Đội ngũ tận tâm"
              desc="Hơn 20 nhân viên kho – kế toán – giao hàng được đào tạo bài bản, gắn bó lâu dài với công ty."
            />
            <FeatureCard
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
              title="Giá cả cạnh tranh"
              desc="Hợp tác trực tiếp với nhà sản xuất, cam kết giá tốt nhất khu vực và chính sách hỗ trợ đại lý linh hoạt."
            />
          </div>
        </div>
      </section>

      {/* ===================== CONTACT ===================== */}
      <section id="contact" className="py-20 md:py-24 bg-white dark:bg-gray-900">
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <div className="text-center mb-12">
            <p className="text-xs md:text-sm font-bold tracking-[0.2em] mb-3" style={{ color: BRAND }}>
              LIÊN HỆ
            </p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-gray-100 mb-4">
              Sẵn sàng hợp tác cùng bạn
            </h2>
            <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
              Liên hệ ngay để nhận báo giá, làm đại lý hoặc tư vấn về danh mục sản phẩm.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            <div className="bg-gradient-to-br from-orange-50 to-white rounded-2xl p-6 border border-orange-100">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-white" style={{ backgroundColor: BRAND }}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1">Hotline</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Đặt hàng & hỗ trợ đại lý</p>
              <a href="tel:0988599747" className="text-lg font-bold block" style={{ color: BRAND }}>
                0988 599 747
              </a>
              <a href="tel:0974058400" className="text-sm font-semibold block mt-1" style={{ color: BRAND }}>
                0974 058 400
              </a>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-white rounded-2xl p-6 border border-orange-100">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-white" style={{ backgroundColor: BRAND }}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1">Email</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Phản hồi trong 24 giờ</p>
              <a href="mailto:khuongmv304@gmail.com" className="text-base font-bold break-all" style={{ color: BRAND }}>
                khuongmv304@gmail.com
              </a>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-white rounded-2xl p-6 border border-orange-100">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-white" style={{ backgroundColor: BRAND }}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1">Văn phòng</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">Trụ sở chính & kho hàng</p>
              <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                TDP Kim Thái, Phường Phổ Yên, Thái Nguyên
              </p>
            </div>
          </div>

          <div className="mt-10 text-center">
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-white shadow-lg hover:shadow-xl transition-all"
              style={{ backgroundColor: BRAND }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Gọi ngay để được tư vấn
            </Link>
          </div>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
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
                  <div className="font-extrabold text-base" style={{ color: BRAND }}>CƯỜNG</div>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-gray-400 dark:text-gray-500 max-w-md">
                Công ty TNHH Khương Phúc – NPP Hương Cường. Nhà phân phối FMCG hàng đầu khu vực Thái Nguyên,
                gần 20 năm kinh nghiệm phục vụ hơn 3.000 đại lý.
              </p>
            </div>

            <div>
              <h4 className="text-white font-bold mb-4">Liên kết</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#home" className="hover:text-white transition-colors">Trang chủ</a></li>
                <li><Link to="/about" className="hover:text-white transition-colors">Về chúng tôi</Link></li>
                <li><Link to="/contact" className="hover:text-white transition-colors">Liên hệ</Link></li>
                <li><Link to="/login" className="hover:text-white transition-colors">Đăng nhập nội bộ</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-4">Thông tin liên hệ</h4>
              <ul className="space-y-2 text-sm text-gray-400 dark:text-gray-500">
                <li>📞 0988 599 747</li>
                <li>✉️ khuongmv304@gmail.com</li>
                <li>📍 TDP Kim Thái, Phường Phổ Yên, Thái Nguyên</li>
                <li>🕐 7:00 – 17:30 (T2 – T7)</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row justify-between items-center gap-3 text-sm text-gray-500 dark:text-gray-500">
            <p>© {new Date().getFullYear()} Công ty TNHH Khương Phúc. Tất cả quyền được bảo lưu.</p>
            <p>Thiết kế hệ thống quản lý nội bộ DeliveryApp</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
