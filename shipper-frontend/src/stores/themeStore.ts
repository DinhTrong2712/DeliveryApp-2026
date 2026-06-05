import { create } from 'zustand'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'dark' || saved === 'light') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
}

interface ThemeState {
  theme: Theme
  toggle: () => void
  setTheme: (t: Theme) => void
}

const initial = getInitialTheme()
applyTheme(initial)

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initial,
  toggle: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem(STORAGE_KEY, next)
    applyTheme(next)
    set({ theme: next })
  },
  setTheme: (t) => {
    localStorage.setItem(STORAGE_KEY, t)
    applyTheme(t)
    set({ theme: t })
  },
}))
