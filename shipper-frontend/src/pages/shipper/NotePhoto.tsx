import { useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../lib/api'

export default function NotePhoto() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    const url = URL.createObjectURL(f)
    setPreview(url)
  }

  const handleUpload = async () => {
    if (!file || !id) return
    setLoading(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      if (caption) form.append('caption', caption)
      await api.post(`/orders/${id}/photos`, form, { headers: { 'Content-Type': 'multipart/form-data' } })
      navigate(-1)
    } catch {
      setError('Tải ảnh thất bại. Kiểm tra: tối đa 5 ảnh, mỗi ảnh < 10MB.')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveNote = async () => {
    if (!id || !note.trim()) return
    setNoteSaving(true)
    try {
      await api.patch(`/orders/${id}/note`, { note })
      navigate(-1)
    } catch {
      // ignore
    } finally {
      setNoteSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="bg-white dark:bg-gray-900 sticky top-0 z-10 border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="min-h-[48px] min-w-[48px] flex items-center justify-center text-gray-600 dark:text-gray-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-bold text-gray-900 dark:text-gray-100">Ảnh & Ghi chú</h1>
      </div>

      <div className="px-4 pt-4 space-y-4 pb-8">
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm">
          <p className="font-medium text-gray-900 dark:text-gray-100 mb-3">Thêm ảnh chứng từ</p>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

          {preview ? (
            <div className="mb-3">
              <img src={preview} alt="preview" className="w-full rounded-xl object-cover max-h-64" />
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl py-10 flex flex-col items-center gap-2 text-gray-400 dark:text-gray-500 min-h-[48px]"
            >
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-sm">Chụp ảnh hoặc chọn từ thư viện</span>
            </button>
          )}

          {file && (
            <>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Mô tả ảnh (tùy chọn)"
                className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-2.5 text-base mt-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
              <div className="flex gap-2 mt-3">
                <button onClick={() => { setFile(null); setPreview(null) }} className="flex-1 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-medium min-h-[48px]">
                  Chọn lại
                </button>
                <button onClick={handleUpload} disabled={loading} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-medium min-h-[48px] disabled:opacity-60">
                  {loading ? 'Đang tải...' : 'Tải lên'}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm">
          <p className="font-medium text-gray-900 dark:text-gray-100 mb-3">Ghi chú đơn hàng</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="Thêm ghi chú cho đơn hàng này..."
            className="w-full border border-gray-300 dark:border-gray-700 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSaveNote}
            disabled={noteSaving || !note.trim()}
            className="w-full mt-2 bg-gray-800 text-white py-3 rounded-xl font-medium min-h-[48px] disabled:opacity-60"
          >
            {noteSaving ? 'Đang lưu...' : 'Lưu ghi chú'}
          </button>
        </div>
      </div>
    </div>
  )
}
