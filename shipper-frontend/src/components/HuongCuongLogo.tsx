import iconSrc from '../assets/landing/icon.png'

const BRAND = '#F26B2C'

interface HuongCuongLogoProps {
  /** Kích thước icon (px). Mặc định 32. */
  size?: number
  /** Ẩn cụm chữ ở màn nhỏ (< sm), chỉ giữ icon. */
  hideTextOnMobile?: boolean
  className?: string
}

/**
 * Logo Hương Cường dùng chung — icon vuông + 2 dòng chữ HƯƠNG / CƯỜNG.
 * Style nhất quán với landing page.
 */
export default function HuongCuongLogo({
  size = 32,
  hideTextOnMobile = false,
  className = '',
}: HuongCuongLogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src={iconSrc}
        alt="Hương Cường"
        width={size}
        height={size}
        className="rounded-lg object-cover flex-shrink-0"
        draggable={false}
      />
      <div className={`leading-none ${hideTextOnMobile ? 'hidden sm:block' : ''}`}>
        <div className="font-extrabold text-[13px] tracking-wide text-gray-900 dark:text-gray-100">
          HƯƠNG
        </div>
        <div className="font-extrabold text-[13px] tracking-wide" style={{ color: BRAND }}>
          CƯỜNG
        </div>
      </div>
    </div>
  )
}
