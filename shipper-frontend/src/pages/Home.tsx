import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const BRAND = '#F26B2C'

function Logo({ size = 36 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id="lg" x1="0" y1="0" x2="64" y2="64">
            <stop offset="0%" stopColor="#F26B2C" />
            <stop offset="100%" stopColor="#D9521A" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#lg)" />
        <path
          d="M18 20 L32 14 L46 20 L46 44 L32 50 L18 44 Z"
          fill="none"
          stroke="white"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d="M32 14 L32 50" stroke="white" strokeWidth="2.5" />
        <path d="M18 20 L46 20" stroke="white" strokeWidth="2.5" />
      </svg>
      <div className="leading-none">
        <div className="font-extrabold text-[15px] tracking-wide text-gray-900">HƯƠNG</div>
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

function PartnerLogo({ name, color, italic }: { name: string; color: string; italic?: boolean }) {
  return (
    <div className="h-24 md:h-28 rounded-xl border border-gray-200 bg-white flex items-center justify-center shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
      <span
        className={`text-2xl md:text-3xl font-extrabold tracking-tight ${italic ? 'italic' : ''}`}
        style={{ color }}
      >
        {name}
      </span>
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
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-shadow">
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
        style={{ backgroundColor: `${BRAND}1A`, color: BRAND }}
      >
        {icon}
      </div>
      <h3 className="font-bold text-lg text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-sm leading-relaxed">{desc}</p>
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
    <div className="min-h-screen bg-white text-gray-900 scroll-smooth">
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
            {[
              { href: '#home', label: 'Trang chủ' },
              { href: '#about', label: 'Về chúng tôi' },
              { href: '#partners', label: 'Đối tác' },
              { href: '#contact', label: 'Liên hệ' },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-orange-600 rounded-full hover:bg-orange-50 transition-colors"
              >
                {item.label}
              </a>
            ))}
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
              href="#contact"
              className="hidden sm:inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity whitespace-nowrap"
              style={{ backgroundColor: BRAND }}
            >
              Liên hệ ngay
            </a>
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

        {/* Stacked box silhouettes (right side) */}
        <div className="hidden lg:block absolute right-0 bottom-0 top-16 w-1/2 pointer-events-none">
          <svg viewBox="0 0 600 800" className="w-full h-full opacity-60">
            <defs>
              <linearGradient id="box1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5a3a1f" />
                <stop offset="100%" stopColor="#2a1d10" />
              </linearGradient>
              <linearGradient id="box2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7a4a26" />
                <stop offset="100%" stopColor="#3a2515" />
              </linearGradient>
            </defs>
            {[
              { x: 60, y: 500, w: 130, h: 120, fill: 'url(#box1)' },
              { x: 200, y: 470, w: 130, h: 150, fill: 'url(#box2)' },
              { x: 340, y: 490, w: 130, h: 130, fill: 'url(#box1)' },
              { x: 480, y: 510, w: 110, h: 110, fill: 'url(#box2)' },
              { x: 100, y: 350, w: 150, h: 140, fill: 'url(#box2)' },
              { x: 270, y: 320, w: 140, h: 150, fill: 'url(#box1)' },
              { x: 420, y: 360, w: 140, h: 130, fill: 'url(#box2)' },
              { x: 180, y: 200, w: 160, h: 130, fill: 'url(#box1)' },
              { x: 360, y: 220, w: 130, h: 130, fill: 'url(#box2)' },
            ].map((b, i) => (
              <g key={i}>
                <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={b.fill} stroke="#F26B2C" strokeWidth="1" opacity="0.85" />
                <rect x={b.x + 8} y={b.y + 16} width={b.w - 16} height={3} fill="#F26B2C" opacity="0.6" />
                <rect x={b.x + 8} y={b.y + b.h - 22} width={b.w - 16} height={3} fill="#F26B2C" opacity="0.4" />
              </g>
            ))}
          </svg>
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
              <a
                href="#about"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white shadow-lg hover:shadow-xl hover:opacity-95 transition-all"
                style={{ backgroundColor: BRAND }}
              >
                Tìm hiểu thêm
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </a>
              <a
                href="#contact"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold border-2 border-white/40 text-white hover:bg-white/10 transition-colors"
              >
                Liên hệ ngay
              </a>
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
      <section id="partners" className="py-20 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center mb-12">
            <p className="text-xs md:text-sm font-bold tracking-[0.2em] mb-3" style={{ color: BRAND }}>
              GẦN 20 NĂM HỢP TÁC
            </p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              Đối Tác Chiến Lược
            </h2>
            <p className="text-gray-600 max-w-xl mx-auto">
              Chúng tôi tự hào là nhà phân phối tin tưởng bởi các thương hiệu FMCG hàng đầu Việt Nam và quốc tế.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 md:gap-5">
            <PartnerLogo name="Abbott" color="#0A4DA0" />
            <PartnerLogo name="Nutifood" color="#1B7F3B" />
            <PartnerLogo name="ORION" color="#E11B22" />
            <PartnerLogo name="Bibica" color="#D11A2A" italic />
            <PartnerLogo name="Danisa" color="#A6212A" italic />
          </div>
        </div>
      </section>

      {/* ===================== ABOUT ===================== */}
      <section id="about" className="py-20 md:py-24 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
            <div>
              <p className="text-xs md:text-sm font-bold tracking-[0.2em] mb-3" style={{ color: BRAND }}>
                VỀ CHÚNG TÔI
              </p>
              <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-6 leading-tight">
                Hai thập kỷ đồng hành cùng ngành phân phối FMCG Thái Nguyên
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                <strong>Công ty TNHH Khương Phúc – NPP Hương Cường</strong> được thành lập với sứ mệnh đưa hàng
                tiêu dùng nhanh chất lượng cao đến từng đại lý, cửa hàng tạp hóa và người tiêu dùng cuối tại
                khu vực Thái Nguyên.
              </p>
              <p className="text-gray-700 leading-relaxed mb-4">
                Với mạng lưới <strong>hơn 3.000 đối tác đại lý</strong>, đội ngũ <strong>15–20 nhân viên giao
                hàng chuyên nghiệp</strong> và quy trình vận hành công nghệ hóa, chúng tôi cam kết giao đúng,
                giao đủ, giao đúng giờ — từ các tuyến nội thành đến khu công nghiệp Samsung.
              </p>
              <div className="flex flex-wrap gap-3 mt-6">
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full text-sm font-medium text-gray-700 border border-gray-200">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: BRAND }} />
                  Bánh kẹo
                </span>
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full text-sm font-medium text-gray-700 border border-gray-200">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: BRAND }} />
                  Sữa & dinh dưỡng
                </span>
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full text-sm font-medium text-gray-700 border border-gray-200">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: BRAND }} />
                  Hàng tiêu dùng nhanh
                </span>
              </div>
            </div>

            <div className="relative">
              <div
                className="aspect-[4/3] rounded-3xl shadow-xl overflow-hidden relative"
                style={{
                  background:
                    'linear-gradient(135deg, #2a1d10 0%, #4a2f15 100%)',
                }}
              >
                <svg viewBox="0 0 400 300" className="w-full h-full">
                  <defs>
                    <pattern id="aboutBoxes" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
                      <rect x="4" y="4" width="52" height="52" fill="none" stroke="#F26B2C" strokeWidth="0.5" opacity="0.3" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#aboutBoxes)" />
                  {Array.from({ length: 12 }).map((_, i) => {
                    const cols = 4
                    const x = 40 + (i % cols) * 80
                    const y = 80 + Math.floor(i / cols) * 70
                    return (
                      <g key={i}>
                        <rect x={x} y={y} width={70} height={60} fill="#5a3a1f" stroke="#F26B2C" strokeWidth="1.5" opacity="0.85" />
                        <rect x={x + 6} y={y + 12} width={58} height="3" fill="#F26B2C" opacity="0.7" />
                      </g>
                    )
                  })}
                </svg>
              </div>
              <div
                className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-xl p-5 border border-gray-100 hidden md:block"
              >
                <div className="text-3xl font-extrabold" style={{ color: BRAND }}>~20</div>
                <div className="text-sm text-gray-600">Năm phân phối FMCG</div>
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
      <section id="contact" className="py-20 md:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 md:px-8">
          <div className="text-center mb-12">
            <p className="text-xs md:text-sm font-bold tracking-[0.2em] mb-3" style={{ color: BRAND }}>
              LIÊN HỆ
            </p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">
              Sẵn sàng hợp tác cùng bạn
            </h2>
            <p className="text-gray-600 max-w-xl mx-auto">
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
              <h3 className="font-bold text-gray-900 mb-1">Hotline</h3>
              <p className="text-gray-600 text-sm mb-2">Đặt hàng & hỗ trợ đại lý</p>
              <a href="tel:0987654321" className="text-lg font-bold" style={{ color: BRAND }}>
                0987 654 321
              </a>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-white rounded-2xl p-6 border border-orange-100">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-white" style={{ backgroundColor: BRAND }}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900 mb-1">Email</h3>
              <p className="text-gray-600 text-sm mb-2">Phản hồi trong 24 giờ</p>
              <a href="mailto:lienhe@huongcuong.vn" className="text-lg font-bold" style={{ color: BRAND }}>
                lienhe@huongcuong.vn
              </a>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-white rounded-2xl p-6 border border-orange-100">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-white" style={{ backgroundColor: BRAND }}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="font-bold text-gray-900 mb-1">Văn phòng</h3>
              <p className="text-gray-600 text-sm mb-2">Trụ sở chính & kho hàng</p>
              <p className="text-base font-semibold text-gray-900">
                TP. Thái Nguyên, tỉnh Thái Nguyên
              </p>
            </div>
          </div>

          <div className="mt-10 text-center">
            <a
              href="tel:0987654321"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-white shadow-lg hover:shadow-xl transition-all"
              style={{ backgroundColor: BRAND }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Gọi ngay để được tư vấn
            </a>
          </div>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer className="bg-gray-900 text-gray-300 pt-14 pb-8">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-10">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <svg width="36" height="36" viewBox="0 0 64 64" fill="none">
                  <rect x="2" y="2" width="60" height="60" rx="14" fill={BRAND} />
                  <path d="M18 20 L32 14 L46 20 L46 44 L32 50 L18 44 Z" fill="none" stroke="white" strokeWidth="3" strokeLinejoin="round" />
                  <path d="M32 14 L32 50" stroke="white" strokeWidth="2.5" />
                  <path d="M18 20 L46 20" stroke="white" strokeWidth="2.5" />
                </svg>
                <div className="leading-none">
                  <div className="font-extrabold text-base text-white">HƯƠNG</div>
                  <div className="font-extrabold text-base" style={{ color: BRAND }}>CƯỜNG</div>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-gray-400 max-w-md">
                Công ty TNHH Khương Phúc – NPP Hương Cường. Nhà phân phối FMCG hàng đầu khu vực Thái Nguyên,
                gần 20 năm kinh nghiệm phục vụ hơn 3.000 đại lý.
              </p>
            </div>

            <div>
              <h4 className="text-white font-bold mb-4">Liên kết</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#home" className="hover:text-white transition-colors">Trang chủ</a></li>
                <li><a href="#about" className="hover:text-white transition-colors">Về chúng tôi</a></li>
                <li><a href="#partners" className="hover:text-white transition-colors">Đối tác</a></li>
                <li><a href="#contact" className="hover:text-white transition-colors">Liên hệ</a></li>
                <li><Link to="/login" className="hover:text-white transition-colors">Đăng nhập nội bộ</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-white font-bold mb-4">Thông tin liên hệ</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>📞 0987 654 321</li>
                <li>✉️ lienhe@huongcuong.vn</li>
                <li>📍 TP. Thái Nguyên, tỉnh Thái Nguyên</li>
                <li>🕐 8:00 – 17:30 (T2 – T7)</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-6 flex flex-col md:flex-row justify-between items-center gap-3 text-sm text-gray-500">
            <p>© {new Date().getFullYear()} Công ty TNHH Khương Phúc. Tất cả quyền được bảo lưu.</p>
            <p>Thiết kế hệ thống quản lý nội bộ DeliveryApp</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
