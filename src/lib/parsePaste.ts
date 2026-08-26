// 호갱노노 단지 목록 붙여넣기 → 후보 단지 행으로 파싱.
// 붙여넣기마다 줄바꿈이 달라지므로 줄이 아니라 토큰(탭·개행·2칸이상 공백·전각공백 구분) 단위로 읽는다.

export interface ParsedRow {
  name: string
  size: number
  totalUnits: string | null
  completionYear: string | null
  salePrice: number
  saleChange: number | null
  jeonsePrice: number | null
  jeonseRatio: string | null
  gap: number | null
}

const ANCHOR = /^([\d,]+)세대\([^)]*\)$/
const SIZE = /^(\d+)평$/
const YM = /^(\d{4})-\d{2}$/
const NUM = /^-?[\d,]+$/
const PCT = /^\d+%$/

const toInt = (s: string) => parseInt(s.replace(/,/g, ''), 10)

export function parsePaste(text: string): { rows: ParsedRow[]; skipped: number } {
  const tokens = text.split(/[\t\r\n　]+|\s{2,}/).map(t => t.trim()).filter(Boolean)

  const anchors: number[] = []
  tokens.forEach((t, i) => { if (ANCHOR.test(t)) anchors.push(i) })

  const rows: ParsedRow[] = []
  const seen = new Set<string>()
  let skipped = 0

  anchors.forEach((a, k) => {
    const end = k + 1 < anchors.length ? anchors[k + 1] - 1 : tokens.length
    const name = tokens[a - 1]
    const slice = tokens.slice(a, end)

    const sizeTok = slice.find(t => SIZE.test(t))
    const nums = slice.filter(t => NUM.test(t)).map(toInt)

    if (!name || ANCHOR.test(name) || SIZE.test(name) || !sizeTok || nums.length === 0) { skipped++; return }

    const size = Number(sizeTok.match(SIZE)![1])
    const key = `${name} ${size}평`
    if (seen.has(key)) { skipped++; return }
    seen.add(key)

    const ym = slice.find(t => YM.test(t))
    rows.push({
      name,
      size,
      totalUnits: String(toInt(tokens[a].match(ANCHOR)![1])),
      completionYear: ym ? ym.slice(0, 4) : null,
      salePrice: nums[0],
      saleChange: nums[1] ?? null,
      jeonsePrice: nums[2] ?? null,
      jeonseRatio: slice.find(t => PCT.test(t)) ?? null,
      gap: nums[4] ?? null,
    })
  })

  return { rows, skipped }
}
