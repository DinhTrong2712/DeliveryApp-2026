import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../../lib/api'
import AdminLayout from '../../components/AdminLayout'

type Section = 'system' | 'vietqr' | 'sepay' | 'ai' | 'backup'
type AiProvider = 'openrouter' | 'gemini' | 'openai' | 'anthropic'

const BANKS = [
  { value: '970418', label: 'BIDV' },
  { value: '970415', label: 'Vietinbank (CTG)' },
  { value: '970436', label: 'Vietcombank (VCB)' },
  { value: '970407', label: 'Techcombank (TCB)' },
  { value: '970422', label: 'MB Bank' },
  { value: '970416', label: 'ACB' },
  { value: '970403', label: 'Sacombank' },
  { value: '970423', label: 'TPBank' },
  { value: '970432', label: 'VPBank' },
  { value: '970405', label: 'Agribank' },
  { value: '970431', label: 'Eximbank' },
  { value: '970441', label: 'VIB' },
  { value: '970443', label: 'SHB' },
  { value: '970426', label: 'MSB' },
  { value: '970449', label: 'LPBank' },
  { value: '970425', label: 'ABBank' },
  { value: '970448', label: 'OCB' },
  { value: '970406', label: 'DongA Bank' },
  { value: '970474', label: 'Nam A Bank' },
  { value: '970433', label: 'Viet Capital Bank' },
]

const AI_PROVIDERS: { value: AiProvider; label: string; placeholder: string }[] = [
  { value: 'openrouter', label: 'OpenRouter (đa model)', placeholder: 'sk-or-v1-...' },
  { value: 'openai', label: 'OpenAI (trực tiếp)', placeholder: 'sk-...' },
  { value: 'anthropic', label: 'Anthropic (trực tiếp)', placeholder: 'sk-ant-...' },
  { value: 'gemini', label: 'Google Gemini (trực tiếp)', placeholder: 'AIzaSy...' },
]

const OPENROUTER_MODEL_HINTS: { name: string; note: string }[] = [
  { name: 'deepseek/deepseek-chat-v3.1', note: 'rẻ, mạnh (khuyến nghị)' },
  { name: 'google/gemini-2.5-flash', note: 'nhanh, rẻ' },
  { name: 'openai/gpt-4o-mini', note: 'cân bằng' },
  { name: 'anthropic/claude-haiku-4.5', note: 'chất lượng cao' },
]

const AI_FEATURES = [
  'Hỏi đáp dữ liệu bằng tiếng Việt tự nhiên',
  'Tự động tạo SQL và truy vấn database',
  'Ghi nhớ lịch sử hội thoại trong phiên làm việc',
  'Tổng hợp báo cáo theo yêu cầu',
]

interface VietQrConfig {
  clientId: string; apiKeySet: boolean
  bank1: string; accountNumber1: string; accountName1: string; template1: string
  bank2: string; accountNumber2: string; accountName2: string; template2: string
}

interface BackupItem {
  name: string
  size: number
  createdAt: string
}

