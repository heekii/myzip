import { create } from 'zustand'
import type { User } from 'firebase/auth'

interface AuthState {
  user: User | null
  isGuest: boolean
  loading: boolean
  setUser: (user: User | null) => void
  setLoading: (v: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isGuest: false,
  loading: true,
  setUser: (user) => set({ user, isGuest: user === null, loading: false }),
  setLoading: (loading) => set({ loading }),
}))
