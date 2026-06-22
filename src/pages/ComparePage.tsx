import { useEffect, useState, type ReactNode } from 'react'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { useScenarioStore } from '@/store/scenarioStore'
import { guestDB } from '@/lib/guestDB'
import { formatPrice } from '@/lib/utils'
import type { Apartment, ApartmentDetail, ApartmentVisit, DecisionStatus } from '@/types'

const FACING_MAP: Record<string, string> = {
  south: '남향', 'south-east': '남동향', 'south-west': '남서향',
  east: '동향', west: '서향', north: '북향',
}

const MAX_SELECT = 4
const VISIT_STATUS_LABEL: Record<string, string> = {
  'not-planned': '미정',
  scheduled: '방문 예정',
  visited: '방문 완료',
  'on-hold': '보류',
}
const DECISION_STATUS_LABEL: Record<DecisionStatus, string> = {
  active: '검토중',
  eliminated: '탈락',
  finalist: '최종 후보',
}
const DECISION_TAG_CLASS: Record<DecisionStatus, string> = {
  active: 'bg-slate-100 text-slate-700',
  eliminated: 'bg-red-50 text-danger',
  finalist: 'bg-emerald-50 text-emerald-700',
}
type CompareFilter = 'all' | 'survivors' | 'finalists'
type CompareSort = 'newest' | 'decision'