// ── Icons (reused across sections) ────────────────────────────────────────
const svgProps = { fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor' } as const

const IconGear = (p: { className?: string }) => (
  <svg className={p.className ?? 'w-4 h-4'} {...svgProps} strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
)

const IconQr = (p: { className?: string }) => (
  <svg className={p.className ?? 'w-4 h-4'} {...svgProps} strokeWidth={1.8}>
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
  </svg>
)

const IconBolt = (p: { className?: string }) => (
  <svg className={p.className ?? 'w-4 h-4'} {...svgProps} strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
  </svg>
)

const IconAi = (p: { className?: string }) => (
  <svg className={p.className ?? 'w-4 h-4'} {...svgProps} strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
  </svg>
)

const IconBackup = (p: { className?: string }) => (
  <svg className={p.className ?? 'w-4 h-4'} {...svgProps} strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
  </svg>
)

const IconCheck = (p: { className?: string; strokeWidth?: number }) => (
  <svg className={p.className ?? 'w-4 h-4'} {...svgProps} strokeWidth={p.strokeWidth ?? 2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
)

const IconClose = (p: { className?: string }) => (
  <svg className={p.className ?? 'w-4 h-4'} {...svgProps} strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
)

const IconSave = (p: { className?: string }) => (
  <svg className={p.className ?? 'w-4 h-4'} {...svgProps} strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
  </svg>
)

const IconEye = (p: { className?: string }) => (
  <svg className={p.className ?? 'w-4 h-4'} {...svgProps} strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
)

const IconEyeOff = (p: { className?: string }) => (
  <svg className={p.className ?? 'w-4 h-4'} {...svgProps} strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
  </svg>
)

const IconCopy = (p: { className?: string }) => (
  <svg className={p.className ?? 'w-4 h-4'} {...svgProps} strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
)

const IconClock = (p: { className?: string }) => (
  <svg className={p.className ?? 'w-4 h-4'} {...svgProps} strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
)

const IconInfo = (p: { className?: string }) => (
  <svg className={p.className ?? 'w-4 h-4'} {...svgProps} strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const IconDownload = (p: { className?: string }) => (
  <svg className={p.className ?? 'w-4 h-4'} {...svgProps} strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
)

const IconUpload = (p: { className?: string }) => (
  <svg className={p.className ?? 'w-4 h-4'} {...svgProps} strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
  </svg>
)

// ── Toast ─────────────────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const show = useCallback((msg: string, ok = true) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast({ msg, ok })
    timerRef.current = setTimeout(() => setToast(null), 3000)
  }, [])
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])
  return { toast, show }
}

// ── Shared components ─────────────────────────────────────────────────────
function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="w-9 h-9 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <h2 className="font-bold text-gray-900 dark:text-gray-100 text-base">{title}</h2>
        <p className="text-sm text-orange-500 mt-0.5">{subtitle}</p>
      </div>
    </div>
  )
}

function Field({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">{label}</label>
      {description && <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">{description}</p>}
      {children}
    </div>
  )
}

function TextInput({ value, onChange, placeholder, readOnly, className = '' }: {
  value: string; onChange?: (v: string) => void; placeholder?: string; readOnly?: boolean; className?: string
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange?.(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      className={`w-full border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white dark:bg-gray-900 ${readOnly ? 'text-gray-500 dark:text-gray-500 bg-gray-50 dark:bg-gray-950' : ''} ${className}`}
    />
  )
}

function BankSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white dark:bg-gray-900"
    >
      <option value="">-- Chọn ngân hàng --</option>
      {BANKS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
    </select>
  )
}

function SaveBtn({ loading, label = 'Lưu thay đổi', disabled }: { loading?: boolean; label?: string; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading || disabled}
      className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
    >
      <IconSave />
      {loading ? 'Đang lưu...' : label}
    </button>
  )
}

function PasswordInput({ value, onChange, show, toggleShow, placeholder }: {
  value: string; onChange: (v: string) => void; show: boolean; toggleShow: () => void; placeholder: string
}) {
  return (
    <div className="relative flex-1">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="new-password"
        className="w-full border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
      />
      <button type="button" onClick={toggleShow} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
        {show ? <IconEyeOff /> : <IconEye />}
      </button>
    </div>
  )
}

function SecondaryBtn({ children, type = 'button', onClick, disabled }: {
  children: React.ReactNode; type?: 'button' | 'submit'; onClick?: () => void; disabled?: boolean
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 whitespace-nowrap">
      {children}
    </button>
  )
}

function ConfiguredBadge({ text = 'Đã cấu hình' }: { text?: string }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
      <IconCheck className="w-3 h-3" strokeWidth={2.5} />
      {text}
    </span>
  )
}

const NAV_ITEMS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'system', label: 'Hệ thống', icon: <IconGear /> },
  { id: 'vietqr', label: 'VietQR', icon: <IconQr /> },
  { id: 'sepay', label: 'SePay', icon: <IconBolt /> },
  { id: 'ai', label: 'Trợ lý AI', icon: <IconAi /> },
  { id: 'backup', label: 'Sao lưu', icon: <IconBackup /> },
]

