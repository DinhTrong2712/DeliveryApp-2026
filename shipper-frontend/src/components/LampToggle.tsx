import { useRef, useState } from 'react'
import { useThemeStore } from '../stores/themeStore'

interface LampToggleProps {
  /**
   * 'header'   — render inline inside layout headers (default). Lamp body sits
   *              within header height; cord+knob hang below into content.
   * 'floating' — fixed top-right corner. Used on public pages without a layout.
   */
  variant?: 'header' | 'floating'
}

const PULL_THRESHOLD = 14 // px — kéo dây vượt mức này khi thả → toggle
const MAX_PULL = 26       // giới hạn kéo trực quan
const CORD_REST_END_Y = 62  // y của đầu dây khi không kéo (gần lamp body hơn)
const CORD_START_Y = 32     // y của điểm dây bắt đầu (rim chao đèn)
const CORD_ANCHOR_X = 36    // x cố định

/**
 * Bóng đèn pendant — KÉO dây xuống để bật/tắt dark mode (không click).
 * Bóng đèn + chao + halo glow đều không nhận sự kiện chuột. Chỉ vùng dây + núm
 * mới nhận pointer events.
 */
export default function LampToggle({ variant = 'header' }: LampToggleProps) {
  const { theme, toggle } = useThemeStore()
  const [pull, setPull] = useState(0)
  const [swaying, setSwaying] = useState(false)
  const dragRef = useRef<{ startY: number; pointerId: number } | null>(null)

  const isLight = theme === 'light'

  const onPointerDown = (e: React.PointerEvent<SVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startY: e.clientY, pointerId: e.pointerId }
  }

  const onPointerMove = (e: React.PointerEvent<SVGElement>) => {
    if (!dragRef.current) return
    const dy = Math.max(0, Math.min(MAX_PULL, e.clientY - dragRef.current.startY))
    setPull(dy)
  }

  const onPointerUp = (e: React.PointerEvent<SVGElement>) => {
    if (!dragRef.current) return
    try { e.currentTarget.releasePointerCapture(dragRef.current.pointerId) } catch {}
    const committed = pull >= PULL_THRESHOLD
    dragRef.current = null
    setPull(0)
    if (committed) {
      setSwaying(true)
      toggle()
      setTimeout(() => setSwaying(false), 900)
    }
  }

  // Colors
  const shadeTop = isLight ? '#F26B2C' : '#5A2F1F'
  const shadeBottom = isLight ? '#D9521A' : '#3F1F12'
  const shadeStroke = isLight ? '#9C3812' : '#2A140B'
  const bulbFill = isLight ? '#FFF3C4' : '#374151'
  const bulbStroke = isLight ? '#FBBF24' : '#1f2937'
  const knobFill = isLight ? '#FCD34D' : '#9CA3AF'
  const knobStroke = isLight ? '#D97706' : '#4B5563'
  const cordStroke = isLight ? '#9CA3AF' : '#6B7280'

  // Wrapper class: header mode = inline-block, no fixed positioning.
  // floating mode = fixed top-right corner.
  const wrapperCls = variant === 'floating'
    ? 'fixed top-2 right-4 z-50 select-none pointer-events-none'
    : 'relative inline-block select-none pointer-events-none'

  // Container size: keep the SVG drawing area at 48×100 but the *flow* size is
  // 48×40 so we don't push the header taller — cord+knob protrude via SVG
  // overflow into the content area below.
  const flowStyle = variant === 'header'
    ? { width: 48, height: 40 }
    : { width: 48, height: 100 }

  // Soft cord path: cubic bezier with slight S-curve at rest, straightens as
  // user pulls. Sway amount decays linearly with pull distance — feels like
  // real cord under tension.
  const endY = CORD_REST_END_Y + pull
  const span = endY - CORD_START_Y
  const tension = Math.max(0, 1 - pull / MAX_PULL)
  const sway = 2.6 * tension
  const cordPath =
    `M ${CORD_ANCHOR_X} ${CORD_START_Y} ` +
    `C ${CORD_ANCHOR_X + sway} ${CORD_START_Y + span * 0.33}, ` +
    `${CORD_ANCHOR_X - sway} ${CORD_START_Y + span * 0.66}, ` +
    `${CORD_ANCHOR_X} ${endY}`
  const knobY = endY + 5.5
  const knobHighlightY = knobY - 2

  return (
    <div className={wrapperCls} style={flowStyle} aria-hidden={false}>
      <div className={swaying ? 'lamp-sway' : ''} style={{ width: 48, height: '100%' }}>
        <svg
          viewBox="0 0 48 100"
          width="48"
          height="100"
          className="overflow-visible block"
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
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
          <line x1="24" y1="0" x2="24" y2="8" stroke="#1f2937" strokeWidth="1.6" />
          <ellipse cx="24" cy="8" rx="4" ry="1.5" fill="#374151" />

          {/* Lamp shade */}
          <path
            d="M 16 10 L 32 10 L 38 30 Q 38 33 35 33 L 13 33 Q 10 33 10 30 Z"
            fill="url(#shadeGrad)"
            stroke={shadeStroke}
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          {/* Highlight */}
          <path
            d="M 17 13 L 19 30"
            stroke="#FFFFFF"
            strokeWidth="0.9"
            strokeLinecap="round"
            opacity={isLight ? 0.55 : 0.18}
          />
          {/* Bottom rim */}
          <ellipse cx="24" cy="33" rx="14" ry="1.6" fill={shadeStroke} opacity="0.5" />

          {/* Glow halo */}
          <ellipse cx="24" cy="45" rx="36" ry="26" fill="url(#glowGrad)" />

          {/* Bulb */}
          <circle cx="24" cy="40" r="4.5" fill={bulbFill} stroke={bulbStroke} strokeWidth="1" />
          <circle cx="22.5" cy="38.5" r="1.1" fill="#FFFFFF" opacity={isLight ? 0.8 : 0.15} />

          {/* ─── Interactive cord — KÉO xuống để toggle ─── */}
          <g
            className="pointer-events-auto cursor-grab active:cursor-grabbing group focus:outline-none"
            role="switch"
            aria-checked={!isLight}
            aria-label={isLight ? 'Kéo để tắt đèn (chế độ tối)' : 'Kéo để bật đèn (chế độ sáng)'}
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                setSwaying(true)
                toggle()
                setTimeout(() => setSwaying(false), 900)
              }
            }}
            style={{
              transition: dragRef.current ? 'none' : 'transform 0.35s cubic-bezier(.34,1.56,.64,1)',
            }}
          >
            {/* Wider invisible hit area covering cord + knob */}
            <rect x={CORD_ANCHOR_X - 8} y={CORD_START_Y - 2} width="16" height={span + 16} fill="transparent" />
            {/* Soft braided cord — bezier path with subtle S-sway at rest */}
            <path
              d={cordPath}
              stroke={cordStroke}
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
              className="transition-[stroke] duration-200 group-hover:stroke-orange-500"
            />
            {/* Faint inner thread for braid feel (slightly offset) */}
            <path
              d={cordPath}
              stroke="#FFFFFF"
              strokeWidth="0.5"
              strokeLinecap="round"
              fill="none"
              opacity="0.35"
              pointerEvents="none"
            />
            {/* Knob */}
            <circle
              cx={CORD_ANCHOR_X}
              cy={knobY}
              r="4.5"
              fill={knobFill}
              stroke={knobStroke}
              strokeWidth="1.1"
              className="transition-[fill,stroke] duration-300 group-hover:brightness-110"
            />
            <circle cx={CORD_ANCHOR_X - 1.4} cy={knobHighlightY} r="1" fill="#FFFFFF" opacity="0.6" pointerEvents="none" />
          </g>
        </svg>
      </div>
    </div>
  )
}
