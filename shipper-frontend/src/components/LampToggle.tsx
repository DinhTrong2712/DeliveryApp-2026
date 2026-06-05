import { useState } from 'react'
import { useThemeStore } from '../stores/themeStore'

/**
 * Bóng đèn ngủ pendant treo bên dưới header — bấm vào dây/núm để bật/tắt dark mode.
 * Vị trí: top-14 (dưới header 56px) right-2/4 để không che username/logout.
 * Tương tác: chỉ click trên dây + núm (không drag), bóng đèn không nhận click.
 */
export default function LampToggle() {
  const { theme, toggle } = useThemeStore()
  const [swaying, setSwaying] = useState(false)

  const isLight = theme === 'light'

  const fireToggle = () => {
    setSwaying(true)
    toggle()
    setTimeout(() => setSwaying(false), 900)
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
      className="fixed top-14 right-2 sm:right-4 z-50 select-none pointer-events-none"
      style={{ width: 64, height: 140 }}
      aria-hidden={false}
    >
      <div className={swaying ? 'lamp-sway' : ''} style={{ width: 64, height: 140 }}>
        <svg viewBox="0 0 64 140" width="64" height="140" className="overflow-visible">
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

          {/* Wire from above (extends visually beyond header) */}
          <line x1="32" y1="0" x2="32" y2="14" stroke="#1f2937" strokeWidth="1.8" />
          {/* Ceiling cap */}
          <ellipse cx="32" cy="14" rx="5" ry="1.8" fill="#374151" />

          {/* Lamp shade (bell-shaped) */}
          <path
            d="M 22 16 L 42 16 L 50 42 Q 50 46 46 46 L 18 46 Q 14 46 14 42 Z"
            fill="url(#shadeGrad)"
            stroke={shadeStroke}
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
          {/* Highlight stripe */}
          <path
            d="M 24 20 L 27 42"
            stroke="#FFFFFF"
            strokeWidth="1"
            strokeLinecap="round"
            opacity={isLight ? 0.55 : 0.18}
          />
          {/* Bottom rim */}
          <ellipse cx="32" cy="46" rx="17" ry="2" fill={shadeStroke} opacity="0.5" />

          {/* Glow halo */}
          <ellipse cx="32" cy="60" rx="45" ry="32" fill="url(#glowGrad)" />

          {/* Bulb under shade */}
          <circle
            cx="32"
            cy="53"
            r="5.5"
            fill={bulbFill}
            stroke={bulbStroke}
            strokeWidth="1.1"
          />
          {/* Bulb highlight */}
          <circle cx="30" cy="51" r="1.4" fill="#FFFFFF" opacity={isLight ? 0.8 : 0.15} />

          {/* ─── Interactive cord group — click anywhere on cord/knob ─── */}
          <g
            onClick={(e) => { e.stopPropagation(); fireToggle() }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fireToggle() }
            }}
            role="switch"
            aria-checked={!isLight}
            aria-label={isLight ? 'Tắt đèn (chế độ tối)' : 'Bật đèn (chế độ sáng)'}
            tabIndex={0}
            className="pointer-events-auto cursor-pointer focus:outline-none group"
          >
            {/* Invisible wider hit area along cord */}
            <rect x="38" y="42" width="16" height="80" fill="transparent" />
            {/* Visible cord */}
            <line
              x1="46"
              y1="44"
              x2="46"
              y2="110"
              stroke={cordStroke}
              strokeWidth="1.4"
              className="transition-[stroke] duration-300 group-hover:stroke-orange-500"
            />
            {/* Knob */}
            <circle
              cx="46"
              cy="115"
              r="5.5"
              fill={knobFill}
              stroke={knobStroke}
              strokeWidth="1.2"
              className="transition-[fill,stroke] duration-300 group-hover:brightness-110"
            />
            {/* Knob highlight */}
            <circle cx="44.5" cy="113" r="1.3" fill="#FFFFFF" opacity="0.6" pointerEvents="none" />
          </g>
        </svg>
      </div>
    </div>
  )
}
