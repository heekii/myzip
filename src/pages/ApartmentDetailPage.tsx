import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  doc, getDoc, collection, getDocs, query, orderBy,
  writeBatch
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { guestDB } from '@/lib/guestDB'
import { formatPrice } from '@/lib/utils'
import type { Apartment, ApartmentDetail, ApartmentVisit, Memo, RealTxItem } from '@/types'
import PriceSection from './detail/PriceSection'
import InfoSection from './detail/InfoSection'
import MapSection from './detail/MapSection'
import NewsSection from './detail/NewsSection'
import MemoSection from './detail/MemoSection'
import VisitSection from './detail/VisitSection'

const KAKAO_REST_KEY = import.meta.env.VITE_KAKAO_REST_KEY as string
const ODSAY_KEY = import.meta.env.VITE_ODSAY_KEY as string

export default function ApartmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, isGuest } = useAuthStore()
  const { setPageTitle, setHeaderRight } = useUIStore()

  const [apt, setApt] = useState<Apartment | null>(null)
  const [detailInfo, setDetailInfo] = useState<Partial<ApartmentDetail>>({})
  const [visitInfo, setVisitInfo] = useState<Partial<ApartmentVisit>>({})
  const [memos, setMemos] = useState<Memo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) { navigate('/dashboard'); return }
    load()
    return () => { setPageTitle('내집마련 트래커'); setHeaderRight(null) }
  }, [id])

  async function load() {
    setLoading(true)
    try {
      let apartment: Apartment | null = null

      if (isGuest) {
        apartment = guestDB.getApartment(id!)
        if (!apartment) { navigate('/dashboard'); return }
      } else {
        const snap = await getDoc(doc(db, 'apartments', id!))
        if (!snap.exists() || snap.data()?.userId !== user?.uid) {
          navigate('/dashboard'); return
        }
        apartment = { id: snap.id, ...snap.data() } as Apartment
      }

      setApt(apartment)
      setPageTitle(apartment.name)

      const [infoData, visitData, memoData] = await Promise.all([
        loadInfo(apartment),
        loadVisit(apartment),
        loadMemos(apartment),
      ])
      setDetailInfo(infoData)
      setVisitInfo(visitData)
      setMemos(memoData)

      autoFill(apartment, infoData)
    } finally {
      setLoading(false)
    }
  }

  async function loadInfo(apartment: Apartment): Promise<Partial<ApartmentDetail>> {
    if (isGuest) return guestDB.getInfo(apartment.id)
    const snap = await getDoc(doc(db, 'apartments', apartment.id, 'info', 'detail'))
    return snap.exists() ? (snap.data() as Partial<ApartmentDetail>) : {}
  }

  async function loadMemos(apartment: Apartment): Promise<Memo[]> {
    if (isGuest) return guestDB.getMemos(apartment.id)
    const snap = await getDocs(
      query(collection(db, 'apartments', apartment.id, 'memos'), orderBy('createdAt', 'desc'))
    )
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Memo))
  }

  async function loadVisit(apartment: Apartment): Promise<Partial<ApartmentVisit>> {
    if (isGuest) return guestDB.getVisit(apartment.id)
    try {
      const snap = await getDoc(doc(db, 'apartments', apartment.id, 'visits', 'latest'))
      return snap.exists() ? (snap.data() as Partial<ApartmentVisit>) : {}
    } catch {
      alert('방문 데이터 불러오기에 실패했습니다. 잠시 후 다시 시도해주세요.')
      return {}
    }
  }

  async function handleDelete() {
    if (!apt || !confirm(`'${apt.name}'을(를) 삭제하시겠습니까?\n메모 등 모든 데이터가 삭제됩니다.`)) return
    try {
      if (isGuest) {
        guestDB.deleteApartment(apt.id)
      } else {
        const batch = writeBatch(db)
        for (const col of ['prices', 'memos', 'info'] as const) {
          const snap = await getDocs(collection(db, 'apartments', apt.id, col))
          snap.docs.forEach(d => batch.delete(d.ref))
        }
        batch.delete(doc(db, 'apartments', apt.id))
        await batch.commit()
      }
      navigate('/dashboard')
    } catch {
      alert('삭제 중 오류가 발생했습니다.')
    }
  }

  useEffect(() => {
    if (!apt) return
    setHeaderRight(
      <button type="button" className="btn btn-danger btn-sm" onClick={handleDelete}>
        삭제
      </button>
    )
  }, [apt])

  // ── Auto-fill background ──────────────────────────────────────────────────

  async function autoFill(apartment: Apartment, info: Partial<ApartmentDetail>) {
    const tasks: Promise<void>[] = []
    if (!info.nearStation) tasks.push(autoFetchStation(apartment))
    if (!info.commuteGangnam) tasks.push(autoFetchCommute(apartment))
    if (!info.schoolName) tasks.push(autoFetchSchool(apartment))
    if (!info.floorAreaRatio) tasks.push(autoFetchBuilding(apartment))
    if (tasks.length > 0) await Promise.allSettled(tasks)
  }

  async function getLatLng(apartment: Apartment): Promise<{ lat: number; lng: number } | null> {
    if (apartment.lat && apartment.lng) return { lat: apartment.lat, lng: apartment.lng }
    try {
      const res = await fetch(
        `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(apartment.name + ' 아파트')}&size=5`,
        { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } }
      )
      const data = await res.json()
      const found = (data.documents || []).find((p: any) => p.category_name?.includes('아파트'))
      if (!found) return null
      const lat = parseFloat(found.y), lng = parseFloat(found.x)
      setApt(prev => prev ? { ...prev, lat, lng } : prev)
      if (!isGuest) {
        const { updateDoc } = await import('firebase/firestore')
        await updateDoc(doc(db, 'apartments', apartment.id), { lat, lng }).catch(() => {})
      } else {
        guestDB.updateApartment(apartment.id, { lat, lng })
      }
      return { lat, lng }
    } catch { return null }
  }

  async function autoFetchStation(apartment: Apartment) {
    const loc = await getLatLng(apartment)
    if (!loc) return
    try {
      const res = await fetch(
        `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=SW8&x=${loc.lng}&y=${loc.lat}&radius=1500&sort=distance&size=1`,
        { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } }
      )
      const data = await res.json()
      const station = data.documents?.[0]
      if (!station) return
      const dist = parseInt(station.distance)
      await saveInfo(apartment.id, {
        nearStation: station.place_name,
        stationDist: String(dist),
        isStationZone: dist <= 500 ? 'yes' : 'no',
      })
    } catch { }
  }

  async function autoFetchCommute(apartment: Apartment) {
    const loc = await getLatLng(apartment)
    if (!loc) return
    const STATIONS = {
      gangnam: { key: 'commuteGangnam' as const, lng: 127.027621, lat: 37.497942 },
      yeouido: { key: 'commuteYeouido' as const, lng: 126.924171, lat: 37.521574 },
      jongno:  { key: 'commuteJongno'  as const, lng: 126.991854, lat: 37.571607 },
    }
    try {
      const entries = await Promise.allSettled(
        Object.values(STATIONS).map(async s => {
          const res = await fetch(
            `https://api.odsay.com/v1/api/searchPubTransPathR?apiKey=${encodeURIComponent(ODSAY_KEY)}&SX=${loc.lng}&SY=${loc.lat}&EX=${s.lng}&EY=${s.lat}&SearchType=0`
          ).then(r => r.json())
          const mins = res.result?.path?.[0]?.info?.totalTime
          return { key: s.key, time: mins != null ? `${mins}분` : null }
        })
      )
      const updates: Partial<ApartmentDetail> = {}
      entries.forEach(r => {
        if (r.status === 'fulfilled' && r.value.time) updates[r.value.key] = r.value.time
      })
      if (Object.keys(updates).length) await saveInfo(apartment.id, updates)
    } catch { }
  }

  async function autoFetchSchool(apartment: Apartment) {
    const loc = await getLatLng(apartment)
    if (!loc) return
    try {
      const res = await fetch(
        `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=SC4&x=${loc.lng}&y=${loc.lat}&radius=1500&size=15`,
        { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } }
      )
      const data = await res.json()
      const school = (data.documents || []).find((p: any) => p.place_name.includes('초등학교'))
      if (!school) return
      await saveInfo(apartment.id, { schoolName: school.place_name })
    } catch { }
  }

  async function autoFetchBuilding(apartment: Apartment) {
    if (!apartment.address) return
    try {
      // Step 1: geocode to get b_code
      const geoRes = await fetch(
        `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(apartment.address)}&size=1`,
        { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } }
      )
      const geoData = await geoRes.json()
      const bCode = geoData.documents?.[0]?.address?.b_code
      if (!bCode) return

      // Step 2: get kaptCode from AptListService2
      const norm = (s: string) => s.replace(/[\s()（）]|아파트/g, '').toLowerCase()
      const aptNorm = norm(apartment.name)
      const listRes = await fetch(
        `https://apis.data.go.kr/1613000/AptListService2/getAptList?serviceKey=${encodeURIComponent(import.meta.env.VITE_MOLIT_KEY)}&bjdongCode=${bCode}&numOfRows=200&_type=json`
      ).then(r => r.json())
      let listItems = listRes.response?.body?.items?.item ?? []
      if (!Array.isArray(listItems)) listItems = listItems ? [listItems] : []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const match = (listItems as any[]).find((it: any) => {
        const n = norm(it.kaptName ?? '')
        return n === aptNorm || n.includes(aptNorm) || aptNorm.includes(n)
      })
      if (!match?.kaptCode) return

      // Step 3: get 용적률/건폐율 from AptBasisInfoService
      const infoRes = await fetch(
        `https://apis.data.go.kr/1613000/AptBasisInfoService/getAprtInfo?serviceKey=${encodeURIComponent(import.meta.env.VITE_MOLIT_KEY)}&kaptCode=${match.kaptCode}&_type=json`
      ).then(r => r.json())
      const item = infoRes.response?.body?.items?.item
      if (!item) return

      const updates: Partial<ApartmentDetail> = {}
      if (item.kaptdacnt) updates.floorAreaRatio = String(item.kaptdacnt)
      if (item.kaptdaPt) updates.buildingCoverage = String(item.kaptdaPt)
      if (Object.keys(updates).length) await saveInfo(apartment.id, updates)
    } catch { }
  }

  async function saveInfo(aptId: string, updates: Partial<ApartmentDetail>) {
    if (isGuest) {
      guestDB.setInfo(aptId, updates)
    } else {
      const { setDoc } = await import('firebase/firestore')
      await setDoc(doc(db, 'apartments', aptId, 'info', 'detail'), updates, { merge: true }).catch(() => {})
    }
    setDetailInfo(prev => ({ ...prev, ...updates }))
  }

  async function saveVisit(aptId: string, updates: Partial<ApartmentVisit>) {
    if (isGuest) {
      guestDB.setVisit(aptId, updates)
      setVisitInfo(prev => ({ ...prev, ...updates }))
      return
    }

    try {
      const { setDoc } = await import('firebase/firestore')
      await setDoc(doc(db, 'apartments', aptId, 'visits', 'latest'), updates, { merge: true })
      setVisitInfo(prev => ({ ...prev, ...updates }))
    } catch {
      alert('방문 데이터 저장에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.')
    }
  }

  // ── Summary from cached real tx items ─────────────────────────────────────

  const summary = useMemo(() => {
    const items: RealTxItem[] = apt?.realTxCache?.items ?? []
    if (!items.length) return null
    const toPrice = (tx: RealTxItem) => parseInt(String(tx.dealAmount).replace(/,/g, ''))
    const latestKey = `${items[0].dealYear}-${items[0].dealMonth}`
    const latestItems = items.filter(tx => `${tx.dealYear}-${tx.dealMonth}` === latestKey)
    const prevItems = items.filter(tx => `${tx.dealYear}-${tx.dealMonth}` !== latestKey)
    const prevKey = prevItems[0] ? `${prevItems[0].dealYear}-${prevItems[0].dealMonth}` : null
    const prevMonthItems = prevKey ? prevItems.filter(tx => `${tx.dealYear}-${tx.dealMonth}` === prevKey) : []
    const latestMax = Math.max(...latestItems.map(toPrice))
    const latestMin = Math.min(...latestItems.map(toPrice))
    const prevMax = prevMonthItems.length ? Math.max(...prevMonthItems.map(toPrice)) : null
    const diff = prevMax ? latestMax - prevMax : null
    return { latestMax, latestMin, count: items.length, diff }
  }, [apt?.realTxCache?.items])

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="card p-5 animate-pulse space-y-2">
          <div className="h-5 bg-slate-100 rounded w-1/3" />
          <div className="h-4 bg-slate-100 rounded w-2/3" />
        </div>
      </div>
    )
  }

  if (!apt) return null

  const chips = [
    apt.completionYear && `${apt.completionYear}년 준공`,
    apt.totalUnits && `${Number(apt.totalUnits).toLocaleString()}세대`,
    apt.maxFloor && `최고 ${apt.maxFloor}층`,
  ].filter(Boolean) as string[]

  return (
    <div className="space-y-4">
      {/* 아파트 헤더 */}
      <div className="card p-5">
        <h1 className="text-lg font-bold text-text">{apt.name}</h1>
        {apt.address && <p className="text-sm text-text-muted mt-0.5">{apt.address}</p>}
        {chips.length > 0 && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {chips.map(c => <span key={c} className="apt-chip">{c}</span>)}
          </div>
        )}
      </div>

      {/* 시세 요약 바 */}
      {summary && (
        <div className="grid grid-cols-4 gap-3">
          <SummaryItem label="최근 최고 실거래" value={formatPrice(summary.latestMax)} />
          <SummaryItem label="최근 최저 실거래" value={formatPrice(summary.latestMin)} />
          <SummaryItem label="조회 건수" value={`${summary.count}건`} neutral />
          <SummaryItem
            label="전월 대비"
            value={summary.diff != null ? (summary.diff > 0 ? `▲ ${formatPrice(summary.diff)}` : summary.diff < 0 ? `▼ ${formatPrice(Math.abs(summary.diff))}` : '변동없음') : '-'}
            up={summary.diff != null && summary.diff > 0}
            down={summary.diff != null && summary.diff < 0}
          />
        </div>
      )}

      {/* 섹션들 */}
      <PriceSection
        apt={apt}
        isGuest={isGuest}
        onAptChange={setApt}
      />

      <InfoSection
        aptId={apt.id}
        detailInfo={detailInfo}
        onSaveInfo={(updates) => saveInfo(apt.id, updates)}
        onAutoRefresh={() => Promise.allSettled([
          autoFetchStation(apt),
          autoFetchCommute(apt),
          autoFetchSchool(apt),
          autoFetchBuilding(apt),
        ])}
      />

      <VisitSection
        visit={visitInfo}
        onSave={(updates) => saveVisit(apt.id, updates)}
      />

      <MapSection apt={apt} />

      <NewsSection aptName={apt.name} region={apt.region} />

      <MemoSection
        apt={apt}
        isGuest={isGuest}
        memos={memos}
        onMemosChange={setMemos}
      />
    </div>
  )
}

function SummaryItem({ label, value, neutral, up, down }: {
  label: string; value: string; neutral?: boolean; up?: boolean; down?: boolean
}) {
  const valueClass = up ? 'text-danger' : down ? 'text-primary' : neutral ? 'text-text' : 'text-text'
  return (
    <div className="card p-3 text-center">
      <p className="text-[11px] text-text-muted mb-1">{label}</p>
      <p className={`text-sm font-bold ${valueClass}`}>{value}</p>
    </div>
  )
}
