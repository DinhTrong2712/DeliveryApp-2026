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

const IconBrain = ({ className }: { className: string }) => (
  <svg className={className} {...svgProps}>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
)

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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mt-2">
      <div className="overflow-x-auto max-h-48">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              {columns.map(col => (
                <th key={col} className="px-2 py-1.5 text-left font-medium text-gray-600 whitespace-nowrap">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, MAX_TABLE_ROWS).map((row, i) => (
              <tr key={i} className="border-t border-gray-50">
                {columns.map(col => (
                  <td key={col} className="px-2 py-1.5 text-gray-700 whitespace-nowrap">{formatCellValue(row[col])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > MAX_TABLE_ROWS && (
        <p className="text-[10px] text-gray-400 px-2 py-1 border-t border-gray-50">
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
          className="fixed bottom-20 right-4 sm:bottom-5 sm:right-5 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg hover:scale-105 active:scale-95 transition-transform flex items-center justify-center"
        >
          <IconBrain className="w-7 h-7" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full ring-2 ring-white" />
        </button>
      )}

      {open && (
        <div className="fixed left-0 right-0 bottom-0 top-16 z-30 sm:inset-auto sm:bottom-5 sm:right-5 sm:top-auto sm:w-[380px] sm:h-[560px] flex flex-col bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-3 flex items-center gap-3 text-white">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <IconBrain className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-sm leading-tight">Trợ lý AI</h2>
              <p className="text-[11px] text-white/80 leading-tight">Truy vấn dữ liệu bằng tiếng Việt</p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Đóng"
              className="w-8 h-8 rounded-lg hover:bg-white/15 flex items-center justify-center">
              <IconClose className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 bg-gray-50">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wider px-1">Gợi ý</p>
                {suggestions.map((s, i) => (
                  <button key={i} onClick={() => sendMessage(s)}
                    className="w-full text-left bg-white rounded-xl px-3 py-2.5 shadow-sm text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors border border-gray-100">
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
                        : 'bg-white text-gray-800 border border-gray-100 rounded-bl-sm'
                  }`}>
                    {msg.loading ? (
                      <div className="flex items-center gap-2 text-gray-400 py-1">
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

          <div className="border-t border-gray-100 p-2 bg-white">
            {messages.length > 0 && (
              <button onClick={clearSession}
                className="text-[11px] text-gray-400 hover:text-gray-600 px-2 py-1 mb-1">
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
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60 bg-gray-50"
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
