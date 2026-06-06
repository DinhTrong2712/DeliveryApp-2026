import { useEffect, useRef, useState } from 'react'

interface ChibiAvatarProps {
  mode?: 'fab' | 'peek'
  className?: string
}

const LEFT_EYE = { cx: 40, cy: 46 }
const RIGHT_EYE = { cx: 60, cy: 46 }
const PUPIL_MAX = 2.4
const FALLOFF = 180

type Pupil = { x: number; y: number }

export default function ChibiAvatar({ mode = 'fab', className = '' }: ChibiAvatarProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [pupils, setPupils] = useState<{ left: Pupil; right: Pupil }>({
    left: { x: 0, y: 0 },
    right: { x: 0, y: 0 },
  })

  useEffect(() => {
    let rafId = 0
    let pending: { x: number; y: number } | null = null

    const flush = () => {
      rafId = 0
      const evt = pending
      pending = null
      const svg = svgRef.current
      if (!evt || !svg) return

      const rect = svg.getBoundingClientRect()
      if (rect.width === 0) return
      const scale = rect.width / 100

      const compute = (eye: { cx: number; cy: number }): Pupil => {
        const ex = rect.left + eye.cx * scale
        const ey = rect.top + eye.cy * scale
        const dx = evt.x - ex
        const dy = evt.y - ey
        const dist = Math.hypot(dx, dy)
        if (dist < 0.5) return { x: 0, y: 0 }
        const t = Math.min(1, dist / FALLOFF)
        const r = PUPIL_MAX * t
        return { x: (dx / dist) * r, y: (dy / dist) * r }
      }

      setPupils({ left: compute(LEFT_EYE), right: compute(RIGHT_EYE) })
    }

    const onMove = (e: MouseEvent) => {
      pending = { x: e.clientX, y: e.clientY }
      if (!rafId) rafId = requestAnimationFrame(flush)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', onMove)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [])

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 100 100"
      className={className}
      aria-hidden
      style={{ overflow: 'visible' }}
    >
      <defs>
        <radialGradient id="chibi-cheek" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#ff8d8d" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ff8d8d" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="chibi-shirt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#ea580c" />
        </linearGradient>
        <linearGradient id="chibi-hair" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b2418" />
          <stop offset="100%" stopColor="#1a0e07" />
        </linearGradient>
        <linearGradient id="chibi-skin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffe6cd" />
          <stop offset="100%" stopColor="#fbcfa6" />
        </linearGradient>
      </defs>

      {/* === BODY === áo cam (chỉ ở mode fab) */}
      {mode === 'fab' && (
        <g>
          {/* cổ */}
          <rect x="45" y="64" width="10" height="8" fill="url(#chibi-skin)" />
          {/* áo */}
          <path
            d="M 26 78 Q 26 70 36 67 L 64 67 Q 74 70 74 78 L 74 100 L 26 100 Z"
            fill="url(#chibi-shirt)"
          />
          {/* cổ áo trắng */}
          <path d="M 42 67 L 50 74 L 58 67 Z" fill="#ffffff" />
          {/* nút áo */}
          <circle cx="50" cy="86" r="1.5" fill="#ffffff" opacity="0.85" />
          <circle cx="50" cy="92" r="1.5" fill="#ffffff" opacity="0.85" />
        </g>
      )}

      {/* === HEAD === */}
      <g>
        {/* tóc phía sau */}
        <ellipse cx="50" cy="40" rx="29" ry="28" fill="url(#chibi-hair)" />
        {/* mặt */}
        <ellipse cx="50" cy="46" rx="24" ry="24" fill="url(#chibi-skin)" />
        {/* mái tóc trước (kiểu tóc cậu bé) */}
        <path
          d="M 23 38
             Q 28 16 50 16
             Q 72 16 77 38
             Q 70 28 60 30
             Q 56 36 50 34
             Q 44 36 40 30
             Q 30 28 23 38 Z"
          fill="url(#chibi-hair)"
        />
        {/* lọn tóc lòa xòa */}
        <path d="M 24 36 Q 20 50 25 62 L 28 60 Q 27 50 29 40 Z" fill="url(#chibi-hair)" />
        <path d="M 76 36 Q 80 50 75 62 L 72 60 Q 73 50 71 40 Z" fill="url(#chibi-hair)" />
        {/* highlight tóc */}
        <path
          d="M 38 22 Q 46 18 56 20"
          stroke="#6b4530"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
          opacity="0.5"
        />

        {/* má hồng */}
        <ellipse cx="31" cy="54" rx="5" ry="3" fill="url(#chibi-cheek)" />
        <ellipse cx="69" cy="54" rx="5" ry="3" fill="url(#chibi-cheek)" />

        {/* lông mày */}
        <path
          d="M 35 38 Q 40 35 45 38"
          stroke="#2a1a0f"
          strokeWidth="1.4"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 55 38 Q 60 35 65 38"
          stroke="#2a1a0f"
          strokeWidth="1.4"
          fill="none"
          strokeLinecap="round"
        />

        {/* mắt trái */}
        <g className="chibi-eye chibi-eye-left">
          <ellipse cx={LEFT_EYE.cx} cy={LEFT_EYE.cy} rx="4.8" ry="6" fill="#ffffff" />
          <circle
            cx={LEFT_EYE.cx + pupils.left.x}
            cy={LEFT_EYE.cy + pupils.left.y}
            r="3"
            fill="#1a1a1a"
          />
          <circle
            cx={LEFT_EYE.cx + pupils.left.x + 0.9}
            cy={LEFT_EYE.cy + pupils.left.y - 1.3}
            r="1.1"
            fill="#ffffff"
          />
          <circle
            cx={LEFT_EYE.cx + pupils.left.x - 0.8}
            cy={LEFT_EYE.cy + pupils.left.y + 1.2}
            r="0.5"
            fill="#ffffff"
            opacity="0.7"
          />
        </g>

        {/* mắt phải */}
        <g className="chibi-eye chibi-eye-right">
          <ellipse cx={RIGHT_EYE.cx} cy={RIGHT_EYE.cy} rx="4.8" ry="6" fill="#ffffff" />
          <circle
            cx={RIGHT_EYE.cx + pupils.right.x}
            cy={RIGHT_EYE.cy + pupils.right.y}
            r="3"
            fill="#1a1a1a"
          />
          <circle
            cx={RIGHT_EYE.cx + pupils.right.x + 0.9}
            cy={RIGHT_EYE.cy + pupils.right.y - 1.3}
            r="1.1"
            fill="#ffffff"
          />
          <circle
            cx={RIGHT_EYE.cx + pupils.right.x - 0.8}
            cy={RIGHT_EYE.cy + pupils.right.y + 1.2}
            r="0.5"
            fill="#ffffff"
            opacity="0.7"
          />
        </g>

        {/* mũi nhỏ */}
        <circle cx="50" cy="54" r="0.7" fill="#c08868" opacity="0.6" />

        {/* miệng cười */}
        <path
          d="M 45 59 Q 50 64 55 59"
          stroke="#8b4a2a"
          strokeWidth="1.4"
          fill="none"
          strokeLinecap="round"
        />
        {/* răng/lưỡi hồng nhỏ */}
        <path d="M 47 60 Q 50 62 53 60 Q 50 61 47 60 Z" fill="#ff9a9a" opacity="0.7" />
      </g>

      {/* === HANDS === (chỉ mode peek — nắm mép tường) */}
      {mode === 'peek' && (
        <g>
          {/* tay trái — bàn tay nắm chỉa xuống */}
          <g className="chibi-hand chibi-hand-left">
            {/* cổ tay/cánh */}
            <path
              d="M 22 78 Q 20 84 22 90 L 30 90 Q 32 84 30 78 Z"
              fill="url(#chibi-skin)"
            />
            {/* các ngón cong xuống */}
            <path
              d="M 21 86 Q 19 92 22 96 L 24 96 Q 24 91 24 87 Z"
              fill="url(#chibi-skin)"
            />
            <path
              d="M 25 87 Q 24 93 26 97 L 28 97 Q 28 92 27 87 Z"
              fill="url(#chibi-skin)"
            />
            <path
              d="M 29 86 Q 30 92 28 96 L 31 95 Q 32 90 31 86 Z"
              fill="url(#chibi-skin)"
            />
          </g>

          {/* tay phải */}
          <g className="chibi-hand chibi-hand-right">
            <path
              d="M 78 78 Q 80 84 78 90 L 70 90 Q 68 84 70 78 Z"
              fill="url(#chibi-skin)"
            />
            <path
              d="M 79 86 Q 81 92 78 96 L 76 96 Q 76 91 76 87 Z"
              fill="url(#chibi-skin)"
            />
            <path
              d="M 75 87 Q 76 93 74 97 L 72 97 Q 72 92 73 87 Z"
              fill="url(#chibi-skin)"
            />
            <path
              d="M 71 86 Q 70 92 72 96 L 69 95 Q 68 90 69 86 Z"
              fill="url(#chibi-skin)"
            />
          </g>
        </g>
      )}
    </svg>
  )
}
