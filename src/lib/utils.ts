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