// ── Main ──────────────────────────────────────────────────────────────────
export default function AdminConfig() {
  const [section, setSection] = useState<Section>('system')
  const [loading, setLoading] = useState(true)
  const { toast, show: showToast } = useToast()

  // System
  const [lockTime, setLockTime] = useState('23:59')
  const [savingSystem, setSavingSystem] = useState(false)

  // VietQR
  const [vqConfig, setVqConfig] = useState<VietQrConfig>({
    clientId: '', apiKeySet: false,
    bank1: '', accountNumber1: '', accountName1: '', template1: '',
    bank2: '', accountNumber2: '', accountName2: '', template2: '',
  })
  const [vqApiKey, setVqApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [savingVq, setSavingVq] = useState(false)
  const [qrTab, setQrTab] = useState<1 | 2>(1)
  const [qrAmount, setQrAmount] = useState('0')
  const [qrContent, setQrContent] = useState('')
  const [qrImage, setQrImage] = useState<string | null>(null)
  const [generatingQr, setGeneratingQr] = useState(false)

  // SePay
  const [sePayKey, setSePayKey] = useState('')
  const [sePayKeySet, setSePayKeySet] = useState(false)
  const [showSePayKey, setShowSePayKey] = useState(false)
  const [savingSePay, setSavingSePay] = useState(false)
  const [copied, setCopied] = useState(false)

  // AI
  const [aiKey, setAiKey] = useState('')
  const [aiKeySet, setAiKeySet] = useState(false)
  const [showAiKey, setShowAiKey] = useState(false)
  const [savingAi, setSavingAi] = useState(false)
  const [aiProvider, setAiProvider] = useState<AiProvider>('openrouter')
  const [aiModel, setAiModel] = useState('deepseek/deepseek-chat-v3.1')

  // Backup
  const [downloading, setDownloading] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [creatingBackup, setCreatingBackup] = useState(false)
  const [backups, setBackups] = useState<BackupItem[]>([])
  const [retention, setRetention] = useState(14)
  const [loadingBackups, setLoadingBackups] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([
      api.get('/admin/config'),
      api.get('/admin/config/vietqr'),
      api.get('/admin/config/ai'),
      api.get('/admin/config/sepay'),
    ]).then(([cfg, vq, ai, sp]) => {
      setLockTime(cfg.data.lockTime ?? '23:59')
      setVqConfig({
        clientId: vq.data.clientId ?? '',
        apiKeySet: vq.data.apiKeySet ?? false,
        bank1: vq.data.bank1 ?? '', accountNumber1: vq.data.accountNumber1 ?? '', accountName1: vq.data.accountName1 ?? '', template1: vq.data.template1 ?? '',
        bank2: vq.data.bank2 ?? '', accountNumber2: vq.data.accountNumber2 ?? '', accountName2: vq.data.accountName2 ?? '', template2: vq.data.template2 ?? '',
      })
      setAiKeySet(ai.data.apiKeySet ?? false)
      setAiProvider(ai.data.provider ?? 'openrouter')
      setAiModel(ai.data.model ?? 'deepseek/deepseek-chat-v3.1')
      setSePayKeySet(sp.data.apiKeySet ?? false)
    }).finally(() => setLoading(false))
  }, [])

  const handleSaveSystem = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingSystem(true)
    try { await api.put('/admin/config', { lockTime }); showToast('Đã lưu cấu hình') }
    catch { showToast('Lưu thất bại', false) }
    finally { setSavingSystem(false) }
  }

  const handleSaveVqApiKey = async (e: React.FormEvent) => {
    e.preventDefault(); if (!vqApiKey.trim()) return; setSavingVq(true)
    try {
      await api.put('/admin/config/vietqr', { clientId: vqConfig.clientId, apiKey: vqApiKey })
      setVqApiKey(''); setVqConfig(c => ({ ...c, apiKeySet: true }))
      showToast('Đã lưu API Key')
    } catch { showToast('Lưu thất bại', false) }
    finally { setSavingVq(false) }
  }

  const handleSaveVqAccounts = async (e: React.FormEvent) => {
    e.preventDefault(); setSavingVq(true)
    try {
      await api.put('/admin/config/vietqr', {
        clientId: vqConfig.clientId,
        bank1: vqConfig.bank1, accountNumber1: vqConfig.accountNumber1, accountName1: vqConfig.accountName1, template1: vqConfig.template1,
        bank2: vqConfig.bank2, accountNumber2: vqConfig.accountNumber2, accountName2: vqConfig.accountName2, template2: vqConfig.template2,
      })
      showToast('Đã lưu tài khoản ngân hàng')
    } catch { showToast('Lưu thất bại', false) }
    finally { setSavingVq(false) }
  }

  const handleGenerateQr = async () => {
    setGeneratingQr(true); setQrImage(null)
    try {
      const res = await api.post('/admin/config/vietqr/generate-qr', {
        accountIndex: qrTab, amount: parseFloat(qrAmount) || 0, content: qrContent,
      })
      const data = res.data
      if (data.data?.qrDataURL) setQrImage(data.data.qrDataURL)
      else showToast(data.desc ?? 'Tạo QR thất bại', false)
    } catch { showToast('Tạo QR thất bại', false) }
    finally { setGeneratingQr(false) }
  }

  const handleSaveSePay = async (e: React.FormEvent) => {
    e.preventDefault(); if (!sePayKey.trim()) return; setSavingSePay(true)
    try {
      await api.put('/admin/config/sepay-apikey', { apiKey: sePayKey })
      setSePayKey(''); setSePayKeySet(true); showToast('Đã cập nhật SePay API Key')
    } catch { showToast('Cập nhật thất bại', false) }
    finally { setSavingSePay(false) }
  }

  const handleSaveAiKey = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingAi(true)
    try {
      const payload: { apiKey?: string; provider: string; model: string } = { provider: aiProvider, model: aiModel }
      if (aiKey.trim()) payload.apiKey = aiKey
      await api.put('/admin/config/ai-key', payload)
      if (aiKey.trim()) { setAiKey(''); setAiKeySet(true) }
      showToast('Đã lưu cấu hình AI')
    } catch { showToast('Lưu thất bại', false) }
    finally { setSavingAi(false) }
  }

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText('/api/webhooks/sepay').then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  const loadBackups = useCallback(async () => {
    setLoadingBackups(true)
    try {
      const res = await api.get('/admin/backup/list')
      setBackups(res.data.items ?? [])
      setRetention(res.data.retention ?? 14)
    } catch { showToast('Không tải được danh sách backup', false) }
    finally { setLoadingBackups(false) }
  }, [showToast])

  useEffect(() => { if (section === 'backup') loadBackups() }, [section, loadBackups])

  const handleCreateBackup = async () => {
    setCreatingBackup(true)
    try {
      await api.post('/admin/backup/create')
      showToast('Đã tạo backup')
      await loadBackups()
    } catch { showToast('Tạo backup thất bại', false) }
    finally { setCreatingBackup(false) }
  }

  const handleDownloadBackup = async () => {
    setDownloading(true)
    try {
      const res = await api.get('/admin/backup/download', { responseType: 'blob' })
      const cd = res.headers['content-disposition'] as string | undefined
      const m = cd?.match(/filename="?([^";]+)"?/)
      const name = m?.[1] ?? `backup_${new Date().toISOString().slice(0, 10)}.sql.gz`
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url; a.download = name
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast('Tải backup thành công')
      await loadBackups()
    } catch { showToast('Tải backup thất bại', false) }
    finally { setDownloading(false) }
  }

  const handleDownloadFile = async (name: string) => {
    try {
      const res = await api.get(`/admin/backup/file/${encodeURIComponent(name)}`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url; a.download = name
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch { showToast('Tải file thất bại', false) }
  }

  const handleDeleteBackup = async (name: string) => {
    if (!confirm(`Xóa file "${name}"?`)) return
    try {
      await api.delete(`/admin/backup/${encodeURIComponent(name)}`)
      showToast('Đã xóa')
      await loadBackups()
    } catch { showToast('Xóa thất bại', false) }
  }

  const handleRestoreServer = async (name: string) => {
    if (!confirm(`Khôi phục từ "${name}"?\n\nLưu ý: Dữ liệu hiện tại sẽ bị ghi đè.`)) return
    setRestoring(true)
    try {
      await api.post('/admin/backup/restore-server', null, { params: { name } })
      showToast('Khôi phục thành công')
    } catch { showToast('Khôi phục thất bại', false) }
    finally { setRestoring(false) }
  }

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    if (!confirm(`Khôi phục từ file "${file.name}"?\n\nLưu ý: Dữ liệu hiện tại sẽ bị ghi đè.`)) return
    setRestoring(true)
    try {
      const form = new FormData(); form.append('file', file)
      await api.post('/admin/backup/restore', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      showToast('Khôi phục thành công')
    } catch { showToast('Khôi phục thất bại', false) }
    finally { setRestoring(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const aiKeyPlaceholder = AI_PROVIDERS.find(p => p.value === aiProvider)?.placeholder ?? ''

  return (
    <AdminLayout>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${toast.ok ? 'bg-gray-900 text-white' : 'bg-red-500 text-white'}`}>
          {toast.ok ? <IconCheck /> : <IconClose />}
          {toast.msg}
        </div>
      )}

      {loading ? <div className="text-center py-16 text-gray-400 dark:text-gray-500">Đang tải...</div> : (
        <div className="flex gap-6">
          <aside className="w-44 flex-shrink-0 space-y-0.5">
            {NAV_ITEMS.map(item => (
              <button key={item.id} onClick={() => setSection(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${section === item.id ? 'bg-gray-900 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'}`}>
                {item.icon}{item.label}
              </button>
            ))}
          </aside>

          <div className="flex-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-5">

            {section === 'system' && (
              <form onSubmit={handleSaveSystem}>
                <SectionHeader icon={<IconGear />} title="Hệ thống" subtitle="Cấu hình chung của ứng dụng." />
                <hr className="border-gray-100 dark:border-gray-800 mb-5" />
                <div className="max-w-xs space-y-4">
                  <Field label="Thời gian khoá đơn" description="Sau giờ này, shipper không thể chỉnh sửa đơn hàng.">
                    <div className="flex items-center border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 gap-2 w-fit">
                      <IconClock className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      <input type="time" value={lockTime} onChange={e => setLockTime(e.target.value)} className="text-sm text-gray-800 dark:text-gray-200 focus:outline-none bg-transparent" required />
                    </div>
                  </Field>
                  <SaveBtn loading={savingSystem} />
                </div>
              </form>
            )}

            {section === 'vietqr' && (
              <div className="space-y-5">
                <SectionHeader icon={<IconQr />} title="Cấu hình VietQR" subtitle="Tài khoản ngân hàng và API key để tạo mã QR thanh toán." />
                <hr className="border-gray-100 dark:border-gray-800" />

                <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Thông tin API</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Dùng chung cho tất cả tài khoản ngân hàng. Lấy từ <span className="text-blue-500">my.vietqr.io</span>.</p>
                    </div>
                    {vqConfig.apiKeySet && <ConfiguredBadge text="API Key đã cấu hình" />}
                  </div>

                  <Field label="Client ID">
                    <TextInput value={vqConfig.clientId} onChange={v => setVqConfig(c => ({ ...c, clientId: v }))} placeholder="Lấy từ my.vietqr.io..." />
                  </Field>

                  <form onSubmit={handleSaveVqApiKey}>
                    <Field label="API Key" description="Mã hoá AES-256 trước khi lưu. Chỉ cập nhật khi có key mới.">
                      <div className="flex gap-2">
                        <PasswordInput value={vqApiKey} onChange={setVqApiKey} show={showApiKey} toggleShow={() => setShowApiKey(v => !v)} placeholder="Dán API Key từ my.vietqr.io..." />
                        <SecondaryBtn type="submit" disabled={savingVq || !vqApiKey.trim()}>
                          <IconSave className="w-3.5 h-3.5" />
                          Lưu key
                        </SecondaryBtn>
                      </div>
                    </Field>
                  </form>
                </div>

                <form onSubmit={handleSaveVqAccounts} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3">
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <span className="w-5 h-5 bg-gray-900 text-white rounded-full text-xs flex items-center justify-center font-bold">1</span>
                        Tài khoản chính
                      </p>
                      <Field label="Ngân hàng">
                        <BankSelect value={vqConfig.bank1} onChange={v => setVqConfig(c => ({ ...c, bank1: v }))} />
                      </Field>
                      <Field label="Số tài khoản">
                        <TextInput value={vqConfig.accountNumber1} onChange={v => setVqConfig(c => ({ ...c, accountNumber1: v }))} placeholder="Số tài khoản" />
                      </Field>
                      <Field label="Tên chủ tài khoản" description="Không dấu, viết hoa.">
                        <TextInput value={vqConfig.accountName1} onChange={v => setVqConfig(c => ({ ...c, accountName1: v }))} placeholder="Không dấu, viết hoa" />
                      </Field>
                      <Field label="Template ID (Quicklink)" description="Để trống = compact2 mặc định. Template phải gắn đúng với ngân hàng/số tài khoản trên my.vietqr.io.">
                        <TextInput value={vqConfig.template1} onChange={v => setVqConfig(c => ({ ...c, template1: v.trim() }))} placeholder="vd: 7e6yn7j (hoặc compact2)" />
                      </Field>
                    </div>

                    <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3">
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        <span className="w-5 h-5 bg-gray-300 text-gray-600 dark:text-gray-400 rounded-full text-xs flex items-center justify-center font-bold">2</span>
                        Tài khoản phụ <span className="text-xs font-normal text-gray-400 dark:text-gray-500">tuỳ chọn</span>
                      </p>
                      <p className="text-xs text-orange-500">Dùng chung ClientID và API Key. Để trống nếu chỉ có một tài khoản.</p>
                      <Field label="Ngân hàng">
                        <BankSelect value={vqConfig.bank2} onChange={v => setVqConfig(c => ({ ...c, bank2: v }))} />
                      </Field>
                      <Field label="Số tài khoản">
                        <TextInput value={vqConfig.accountNumber2} onChange={v => setVqConfig(c => ({ ...c, accountNumber2: v }))} placeholder="Số tài khoản" />
                      </Field>
                      <Field label="Tên chủ tài khoản" description="Không dấu, viết hoa.">
                        <TextInput value={vqConfig.accountName2} onChange={v => setVqConfig(c => ({ ...c, accountName2: v }))} placeholder="Không dấu, viết hoa" />
                      </Field>
                      <Field label="Template ID (Quicklink)" description="Để trống = compact2 mặc định.">
                        <TextInput value={vqConfig.template2} onChange={v => setVqConfig(c => ({ ...c, template2: v.trim() }))} placeholder="vd: 7e6yn7j (hoặc compact2)" />
                      </Field>
                    </div>
                  </div>

                  <SaveBtn loading={savingVq} label="Lưu tài khoản" />
                </form>

                <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2 mb-3">
                    <IconQr />
                    Thử tạo QR
                    <span className="text-xs font-normal text-gray-400 dark:text-gray-500">— không cần đơn thật, tài khoản 2 dùng thông tin trong form</span>
                  </p>

                  <div className="flex gap-1 border-b border-gray-100 dark:border-gray-800 mb-4">
                    {([1, 2] as const).map(t => (
                      <button key={t} type="button" onClick={() => setQrTab(t)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${qrTab === t ? 'border-gray-900 text-gray-900 dark:text-gray-100' : 'border-transparent text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}>
                        Tài khoản {t}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Số tiền">
                          <TextInput value={qrAmount} onChange={setQrAmount} placeholder="0 = tuỳ ý" />
                        </Field>
                        <Field label="Nội dung">
                          <TextInput value={qrContent} onChange={setQrContent} placeholder="BH24147767" />
                        </Field>
                      </div>
                      <button type="button" onClick={handleGenerateQr} disabled={generatingQr}
                        className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 w-full justify-center">
                        <IconQr />
                        {generatingQr ? 'Đang tạo...' : `Tạo QR — tài khoản ${qrTab}`}
                      </button>
                    </div>

                    <div className="flex flex-col items-center justify-center border border-dashed border-gray-200 dark:border-gray-800 rounded-xl min-h-36 p-4">
                      {qrImage ? (
                        <img src={qrImage} alt="QR Code" className="w-32 h-32 object-contain" />
                      ) : (
                        <>
                          <IconQr className="w-8 h-8 text-gray-300 dark:text-gray-600 mb-2" />
                          <p className="text-xs text-gray-400 dark:text-gray-500 text-center">Xem trước QR</p>
                          <p className="text-xs text-orange-400 text-center mt-0.5">Nhập thông tin và nhấn Thử tạo QR</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {section === 'sepay' && (
              <div className="space-y-5">
                <SectionHeader icon={<IconBolt />} title="Tích hợp SePay Webhook" subtitle="Xác thực API key cho mỗi webhook từ SePay." />
                <hr className="border-gray-100 dark:border-gray-800" />

                <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Webhook URL</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">Cấu hình URL này trong SePay dashboard.</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-sm font-mono text-gray-600 dark:text-gray-400">
                      /api/webhooks/sepay
                    </div>
                    <button type="button" onClick={handleCopyWebhook}
                      className="flex items-center gap-1.5 px-3 py-2.5 border border-gray-200 dark:border-gray-800 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {copied
                        ? <><IconCheck className="w-4 h-4 text-green-500" /> Đã sao chép</>
                        : <><IconCopy /> Sao chép</>}
                    </button>
                  </div>
                </div>

                <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      <span className="w-5 h-5 bg-gray-900 text-white rounded-full text-xs flex items-center justify-center">1</span>
                      API Key xác thực
                    </p>
                    {sePayKeySet && <ConfiguredBadge text="API Key đã cấu hình" />}
                  </div>

                  <form onSubmit={handleSaveSePay} className="space-y-3">
                    <Field label="API Key" description="Mã hoá AES-256 trước khi lưu. Chỉ cập nhật khi có key mới.">
                      <div className="flex gap-2">
                        <PasswordInput value={sePayKey} onChange={setSePayKey} show={showSePayKey} toggleShow={() => setShowSePayKey(v => !v)} placeholder="Dán API key từ SePay..." />
                        <SecondaryBtn type="submit" disabled={savingSePay || !sePayKey.trim()}>
                          <IconSave className="w-3.5 h-3.5" />
                          Lưu
                        </SecondaryBtn>
                      </div>
                    </Field>
                  </form>
                </div>
              </div>
            )}

            {section === 'ai' && (
              <div className="space-y-5">
                <SectionHeader icon={<IconAi />} title="Trợ lý AI" subtitle="Cấu hình API key để bật tính năng hỏi đáp dữ liệu bằng tiếng Việt." />
                <hr className="border-gray-100 dark:border-gray-800" />

                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                  <IconInfo className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-700 space-y-1">
                    <p className="font-semibold">Hỗ trợ đa nhà cung cấp qua OpenRouter</p>
                    <p className="text-xs text-blue-500">Dùng 1 key OpenRouter để truy cập Claude, GPT-4, Gemini, DeepSeek, Llama... Lấy key tại <span className="font-mono font-medium">openrouter.ai/keys</span>.</p>
                  </div>
                </div>

                <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Cấu hình AI</p>
                    {aiKeySet && <ConfiguredBadge />}
                  </div>

                  <form onSubmit={handleSaveAiKey} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Nhà cung cấp" description="OpenRouter hỗ trợ tất cả model.">
                        <select
                          value={aiProvider}
                          onChange={e => setAiProvider(e.target.value as AiProvider)}
                          className="w-full border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 bg-white dark:bg-gray-900"
                        >
                          {AI_PROVIDERS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                      </Field>
                      <Field label="Model" description="VD: anthropic/claude-3.5-sonnet, openai/gpt-4o-mini">
                        <TextInput value={aiModel} onChange={setAiModel} placeholder="google/gemini-2.0-flash-exp:free" />
                      </Field>
                    </div>

                    <Field label="API Key" description={aiKeySet ? 'Để trống nếu chỉ đổi model. Nhập key mới để thay thế.' : 'Bắt buộc lần đầu. Lưu mã hoá trong DB.'}>
                      <div className="flex gap-2">
                        <PasswordInput value={aiKey} onChange={setAiKey} show={showAiKey} toggleShow={() => setShowAiKey(v => !v)} placeholder={aiKeyPlaceholder} />
                        <SecondaryBtn type="submit" disabled={savingAi || (!aiKey.trim() && !aiKeySet)}>
                          <IconSave className="w-3.5 h-3.5" />
                          {savingAi ? 'Đang lưu...' : 'Lưu cấu hình'}
                        </SecondaryBtn>
                      </div>
                    </Field>

                    {aiProvider === 'openrouter' && (
                      <div className="text-xs text-gray-500 dark:text-gray-500 space-y-1 bg-gray-50 dark:bg-gray-950 rounded-lg p-3">
                        <p className="font-semibold text-gray-700 dark:text-gray-300">Gợi ý model phổ biến (OpenRouter):</p>
                        <ul className="space-y-0.5 ml-2">
                          {OPENROUTER_MODEL_HINTS.map(m => (
                            <li key={m.name}>• <span className="font-mono">{m.name}</span> — {m.note}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </form>
                </div>

                <div className="border border-gray-100 dark:border-gray-800 rounded-xl p-4 space-y-2">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Tính năng sau khi kích hoạt</p>
                  {AI_FEATURES.map(f => (
                    <div key={f} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <IconCheck className="w-4 h-4 text-green-500 flex-shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {section === 'backup' && (
              <div className="space-y-5">
                <SectionHeader icon={<IconBackup />} title="Sao lưu & Khôi phục" subtitle="Quản lý các bản sao lưu và khôi phục cơ sở dữ liệu." />
                <hr className="border-gray-100 dark:border-gray-800" />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button onClick={handleCreateBackup} disabled={creatingBackup}
                    className="flex items-center gap-3 border border-gray-200 dark:border-gray-800 rounded-xl p-3 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 text-left">
                    <div className="w-9 h-9 bg-green-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <IconBackup className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{creatingBackup ? 'Đang tạo...' : 'Tạo backup mới'}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Sao lưu DB hiện tại (.sql.gz)</p>
                    </div>
                  </button>

                  <button onClick={handleDownloadBackup} disabled={downloading}
                    className="flex items-center gap-3 border border-gray-200 dark:border-gray-800 rounded-xl p-3 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 text-left">
                    <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <IconDownload className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{downloading ? 'Đang xuất...' : 'Tạo & tải xuống'}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Tạo backup mới rồi tải về máy</p>
                    </div>
                  </button>

                  <button type="button" onClick={() => fileRef.current?.click()} disabled={restoring}
                    className="flex items-center gap-3 border border-gray-200 dark:border-gray-800 rounded-xl p-3 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 text-left">
                    <div className="w-9 h-9 bg-orange-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      <IconUpload className="w-5 h-5 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{restoring ? 'Đang khôi phục...' : 'Khôi phục từ máy'}</p>
                      <p className="text-xs text-orange-500">Upload .sql hoặc .sql.gz</p>
                    </div>
                  </button>
                  <input ref={fileRef} type="file" accept=".sql,.gz" className="hidden" onChange={handleRestoreFile} />
                </div>

                <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-950">
                    <div>
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">Backup trên server</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Lưu giữ {retention} bản gần nhất, tự động chạy mỗi 2:00 AM</p>
                    </div>
                    <button onClick={loadBackups} disabled={loadingBackups}
                      className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50">
                      {loadingBackups ? 'Đang tải...' : 'Làm mới'}
                    </button>
                  </div>

                  {backups.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                      {loadingBackups ? 'Đang tải...' : 'Chưa có backup nào'}
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-950 text-xs text-gray-500 dark:text-gray-500">
                        <tr>
                          <th className="px-4 py-2.5 text-left font-medium">Tên file</th>
                          <th className="px-4 py-2.5 text-left font-medium">Thời gian</th>
                          <th className="px-4 py-2.5 text-right font-medium">Kích thước</th>
                          <th className="px-4 py-2.5 text-right font-medium">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {backups.map(b => (
                          <tr key={b.name} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                            <td className="px-4 py-2.5 font-mono text-xs text-gray-700 dark:text-gray-300">{b.name}</td>
                            <td className="px-4 py-2.5 text-gray-600 dark:text-gray-400">{formatDate(b.createdAt)}</td>
                            <td className="px-4 py-2.5 text-right text-gray-600 dark:text-gray-400">{formatSize(b.size)}</td>
                            <td className="px-4 py-2.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button onClick={() => handleDownloadFile(b.name)}
                                  className="px-2.5 py-1 text-xs border border-gray-200 dark:border-gray-800 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">
                                  Tải
                                </button>
                                <button onClick={() => handleRestoreServer(b.name)} disabled={restoring}
                                  className="px-2.5 py-1 text-xs border border-orange-200 rounded-md hover:bg-orange-50 text-orange-600 disabled:opacity-50">
                                  Khôi phục
                                </button>
                                <button onClick={() => handleDeleteBackup(b.name)}
                                  className="px-2.5 py-1 text-xs border border-red-200 rounded-md hover:bg-red-50 text-red-600">
                                  Xóa
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
