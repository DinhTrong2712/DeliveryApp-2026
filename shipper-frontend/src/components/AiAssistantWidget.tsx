import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import api from '../lib/api'
import { formatVND } from '../lib/formatters'
import { useAuthStore } from '../stores/authStore'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  tableData?: Record<string, unknown>[]
  error?: string
  loading?: boolean
}

const SESSION_KEY = 'ai_session_id'
const MAX_TABLE_ROWS = 10

const SUGGESTIONS_BY_ROLE: Record<string, string[]> = {
  Admin: [
    'Doanh thu hôm nay là bao nhiêu?',
    'Shipper nào giao nhiều đơn nhất tuần này?',
    'Tổng tiền mặt và chuyển khoản tháng này?',
  ],
  Accountant: [
    'Doanh thu hôm nay là bao nhiêu?',
    'Có bao nhiêu đơn chưa thu được tiền hôm nay?',
    'Danh sách đơn chưa giao hôm nay?',
  ],
  Shipper: [
    'Hôm nay tôi cần giao bao nhiêu đơn?',
    'Tổng tiền tôi đã thu hôm nay?',
    'Tuyến nào tôi sắp giao?',
  ],
}

const svgProps = { fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' } as const

const SKIN = '#FDE2C9'
const SKIN_STROKE = '#A87650'
const SHIRT = '#F26B2C'
const SHIRT_DARK = '#D9521A'
const CAP_TOP = '#F26B2C'
const CAP_BRIM = '#9C3812'
const EYES = '#1F2937'
const BLUSH = '#FCA5A5'

/**
 * Chibi bé shipper đội mũ lưỡi trai — trợ lý AI.
 * - `waving`: tay phải vẫy nhẹ (nút FAB).
 * - `peeking`: ẩn thân, chỉ giữ đầu+mũ (chế độ lấp ló sau khung chat).
 * - Mắt: con ngươi liếc theo vị trí chuột trên màn hình.
 */
const ChibiBoy = ({ className, waving = false, peeking = false }: {
  className?: string
  waving?: boolean
  peeking?: boolean
}) => {
  const svgRef = useRef<SVGSVGElement>(null)
  const [pupil, setPupil] = useState({ x: 0, y: 0 })

  // Theo dõi vị trí chuột → tính offset con ngươi.
  // Ghi vào state nhưng throttle bằng requestAnimationFrame để mượt.
  useEffect(() => {
    let raf = 0
    let latest: { x: number; y: number } | null = null

    const handle = (e: MouseEvent) => {
      latest = { x: e.clientX, y: e.clientY }
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        if (!latest || !svgRef.current) return
        const rect = svgRef.current.getBoundingClientRect()
        // Tâm cụm mắt ở khoảng y=26 trên viewBox 64 → 40% chiều cao
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height * 0.4
        const dx = latest.x - cx
        const dy = latest.y - cy
        const dist = Math.hypot(dx, dy)
        const MAX_OFFSET = 1.7 // đơn vị viewBox
        if (dist < 1) {
          setPupil({ x: 0, y: 0 })
          return
        }
        const intensity = Math.min(dist / 280, 1)
        setPupil({
          x: (dx / dist) * MAX_OFFSET * intensity,
          y: (dy / dist) * MAX_OFFSET * intensity * 0.85,
        })
      })
    }

    window.addEventListener('mousemove', handle, { passive: true })
    return () => {
      window.removeEventListener('mousemove', handle)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <svg ref={svgRef} className={className} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" overflow="visible">
      {/* Thân + tay — bỏ qua khi peeking để chibi chỉ hiện đầu */}
      {!peeking && (
        <>
          {/* Áo polo cam */}
          <path
            d="M 18 40 Q 18 38 22 38 L 42 38 Q 46 38 46 40 L 50 64 L 14 64 Z"
            fill={SHIRT}
            stroke={SHIRT_DARK}
            strokeWidth="0.8"
          />
          {/* Logo nhỏ ngực — gợi áo shipper */}
          <rect x="38" y="44" width="6" height="3" rx="0.5" fill="#FFFFFF" opacity="0.85" />
          <rect x="38.5" y="44.5" width="5" height="2" rx="0.3" fill={SHIRT_DARK} />
          {/* Khuy áo */}
          <circle cx="28" cy="46" r="1.1" fill="#FFFFFF" />
          {/* Cổ */}
          <rect x="28" y="35" width="8" height="5" fill={SKIN} />
        </>
      )}

      {/* Mặt */}
      <circle cx="32" cy="25" r="13" fill={SKIN} stroke={SKIN_STROKE} strokeWidth="0.8" />

      {/* Mũ lưỡi trai — chao trên đầu + lưỡi trai chìa ra phía trước-trái */}
      {/* Crown (chao mũ): bán nguyệt ôm đỉnh đầu */}
      <path
        d="M 20 16 Q 20 6 32 5 Q 44 6 44 16 Q 44 17 43 17 L 21 17 Q 20 17 20 16 Z"
        fill={CAP_TOP}
        stroke={CAP_BRIM}
        strokeWidth="0.8"
      />
      {/* Highlight bóng trên đỉnh */}
      <ellipse cx="28" cy="9" rx="4" ry="1.5" fill="#FFFFFF" opacity="0.35" />
      {/* Lưỡi trai (visor) — chìa sang trái */}
      <path
        d="M 8 17 Q 8 14 13 14 L 25 14 Q 26 17 25 18 L 13 18 Q 8 19 8 17 Z"
        fill={CAP_BRIM}
        stroke={CAP_BRIM}
        strokeWidth="0.5"
        strokeLinejoin="round"
      />
      {/* Logo cam nhỏ trên mũ */}
      <circle cx="32" cy="11" r="1.6" fill="#FFFFFF" />
      <circle cx="32" cy="11" r="0.8" fill={SHIRT_DARK} />

      {/* ── MẮT — tròng trắng cố định, con ngươi liếc theo chuột ── */}
      <ellipse cx="27" cy="26" rx="2.4" ry="2.9" fill="#FFFFFF" stroke={EYES} strokeWidth="0.5" />
      <ellipse cx="37" cy="26" rx="2.4" ry="2.9" fill="#FFFFFF" stroke={EYES} strokeWidth="0.5" />
      <ellipse cx={27 + pupil.x} cy={26 + pupil.y} rx="1.5" ry="1.9" fill={EYES} />
      <ellipse cx={37 + pupil.x} cy={26 + pupil.y} rx="1.5" ry="1.9" fill={EYES} />
      {/* Highlight con ngươi */}
      <circle cx={26.5 + pupil.x} cy={25.4 + pupil.y} r="0.55" fill="#FFFFFF" />
      <circle cx={36.5 + pupil.x} cy={25.4 + pupil.y} r="0.55" fill="#FFFFFF" />

      {/* Má hồng */}
      <circle cx="23" cy="30" r="2.2" fill={BLUSH} opacity="0.7" />
      <circle cx="41" cy="30" r="2.2" fill={BLUSH} opacity="0.7" />
      {/* Cười nhẹ */}
      <path d="M 28 32 Q 32 35 36 32" stroke="#7A4A2F" strokeWidth="1.4" fill="none" strokeLinecap="round" />

      {/* Tay — chỉ khi không peeking */}
      {!peeking && (
        waving ? (
          <>
            <ellipse cx="17" cy="46" rx="3" ry="6" fill={SKIN} stroke={SKIN_STROKE} strokeWidth="0.6" />
            <g className="chibi-wave-hand">
              <path d="M 47 42 Q 53 32 55 22" stroke={SKIN} strokeWidth="5" strokeLinecap="round" fill="none" />
              <circle cx="55" cy="20" r="3.6" fill={SKIN} stroke={SKIN_STROKE} strokeWidth="0.6" />
              <path d="M 53 18 L 54 16 M 55 17 L 56 15 M 57 18 L 58 16" stroke={SKIN_STROKE} strokeWidth="0.5" strokeLinecap="round" />
            </g>
          </>
        ) : (
          <>
            <ellipse cx="17" cy="46" rx="3" ry="6" fill={SKIN} stroke={SKIN_STROKE} strokeWidth="0.6" />
            <ellipse cx="47" cy="46" rx="3" ry="6" fill={SKIN} stroke={SKIN_STROKE} strokeWidth="0.6" />
          </>
        )
      )}
    </svg>
  )
}

const IconClose = ({ className }: { className: string }) => (
  <svg className={className} {...svgProps}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const IconSend = () => (
  <svg className="w-5 h-5" {...svgProps}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
)

function getOrCreateSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(SESSION_KEY, id) }
  return id
}

