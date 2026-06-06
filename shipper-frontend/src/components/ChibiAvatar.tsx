import { useEffect, useRef, useState } from 'react'

interface ChibiAvatarProps {
  mode?: 'fab' | 'peek'
  className?: string
}

const LEFT_EYE = { cx: 40, cy: 53 }
const RIGHT_EYE = { cx: 60, cy: 53 }
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
        <linearGradient id="chibi-cap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#c2410c" />
        </linearGradient>
        <linearGradient id="chibi-brim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c2410c" />
          <stop offset="100%" stopColor="#7c2d12" />
        </linearGradient>
        {/* shading nhẹ dưới mũ + cằm */}
        <radialGradient id="chibi-face-shade" cx="0.5" cy="0.25" r="0.55">
          <stop offset="60%" stopColor="#000" stopOpacity="0" />
          <stop offset="100%" stopColor="#a86a3a" stopOpacity="0.18" />
        </radialGradient>
      </defs>

      {/* === BODY === (chỉ ở mode fab) */}
      {mode === 'fab' && (
        <g>
          {/* cổ */}
          <rect x="45" y="70" width="10" height="6" fill="url(#chibi-skin)" />
          <path d="M 45 73 Q 50 75 55 73 L 55 76 L 45 76 Z" fill="#d9a578" opacity="0.4" />
          {/* áo cam */}
          <path
            d="M 24 84 Q 24 74 36 71 L 64 71 Q 76 74 76 84 L 76 100 L 24 100 Z"
            fill="url(#chibi-shirt)"
          />
          {/* cổ áo V trắng */}
          <path d="M 41 71 L 50 80 L 59 71 Z" fill="#ffffff" />
          {/* nút áo */}
          <circle cx="50" cy="88" r="1.4" fill="#ffffff" opacity="0.85" />
          <circle cx="50" cy="94" r="1.4" fill="#ffffff" opacity="0.85" />
        </g>
      )}

      {/* === HEAD === đầu tròn to */}
      <g>
        {/* tóc phía sau — vùng quầng tóc lớn */}
        <circle cx="50" cy="46" r="30" fill="url(#chibi-hair)" />

        {/* khuôn mặt — tròn xoe */}
        <circle cx="50" cy="50" r="28" fill="url(#chibi-skin)" />

        {/* mái tóc trước (lộ ra dưới mũ ở thái dương) */}
        <path
          d="M 22 44
             Q 24 36 30 34
             Q 32 40 36 40
             Q 30 42 22 48 Z"
          fill="url(#chibi-hair)"
        />
        <path
          d="M 78 44
             Q 76 36 70 34
             Q 68 40 64 40
             Q 70 42 78 48 Z"
          fill="url(#chibi-hair)"
        />
        {/* lọn tóc dài hai bên má (kiểu tóc bé) */}
        <path d="M 22 46 Q 19 58 24 68 L 28 64 Q 26 56 28 48 Z" fill="url(#chibi-hair)" />
        <path d="M 78 46 Q 81 58 76 68 L 72 64 Q 74 56 72 48 Z" fill="url(#chibi-hair)" />
        {/* lông mái xõa nhẹ trước trán (sẽ bị mũ phủ phần lớn) */}
        <path
          d="M 36 36 Q 42 32 50 33 Q 58 32 64 36 Q 58 34 50 35 Q 42 34 36 36 Z"
          fill="url(#chibi-hair)"
          opacity="0.95"
        />

        {/* shading dưới mũ làm trán có chiều sâu */}
        <ellipse cx="50" cy="44" rx="22" ry="6" fill="#7c4a2a" opacity="0.12" />

        {/* ============ MŨ LƯỠI TRAI ============ */}
        {/* phần chỏm (crown) — vòm trên đầu */}
        <path
          d="M 22 40
             Q 22 18 50 18
             Q 78 18 78 40
             Q 70 36 50 35
             Q 30 36 22 40 Z"
          fill="url(#chibi-cap)"
        />
        {/* đường khâu giữa mũ */}
        <path
          d="M 50 18 L 50 35"
          stroke="#7c2d12"
          strokeWidth="0.6"
          opacity="0.5"
          strokeDasharray="1.5 1.2"
        />
        {/* nút chóp mũ */}
        <circle cx="50" cy="19" r="1.5" fill="#7c2d12" />

        {/* lưỡi trai — chìa ra phía trước (cong xuống nhẹ) */}
        <path
          d="M 16 38
             Q 50 50 84 38
             Q 84 42 82 44
             Q 50 53 18 44
             Q 16 42 16 38 Z"
          fill="url(#chibi-brim)"
        />
        {/* highlight bóng trên đỉnh lưỡi trai */}
        <path
          d="M 22 40 Q 50 47 78 40"
          stroke="#fcd9b5"
          strokeWidth="0.8"
          fill="none"
          opacity="0.5"
          strokeLinecap="round"
        />

        {/* logo nhỏ trắng phía trước mũ */}
        <rect x="44" y="25" width="12" height="7" rx="1.2" fill="#ffffff" />
        {/* icon hộp ship trên logo */}
        <rect x="46.5" y="27" width="7" height="3.5" rx="0.4" fill="#ea580c" />
        <line x1="50" y1="27" x2="50" y2="30.5" stroke="#ffffff" strokeWidth="0.4" />
        <line x1="46.5" y1="28.5" x2="53.5" y2="28.5" stroke="#ffffff" strokeWidth="0.4" />

        {/* === MẶT === */}
        {/* má hồng */}
        <ellipse cx="30" cy="60" rx="5.5" ry="3" fill="url(#chibi-cheek)" />
        <ellipse cx="70" cy="60" rx="5.5" ry="3" fill="url(#chibi-cheek)" />

        {/* lông mày (lộ một chút dưới mũ) */}
        <path
          d="M 34 46 Q 40 44 45 46"
          stroke="#2a1a0f"
          strokeWidth="1.4"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 55 46 Q 60 44 66 46"
          stroke="#2a1a0f"
          strokeWidth="1.4"
          fill="none"
          strokeLinecap="round"
        />

        {/* mắt trái — to tròn */}
        <g className="chibi-eye chibi-eye-left">
          <ellipse cx={LEFT_EYE.cx} cy={LEFT_EYE.cy} rx="5.5" ry="7" fill="#ffffff" />
          <circle
            cx={LEFT_EYE.cx + pupils.left.x}
            cy={LEFT_EYE.cy + pupils.left.y}
            r="3.5"
            fill="#1a1a1a"
          />
          {/* highlight to */}
          <circle
            cx={LEFT_EYE.cx + pupils.left.x + 1.1}
            cy={LEFT_EYE.cy + pupils.left.y - 1.6}
            r="1.3"
            fill="#ffffff"
          />
          {/* highlight nhỏ phụ */}
          <circle
            cx={LEFT_EYE.cx + pupils.left.x - 0.9}
            cy={LEFT_EYE.cy + pupils.left.y + 1.4}
            r="0.6"
            fill="#ffffff"
            opacity="0.7"
          />
        </g>

        {/* mắt phải */}
        <g className="chibi-eye chibi-eye-right">
          <ellipse cx={RIGHT_EYE.cx} cy={RIGHT_EYE.cy} rx="5.5" ry="7" fill="#ffffff" />
          <circle
            cx={RIGHT_EYE.cx + pupils.right.x}
            cy={RIGHT_EYE.cy + pupils.right.y}
            r="3.5"
            fill="#1a1a1a"
          />
          <circle
            cx={RIGHT_EYE.cx + pupils.right.x + 1.1}
            cy={RIGHT_EYE.cy + pupils.right.y - 1.6}
            r="1.3"
            fill="#ffffff"
          />
          <circle
            cx={RIGHT_EYE.cx + pupils.right.x - 0.9}
            cy={RIGHT_EYE.cy + pupils.right.y + 1.4}
            r="0.6"
            fill="#ffffff"
            opacity="0.7"
          />
        </g>

        {/* mũi nhỏ */}
        <circle cx="50" cy="62" r="0.9" fill="#c08868" opacity="0.55" />

        {/* miệng cười */}
        <path
          d="M 44 67 Q 50 73 56 67"
          stroke="#8b4a2a"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
        {/* lưỡi/răng hồng nhỏ */}
        <path d="M 46 68 Q 50 71 54 68 Q 50 69.5 46 68 Z" fill="#ff9a9a" opacity="0.7" />

        {/* shading nhẹ dọc cằm để mặt có khối */}
        <ellipse cx="50" cy="70" rx="22" ry="8" fill="url(#chibi-face-shade)" />
      </g>

      {/* === HANDS === (chỉ mode peek — bàn tay thật nắm mép) */}
      {mode === 'peek' && (
        <g>
          {/* TAY TRÁI */}
          <g className="chibi-hand chibi-hand-left">
            {/* cổ tay/cánh phía trên */}
            <path
              d="M 10 76
                 Q 10 72 14 71
                 L 28 71
                 Q 32 72 32 76
                 L 32 86
                 Q 32 89 28 89
                 L 14 89
                 Q 10 89 10 86 Z"
              fill="url(#chibi-skin)"
            />
            {/* ngón cái — chìa lên phía sau mép (visible từ trên) */}
            <ellipse cx="32" cy="78" rx="3.5" ry="2.8" fill="url(#chibi-skin)" />
            <path
              d="M 30 76 Q 34 76 35 79"
              stroke="#d9a578"
              strokeWidth="0.5"
              fill="none"
              opacity="0.6"
            />
            {/* 4 ngón cong xuống nắm mép */}
            {/* ngón trỏ */}
            <path
              d="M 12 86
                 Q 11 92 13 97
                 Q 14 98 15.5 98
                 Q 17 97.5 17 95
                 L 17 86 Z"
              fill="url(#chibi-skin)"
            />
            {/* ngón giữa */}
            <path
              d="M 17 86
                 Q 16.5 93 18 98
                 Q 19 99 20.5 99
                 Q 22 98.5 22 96
                 L 22 86 Z"
              fill="url(#chibi-skin)"
            />
            {/* ngón áp út */}
            <path
              d="M 22 86
                 Q 22 93 23.5 97
                 Q 24.5 98 26 97.5
                 Q 27 97 27 95
                 L 27 86 Z"
              fill="url(#chibi-skin)"
            />
            {/* ngón út (ngắn hơn) */}
            <path
              d="M 27 86
                 Q 27.5 91 29 94
                 Q 30 95 31 94.5
                 Q 32 94 32 92
                 L 32 86 Z"
              fill="url(#chibi-skin)"
            />
            {/* khía giữa các ngón cho rõ */}
            <path
              d="M 17 88 L 17 96 M 22 88 L 22 97 M 27 88 L 27 95"
              stroke="#d9a578"
              strokeWidth="0.4"
              opacity="0.55"
            />
            {/* highlight bóng trên lưng bàn tay */}
            <path
              d="M 14 74 Q 20 73 28 74"
              stroke="#fff2e0"
              strokeWidth="0.7"
              fill="none"
              opacity="0.55"
              strokeLinecap="round"
            />
          </g>

          {/* TAY PHẢI — mirror */}
          <g className="chibi-hand chibi-hand-right">
            <path
              d="M 90 76
                 Q 90 72 86 71
                 L 72 71
                 Q 68 72 68 76
                 L 68 86
                 Q 68 89 72 89
                 L 86 89
                 Q 90 89 90 86 Z"
              fill="url(#chibi-skin)"
            />
            <ellipse cx="68" cy="78" rx="3.5" ry="2.8" fill="url(#chibi-skin)" />
            <path
              d="M 70 76 Q 66 76 65 79"
              stroke="#d9a578"
              strokeWidth="0.5"
              fill="none"
              opacity="0.6"
            />
            <path
              d="M 88 86
                 Q 89 92 87 97
                 Q 86 98 84.5 98
                 Q 83 97.5 83 95
                 L 83 86 Z"
              fill="url(#chibi-skin)"
            />
            <path
              d="M 83 86
                 Q 83.5 93 82 98
                 Q 81 99 79.5 99
                 Q 78 98.5 78 96
                 L 78 86 Z"
              fill="url(#chibi-skin)"
            />
            <path
              d="M 78 86
                 Q 78 93 76.5 97
                 Q 75.5 98 74 97.5
                 Q 73 97 73 95
                 L 73 86 Z"
              fill="url(#chibi-skin)"
            />
            <path
              d="M 73 86
                 Q 72.5 91 71 94
                 Q 70 95 69 94.5
                 Q 68 94 68 92
                 L 68 86 Z"
              fill="url(#chibi-skin)"
            />
            <path
              d="M 83 88 L 83 96 M 78 88 L 78 97 M 73 88 L 73 95"
              stroke="#d9a578"
              strokeWidth="0.4"
              opacity="0.55"
            />
            <path
              d="M 86 74 Q 80 73 72 74"
              stroke="#fff2e0"
              strokeWidth="0.7"
              fill="none"
              opacity="0.55"
              strokeLinecap="round"
            />
          </g>
        </g>
      )}
    </svg>
  )
}
