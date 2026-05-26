import { create } from 'zustand'

interface UIState {
  pageTitle: string
  headerRight: React.ReactNode | null
  setPageTitle: (title: string) => void
  setHeaderRight: (el: React.ReactNode | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  pageTitle: '내집마련 트래커',
  headerRight: null,
  setPageTitle: (pageTitle) => set({ pageTitle }),
  setHeaderRight: (headerRight) => set({ headerRight }),
}))
