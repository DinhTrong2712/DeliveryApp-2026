import { create } from 'zustand'
import api from '../lib/api'

export interface AuthUser {
  id: string
  fullName: string
  role: 'Admin' | 'Accountant' | 'Shipper'
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  setAuth: (token: string, user: AuthUser, persist: boolean) => void
  logout: () => void
}

// sessionStorage (per-tab) takes precedence over localStorage (cross-tab).
function readAuth(key: string): string | null {
  return sessionStorage.getItem(key) ?? localStorage.getItem(key)
}

export const useAuthStore = create<AuthState>((set) => ({
  token: readAuth('token'),
  user: (() => {
    try {
      const u = readAuth('user')
      return u ? JSON.parse(u) : null
    } catch {
      return null
    }
  })(),
  setAuth: (token, user, persist) => {
    if (persist) {
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
      // This tab is now using persistent session — clear any per-tab leftovers.
      sessionStorage.removeItem('token')
      sessionStorage.removeItem('user')
    } else {
      sessionStorage.setItem('token', token)
      sessionStorage.setItem('user', JSON.stringify(user))
      // Leave localStorage alone so other tabs keep their persistent session.
    }
    set({ token, user })
  },
  logout: () => {
    api.post('/auth/logout').catch(() => {})
    // Clear only the storage that holds THIS tab's session, so logging out in
    // one tab doesn't kick other tabs that rely on localStorage.
    if (sessionStorage.getItem('token')) {
      sessionStorage.removeItem('token')
      sessionStorage.removeItem('user')
    } else {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }
    set({ token: null, user: null })
  },
}))
