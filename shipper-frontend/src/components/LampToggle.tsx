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
 * Toggle dark/light mode:
 *  - Mobile (< md): nút bấm đơn giản (sun/moon icon) — tap để chuyển
 *  - Desktop (>= md): bóng đèn pendant, kéo dây xuống để chuyển
 *
 * Tách responsive bằng Tailwind class (md:hidden / hidden md:block)
 * để tránh hydration mismatch và không cần JS detect device.
 */
export default function LampToggle({ variant = 'header' }: LampToggleProps) {
  const { theme, toggle } = useThemeStore()
  const [pull, setPull] = useState(0)
  const [swaying, setSwaying] = useState(false)
  const dragRef = useRef<{ startY: number; pointerId: number } | null>(null)

  const isLight = theme === 'light'

  const fireToggle = () => {
    setSwaying(true)
    toggle()
    setTimeout(() => setSwaying(false), 900)
  }

  // ── Desktop drag handlers ─────────────────────────────────────────
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
    if (committed) fireToggle()
  }

  // ── Colors ────────────────────────────────────────────────────────
  const shadeTop = isLight ? '#F26B2C' : '#5A2F1F'
  const shadeBottom = isLight ? '#D9521A' : '#3F1F12'
  const shadeStroke = isLight ? '#9C3812' : '#2A140B'
  const bulbFill = isLight ? '#FFF3C4' : '#374151'
  const bulbStroke = isLight ? '#FBBF24' : '#1f2937'
  const knobFill = isLight ? '#FCD34D' : '#9CA3AF'
  const knobStroke = isLight ? '#D97706' : '#4B5563'
  const cordStroke = isLight ? '#9CA3AF' : '#6B7280'

  // ── Wrapper classes ───────────────────────────────────────────────
  // Desktop: hidden trên mobile, hiện từ md trở lên
  const desktopWrapperCls = variant === 'floating'
    ? 'hidden md:block fixed top-2 right-4 z-50 select-none pointer-events-none'
    : 'hidden md:inline-block relative select-none pointer-events-none'

  // Mobile button: hiện trên mobile, ẩn từ md trở lên
  const mobileBtnCls = variant === 'floating'
    ? 'md:hidden fixed top-3 right-4 z-50 w-9 h-9 rounded-lg bg-white/85 backdrop-blur-md shadow-sm flex items-center justify-center text-orange-500 dark:bg-gray-800/85 dark:text-orange-300 active:scale-95 transition'
    : 'md:hidden w-9 h-9 rounded-lg flex items-center justify-center text-orange-500 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-gray-800 active:scale-95 transition'

  // Container size cho lamp SVG (desktop only)
  const flowStyle = variant === 'header'
    ? { width: 48, height: 40 }
    : { width: 48, height: 100 }

  // Soft cord path
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
    <>
      {/* ────────── MOBILE: nút bấm sun/moon ────────── */}
      <button
        type="button"
        onClick={fireToggle}
        aria-label={isLight ? 'Chuyển sang chế độ tối' : 'Chuyển sang chế độ sáng'}
        className={mobileBtnCls}
      >
        {isLight ? (
          // Sun icon
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M4 12H2m20 0h-2M5.64 5.64 4.22 4.22m15.56 15.56-1.42-1.42M5.64 18.36l-1.42 1.42M19.78 4.22l-1.42 1.42" />
          </svg>
        ) : (
          // Moon icon
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21.64 13.65A9 9 0 1 1 10.35 2.36 7 7 0 0 0 21.64 13.65Z" />
          </svg>
        )}
      </button>

      {/* ────────── DESKTOP: bóng đèn kéo dây ────────── */}
      <div className={desktopWrapperCls} style={flowStyle} aria-hidden={false}>
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
                  fireToggle()
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
    </>
  )
}
