import type { Apartment, ApartmentDetail, PriceEntry, Memo } from '@/types'

const APT_KEY = 'guestApartments'
const INFO_KEY = 'guestApartmentInfo'
const PRICES_KEY = 'guestPrices'
const MEMOS_KEY = 'guestMemos'

// ── Apartments ────────────────────────────────────────────────────────────────

function getAll(): Apartment[] {
  try { return JSON.parse(sessionStorage.getItem(APT_KEY) ?? '[]') } catch { return [] }
}
function saveAll(apts: Apartment[]) {
  sessionStorage.setItem(APT_KEY, JSON.stringify(apts))
}

// ── Info ──────────────────────────────────────────────────────────────────────

function getInfoAll(): Record<string, Partial<ApartmentDetail>> {
  try { return JSON.parse(sessionStorage.getItem(INFO_KEY) ?? '{}') } catch { return {} }
}

// ── Prices ────────────────────────────────────────────────────────────────────

function getPricesAll(): Record<string, PriceEntry[]> {
  try { return JSON.parse(sessionStorage.getItem(PRICES_KEY) ?? '{}') } catch { return {} }
}
function savePricesAll(data: Record<string, PriceEntry[]>) {
  sessionStorage.setItem(PRICES_KEY, JSON.stringify(data))
}

// ── Memos ─────────────────────────────────────────────────────────────────────

function getMemosAll(): Record<string, Memo[]> {
  try { return JSON.parse(sessionStorage.getItem(MEMOS_KEY) ?? '{}') } catch { return {} }
}
function saveMemosAll(data: Record<string, Memo[]>) {
  sessionStorage.setItem(MEMOS_KEY, JSON.stringify(data))
}

// ── Public API ────────────────────────────────────────────────────────────────

export const guestDB = {
  // Apartments
  getApartments: getAll,

  getApartment: (id: string): Apartment | null =>
    getAll().find(a => a.id === id) ?? null,

  addApartment: (apt: Omit<Apartment, 'id' | 'userId' | 'createdAt' | 'priceCount'>): string => {
    const id = crypto.randomUUID()
    const full: Apartment = {
      id,
      userId: '',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createdAt: null as any,
      priceCount: 0,
      ...apt,
    }
    saveAll([...getAll(), full])
    return id
  },

  updateApartment: (id: string, data: Partial<Apartment>) =>
    saveAll(getAll().map(a => (a.id === id ? { ...a, ...data } : a))),

  deleteApartment: (id: string) => {
    saveAll(getAll().filter(a => a.id !== id))
    // cascade
    const prices = getPricesAll()
    const memos = getMemosAll()
    const info = getInfoAll()
    delete prices[id]; savePricesAll(prices)
    delete memos[id]; saveMemosAll(memos)
    delete info[id]; sessionStorage.setItem(INFO_KEY, JSON.stringify(info))
  },

  // Info
  setInfo: (id: string, info: Partial<ApartmentDetail>) => {
    const all = getInfoAll()
    sessionStorage.setItem(INFO_KEY, JSON.stringify({ ...all, [id]: { ...all[id], ...info } }))
  },

  getInfo: (id: string): Partial<ApartmentDetail> => getInfoAll()[id] ?? {},

  // Prices
  getPrices: (aptId: string): PriceEntry[] => {
    const all = getPricesAll()
    return [...(all[aptId] ?? [])].sort((a, b) => a.date.localeCompare(b.date))
  },

  addPrice: (aptId: string, price: { date: string; maxPrice: number | null; minPrice: number | null }): string => {
    const id = crypto.randomUUID()
    const all = getPricesAll()
    all[aptId] = [...(all[aptId] ?? []), {
      ...price,
      id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createdAt: new Date().toISOString() as any,
    }]
    savePricesAll(all)
    // update apartment summary
    const sorted = [...all[aptId]].sort((a, b) => a.date.localeCompare(b.date))
    const latest = sorted[sorted.length - 1]
    const prev = sorted.length > 1 ? sorted[sorted.length - 2] : null
    saveAll(getAll().map(a => {
      if (a.id !== aptId) return a
      return {
        ...a,
        priceCount: sorted.length,
        latestMaxPrice: latest.maxPrice ?? undefined,
        latestMinPrice: latest.minPrice ?? undefined,
        prevMaxPrice: prev?.maxPrice ?? undefined,
      }
    }))
    return id
  },

  updatePrice: (aptId: string, id: string, data: Partial<PriceEntry>) => {
    const all = getPricesAll()
    all[aptId] = (all[aptId] ?? []).map(p => (p.id === id ? { ...p, ...data } : p))
    savePricesAll(all)
    // refresh apartment summary
    const sorted = [...all[aptId]].sort((a, b) => a.date.localeCompare(b.date))
    const latest = sorted[sorted.length - 1]
    const prev = sorted.length > 1 ? sorted[sorted.length - 2] : null
    saveAll(getAll().map(a => {
      if (a.id !== aptId) return a
      return {
        ...a,
        latestMaxPrice: latest?.maxPrice ?? undefined,
        latestMinPrice: latest?.minPrice ?? undefined,
        prevMaxPrice: prev?.maxPrice ?? undefined,
      }
    }))
  },

  deletePrice: (aptId: string, id: string) => {
    const all = getPricesAll()
    all[aptId] = (all[aptId] ?? []).filter(p => p.id !== id)
    savePricesAll(all)
    const sorted = [...all[aptId]].sort((a, b) => a.date.localeCompare(b.date))
    const latest = sorted[sorted.length - 1]
    const prev = sorted.length > 1 ? sorted[sorted.length - 2] : null
    saveAll(getAll().map(a => {
      if (a.id !== aptId) return a
      return {
        ...a,
        priceCount: sorted.length,
        latestMaxPrice: latest?.maxPrice ?? undefined,
        latestMinPrice: latest?.minPrice ?? undefined,
        prevMaxPrice: prev?.maxPrice ?? undefined,
      }
    }))
  },

  // Memos
  getMemos: (aptId: string): Memo[] => {
    const all = getMemosAll()
    return [...(all[aptId] ?? [])].sort((a, b) => {
      const ta = typeof a.createdAt === 'string' ? a.createdAt : ''
      const tb = typeof b.createdAt === 'string' ? b.createdAt : ''
      return tb.localeCompare(ta) // newest first
    })
  },

  addMemo: (aptId: string, content: string): string => {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const all = getMemosAll()
    all[aptId] = [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { id, content, createdAt: now as any, updatedAt: now as any },
      ...(all[aptId] ?? []),
    ]
    saveMemosAll(all)
    return id
  },

  updateMemo: (aptId: string, id: string, content: string) => {
    const now = new Date().toISOString()
    const all = getMemosAll()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    all[aptId] = (all[aptId] ?? []).map(m => (m.id === id ? { ...m, content, updatedAt: now as any } : m))
    saveMemosAll(all)
  },

  deleteMemo: (aptId: string, id: string) => {
    const all = getMemosAll()
    all[aptId] = (all[aptId] ?? []).filter(m => m.id !== id)
    saveMemosAll(all)
  },
}
