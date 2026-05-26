export function formatPrice(manwon: number): string {
  const eok = Math.floor(manwon / 10000)
  const rem = manwon % 10000
  if (eok > 0 && rem > 0) return `${eok}억 ${rem.toLocaleString()}만원`
  if (eok > 0) return `${eok}억`
  return `${manwon.toLocaleString()}만원`
}
