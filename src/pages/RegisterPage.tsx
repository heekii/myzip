import { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, query, where, getDocs, serverTimestamp, setDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { guestDB } from '@/lib/guestDB'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const kakao: any

const MOLIT_KEY = import.meta.env.VITE_MOLIT_KEY as string
const ODSAY_KEY = import.meta.env.VITE_ODSAY_KEY as string
const STATIONS = {
  gangnam: { name: '강남역', lng: 127.027621, lat: 37.497942 },
  yeouido: { name: '여의도역', lng: 126.924171, lat: 37.521574 },
  jongno: { name: '종로3가역', lng: 126.991854, lat: 37.571607 },
} as const

interface Suggestion {
  name: string
  address: string
}

interface RegisterData {
  address: string
  region: string
  lawdCd: string | null
  completionYear: string | null
  totalUnits: string | null
  maxFloor: string | null
  lat: number | null
  lng: number | null
  commuteGangnam: string | null
  commuteYeouido: string | null
  commuteJongno: string | null
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { user, isGuest } = useAuthStore()
  const [aptName, setAptName] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [preview, setPreview] = useState<{ name: string; address: string; meta: string } | null>(null)
  const [registerData, setRegisterData] = useState<RegisterData | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [error, setError] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout>>()

  const searchByName = useCallback((q: string) => {
    try {
      const ps = new kakao.maps.services.Places()
      ps.keywordSearch(q, (result: KakaoPlace[], status: string) => {
        if (status !== kakao.maps.services.Status.OK) { setSuggestions([]); return }
        setSuggestions(
          result
            .filter(p => p.category_name?.endsWith('아파트'))
            .map(p => ({
              name: p.place_name.replace(/아파트$/, '').trim(),
              address: p.road_address_name || p.address_name,
            }))
        )
      }, { size: 15 })
    } catch {
      setSuggestions([])
    }
  }, [])

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setAptName(v)
    setPreview(null)
    setRegisterData(null)
    setError('')
    clearTimeout(searchTimer.current)
    if (v.trim().length < 2) { setSuggestions([]); setShowDropdown(false); return }
    searchTimer.current = setTimeout(() => {
      searchByName(v.trim())
      setShowDropdown(true)
    }, 300)
  }

  async function selectSuggestion(name: string, address: string) {
    setAptName(name)
    setSuggestions([])
    setShowDropdown(false)
    setLoadingPreview(true)
    setPreview({ name, address, meta: '정보 불러오는 중...' })

    let region = ''
    let lawdCd: string | null = null
    let lat: number | null = null
    let lng: number | null = null
    let bCode = ''

    try {
      const geocoder = new kakao.maps.services.Geocoder()
      await new Promise<void>(resolve => {
        geocoder.addressSearch(address, (result: KakaoGeoResult[], status: string) => {
          if (status === kakao.maps.services.Status.OK && result[0]?.address) {
            const addr = result[0].address
            region = `${addr.region_1depth_name} ${addr.region_2depth_name}`.trim()
            lat = parseFloat(result[0].y)
            lng = parseFloat(result[0].x)
            bCode = addr.b_code || ''
            lawdCd = bCode ? bCode.substring(0, 5) : null
          }
          resolve()
        })
      })
    } catch { /* geocoding 실패 시 기본값으로 진행 */ }

    const base: RegisterData = {
      address, region, lawdCd,
      completionYear: null, totalUnits: null, maxFloor: null,
      lat, lng,
      commuteGangnam: null, commuteYeouido: null, commuteJongno: null,
    }

    if (!lawdCd || lat == null || lng == null) {
      setPreview({ name, address, meta: '' })
      setRegisterData(base)
      setLoadingPreview(false)
      return
    }

    const [molit, units, commute] = await Promise.all([
      fetchMOLIT(name, lawdCd),
      fetchUnits(name, bCode),
      fetchCommute(lat, lng),
    ])

    const metaParts = [
      molit.completionYear && `${molit.completionYear}년 준공`,
      molit.maxFloor && `최고 ${molit.maxFloor}층`,
      units && `${Number(units).toLocaleString()}세대`,
      commute.commuteGangnam && `강남역 ${commute.commuteGangnam}`,
      commute.commuteYeouido && `여의도역 ${commute.commuteYeouido}`,
      commute.commuteJongno && `종로3가역 ${commute.commuteJongno}`,
    ].filter(Boolean)

    setPreview({ name, address, meta: metaParts.join(' · ') })
    setRegisterData({ ...base, ...molit, totalUnits: units, ...commute })
    setLoadingPreview(false)
  }

  async function handleRegister() {
    if (!aptName.trim()) { setError('아파트 이름을 입력해주세요.'); return }
    if (!registerData?.address) { setError('목록에서 아파트를 선택해주세요.'); return }

    setSubmitting(true)
    setError('')
    try {
      const payload = {
        name: aptName.trim(),
        address: registerData.address,
        region: registerData.region,
        lawdCd: registerData.lawdCd,
        completionYear: registerData.completionYear,
        totalUnits: registerData.totalUnits,
        maxFloor: registerData.maxFloor,
        lat: registerData.lat,
        lng: registerData.lng,
      }

      if (isGuest) {
        const id = guestDB.addApartment(payload)
        guestDB.setInfo(id, {
          commuteGangnam: registerData.commuteGangnam ?? undefined,
          commuteYeouido: registerData.commuteYeouido ?? undefined,
          commuteJongno: registerData.commuteJongno ?? undefined,
        })
        navigate(`/apartments/${id}`)
        return
      }

      const dup = await getDocs(
        query(collection(db, 'apartments'), where('userId', '==', user!.uid), where('name', '==', payload.name))
      )
      if (!dup.empty) { setError('이미 등록된 아파트입니다.'); return }

      const ref = await addDoc(collection(db, 'apartments'), {
        ...payload,
        userId: user!.uid,
        createdAt: serverTimestamp(),
        priceCount: 0,
      })

      await setDoc(doc(db, 'apartments', ref.id, 'info', 'detail'), {
        commuteGangnam: registerData.commuteGangnam,
        commuteYeouido: registerData.commuteYeouido,
        commuteJongno: registerData.commuteJongno,
        updatedAt: serverTimestamp(),
      })

      navigate(`/apartments/${ref.id}`)
    } catch (err) {
      console.error(err)
      setError('등록 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-[560px] mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text">아파트 추가</h1>
        <p className="text-sm text-text-muted mt-1">이름만 검색하면 끝이에요. 상세 정보는 나중에 채울 수 있어요.</p>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="relative mb-3">
            <label className="form-label" htmlFor="aptName">아파트 단지명</label>
            <input
              id="aptName"
              type="text"
              className="form-input"
              style={{ fontSize: '1rem', padding: '14px 16px', borderRadius: '12px' }}
              placeholder="예: 래미안원베일리"
              maxLength={50}
              autoComplete="off"
              value={aptName}
              onChange={handleInput}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            />

            {showDropdown && suggestions.length > 0 && (
              <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border-2 border-primary rounded-xl shadow-[0_8px_24px_rgba(37,99,235,.15)] z-50 max-h-[360px] overflow-y-auto">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-border last:border-b-0"
                    onMouseDown={() => selectSuggestion(s.name, s.address)}
                  >
                    <div className="text-sm font-semibold text-text">{s.name}</div>
                    <div className="text-xs text-text-muted mt-0.5">{s.address}</div>
                  </button>
                ))}
              </div>
            )}

            <p className="form-hint">이름 입력 → 목록에서 선택하면 주소·세대수·준공연도가 자동 입력돼요</p>
          </div>

          {preview && (
            <div className="bg-bg rounded-lg px-4 py-3 mb-4 text-sm">
              <div className="font-bold mb-1 text-text">{preview.name}</div>
              <div className="text-text-muted">{preview.address}</div>
              {preview.meta && (
                <div className="text-text-muted text-xs mt-1">{preview.meta}</div>
              )}
            </div>
          )}

          {error && (
            <p className="text-sm text-danger mb-3">{error}</p>
          )}

          <button
            type="button"
            className="btn btn-primary btn-full"
            style={{ padding: '14px', fontSize: '1rem', borderRadius: '12px' }}
            disabled={submitting || loadingPreview}
            onClick={handleRegister}
          >
            {submitting ? '등록 중...' : loadingPreview ? '정보 불러오는 중...' : '추가하기'}
          </button>

          <p className="text-center text-xs text-text-muted mt-3">
            주소 자동검색이 안 되면{' '}
            <button
              type="button"
              className="text-primary underline"
              onClick={searchAddress}
            >
              주소 직접 검색
            </button>
          </p>
        </div>
      </div>
    </div>
  )

  function searchAddress() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new (window as any).daum.Postcode({
        oncomplete(data: { roadAddress: string; jibunAddress: string; sido: string; sigungu: string; sigunguCode: string }) {
          const address = data.roadAddress || data.jibunAddress
          setRegisterData(prev => ({
            address,
            region: `${data.sido} ${data.sigungu}`.trim(),
            lawdCd: data.sigunguCode,
            completionYear: null,
            totalUnits: null,
            maxFloor: null,
            lat: prev?.lat ?? null,
            lng: prev?.lng ?? null,
            commuteGangnam: null,
            commuteYeouido: null,
            commuteJongno: null,
          }))
          setPreview({ name: aptName || address, address, meta: '' })
        },
      }).open()
    } catch {
      setError('주소 검색을 사용할 수 없습니다.')
    }
  }
}

