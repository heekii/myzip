import type { Timestamp } from 'firebase/firestore'

export function formatPrice(manwon: number): string {
  const eok = Math.floor(manwon / 10000)
  const rem = manwon % 10000
  if (eok > 0 && rem > 0) return `${eok}억 ${rem.toLocaleString()}만원`
  if (eok > 0) return `${eok}억`
  return `${manwon.toLocaleString()}만원`
}

export function formatDate(dateStr: string): string {
  return dateStr.replace(/-/g, '.')
}

export function tsToDate(ts: Timestamp | string | null | undefined): string {
  if (!ts) return ''
  if (typeof ts === 'string') return ts.slice(0, 10).replace(/-/g, '.')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((ts as any).toDate) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = (ts as any).toDate() as Date
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  }
  return ''
}

// 목록 붙여넣기로 들어온 후보는 평형까지 이름에 붙는다("장미 24평").
// 실거래가·뉴스는 단지명으로 찾아야 하므로 꼬리의 평형을 뗀다.
export function baseAptName(name: string): string {
  return name.replace(/\s*\d+평$/, '').trim()
}

const normAptName = (s: string) =>
  baseAptName(s).replace(/[\s()（）]|아파트/g, '').toLowerCase()

// 국토부 등록명은 줄여 쓰는 경우가 많다(방화5단지→"방화5", 방화3단지청솔→"청솔").
// 정확일치를 먼저 쓰고, 없을 때만 앞/뒤가 걸리는 느슨한 일치를 쓴다.
// 느슨한 일치는 다른 단지를 물 수 있어(마곡중앙하이츠 vs 중앙하이츠) 호출부에서 지번 다수결로 거른다.
export function aptNameMatch(molitName: string, myName: string): 'exact' | 'loose' | null {
  const a = normAptName(molitName)
  const b = normAptName(myName)
  if (!a || !b) return null
  if (a === b) return 'exact'
  if (a.length < 2 || b.length < 2) return null
  return a.startsWith(b) || a.endsWith(b) || b.startsWith(a) || b.endsWith(a) ? 'loose' : null
}
