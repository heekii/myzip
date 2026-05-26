import type { Apartment } from '@/types'

const KEY = 'guestApartments'

function getAll(): Apartment[] {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '[]')
  } catch {
    return []
  }
}

function save(apts: Apartment[]) {
  sessionStorage.setItem(KEY, JSON.stringify(apts))
}

export const guestDB = {
  getApartments: getAll,
  addApartment: (apt: Apartment) => save([...getAll(), apt]),
  deleteApartment: (id: string) => save(getAll().filter(a => a.id !== id)),
}
