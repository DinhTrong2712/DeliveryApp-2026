import { useRef, useState } from 'react'
import { useThemeStore } from '../stores/themeStore'

/**
 * Bóng đèn ngủ pendant treo từ góc phải trên — kéo dây để bật/tắt dark mode.
 * Click vào núm dây hoặc kéo xuống đều toggle. Bóng đèn lắc nhẹ sau mỗi lần kéo.
 */
export default function LampToggle() {
  const { theme, toggle } = useThemeStore()
  const [pullDistance, setPullDistance] = useState(0)
  const [swaying, setSwaying] = useState(false)
  const dragRef = useRef<{ startY: number; pointerId: number } | null>(null)

  const isLight = theme === 'light'

  const fireToggle = () => {
    setSwaying(true)
    toggle()
    setTimeout(() => setSwaying(false), 900)
  }

  const onPointerDown = (e: React.PointerEvent<SVGCircleElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startY: e.clientY, pointerId: e.pointerId }
  }

  const onPointerMove = (e: React.PointerEvent<SVGCircleElement>) => {
    if (!dragRef.current) return
    const dy = Math.max(0, Math.min(28, e.clientY - dragRef.current.startY))
    setPullDistance(dy)
  }

  const onPointerUp = (e: React.PointerEvent<SVGCircleElement>) => {
    if (!dragRef.current) return
    e.currentTarget.releasePointerCapture(dragRef.current.pointerId)
    const triggered = pullDistance >= 10
    dragRef.current = null
    setPullDistance(0)
    if (triggered) fireToggle()
  }

  // Colors swap depending on state
  const shadeTop = isLight ? '#F26B2C' : '#5A2F1F'
  const shadeBottom = isLight ? '#D9521A' : '#3F1F12'
  const shadeStroke = isLight ? '#9C3812' : '#2A140B'
  const bulbFill = isLight ? '#FFF3C4' : '#374151'
  const bulbStroke = isLight ? '#FBBF24' : '#1f2937'
  const knobFill = isLight ? '#FCD34D' : '#9CA3AF'
  const knobStroke = isLight ? '#D97706' : '#4B5563'
  const cordStroke = isLight ? '#9CA3AF' : '#6B7280'

  return (
    <div
      className="fixed top-0 right-4 sm:right-8 z-50 select-none pointer-events-none"
      aria-hidden={false}
      style={{ width: 80, height: 160 }}
    >
      {/* Container that sways when toggled */}
      <div className={swaying ? 'lamp-sway' : ''} style={{ width: 80, height: 160 }}>
        <svg viewBox="0 0 80 160" width="80" height="160" className="overflow-visible">
          <defs>
            <linearGradient id="shadeGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={shadeTop} />
              <stop offset="100%" stopColor={shadeBottom} />
            </linearGradient>
            <radialGradient id="glowGrad" cx="0.5" cy="0" r="0.85">
              <stop offset="0%" stopColor="#FDE68A" stopOpacity={isLight ? 0.85 : 0} />
              <stop offset="55%" stopColor="#FBBF24" stopOpacity={isLight ? 0.35 : 0} />
              <stop offset="100%" stopColor="#FBBF24" stopOpacity={0} />
            </radialGradient>
          </defs>

          {/* Wire from ceiling */}
          <line x1="40" y1="-2" x2="40" y2="22" stroke="#1f2937" strokeWidth="2" />

          {/* Ceiling cap */}
          <ellipse cx="40" cy="22" rx="6" ry="2" fill="#374151" />

          {/* Lamp shade (bell-shaped) */}
          <path
            d="M 28 26 L 52 26 L 60 56 Q 60 60 56 60 L 24 60 Q 20 60 20 56 Z"
            fill="url(#shadeGrad)"
            stroke={shadeStroke}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          {/* Highlight stripe */}
          <path
            d="M 30 30 L 33 56"
            stroke="#FFFFFF"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity={isLight ? 0.55 : 0.18}
          />
          {/* Bottom rim */}
          <ellipse cx="40" cy="60" rx="20" ry="2.5" fill={shadeStroke} opacity="0.5" />

          {/* Glow halo (radial gradient under lamp) */}
          <ellipse cx="40" cy="80" rx="55" ry="40" fill="url(#glowGrad)" />

          {/* Bulb under shade */}
          <circle
            cx="40"
            cy="68"
            r="6.5"
            fill={bulbFill}
            stroke={bulbStroke}
            strokeWidth="1.2"
          />
          {/* Bulb highlight */}
          <circle cx="37.5" cy="65.5" r="1.6" fill="#FFFFFF" opacity={isLight ? 0.8 : 0.15} />

          {/* Pull cord — string from right side of shade */}
          <line
            x1="54"
            y1="55"
            x2="54"
            y2={120 + pullDistance}
            stroke={cordStroke}
            strokeWidth="1.4"
            className="transition-[stroke] duration-300"
          />

          {/* Pull cord knob — interactive (drag or click) */}
          <circle
            cx="54"
            cy={125 + pullDistance}
            r="6"
            fill={knobFill}
            stroke={knobStroke}
            strokeWidth="1.3"
            className="transition-[fill,stroke] duration-300 pointer-events-auto cursor-grab active:cursor-grabbing hover:brightness-110"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onClick={(e) => { if (!dragRef.current) fireToggle(); e.stopPropagation() }}
            role="switch"
            aria-checked={!isLight}
            aria-label={isLight ? 'Chuyển sang chế độ tối' : 'Chuyển sang chế độ sáng'}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                fireToggle()
              }
            }}
          />
          {/* Knob highlight */}
          <circle cx="52" cy={123 + pullDistance} r="1.4" fill="#FFFFFF" opacity="0.65" pointerEvents="none" />
        </svg>
      </div>
    </div>
  )
}
