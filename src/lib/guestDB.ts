import type { Apartment, ApartmentDetail } from '@/types'

const APT_KEY = 'guestApartments'
const INFO_KEY = 'guestApartmentInfo'

function getAll(): Apartment[] {
  try {
    return JSON.parse(sessionStorage.getItem(APT_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveAll(apts: Apartment[]) {
  sessionStorage.setItem(APT_KEY, JSON.stringify(apts))
}

function getInfoAll(): Record<string, Partial<ApartmentDetail>> {
  try {
    return JSON.parse(sessionStorage.getItem(INFO_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export const guestDB = {
  getApartments: getAll,

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

  deleteApartment: (id: string) => saveAll(getAll().filter(a => a.id !== id)),

  setInfo: (id: string, info: Partial<ApartmentDetail>) => {
    const all = getInfoAll()
    sessionStorage.setItem(INFO_KEY, JSON.stringify({ ...all, [id]: { ...all[id], ...info } }))
  },

  getInfo: (id: string): Partial<ApartmentDetail> => getInfoAll()[id] ?? {},
}