export default function ComparePage() {
  const { user, isGuest } = useAuthStore()
  const { setPageTitle, setHeaderRight } = useUIStore()
  const activeScenarioId = useScenarioStore(s => s.activeId)

  const [apartments, setApartments] = useState<Apartment[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [infoMap, setInfoMap] = useState<Record<string, Partial<ApartmentDetail>>>({})
  const [visitMap, setVisitMap] = useState<Record<string, Partial<ApartmentVisit>>>({})
  const [filter, setFilter] = useState<CompareFilter>('survivors')
  const [sortBy, setSortBy] = useState<CompareSort>('decision')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setPageTitle('단지 비교')
    setHeaderRight(null)
    return () => { setPageTitle('내집마련 트래커'); setHeaderRight(null) }
  }, [])

  useEffect(() => {
    loadApartments()
  }, [user, isGuest])

  // 시나리오 전환 시 다른 세트의 선택이 남지 않도록 초기화
  useEffect(() => {
    setSelected([])
  }, [activeScenarioId])

  async function loadApartments() {
    setLoading(true)
    try {
      if (isGuest) {
        const apts = guestDB.getApartments()
        setApartments(apts)
        const visitEntries = Object.fromEntries(apts.map(apt => [apt.id, guestDB.getVisit(apt.id)]))
        setVisitMap(visitEntries)
      } else if (user) {
        const snap = await getDocs(
          query(collection(db, 'apartments'), where('userId', '==', user.uid))
        )
        const apts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Apartment))
        apts.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
        setApartments(apts)
        const visitSnaps = await Promise.all(
          apts.map(async apt => {
            try {
              const visitSnap = await getDoc(doc(db, 'apartments', apt.id, 'visits', 'latest'))
              return [apt.id, visitSnap.exists() ? (visitSnap.data() as Partial<ApartmentVisit>) : {}] as const
            } catch {
              return [apt.id, {}] as const
            }
          })
        )
        setVisitMap(Object.fromEntries(visitSnaps))
      }
    } finally {
      setLoading(false)
    }
  }

  async function toggleSelect(id: string) {
    if (selected.includes(id)) {
      setSelected(prev => prev.filter(s => s !== id))
      return
    }
    if (selected.length >= MAX_SELECT) return

    setSelected(prev => [...prev, id])

    // load info/visit if not cached
    if (infoMap[id] !== undefined && visitMap[id] !== undefined) return
    try {
      let info: Partial<ApartmentDetail> = {}
      let visit: Partial<ApartmentVisit> = {}
      if (isGuest) {
        info = guestDB.getInfo(id)
        visit = guestDB.getVisit(id)
      } else {
        const [infoSnap, visitSnap] = await Promise.all([
          getDoc(doc(db, 'apartments', id, 'info', 'detail')),
          getDoc(doc(db, 'apartments', id, 'visits', 'latest')),
        ])
        if (infoSnap.exists()) info = infoSnap.data() as Partial<ApartmentDetail>
        if (visitSnap.exists()) visit = visitSnap.data() as Partial<ApartmentVisit>
      }
      setInfoMap(prev => ({ ...prev, [id]: info }))
      setVisitMap(prev => ({ ...prev, [id]: visit }))
    } catch {
      setInfoMap(prev => ({ ...prev, [id]: {} }))
      setVisitMap(prev => ({ ...prev, [id]: {} }))
    }
  }

  const decisionValue = (id: string): DecisionStatus => {
    const raw = visitMap[id]?.decisionStatus
    return raw === 'eliminated' || raw === 'finalist' ? raw : 'active'
  }

  // 시나리오가 지정되지 않은 기존 단지는 모든 시나리오에 노출
  const scenarioApts = apartments.filter(a => !a.scenarioId || a.scenarioId === activeScenarioId)

  const visibleApartments = scenarioApts
    .filter(apt => {
      const decision = decisionValue(apt.id)
      if (filter === 'survivors') return decision !== 'eliminated'
      if (filter === 'finalists') return decision === 'finalist'
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return 0
      const rank = (status: DecisionStatus) => (status === 'finalist' ? 0 : status === 'active' ? 1 : 2)
      return rank(decisionValue(a.id)) - rank(decisionValue(b.id))
    })

  const selectedApts = selected
    .map(id => apartments.find(a => a.id === id))
    .filter(Boolean)
    .filter(a => {
      if (!a) return false
      const decision = decisionValue(a.id)
      if (filter === 'survivors') return decision !== 'eliminated'
      if (filter === 'finalists') return decision === 'finalist'
      return true
    }) as Apartment[]

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="card p-4 animate-pulse">
            <div className="h-4 bg-slate-100 rounded w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  if (apartments.length === 0) {
    return (
      <div className="card p-8 text-center text-text-muted">
        <p className="text-3xl mb-3">🏠</p>
        <p className="font-semibold text-text">등록된 아파트가 없어요</p>
        <p className="text-sm mt-1">아파트를 등록하면 단지를 비교할 수 있어요.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* 선택 영역 */}
      <div className="card p-4">
        <div className="flex flex-col gap-2.5 mb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-sm text-text">비교할 단지 선택</h3>
            <p className="text-[11px] text-text-muted mt-0.5">
              필터 기준: {filter === 'all' ? '전체 단지' : filter === 'survivors' ? '생존 후보(검토중/최종 후보)' : '최종 후보만'}
            </p>
          </div>
          <span className="text-xs text-text-muted">{selected.length}/{MAX_SELECT}</span>
        </div>
        <div className="grid grid-cols-1 gap-2 mb-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-[11px] text-text-muted">필터</span>
            <select className="form-input text-sm" value={filter} onChange={e => setFilter(e.target.value as CompareFilter)}>
              <option value="survivors">생존 후보</option>
              <option value="finalists">최종 후보</option>
              <option value="all">전체</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] text-text-muted">정렬</span>
            <select className="form-input text-sm" value={sortBy} onChange={e => setSortBy(e.target.value as CompareSort)}>
              <option value="decision">의사결정 우선</option>
              <option value="newest">등록순</option>
            </select>
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          {visibleApartments.map(apt => {
            const isOn = selected.includes(apt.id)
            const disabled = !isOn && selected.length >= MAX_SELECT
            const decision = decisionValue(apt.id)
            return (
              <button
                key={apt.id}
                onClick={() => toggleSelect(apt.id)}
                disabled={disabled}
                className={[
                  'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                  isOn
                    ? 'bg-primary text-white border-primary'
                    : disabled
                      ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                      : 'bg-white text-text border-border hover:border-primary hover:text-primary',
                ].join(' ')}
              >
                {apt.name}
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${DECISION_TAG_CLASS[decision]}`}>
                  {DECISION_STATUS_LABEL[decision]}
                </span>
              </button>
            )
          })}
        </div>
        {visibleApartments.length === 0 && (
          <p className="text-xs text-text-muted mt-2">현재 필터에 해당하는 단지가 없습니다.</p>
        )}
        {visibleApartments.length > 0 && selected.length === 0 && (
          <p className="text-xs text-text-muted mt-2">단지를 선택하면 비교표가 나타납니다.</p>
        )}
      </div>

      {/* 비교 테이블 */}
      {selectedApts.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: `${180 + selectedApts.length * 180}px` }}>
              <thead>
                <tr className="bg-bg">
                  <th className="sticky left-0 bg-bg z-10 text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider w-[160px]">
                    항목
                  </th>
                  {selectedApts.map(apt => (
                    <th key={apt.id} className="px-4 py-3 text-center min-w-[160px]">
                      <div className="font-bold text-text text-[13px] leading-tight">{apt.name}</div>
                      {apt.address && (
                        <div className="text-[10px] text-text-muted mt-0.5 font-normal truncate max-w-[120px] mx-auto">
                          {apt.address}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">

                <GroupRow label="💰 시세" />
                <Row label="최근 최고가" values={selectedApts.map(a => a.latestMaxPrice ? formatPrice(a.latestMaxPrice) : '-')} compare="min" />
                <Row label="최근 최저가" values={selectedApts.map(a => a.latestMinPrice ? formatPrice(a.latestMinPrice) : '-')} compare="min" />
                <Row label="시세 기록" values={selectedApts.map(a => a.priceCount ? `${a.priceCount}건` : '-')} />

                <GroupRow label="🏗️ 단지 정보" />
                <Row label="준공년도" values={selectedApts.map(a => a.completionYear ? `${a.completionYear}년` : '-')} />
                <Row label="세대수" values={selectedApts.map(a => a.totalUnits ? `${Number(a.totalUnits).toLocaleString()}세대` : '-')} compare="max" />
                <Row label="최고층" values={selectedApts.map(a => a.maxFloor ? `${a.maxFloor}층` : '-')} compare="max" />

                <GroupRow label="🚇 교통" />
                <Row label="가장 가까운 역" values={selectedApts.map(a => infoMap[a.id]?.nearStation || '-')} />
                <Row label="역까지 도보" values={selectedApts.map(a => infoMap[a.id]?.stationDist ? `${infoMap[a.id]?.stationDist}m` : '-')} compare="min-num" />
                <Row label="역세권 여부" values={selectedApts.map(a => {
                  const v = infoMap[a.id]?.isStationZone
                  return v === 'yes' ? '✓ 역세권' : v === 'no' ? '✗ 비역세권' : '-'
                })} highlight={selectedApts.map(a => infoMap[a.id]?.isStationZone === 'yes')} />
                <Row label="향/조망" values={selectedApts.map(a => FACING_MAP[infoMap[a.id]?.southFacing ?? ''] ?? '-')} />

                <GroupRow label="🗺️ 업무지구 접근성" />
                <Row label="강남역" values={selectedApts.map(a => infoMap[a.id]?.commuteGangnam || '-')} compare="min-num" />
                <Row label="여의도역" values={selectedApts.map(a => infoMap[a.id]?.commuteYeouido || '-')} compare="min-num" />
                <Row label="종로3가역" values={selectedApts.map(a => infoMap[a.id]?.commuteJongno || '-')} compare="min-num" />

                <GroupRow label="🏫 교육 / 건축" />
                <Row label="초등학교 배정" values={selectedApts.map(a => infoMap[a.id]?.schoolName || '-')} />
                <Row label="용적률" values={selectedApts.map(a => infoMap[a.id]?.floorAreaRatio ? `${infoMap[a.id]?.floorAreaRatio}%` : '-')} compare="min-num" />
                <Row label="건폐율" values={selectedApts.map(a => infoMap[a.id]?.buildingCoverage ? `${infoMap[a.id]?.buildingCoverage}%` : '-')} compare="min-num" />

                <GroupRow label="🧭 현장 방문" />
                <Row
                  label={<ResponsiveLabel mobile="결정" desktop="의사결정 상태" />}
                  values={selectedApts.map(a => DECISION_STATUS_LABEL[decisionValue(a.id)] ?? DECISION_STATUS_LABEL.active)}
                />
                <Row
                  label={<ResponsiveLabel mobile="탈락 사유" desktop="탈락 사유" />}
                  values={selectedApts.map(a => {
                    const decision = decisionValue(a.id)
                    if (decision !== 'eliminated') return '-'
                    return visitMap[a.id]?.eliminationReason?.trim() || '미입력'
                  })}
                  multiline
                />
                <Row
                  label={<ResponsiveLabel mobile="상태" desktop="방문 상태" />}
                  values={selectedApts.map(a => VISIT_STATUS_LABEL[visitMap[a.id]?.status ?? ''] || '-')}
                />
                <Row
                  label={<ResponsiveLabel mobile="예정일" desktop="방문 예정일" />}
                  values={selectedApts.map(a => visitMap[a.id]?.scheduledAt || '-')}
                />
                <Row
                  label={<ResponsiveLabel mobile="실방문" desktop="실방문일" />}
                  values={selectedApts.map(a => visitMap[a.id]?.visitedAt || '-')}
                />
                <Row label={<ResponsiveLabel mobile="동/호" desktop="동/호 상태" />} values={selectedApts.map(a => {
                  const b = visitMap[a.id]?.buildingCondition?.trim()
                  const u = visitMap[a.id]?.unitCondition?.trim()
                  if (!b && !u) return '-'
                  return [b, u].filter(Boolean).join(' / ')
                })} multiline />
                <Row
                  label={<ResponsiveLabel mobile="하자" desktop="하자 메모" />}
                  values={selectedApts.map(a => visitMap[a.id]?.defectNotes?.trim() || '-')}
                  multiline
                />
                <Row
                  label={<ResponsiveLabel mobile="액션" desktop="다음 액션" />}
                  values={selectedApts.map(a => visitMap[a.id]?.nextAction?.trim() || '-')}
                  multiline
                />

              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function GroupRow({ label }: { label: string }) {
  return (
    <tr className="bg-blue-50/60">
      <td colSpan={99} className="sticky left-0 bg-blue-50/60 px-3 sm:px-4 py-2 text-[11px] font-semibold text-primary uppercase tracking-wider">
        {label}
      </td>
    </tr>
  )
}

function Row({ label, values, compare, highlight, multiline }: {
  label: ReactNode
  values: string[]
  compare?: 'min' | 'max' | 'min-num'
  highlight?: boolean[]
  multiline?: boolean
}) {
  // find best index for numeric comparison
  const bestIdx = (() => {
    if (!compare || values.every(v => v === '-')) return -1
    if (compare === 'min-num') {
      const nums = values.map(v => parseInt(v.replace(/[^0-9]/g, '')))
      const valid = nums.filter(n => !isNaN(n))
      if (valid.length < 2) return -1
      const best = Math.min(...valid)
      return nums.indexOf(best)
    }
    // for price values formatted as "X억 Y만원" — compare raw
    if (compare === 'min' || compare === 'max') {
      // already formatted — just highlight if only 1 value no point
      if (values.length < 2) return -1
      const nums = values.map(v => {
        if (v === '-') return NaN
        // parse "X억 Y만원" back to 만원
        let total = 0
        const uk = v.match(/(\d[\d,]*)억/)
        const man = v.match(/(\d[\d,]*)만원/)
        if (uk) total += parseInt(uk[1].replace(/,/g, '')) * 10000
        if (man) total += parseInt(man[1].replace(/,/g, ''))
        return total || NaN
      })
      const valid = nums.filter(n => !isNaN(n))
      if (valid.length < 2) return -1
      const best = compare === 'min' ? Math.min(...valid) : Math.max(...valid)
      return nums.indexOf(best)
    }
    return -1
  })()

  const isLabelText = typeof label === 'string'

  return (
    <tr className="hover:bg-slate-50/50">
      <td
        className={[
          'sticky left-0 bg-white hover:bg-slate-50/50 px-3 sm:px-4 py-2.5 sm:py-3 text-xs text-text-muted font-medium z-10',
          isLabelText ? 'whitespace-nowrap' : 'whitespace-normal leading-tight',
        ].join(' ')}
      >
        {isLabelText ? <span className="block truncate max-w-[82px] sm:max-w-none">{label}</span> : label}
      </td>
      {values.map((v, i) => (
        <td key={i} className="px-3 sm:px-4 py-2.5 sm:py-3 text-center text-sm">
          <span className={[
            v === '-' ? 'text-text-muted' : 'text-text font-medium',
            i === bestIdx ? 'text-success font-bold' : '',
            highlight?.[i] ? 'text-success font-bold' : '',
            multiline ? 'inline-block max-w-[112px] sm:max-w-[150px] text-[12px] sm:text-sm leading-5 sm:leading-6 whitespace-normal break-words text-left sm:text-center' : 'inline-block max-w-[112px] sm:max-w-none truncate',
          ].filter(Boolean).join(' ')} title={v !== '-' ? v : undefined}>
            {v}
          </span>
        </td>
      ))}
    </tr>
  )
}

function ResponsiveLabel({ mobile, desktop }: { mobile: string; desktop: string }) {
  return (
    <>
      <span className="sm:hidden">{mobile}</span>
      <span className="hidden sm:inline">{desktop}</span>
    </>
  )
}
