import type { Timestamp } from 'firebase/firestore'

export interface Scenario {
  id: string
  name: string
}

export interface Apartment {
  id: string
  userId: string
  scenarioId?: string
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
  // 실거래가 조회용 캐시 필드
  bjdCode?: string
  umdNm?: string
  aptJibun?: string
  aptPreferredSize?: number | null
  kaptCode?: string
  realTxCache?: { items: RealTxItem[] }
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

export type VisitStatus = 'not-planned' | 'scheduled' | 'visited' | 'on-hold'
export type DecisionStatus = 'active' | 'eliminated' | 'finalist'

export interface ApartmentVisit {
  status?: VisitStatus
  decisionStatus?: DecisionStatus
  eliminationReason?: string
  scheduledAt?: string
  visitedAt?: string
  buildingCondition?: string
  unitCondition?: string
  interiorCondition?: string
  defectNotes?: string
  tenantStatus?: string
  brokerNotes?: string
  askingPriceNote?: string
  expectedPriceNote?: string
  nextAction?: string
  // 정성 점수(1~10) — 데이터로 자동 산출 불가한 카테고리는 수동 입력
  infraScore?: number
  schoolScore?: number
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
