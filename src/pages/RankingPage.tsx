import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { useScenarioStore } from '@/store/scenarioStore'
import { useUIStore } from '@/store/uiStore'
import { guestDB } from '@/lib/guestDB'
import { formatPrice } from '@/lib/utils'
import {
  CATEGORIES, CATEGORY_LABEL, DEFAULT_WEIGHTS,
  commuteScore, futureScore, priceScore, totalScore,
  loadScoreSettings, saveScoreSettings,
  type ScoreCategory, type ScoreWeights, type CategoryScores,
} from '@/lib/scoring'
import type { Apartment, ApartmentDetail, ApartmentVisit } from '@/types'

const num = (v: unknown): number | null => {
  if (v == null) return null
  const n = parseInt(String(v).replace(/[^0-9]/g, ''), 10)
  return isNaN(n) ? null : n
}

interface Row {
  apt: Apartment
  scores: CategoryScores
  total: number | null
  completeness: number
}

export default function RankingPage() {
  const { user, isGuest } = useAuthStore()
  const activeScenarioId = useScenarioStore(s => s.activeId)
  const { setPageTitle } = useUIStore()

  const [apartments, setApartments] = useState<Apartment[]>([])
  const [infoMap, setInfoMap] = useState<Record<string, Partial<ApartmentDetail>>>({})
  const [visitMap, setVisitMap] = useState<Record<string, Partial<ApartmentVisit>>>({})
  const [weights, setWeights] = useState<ScoreWeights>(DEFAULT_WEIGHTS)
  const [budgetEok, setBudgetEok] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setPageTitle('점수·순위')
    return () => setPageTitle('내집마련 트래커')
  }, [setPageTitle])

  useEffect(() => {
    loadAll()
  }, [user, isGuest])

  // 시나리오 전환 시 설정(가중치·예산) 다시 로드
  useEffect(() => {
    const s = loadScoreSettings(isGuest, user?.uid ?? null, activeScenarioId)
    setWeights(s.weights)
    setBudgetEok(s.budgetEok)
  }, [activeScenarioId, isGuest, user])

  async function loadAll() {
    setLoading(true)
    try {
      let apts: Apartment[] = []
      if (isGuest) {
        apts = guestDB.getApartments()
        setInfoMap(Object.fromEntries(apts.map(a => [a.id, guestDB.getInfo(a.id)])))
        setVisitMap(Object.fromEntries(apts.map(a => [a.id, guestDB.getVisit(a.id)])))
      } else if (user) {
        const snap = await getDocs(query(collection(db, 'apartments'), where('userId', '==', user.uid)))
        apts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Apartment))
        const pairs = await Promise.all(apts.map(async a => {
          try {
            const [infoSnap, visitSnap] = await Promise.all([
              getDoc(doc(db, 'apartments', a.id, 'info', 'detail')),
              getDoc(doc(db, 'apartments', a.id, 'visits', 'latest')),
            ])
            return {
              id: a.id,
              info: infoSnap.exists() ? (infoSnap.data() as Partial<ApartmentDetail>) : {},
              visit: visitSnap.exists() ? (visitSnap.data() as Partial<ApartmentVisit>) : {},
            }
          } catch {
            return { id: a.id, info: {}, visit: {} }
          }
        }))
        setInfoMap(Object.fromEntries(pairs.map(p => [p.id, p.info])))
        setVisitMap(Object.fromEntries(pairs.map(p => [p.id, p.visit])))
      }
      setApartments(apts)
    } finally {
      setLoading(false)
    }
  }

  function updateWeight(cat: ScoreCategory, value: number) {
    const next = { ...weights, [cat]: Math.max(0, value) }
    setWeights(next)
    saveScoreSettings(isGuest, user?.uid ?? null, activeScenarioId, { weights: next, budgetEok })
  }

  function updateBudget(value: string) {
    const clean = value.replace(/[^0-9.]/g, '')
    setBudgetEok(clean)
    saveScoreSettings(isGuest, user?.uid ?? null, activeScenarioId, { weights, budgetEok: clean })
  }

  function resetWeights() {
    setWeights(DEFAULT_WEIGHTS)
    saveScoreSettings(isGuest, user?.uid ?? null, activeScenarioId, { weights: DEFAULT_WEIGHTS, budgetEok })
  }

  async function saveManualScore(aptId: string, cat: 'infra' | 'school', value: number | undefined) {
    const field = cat === 'infra' ? 'infraScore' : 'schoolScore'
    const updates = { [field]: value } as Partial<ApartmentVisit>
    setVisitMap(prev => ({ ...prev, [aptId]: { ...prev[aptId], ...updates } }))
    if (isGuest) {
      guestDB.setVisit(aptId, updates)
      return
    }
    try {
      await setDoc(doc(db, 'apartments', aptId, 'visits', 'latest'), updates, { merge: true })
    } catch {
      alert('점수 저장에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.')
    }
  }

  // 활성 시나리오 생존 단지 (미배정은 전 시나리오 노출, 탈락 제외)
  const candidates = useMemo(
    () => apartments.filter(a =>
      (!a.scenarioId || a.scenarioId === activeScenarioId) &&
      visitMap[a.id]?.decisionStatus !== 'eliminated'
    ),
    [apartments, visitMap, activeScenarioId],
  )

  const rows: Row[] = useMemo(() => {
    const budgetManwon = budgetEok ? parseFloat(budgetEok) * 10000 : null
    const prices = candidates.map(a => a.latestMaxPrice ?? a.latestMinPrice ?? null).filter((p): p is number => p != null)
    const minP = prices.length ? Math.min(...prices) : 0
    const maxP = prices.length ? Math.max(...prices) : 0

    const list = candidates.map(apt => {
      const info = infoMap[apt.id] ?? {}
      const visit = visitMap[apt.id] ?? {}
      const commuteMins = [info.commuteGangnam, info.commuteYeouido, info.commuteJongno]
        .map(num).filter((n): n is number => n != null)
      const price = apt.latestMaxPrice ?? apt.latestMinPrice ?? null
      const scores: CategoryScores = {
        price: priceScore(price, budgetManwon, minP, maxP) ?? undefined,
        commute: commuteMins.length ? commuteScore(Math.min(...commuteMins)) ?? undefined : undefined,
        future: futureScore(num(apt.completionYear), num(info.floorAreaRatio)) ?? undefined,
        infra: visit.infraScore,
        school: visit.schoolScore,
      }
      const { total, completeness } = totalScore(scores, weights)
      return { apt, scores, total, completeness }
    })

    return list.sort((a, b) => {
      if (a.total == null && b.total == null) return 0
      if (a.total == null) return 1
      if (b.total == null) return -1
      return b.total - a.total
    })
  }, [candidates, infoMap, visitMap, weights, budgetEok])

  const weightSum = CATEGORIES.reduce((s, c) => s + weights[c], 0)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-text">점수 · 순위</h1>
        <p className="text-sm text-text-muted mt-1">활성 시나리오의 생존 단지를 가중 점수로 자동 정렬합니다. 탈락 단지는 제외됩니다.</p>
      </div>

      {/* 가중치 / 예산 */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-text">가중치 설정</h3>
          <button type="button" className="text-xs text-text-muted hover:text-primary" onClick={resetWeights}>기본값으로</button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {CATEGORIES.map(cat => (
            <label key={cat} className="block">
              <span className="block text-[11px] text-text-muted mb-1">{CATEGORY_LABEL[cat]}</span>
              <input
                type="number" min={0} max={100}
                className="form-input text-sm py-1.5 text-center"
                value={weights[cat]}
                onChange={e => updateWeight(cat, parseInt(e.target.value || '0', 10))}
              />
            </label>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <label className="block">
            <span className="block text-[11px] text-text-muted mb-1">예산 (억, 선택) — 입력 시 가격을 예산 대비로 평가</span>
            <input
              type="text" inputMode="decimal" placeholder="예: 12.5"
              className="form-input text-sm py-1.5 max-w-[160px]"
              value={budgetEok}
              onChange={e => updateBudget(e.target.value)}
            />
          </label>
          <p className="text-[11px] text-text-muted">
            가중치 합 {weightSum} — 합이 100이 아니어도 비율로 자동 정규화됩니다.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-text-muted text-sm">불러오는 중…</div>
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-3xl mb-2">🏆</p>
          <p className="font-bold text-text mb-1">순위를 매길 단지가 없습니다</p>
          <p className="text-sm text-text-muted mb-4">이 시나리오에 단지를 등록하거나, 탈락 처리를 해제해보세요.</p>
          <Link to="/register" className="btn btn-primary">단지 등록하기</Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-text-muted text-[11px]">
                  <th className="sticky left-0 bg-slate-50 px-3 py-2.5 text-left font-semibold">순위 / 단지</th>
                  {CATEGORIES.map(cat => (
                    <th key={cat} className="px-2 py-2.5 font-semibold whitespace-nowrap">{CATEGORY_LABEL[cat]}</th>
                  ))}
                  <th className="px-3 py-2.5 font-semibold whitespace-nowrap">총점</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={row.apt.id} className="border-t border-border hover:bg-slate-50/50">
                    <td className="sticky left-0 bg-white px-3 py-3">
                      <div className="flex items-center gap-2">
                        <span className={[
                          'shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold',
                          i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-slate-200 text-slate-600' : i === 2 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-text-muted',
                        ].join(' ')}>{i + 1}</span>
                        <Link to={`/apartments/${row.apt.id}`} className="min-w-0">
                          <span className="block text-sm font-semibold text-text truncate max-w-[120px] sm:max-w-none hover:text-primary">{row.apt.name}</span>
                          <span className="block text-[11px] text-text-muted">
                            {row.apt.latestMaxPrice ? formatPrice(row.apt.latestMaxPrice) : '시세 없음'} · 데이터 {row.completeness}/5
                          </span>
                        </Link>
                      </div>
                    </td>
                    {CATEGORIES.map(cat => (
                      <td key={cat} className="px-2 py-3 text-center">
                        {cat === 'infra' || cat === 'school' ? (
                          <ManualScoreInput
                            value={cat === 'infra' ? visitMap[row.apt.id]?.infraScore : visitMap[row.apt.id]?.schoolScore}
                            onChange={v => saveManualScore(row.apt.id, cat, v)}
                          />
                        ) : (
                          <ScoreCell value={row.scores[cat]} />
                        )}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-center">
                      {row.total != null ? (
                        <span className="inline-block px-2 py-1 rounded-lg bg-primary/10 text-primary font-bold">{row.total.toFixed(1)}</span>
                      ) : (
                        <span className="text-text-muted">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-4 py-3 text-[11px] text-text-muted border-t border-border">
            가격·출퇴근·미래가치는 등록 데이터로 자동 산출(미래가치는 준공연도·용적률 기반 추정), 인프라·학군은 직접 입력합니다. 데이터 없는 카테고리는 점수에서 제외됩니다.
          </p>
        </div>
      )}
    </div>
  )
}

function ScoreCell({ value }: { value?: number }) {
  if (value == null) return <span className="text-text-muted text-xs">-</span>
  const tone = value >= 7 ? 'text-success' : value <= 3 ? 'text-danger' : 'text-text'
  return <span className={`font-semibold ${tone}`}>{value}</span>
}

function ManualScoreInput({ value, onChange }: { value?: number; onChange: (v: number | undefined) => void }) {
  return (
    <select
      className="border border-border rounded-md text-xs px-1 py-1 bg-white focus:outline-none focus:border-primary"
      value={value ?? ''}
      onChange={e => onChange(e.target.value ? Number(e.target.value) : undefined)}
    >
      <option value="">-</option>
      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
        <option key={n} value={n}>{n}</option>
      ))}
    </select>
  )
}
