import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import api from '../lib/api'
import { formatVND } from '../lib/formatters'
import { useAuthStore } from '../stores/authStore'
import ChibiAvatar from './ChibiAvatar'

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
          className="fixed bottom-20 right-4 sm:bottom-5 sm:right-5 z-40 w-16 h-16 hover:scale-110 active:scale-95 transition-transform flex items-center justify-center group chibi-bob"
        >
          {/* Vòng tròn gradient cam — viền trắng + bóng đổ */}
          <span className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-300 via-orange-400 to-orange-600 ring-2 ring-white dark:ring-gray-900 shadow-[0_4px_14px_rgba(217,82,26,0.4)] group-hover:shadow-[0_6px_20px_rgba(217,82,26,0.55)] transition-shadow duration-200" />
          {/* Chibi trong vòng — clip để gọn trong hình tròn */}
          <span className="relative w-full h-full rounded-full overflow-hidden">
            <ChibiAvatar mode="fab" className="w-full h-full" />
          </span>
          {/* Notification dot */}
          <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full ring-2 ring-white dark:ring-gray-900 animate-pulse" />
        </button>
      )}

      {open && (
        <div className="fixed left-0 right-0 bottom-0 top-16 z-30 sm:inset-auto sm:bottom-5 sm:right-5 sm:top-auto sm:w-[380px] sm:h-[560px] flex flex-col bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800">
          {/* Chibi lấp ló trên header — 2 nắm đấm tựa lên mép header, cằm khuất sau gradient.
              Render TRƯỚC header trong DOM + KHÔNG z-index → header gradient phủ phần dưới
              SVG tự nhiên (cằm, đáy nắm đấm) tạo hiệu ứng tựa lên tường. */}
          <div
            className="absolute left-3 sm:left-5 pointer-events-none chibi-climb"
            style={{ top: -53, width: 72, height: 72 }}
            aria-hidden
          >
            <div className="chibi-sway w-full h-full">
              <ChibiAvatar mode="peek" className="w-full h-full drop-shadow-[0_4px_6px_rgba(0,0,0,0.18)]" />
            </div>
          </div>

          <div className="relative bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3 flex items-center gap-3 text-white rounded-t-2xl">
            {/* Chỗ trống cho chibi lấp ló phía trên-trái (tay nắm mép) */}
            <div className="w-16 flex-shrink-0" />
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
