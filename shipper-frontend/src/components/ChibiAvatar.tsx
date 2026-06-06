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

        {/* === TAI === (hai bên đầu, ngang tầm mắt-mũi) */}
        <g>
          {/* tai trái */}
          <ellipse cx="21" cy="54" rx="3" ry="5" fill="url(#chibi-skin)" />
          {/* vành trong tai trái */}
          <path
            d="M 21 50 Q 23 54 21 58"
            stroke="#c08868"
            strokeWidth="0.6"
            fill="none"
            opacity="0.55"
            strokeLinecap="round"
          />
          <ellipse cx="21.5" cy="55" rx="1.2" ry="2.2" fill="#e09870" opacity="0.45" />

          {/* tai phải */}
          <ellipse cx="79" cy="54" rx="3" ry="5" fill="url(#chibi-skin)" />
          <path
            d="M 79 50 Q 77 54 79 58"
            stroke="#c08868"
            strokeWidth="0.6"
            fill="none"
            opacity="0.55"
            strokeLinecap="round"
          />
          <ellipse cx="78.5" cy="55" rx="1.2" ry="2.2" fill="#e09870" opacity="0.45" />
        </g>

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

        {/* ============ MŨ LƯỠI TRAI (chìa sang TRÁI, to bự) ============ */}
        {/* chỏm mũ — to hơn, phủ rộng đến gần đỉnh viewBox */}
        <path
          d="M 14 44
             Q 14 6 50 4
             Q 86 6 86 44
             Q 72 39 50 38
             Q 28 39 14 44 Z"
          fill="url(#chibi-cap)"
        />
        {/* gân/sườn mũ chạy ngang (mũ đang xoay) */}
        <path
          d="M 22 22 Q 50 14 78 22"
          stroke="#7c2d12"
          strokeWidth="0.7"
          opacity="0.45"
          fill="none"
          strokeDasharray="1.5 1.2"
        />
        {/* nút chóp mũ */}
        <circle cx="50" cy="7" r="2" fill="#7c2d12" />
        <circle cx="49.4" cy="6.4" r="0.6" fill="#fcd9b5" opacity="0.6" />

        {/* LƯỠI TRAI — wing chìa hẳn sang trái */}
        <path
          d="M 18 36
             Q 4 34 -6 40
             Q -10 46 -4 50
             Q 10 52 22 47
             Q 25 41 18 36 Z"
          fill="url(#chibi-brim)"
        />
        {/* mặt dưới lưỡi trai (bóng tối) */}
        <path
          d="M -4 48 Q 10 51 22 47"
          stroke="#5a1f0a"
          strokeWidth="0.8"
          fill="none"
          opacity="0.55"
        />
        {/* highlight bóng trên đỉnh lưỡi trai */}
        <path
          d="M -2 40 Q 10 37 20 40"
          stroke="#fcd9b5"
          strokeWidth="0.9"
          fill="none"
          opacity="0.6"
          strokeLinecap="round"
        />
        {/* bóng đổ của lưỡi trai lên má bên trái */}
        <ellipse cx="22" cy="50" rx="10" ry="3" fill="#000" opacity="0.1" />

        {/* logo trắng — chuyển sang phải vì lưỡi trai quay trái */}
        <rect x="54" y="22" width="14" height="9" rx="1.5" fill="#ffffff" />
        {/* icon hộp ship */}
        <rect x="57" y="24.5" width="8" height="4.5" rx="0.5" fill="#ea580c" />
        <line x1="61" y1="24.5" x2="61" y2="29" stroke="#ffffff" strokeWidth="0.5" />
        <line x1="57" y1="26.7" x2="65" y2="26.7" stroke="#ffffff" strokeWidth="0.5" />

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

      {/* === TAY NẮM MÉP === (peek mode — mu bàn tay trên mép + 4 ngón cong xuống nắm) */}
      {mode === 'peek' && (
        <g>
          {/* TAY TRÁI nắm mép — bên má trái */}
          <g className="chibi-hand chibi-hand-left">
            {/* mu bàn tay (đặt trên đỉnh mép tường) */}
            <path
              d="M 2 60
                 Q 2 53 9 52
                 L 23 52
                 Q 28 54 28 62
                 L 28 73
                 L 2 73 Z"
              fill="url(#chibi-skin)"
            />
            {/* ngón cái cuộn trên (lộ trên mu bàn tay) */}
            <ellipse cx="25" cy="56" rx="3" ry="3.2" fill="url(#chibi-skin)" />
            <path
              d="M 23 54 Q 27 55 27.5 58"
              stroke="#d9a578"
              strokeWidth="0.5"
              fill="none"
              opacity="0.55"
            />

            {/* 4 ngón cong xuống nắm qua mép (lộ trên gradient) */}
            {/* ngón trỏ (gần mặt nhất) */}
            <path
              d="M 22 71
                 Q 23 80 21 86
                 Q 20 87 18.5 87
                 Q 17 86.5 17 84
                 L 17 71 Z"
              fill="url(#chibi-skin)"
            />
            {/* ngón giữa (dài nhất) */}
            <path
              d="M 17 71
                 Q 17.5 83 16 88
                 Q 15 89 13.5 89
                 Q 12 88.5 12 86
                 L 12 71 Z"
              fill="url(#chibi-skin)"
            />
            {/* ngón áp út */}
            <path
              d="M 12 71
                 Q 12 82 11 87
                 Q 10 88 8.5 88
                 Q 7 87.5 7 85
                 L 7 71 Z"
              fill="url(#chibi-skin)"
            />
            {/* ngón út (ngắn nhất) */}
            <path
              d="M 7 71
                 Q 6.5 78 5.5 83
                 Q 4.5 84 3 84
                 Q 1.5 83.5 1.5 81
                 L 1.5 71 Z"
              fill="url(#chibi-skin)"
            />

            {/* khía giữa các ngón */}
            <path
              d="M 17 73 L 17.5 85 M 12 73 L 12.5 87 M 7 73 L 7.5 84"
              stroke="#d9a578"
              strokeWidth="0.4"
              opacity="0.55"
            />
            {/* highlight bóng trên mu bàn tay */}
            <path
              d="M 5 56 Q 14 54 23 56"
              stroke="#fff2e0"
              strokeWidth="0.8"
              fill="none"
              opacity="0.55"
              strokeLinecap="round"
            />
            {/* móng ngón nhỏ trên đầu ngón */}
            <ellipse cx="19" cy="85.5" rx="1.2" ry="0.8" fill="#ffd9b5" opacity="0.7" />
            <ellipse cx="14" cy="87.5" rx="1.2" ry="0.8" fill="#ffd9b5" opacity="0.7" />
            <ellipse cx="9" cy="86.5" rx="1.2" ry="0.8" fill="#ffd9b5" opacity="0.7" />
            <ellipse cx="4" cy="82.5" rx="1.1" ry="0.7" fill="#ffd9b5" opacity="0.7" />
          </g>

          {/* TAY PHẢI nắm mép — mirror */}
          <g className="chibi-hand chibi-hand-right">
            <path
              d="M 98 60
                 Q 98 53 91 52
                 L 77 52
                 Q 72 54 72 62
                 L 72 73
                 L 98 73 Z"
              fill="url(#chibi-skin)"
            />
            <ellipse cx="75" cy="56" rx="3" ry="3.2" fill="url(#chibi-skin)" />
            <path
              d="M 77 54 Q 73 55 72.5 58"
              stroke="#d9a578"
              strokeWidth="0.5"
              fill="none"
              opacity="0.55"
            />

            <path
              d="M 78 71
                 Q 77 80 79 86
                 Q 80 87 81.5 87
                 Q 83 86.5 83 84
                 L 83 71 Z"
              fill="url(#chibi-skin)"
            />
            <path
              d="M 83 71
                 Q 82.5 83 84 88
                 Q 85 89 86.5 89
                 Q 88 88.5 88 86
                 L 88 71 Z"
              fill="url(#chibi-skin)"
            />
            <path
              d="M 88 71
                 Q 88 82 89 87
                 Q 90 88 91.5 88
                 Q 93 87.5 93 85
                 L 93 71 Z"
              fill="url(#chibi-skin)"
            />
            <path
              d="M 93 71
                 Q 93.5 78 94.5 83
                 Q 95.5 84 97 84
                 Q 98.5 83.5 98.5 81
                 L 98.5 71 Z"
              fill="url(#chibi-skin)"
            />

            <path
              d="M 83 73 L 82.5 85 M 88 73 L 87.5 87 M 93 73 L 92.5 84"
              stroke="#d9a578"
              strokeWidth="0.4"
              opacity="0.55"
            />
            <path
              d="M 95 56 Q 86 54 77 56"
              stroke="#fff2e0"
              strokeWidth="0.8"
              fill="none"
              opacity="0.55"
              strokeLinecap="round"
            />
            <ellipse cx="81" cy="85.5" rx="1.2" ry="0.8" fill="#ffd9b5" opacity="0.7" />
            <ellipse cx="86" cy="87.5" rx="1.2" ry="0.8" fill="#ffd9b5" opacity="0.7" />
            <ellipse cx="91" cy="86.5" rx="1.2" ry="0.8" fill="#ffd9b5" opacity="0.7" />
            <ellipse cx="96" cy="82.5" rx="1.1" ry="0.7" fill="#ffd9b5" opacity="0.7" />
          </g>
        </g>
      )}
    </svg>
  )
}
