// 아파트 가중 점수 엔진 (apartment-scoring 스킬 프레임워크 기반)
// 가격·출퇴근·미래가치는 데이터로 자동 산출, 인프라·학군은 정성 수동 점수.

export type ScoreCategory = 'price' | 'commute' | 'future' | 'infra' | 'school'

export interface ScoreWeights {
  price: number
  commute: number
  future: number
  infra: number
  school: number
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  price: 35, commute: 25, future: 15, infra: 15, school: 10,
}

export const CATEGORY_LABEL: Record<ScoreCategory, string> = {
  price: '가격', commute: '출퇴근', future: '미래가치', infra: '인프라', school: '학군',
}

export const CATEGORIES: ScoreCategory[] = ['price', 'commute', 'future', 'infra', 'school']

const clamp = (n: number, lo = 1, hi = 10) => Math.max(lo, Math.min(hi, n))
const round1 = (n: number) => Math.round(n * 10) / 10

// 출퇴근 분 → 점수 (30분 이하 10점, 89분 1점 선형)
export function commuteScore(mins: number | null): number | null {
  if (mins == null || isNaN(mins)) return null
  if (mins <= 30) return 10
  if (mins >= 89) return 1
  return round1(10 - ((mins - 30) / (89 - 30)) * 9)
}

// 준공연도 + 용적률 휴리스틱 (추정치)
export function futureScore(completionYear: number | null, far: number | null): number | null {
  if (completionYear == null || isNaN(completionYear)) return null
  const age = new Date().getFullYear() - completionYear
  let s: number
  if (age <= 5) s = 7
  else if (age <= 15) s = 6
  else if (age <= 25) s = 5
  else if (age <= 30) s = 4
  else s = far != null && far < 200 ? 8 : 3 // 노후 + 저용적률 = 재건축 기대
  if (far != null && age <= 30) {
    if (far < 200) s += 1
    else if (far > 300) s -= 1
  }
  return clamp(s)
}

// 가격 점수: 예산(만원)이 있으면 예산 대비, 없으면 후보군 내 상대평가(저렴할수록 고점)
export function priceScore(
  price: number | null,
  budgetManwon: number | null,
  minPrice: number,
  maxPrice: number,
): number | null {
  if (price == null) return null
  if (budgetManwon && budgetManwon > 0) {
    const ratio = price / budgetManwon
    if (ratio <= 0.7) return 10
    if (ratio >= 1) return 1
    return round1(10 - ((ratio - 0.7) / 0.3) * 9)
  }
  if (maxPrice === minPrice) return 10
  return round1(10 - ((price - minPrice) / (maxPrice - minPrice)) * 9)
}

export type CategoryScores = Partial<Record<ScoreCategory, number>>

export interface ScoreResult {
  total: number | null  // 0~10
  completeness: number  // 0~5 (데이터 있는 카테고리 수)
}

// 가중 총점 — 데이터 없는 카테고리는 가중치에서 제외하고 정규화
export function totalScore(scores: CategoryScores, weights: ScoreWeights): ScoreResult {
  let wsum = 0
  let ssum = 0
  let count = 0
  for (const cat of CATEGORIES) {
    const v = scores[cat]
    if (v != null) {
      wsum += weights[cat]
      ssum += v * weights[cat]
      count++
    }
  }
  return {
    total: wsum > 0 ? round1(ssum / wsum) : null,
    completeness: count,
  }
}

// ── 시나리오별 점수 설정(가중치·예산) 영속 ──────────────────────────────────────

export interface ScoreSettings {
  weights: ScoreWeights
  budgetEok: string // 억 단위 문자열 (빈값 = 미설정)
}

const DEFAULT_SETTINGS: ScoreSettings = { weights: DEFAULT_WEIGHTS, budgetEok: '' }

function settingsKey(uid: string | null, scenarioId: string | null) {
  return `myzip_scoreSettings_${uid ?? 'guest'}_${scenarioId ?? 'none'}`
}

export function loadScoreSettings(isGuest: boolean, uid: string | null, scenarioId: string | null): ScoreSettings {
  try {
    const raw = (isGuest ? sessionStorage : localStorage).getItem(settingsKey(uid, scenarioId))
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw)
    return {
      weights: { ...DEFAULT_WEIGHTS, ...(parsed.weights ?? {}) },
      budgetEok: typeof parsed.budgetEok === 'string' ? parsed.budgetEok : '',
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveScoreSettings(isGuest: boolean, uid: string | null, scenarioId: string | null, settings: ScoreSettings) {
  ;(isGuest ? sessionStorage : localStorage).setItem(settingsKey(uid, scenarioId), JSON.stringify(settings))
}
