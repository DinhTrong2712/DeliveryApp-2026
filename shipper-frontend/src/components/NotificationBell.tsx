import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import { useSignalR } from '../hooks/useSignalR'

interface NotificationItem {
  id: string
  title: string
  body: string
  link?: string | null
  type?: string | null
  readAt?: string | null
  createdAt: string
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'vừa xong'
  if (m < 60) return `${m} phút`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} giờ`
  const d = Math.floor(h / 24)
  return `${d} ngày`
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/notifications', { params: { take: 20 } })
      setItems(res.data.items ?? [])
      setUnread(res.data.unread ?? 0)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useSignalR({
    NotificationCreated: (n: unknown) => {
      const item = n as NotificationItem
      setItems(prev => [item, ...prev].slice(0, 20))
      setUnread(c => c + 1)
    },
  }, ['shipper'])

  const handleClickItem = async (n: NotificationItem) => {
    if (!n.readAt) {
      try {
        await api.put(`/notifications/${n.id}/read`)
        setItems(prev => prev.map(x => x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x))
        setUnread(c => Math.max(0, c - 1))
      } catch { /* ignore */ }
    }
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  const handleMarkAll = async () => {
    try {
      await api.put('/notifications/read-all')
      const now = new Date().toISOString()
      setItems(prev => prev.map(x => x.readAt ? x : { ...x, readAt: now }))
      setUnread(0)
    } catch { /* ignore */ }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-label="Thông báo"
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Thông báo</p>
            {unread > 0 && (
              <button onClick={handleMarkAll} className="text-xs text-blue-600 hover:text-blue-700">
                Đánh dấu đã đọc
              </button>
            )}
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="py-8 text-center text-gray-400 text-sm">Đang tải...</div>
            ) : items.length === 0 ? (
              <div className="py-8 text-center text-gray-400 text-sm">Chưa có thông báo</div>
            ) : (
              items.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClickItem(n)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors ${n.readAt ? '' : 'bg-blue-50/40'}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.readAt && <span className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${n.readAt ? 'text-gray-700' : 'text-gray-900 font-semibold'}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5 leading-snug">{n.body}</p>
                      <p className="text-[11px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
