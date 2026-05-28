import { useEffect, useState } from 'react'
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
import type { Apartment, ApartmentDetail, PriceEntry, Memo } from '@/types'
import PriceSection from './detail/PriceSection'
import InfoSection from './detail/InfoSection'
import MemoSection from './detail/MemoSection'

const KAKAO_REST_KEY = '4361e30ce685349654b54d472a22e974'
const ODSAY_KEY = '5QCQZr+fdJhD2Blcte1aWA'

export default function ApartmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, isGuest } = useAuthStore()
  const { setPageTitle, setHeaderRight } = useUIStore()

  const [apt, setApt] = useState<Apartment | null>(null)
  const [prices, setPrices] = useState<PriceEntry[]>([])
  const [detailInfo, setDetailInfo] = useState<Partial<ApartmentDetail>>({})
  const [memos, setMemos] = useState<Memo[]>([])
  const [loading, setLoading] = useState(true)

  // ── Load ──────────────────────────────────────────────────────────────────

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

      const [priceData, infoData, memoData] = await Promise.all([
        loadPrices(apartment),
        loadInfo(apartment),
        loadMemos(apartment),
      ])
      setPrices(priceData)
      setDetailInfo(infoData)
      setMemos(memoData)

      // 누락 필드 자동 보완 (백그라운드)
      autoFill(apartment, infoData)
    } finally {
      setLoading(false)
    }
  }

  async function loadPrices(apartment: Apartment): Promise<PriceEntry[]> {
    if (isGuest) return guestDB.getPrices(apartment.id)
    const snap = await getDocs(
      query(collection(db, 'apartments', apartment.id, 'prices'), orderBy('date', 'asc'))
    )
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as PriceEntry))
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

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!apt || !confirm(`'${apt.name}'을(를) 삭제하시겠습니까?\n시세, 메모 등 모든 데이터가 삭제됩니다.`)) return
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

  // ── Header right (delete button) ──────────────────────────────────────────

  useEffect(() => {
    if (!apt) return
    setHeaderRight(
      <button type="button" className="btn btn-danger btn-sm" onClick={handleDelete}>
        삭제
      </button>
    )
  }, [apt])

  // ── Auto-fill background tasks ────────────────────────────────────────────

  async function autoFill(apartment: Apartment, info: Partial<ApartmentDetail>) {
    const tasks: Promise<void>[] = []
    if (!info.nearStation) tasks.push(autoFetchStation(apartment))
    if (!info.commuteGangnam) tasks.push(autoFetchCommute(apartment))
    if (!info.schoolName) tasks.push(autoFetchSchool(apartment))
    if (tasks.length > 0) await Promise.allSettled(tasks)
  }

  async function getLatLng(apartment: Apartment): Promise<{ lat: number; lng: number } | null> {
    if (apartment.lat && apartment.lng) return { lat: apartment.lat, lng: apartment.lng }
    try {
      const res = await fetch(
        `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(apartment.name)}&size=5`,
        { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } }
      )
      const data = await res.json()
      const found = (data.documents || []).find((p: any) => p.category_name?.endsWith('아파트'))
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
      const updates: Partial<ApartmentDetail> = {
        nearStation: station.place_name,
        stationDist: String(dist),
        isStationZone: dist <= 500 ? 'yes' : 'no',
      }
      await saveInfo(apartment.id, updates)
    } catch { /* 무시 */ }
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
    } catch { /* 무시 */ }
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
    } catch { /* 무시 */ }
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

  const latest = prices[prices.length - 1]
  const prev = prices.length > 1 ? prices[prices.length - 2] : null
  const priceDiff = latest?.maxPrice && prev?.maxPrice ? latest.maxPrice - prev.maxPrice : null

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
      <div className="grid grid-cols-4 gap-3">
        <SummaryItem label="최근 최고가" value={latest?.maxPrice ? formatPrice(latest.maxPrice) : '-'} />
        <SummaryItem label="최근 최저가" value={latest?.minPrice ? formatPrice(latest.minPrice) : '-'} />
        <SummaryItem label="기록 건수" value={`${prices.length}건`} neutral />
        <SummaryItem
          label="최근 변동"
          value={priceDiff != null ? (priceDiff > 0 ? `▲ ${formatPrice(priceDiff)}` : priceDiff < 0 ? `▼ ${formatPrice(Math.abs(priceDiff))}` : '변동없음') : '-'}
          up={priceDiff != null && priceDiff > 0}
          down={priceDiff != null && priceDiff < 0}
        />
      </div>

      {/* 섹션들 */}
      <PriceSection
        apt={apt}
        isGuest={isGuest}
        prices={prices}
        onPricesChange={setPrices}
        onAptChange={setApt}
      />

      <InfoSection
        detailInfo={detailInfo}
        onInfoChange={updates => saveInfo(apt.id, updates)}
        onAutoStation={() => autoFetchStation(apt)}
        onAutoCommute={() => autoFetchCommute(apt)}
        onAutoSchool={() => autoFetchSchool(apt)}
      />

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
