import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, query, where, getDocs, serverTimestamp, setDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { useScenarioStore } from '@/store/scenarioStore'
import { useUIStore } from '@/store/uiStore'
import { guestDB } from '@/lib/guestDB'
import { formatPrice } from '@/lib/utils'
import { searchKeyword, searchAddress as geocodeAddress, pickAptPlace } from '@/lib/kakao'
import { fetchCommute, type Commute } from '@/lib/commute'
import { parsePaste, decodeList, type ParsedRow } from '@/lib/parsePaste'

interface Found {
  placeName: string
  address: string
  region: string
  lawdCd: string | null
  lat: number | null
  lng: number | null
  commute: Commute
}

const EMPTY_COMMUTE: Commute = { commuteGangnam: null, commuteYeouido: null, commuteJongno: null }

// 붙여넣기에는 주소가 없다. 단지명으로 찾되 같은 이름이 전국에 있으므로
// 지역명을 앞에 붙여 검색한다. 잘못 잡힐 수 있으니 찾아온 등록명을 화면에 그대로 보여준다.
async function lookup(name: string, region: string): Promise<Found | null> {
  const places = await searchKeyword(`${region} ${name} 아파트`.trim(), { size: 5 })
  const hit = pickAptPlace(places, name)
  if (!hit) return null

  const address = hit.road_address_name || hit.address_name
  const addr = await geocodeAddress(address)
  const lat = parseFloat(addr ? addr.y : hit.y)
  const lng = parseFloat(addr ? addr.x : hit.x)
  const ok = !isNaN(lat) && !isNaN(lng)

  return {
    placeName: hit.place_name,
    address,
    region: addr ? `${addr.region_1depth_name} ${addr.region_2depth_name}`.trim() : region.trim(),
    lawdCd: addr?.b_code ? addr.b_code.substring(0, 5) : null,
    lat: ok ? lat : null,
    lng: ok ? lng : null,
    commute: ok ? await fetchCommute(lat, lng) : EMPTY_COMMUTE,
  }
}

const memoOf = (r: ParsedRow) =>
  [
    r.jeonsePrice ? `전세 ${formatPrice(r.jeonsePrice)}` : null,
    r.jeonseRatio ? `전세가율 ${r.jeonseRatio}` : null,
    r.gap ? `갭 ${formatPrice(r.gap)}` : null,
  ].filter(Boolean).join(' · ')