// ─── Kakao SDK types ───────────────────────────────────────────────────────────

interface KakaoPlace {
  place_name: string
  category_name?: string
  road_address_name: string
  address_name: string
}

interface KakaoGeoResult {
  y: string
  x: string
  address: {
    region_1depth_name: string
    region_2depth_name: string
    b_code: string
  }
}

// ─── API helpers ───────────────────────────────────────────────────────────────

const norm = (s: string) => s.replace(/[\s()（）아파트]/g, '').toLowerCase()

async function fetchMOLIT(aptName: string, lawdCd: string): Promise<{ completionYear: string | null; maxFloor: string | null }> {
  const normName = norm(aptName)
  const now = new Date()
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  const results = await Promise.all(
    months.map(ym =>
      fetch(`https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?serviceKey=${encodeURIComponent(MOLIT_KEY)}&LAWD_CD=${lawdCd}&DEAL_YMD=${ym}&numOfRows=1000&_type=json`)
        .then(r => r.json())
        .then(data => {
          let items = data.response?.body?.items?.item ?? []
          if (!Array.isArray(items)) items = items ? [items] : []
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (items as any[]).filter(it => {
            const n = norm(it.aptNm ?? '')
            return n === normName || n.includes(normName) || normName.includes(n)
          })
        })
        .catch(() => [])
    )
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: any[] = results.flat()
  if (!all.length) return { completionYear: null, maxFloor: null }

  const completionYear = all[0].buildYear || null
  const floors = all.map(it => parseInt(it.floor) || 0).filter(f => f > 0)
  const maxFloor = floors.length ? String(Math.max(...floors)) : null
  return { completionYear, maxFloor }
}

async function fetchUnits(aptName: string, bCode: string): Promise<string | null> {
  const normName = norm(aptName)
  try {
    const listData = await fetch(
      `https://apis.data.go.kr/1613000/AptListService2/getAptList?serviceKey=${encodeURIComponent(MOLIT_KEY)}&bjdongCode=${bCode}&numOfRows=200&_type=json`
    ).then(r => r.json())

    let items = listData.response?.body?.items?.item ?? []
    if (!Array.isArray(items)) items = items ? [items] : []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const match = (items as any[]).find(it => {
      const n = norm(it.kaptName ?? '')
      return n === normName || n.includes(normName) || normName.includes(n)
    })
    if (!match?.kaptCode) return null

    const infoData = await fetch(
      `https://apis.data.go.kr/1613000/AptBasisInfoService/getAprtInfo?serviceKey=${encodeURIComponent(MOLIT_KEY)}&kaptCode=${match.kaptCode}&_type=json`
    ).then(r => r.json())
    return infoData.response?.body?.items?.item?.kaptHoCount ?? null
  } catch {
    return null
  }
}

async function fetchCommute(fromLat: number, fromLng: number): Promise<{
  commuteGangnam: string | null
  commuteYeouido: string | null
  commuteJongno: string | null
}> {
  const entries = await Promise.allSettled(
    (Object.entries(STATIONS) as [keyof typeof STATIONS, typeof STATIONS[keyof typeof STATIONS]][]).map(
      async ([key, station]) => {
        const data = await fetch(
          `https://api.odsay.com/v1/api/searchPubTransPathR?apiKey=${encodeURIComponent(ODSAY_KEY)}&SX=${fromLng}&SY=${fromLat}&EX=${station.lng}&EY=${station.lat}&SearchType=0`
        ).then(r => r.json())
        const mins = data.result?.path?.[0]?.info?.totalTime
        return { key, time: mins != null ? `${mins}분` : null }
      }
    )
  )

  const result = { commuteGangnam: null as string | null, commuteYeouido: null as string | null, commuteJongno: null as string | null }
  const keyMap: Record<keyof typeof STATIONS, keyof typeof result> = {
    gangnam: 'commuteGangnam',
    yeouido: 'commuteYeouido',
    jongno: 'commuteJongno',
  }
  for (const r of entries) {
    if (r.status === 'fulfilled') result[keyMap[r.value.key]] = r.value.time
  }
  return result
}
