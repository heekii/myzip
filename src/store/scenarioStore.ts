import { create } from 'zustand'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db } from '@/lib/firebase'
import { guestDB } from '@/lib/guestDB'
import type { Scenario } from '@/types'

const seed = (): Scenario[] => [
  { id: crypto.randomUUID(), name: '1인 가구' },
  { id: crypto.randomUUID(), name: '2인 가구' },
]

// 활성 시나리오 선택은 UI 상태이므로 게스트는 sessionStorage(탭 종료 시 소멸), 유저는 localStorage에 보관
function activeStorage(isGuest: boolean): Storage {
  return isGuest ? sessionStorage : localStorage
}
function activeKey(user: User | null) {
  return `myzip_activeScenario_${user?.uid ?? 'guest'}`
}

async function persist(user: User | null, isGuest: boolean, scenarios: Scenario[]) {
  if (isGuest) { guestDB.setScenarios(scenarios); return }
  if (!user) return
  await setDoc(doc(db, 'users', user.uid), { scenarios }, { merge: true })
}

interface ScenarioState {
  scenarios: Scenario[]
  activeId: string | null
  loaded: boolean
  user: User | null
  isGuest: boolean
  load: (user: User | null, isGuest: boolean) => Promise<void>
  setActive: (id: string) => void
  add: (name: string) => Promise<void>
  rename: (id: string, name: string) => Promise<void>
  remove: (id: string) => Promise<void>
}

export const useScenarioStore = create<ScenarioState>((set, get) => ({
  scenarios: [],
  activeId: null,
  loaded: false,
  user: null,
  isGuest: false,

  load: async (user, isGuest) => {
    let scenarios: Scenario[] = []
    if (isGuest) {
      scenarios = guestDB.getScenarios()
    } else if (user) {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid))
        scenarios = (snap.exists() ? (snap.data().scenarios as Scenario[]) : null) ?? []
      } catch { scenarios = [] }
    }
    if (scenarios.length === 0) {
      scenarios = seed()
      await persist(user, isGuest, scenarios)
    }
    const stored = activeStorage(isGuest).getItem(activeKey(user))
    const activeId = scenarios.some(s => s.id === stored) ? stored! : scenarios[0].id
    set({ scenarios, activeId, loaded: true, user, isGuest })
  },

  setActive: (id) => {
    const { user, isGuest } = get()
    activeStorage(isGuest).setItem(activeKey(user), id)
    set({ activeId: id })
  },

  add: async (name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const { scenarios, user, isGuest } = get()
    const created = { id: crypto.randomUUID(), name: trimmed }
    const next = [...scenarios, created]
    set({ scenarios: next })
    await persist(user, isGuest, next)
    get().setActive(created.id)
  },

  rename: async (id, name) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const { scenarios, user, isGuest } = get()
    const next = scenarios.map(s => (s.id === id ? { ...s, name: trimmed } : s))
    set({ scenarios: next })
    await persist(user, isGuest, next)
  },

  remove: async (id) => {
    const { scenarios, activeId, user, isGuest } = get()
    if (scenarios.length <= 1) return
    const next = scenarios.filter(s => s.id !== id)
    set({ scenarios: next })
    await persist(user, isGuest, next)
    if (activeId === id) get().setActive(next[0].id)
  },
}))