function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'number') {
    if (value > 10000) return formatVND(value)
    return value.toLocaleString('vi-VN')
  }
  if (typeof value === 'string' && value.includes('T') && value.includes('Z')) {
    try { return new Date(value).toLocaleDateString('vi-VN') } catch { return value }
  }
  return String(value)
}

function ResultTable({ rows }: { rows: Record<string, unknown>[] }) {
  const columns = Object.keys(rows[0])
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden mt-2">
      <div className="overflow-x-auto max-h-48">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 dark:bg-gray-950 sticky top-0">
            <tr>
              {columns.map(col => (
                <th key={col} className="px-2 py-1.5 text-left font-medium text-gray-600 dark:text-gray-400 whitespace-nowrap">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, MAX_TABLE_ROWS).map((row, i) => (
              <tr key={i} className="border-t border-gray-50 dark:border-gray-800">
                {columns.map(col => (
                  <td key={col} className="px-2 py-1.5 text-gray-700 dark:text-gray-300 whitespace-nowrap">{formatCellValue(row[col])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > MAX_TABLE_ROWS && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500 px-2 py-1 border-t border-gray-50 dark:border-gray-800">
          Hiển thị {MAX_TABLE_ROWS}/{rows.length}
        </p>
      )}
    </div>
  )
}

export default function AiAssistantWidget() {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  if (!user) return null
  if (location.pathname === '/login' || location.pathname === '/') return null

  const suggestions = SUGGESTIONS_BY_ROLE[user.role] ?? []

  const sendMessage = async (question: string) => {
    if (!question.trim() || loading) return
    const sessionId = getOrCreateSessionId()
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: question }
    const assistantMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', content: '', loading: true }
    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await api.post('/ai/chat', { question, sessionId })
      const data = res.data
      if (data.sessionId) localStorage.setItem(SESSION_KEY, data.sessionId)
      setMessages(prev => prev.map(m =>
        m.id === assistantMsg.id
          ? { ...m, content: data.answer, tableData: data.tableData, loading: false, error: data.success ? undefined : data.error }
          : m
      ))
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === assistantMsg.id
          ? { ...m, content: 'Có lỗi xảy ra khi kết nối AI.', loading: false, error: 'Lỗi kết nối' }
          : m
      ))
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const clearSession = () => {
    localStorage.setItem(SESSION_KEY, crypto.randomUUID())
    setMessages([])
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Mở trợ lý AI"
          className="fixed bottom-20 right-4 sm:bottom-5 sm:right-5 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 shadow-lg shadow-orange-500/30 hover:scale-105 active:scale-95 transition-transform flex items-center justify-center overflow-hidden ring-2 ring-white dark:ring-gray-800"
        >
          <ChibiBoy className="w-12 h-12" waving />
          <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full ring-2 ring-white" />
        </button>
      )}

      {open && (
        <div className="fixed left-0 right-0 bottom-0 top-16 z-30 sm:inset-auto sm:bottom-5 sm:right-5 sm:top-auto sm:w-[380px] sm:h-[560px] flex flex-col bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800">
          {/* Chibi lấp ló — đầu+mũ nhô lên trên, phần thân khuất sau header chat */}
          {/* Đặt TRƯỚC header trong DOM nên header (gradient cam) sẽ vẽ đè lên phần dưới của chibi. */}
          <div
            className="absolute right-6 sm:right-10 pointer-events-none chibi-peek-in chibi-bob"
            style={{ top: -22, width: 56, height: 56 }}
            aria-hidden
          >
            <ChibiBoy className="w-14 h-14 drop-shadow-md" peeking />
          </div>

          <div className="relative bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3 flex items-center gap-3 text-white rounded-t-2xl">
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-sm leading-tight">Trợ lý AI</h2>
              <p className="text-[11px] text-white/85 leading-tight">Truy vấn dữ liệu bằng tiếng Việt</p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Đóng"
              className="w-8 h-8 rounded-lg hover:bg-white/15 flex items-center justify-center flex-shrink-0">
              <IconClose className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-gray-50 dark:bg-gray-950">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider px-1">Gợi ý</p>
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => sendMessage(s)}
                    className="w-full text-left bg-white dark:bg-gray-900 rounded-xl px-3 py-2.5 shadow-sm text-xs text-gray-700 dark:text-gray-300 hover:bg-blue-50 hover:text-blue-700 transition-colors border border-gray-100 dark:border-gray-800">
                    <span className="mr-1.5">💡</span>{s}
                  </button>
                ))}
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] ${msg.role === 'user' ? '' : 'flex-1'}`}>
                  <div className={`rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-sm'
                      : msg.error
                        ? 'bg-red-50 text-red-700 border border-red-100'
                        : 'bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-800 rounded-bl-sm'
                  }`}>
                    {msg.loading ? (
                      <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 py-1">
                        <div className="flex gap-1">
                          {[0, 1, 2].map(i => (
                            <div key={i} className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                          ))}
                        </div>
                        <span className="text-[11px]">Đang phân tích...</span>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                  {msg.tableData && msg.tableData.length > 0 && <ResultTable rows={msg.tableData} />}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 p-2 bg-white dark:bg-gray-900">
            {messages.length > 0 && (
              <button onClick={clearSession}
                className="text-[11px] text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 px-2 py-1 mb-1">
                Cuộc trò chuyện mới
              </button>
            )}
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Hỏi về dữ liệu..."
                disabled={loading}
                className="flex-1 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 bg-gray-50 dark:bg-gray-950"
                maxLength={500}
              />
              <button type="submit" disabled={loading || !input.trim()}
                className="bg-blue-600 text-white w-10 h-10 rounded-xl flex items-center justify-center disabled:opacity-60 flex-shrink-0">
                <IconSend />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