export default function ImportPage() {
  const navigate = useNavigate()
  const { user, isGuest } = useAuthStore()
  const activeScenarioId = useScenarioStore(s => s.activeId)
  const { setPageTitle } = useUIStore()

  const [text, setText] = useState('')
  const [region, setRegion] = useState('')
  const [found, setFound] = useState<Record<string, Found | null>>({})
  const [looking, setLooking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setPageTitle('여러 건 추가')
    return () => setPageTitle('내집마련 트래커')
  }, [setPageTitle])

  // 링크에 목록이 실려 오면 그대로 채운다(#해시라 서버엔 남지 않는다).
  useEffect(() => {
    const carried = decodeList(window.location.hash)
    if (!carried) return
    setText(carried.text)
    setRegion(carried.region)
    window.history.replaceState(null, '', window.location.pathname)
  }, [])

  const { rows, skipped } = useMemo(() => parsePaste(text), [text])

  // 같은 단지의 평형이 여러 개면 주소는 한 번만 찾으면 된다.
  const names = useMemo(() => [...new Set(rows.map(r => r.name))], [rows])
  const namesKey = names.join('|')

  const runIdRef = useRef(0)
  useEffect(() => {
    if (!names.length) { setFound({}); setLooking(false); return }
    const runId = ++runIdRef.current
    setLooking(true)
    const timer = setTimeout(async () => {
      const result: Record<string, Found | null> = {}
      for (const name of names) {
        result[name] = await lookup(name, region)
        if (runIdRef.current !== runId) return
        setFound({ ...result })
      }
      if (runIdRef.current === runId) setLooking(false)
    }, 600)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [namesKey, region])

  async function handleImport() {
    if (!rows.length) return
    setSubmitting(true)
    setError('')
    try {
      const existing = new Set(
        isGuest
          ? guestDB.getApartments().map(a => a.name)
          : (await getDocs(query(collection(db, 'apartments'), where('userId', '==', user!.uid)))).docs.map(d => d.data().name as string)
      )

      let added = 0
      for (const r of rows) {
        const name = `${r.name} ${r.size}평`
        if (existing.has(name)) continue

        const f = found[r.name] ?? null
        const commute = f?.commute ?? EMPTY_COMMUTE
        const payload = {
          name,
          address: f?.address ?? region.trim(),
          region: f?.region ?? region.trim(),
          lawdCd: f?.lawdCd ?? null,
          completionYear: r.completionYear,
          totalUnits: r.totalUnits,
          maxFloor: null,
          lat: f?.lat ?? null,
          lng: f?.lng ?? null,
          latestMaxPrice: r.salePrice,
          latestMinPrice: r.salePrice,
          // 붙여넣기의 변동폭을 역산해 대시보드 상승/하락 표시에 쓴다
          ...(r.saleChange != null ? { prevMaxPrice: r.salePrice - r.saleChange } : {}),
          ...(activeScenarioId ? { scenarioId: activeScenarioId } : {}),
        }
        const memo = memoOf(r)

        if (isGuest) {
          const id = guestDB.addApartment(payload)
          guestDB.setInfo(id, {
            targetSize: `${r.size}평`,
            commuteGangnam: commute.commuteGangnam ?? undefined,
            commuteYeouido: commute.commuteYeouido ?? undefined,
            commuteJongno: commute.commuteJongno ?? undefined,
          })
          if (memo) guestDB.addMemo(id, memo)
        } else {
          const ref = await addDoc(collection(db, 'apartments'), {
            ...payload,
            userId: user!.uid,
            createdAt: serverTimestamp(),
            priceCount: 0,
          })
          await setDoc(doc(db, 'apartments', ref.id, 'info', 'detail'), {
            targetSize: `${r.size}평`,
            ...commute,
            updatedAt: serverTimestamp(),
          })
          if (memo) {
            await addDoc(collection(db, 'apartments', ref.id, 'memos'), {
              content: memo,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          }
        }
        added++
      }

      if (added === 0) { setError('모두 이미 등록된 단지예요.'); return }
      navigate('/ranking')
    } catch (err) {
      console.error(err)
      setError('추가 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const missing = names.filter(n => n in found && found[n] == null).length

  return (
    <div className="max-w-[560px] mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text">여러 건 한 번에 추가</h1>
        <p className="text-sm text-text-muted mt-1">호갱노노 단지 목록을 그대로 복사해 붙여넣으세요. 주소·좌표·출퇴근 시간은 단지명으로 찾아 채웁니다.</p>
      </div>

      <div className="card">
        <div className="card-body">
          <label className="form-label" htmlFor="paste">붙여넣기</label>
          <textarea
            id="paste"
            className="form-input"
            style={{ minHeight: '180px', fontSize: '.875rem', lineHeight: 1.5 }}
            placeholder={'장미\n387세대(아파트)\t24평\n119세대\t1994-07\n...'}
            value={text}
            onChange={e => setText(e.target.value)}
          />

          <label className="form-label mt-3" htmlFor="region">지역</label>
          <input
            id="region"
            type="text"
            className="form-input"
            placeholder="예: 서울 강서구"
            value={region}
            onChange={e => setRegion(e.target.value)}
          />
          <p className="form-hint">같은 이름의 단지가 전국에 있어요. 지역을 적으면 엉뚱한 단지를 잡지 않습니다.</p>

          {text.trim() && (
            <div className="bg-bg rounded-lg px-4 py-3 my-4 text-sm">
              <div className="font-bold mb-2 text-text">
                {rows.length}건 인식
                {skipped > 0 && <span className="text-text-muted font-normal"> · {skipped}건 건너뜀(값 부족·중복)</span>}
                {looking && <span className="text-text-muted font-normal"> · 주소 찾는 중...</span>}
                {!looking && missing > 0 && <span className="text-danger font-normal"> · 주소 못 찾음 {missing}곳</span>}
              </div>
              <div className="max-h-[240px] overflow-y-auto">
                {rows.map((r, i) => {
                  const f = found[r.name]
                  return (
                    <div key={i} className="py-1.5 border-b border-border last:border-b-0">
                      <div className="flex justify-between gap-2">
                        <span className="text-text truncate">{r.name} {r.size}평</span>
                        <span className="text-text-muted whitespace-nowrap">
                          {formatPrice(r.salePrice)}{r.gap ? ` · 갭 ${formatPrice(r.gap)}` : ''}
                        </span>
                      </div>
                      <div className="text-xs mt-0.5 truncate">
                        {f === undefined ? (
                          <span className="text-text-muted">주소 찾는 중...</span>
                        ) : f === null ? (
                          <span className="text-danger">주소 못 찾음 — 나중에 상세에서 입력</span>
                        ) : (
                          <span className="text-text-muted">
                            {f.placeName} · {f.address}
                            {f.commute.commuteGangnam ? ` · 강남 ${f.commute.commuteGangnam}` : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-danger mb-3">{error}</p>}

          <button
            type="button"
            className="btn btn-primary btn-full"
            style={{ padding: '14px', fontSize: '1rem', borderRadius: '12px' }}
            disabled={submitting || looking || rows.length === 0}
            onClick={handleImport}
          >
            {submitting ? '추가 중...' : looking ? '주소 찾는 중...' : rows.length ? `${rows.length}건 추가하기` : '붙여넣으면 미리보기가 나와요'}
          </button>
        </div>
      </div>
    </div>
  )
}
