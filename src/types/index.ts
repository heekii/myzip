import type { Timestamp } from 'firebase/firestore'

export interface Apartment {
  id: string
  userId: string
  name: string
  address: string
  region: string
  lawdCd: string | null
  completionYear: string | null
  totalUnits: string | null
  maxFloor: string | null
  lat: number | null
  lng: number | null
  createdAt: Timestamp
  priceCount: number
  latestMaxPrice?: number
  latestMinPrice?: number
  prevMaxPrice?: number
}

export interface PriceEntry {
  id: string
  date: string
  maxPrice: number | null
  minPrice: number | null
  createdAt: Timestamp
}

export interface ApartmentDetail {
  nearStation?: string
  stationDist?: string
  isStationZone?: 'yes' | 'no'
  southFacing?: string
  schoolName?: string
  floorAreaRatio?: string
  buildingCoverage?: string
  targetSize?: string
  preferredFloor?: string
  commuteGangnam?: string
  commuteYeouido?: string
  commuteJongno?: string
  updatedAt?: Timestamp
}

export interface Memo {
  id: string
  content: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface RealTxItem {
  aptNm: string
  dealAmount: string
  dealYear: string
  dealMonth: string
  dealDay: string
  excluUseAr: string
  floor: string
  jibun: string
  umdNm: string
  buildYear: string
}
