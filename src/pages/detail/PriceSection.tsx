import { useState, useEffect, useRef, useMemo } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { guestDB } from '@/lib/guestDB'
import { formatPrice, aptNameMatch } from '@/lib/utils'
import type { Apartment, RealTxItem } from '@/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Chart: any

const MOLIT_KEY = import.meta.env.VITE_MOLIT_KEY as string

const toJibun = (v: unknown) => (v != null ? String(v).trim() : '')

interface Props {
  apt: Apartment
  isGuest: boolean
  onAptChange: (updater: (prev: Apartment | null) => Apartment | null) => void
}

export default function PriceSection({ apt, isGuest, onAptChange }: Props) {
  const [realTxItems, setRealTxItems] = useState<RealTxItem[]>(apt.realTxCache?.items ?? [])
  const [selectedSize, setSelectedSize] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { fetchRealTx() }, [apt.id])

  async function fetchRealTx() {
    if (!apt.lawdCd) return
    setLoading(true)
    try {
      const now = new Date()
      const monthsFrom = (start: number, count: number) =>
        Array.from({ length: count }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - start - i, 1)
          return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
        })

      const fetchMonths = async (months: string[]) => {
        const results = await Promise.all(
          months.map(ym =>
            fetch(`https://apis.data.go.kr/1613000/RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev?serviceKey=${encodeURIComponent(MOLIT_KEY)}&LAWD_CD=${apt.lawdCd}&DEAL_YMD=${ym}&numOfRows=1000&_type=json`)
              .then(r => r.json())
              .then(r => {
                let items = r.response?.body?.items?.item ?? []
                if (!Array.isArray(items)) items = items ? [items] : []
                return items as RealTxItem[]
              })
              .catch(() => [] as RealTxItem[])
          )
        )
        return results.flat()
      }

      const match = (flat: RealTxItem[]) => {
        const exact = flat.filter(tx => aptNameMatch(tx.aptNm ?? '', apt.name) === 'exact')
        return exact.length ? exact : flat.filter(tx => aptNameMatch(tx.aptNm ?? '', apt.name) === 'loose')
      }

      let flat = await fetchMonths(monthsFrom(0, 6))
      let candidates = match(flat)
      // 신축 입주장처럼 거래가 한때 몰렸다 끊긴 단지는 6개월로는 한 건도 안 잡힌다.
      if (!candidates.length) {
        flat = flat.concat(await fetchMonths(monthsFrom(6, 12)))
        candidates = match(flat)
      }

      let all: RealTxItem[] = []
      if (candidates.length) {
        if (apt.aptJibun) {
          // Use cached jibun, fall back to all candidates if empty
          const byJibun = candidates.filter(tx => toJibun(tx.jibun) === apt.aptJibun)
          all = byJibun.length > 0 ? byJibun : candidates
        } else {
          // Discover dominant jibun and cache it
          const jibunMap: Record<string, number> = {}
          candidates.forEach(tx => {
            const j = toJibun(tx.jibun)
            if (j) jibunMap[j] = (jibunMap[j] ?? 0) + 1
          })
          const topJibun = Object.entries(jibunMap).sort((a, b) => b[1] - a[1])[0]?.[0]
          if (topJibun) {
            onAptChange(prev => prev ? { ...prev, aptJibun: topJibun } : prev)
            if (!isGuest) updateDoc(doc(db, 'apartments', apt.id), { aptJibun: topJibun }).catch(() => {})
            else guestDB.updateApartment(apt.id, { aptJibun: topJibun })
            all = candidates.filter(tx => toJibun(tx.jibun) === topJibun)
          } else {
            all = candidates
          }
        }
      }

      all.sort((a, b) => {
        const da = `${a.dealYear}-${String(a.dealMonth).padStart(2, '0')}-${String(a.dealDay).padStart(2, '0')}`
        const db2 = `${b.dealYear}-${String(b.dealMonth).padStart(2, '0')}-${String(b.dealDay).padStart(2, '0')}`
        return db2.localeCompare(da)
      })

      const toCache = all.slice(0, 100)
      setRealTxItems(toCache)
      onAptChange(prev => prev ? { ...prev, realTxCache: { items: toCache } } : prev)
      if (!isGuest) {
        updateDoc(doc(db, 'apartments', apt.id), { realTxCache: { items: toCache } }).catch(() => {})
      }
    } finally {
      setLoading(false)
    }
  }

  const displayItems = useMemo(() =>
    selectedSize != null
      ? realTxItems.filter(tx => Math.abs(parseFloat(tx.excluUseAr) - selectedSize) <= 0.5)
      : realTxItems
  , [realTxItems, selectedSize])

  // Monthly max/min for chart
  const monthlyData = useMemo(() => {
    const map: Record<string, { max: number; min: number }> = {}
    displayItems.forEach(tx => {
      const ym = `${tx.dealYear}-${String(tx.dealMonth).padStart(2, '0')}`
      const price = parseInt(String(tx.dealAmount).replace(/,/g, ''))
      if (isNaN(price)) return
      if (!map[ym]) map[ym] = { max: price, min: price }
      else { map[ym].max = Math.max(map[ym].max, price); map[ym].min = Math.min(map[ym].min, price) }
    })
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([ym, v]) => ({ label: ym.replace('-', '.'), ...v }))
  }, [displayItems])

  // Chart
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<any>(null)

  useEffect(() => {
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
    if (!canvasRef.current || !monthlyData.length || typeof Chart === 'undefined') return
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: monthlyData.map(d => d.label),
        datasets: [
          {
            label: '최고 실거래가',
            data: monthlyData.map(d => d.max),
            borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.1)',
            tension: 0.4, fill: false, pointRadius: 4, borderWidth: 2.5,
          },
          {
            label: '최저 실거래가',
            data: monthlyData.map(d => d.min),
            borderColor: '#2563EB', backgroundColor: 'rgba(37,99,235,0.05)',
            tension: 0.4, fill: '-1', pointRadius: 4, borderWidth: 2.5,
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { family: 'Noto Sans KR', size: 12 }, usePointStyle: true } },
          tooltip: { callbacks: { label: (ctx: any) => ` ${ctx.dataset.label}: ${formatPrice(ctx.parsed.y)}` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 }, maxRotation: 45 } },
          y: {
            ticks: {
              callback: (v: number) => { const uk = Math.floor(v / 10000); return uk > 0 ? `${uk}억` : `${v.toLocaleString()}만` },
              font: { size: 11 },
            },
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
        },
      },
    })
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [monthlyData])

  const sizes = [...new Set(realTxItems.map(tx => parseFloat(parseFloat(tx.excluUseAr).toFixed(1))))].sort((a, b) => a - b)

  return (
    <>
      {/* 실거래가 추이 차트 */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">실거래가 추이</h3>
          <button type="button" className="btn btn-secondary btn-sm" disabled={loading} onClick={fetchRealTx}>
            {loading ? '조회 중...' : '새로고침'}
          </button>
        </div>
        <div className="card-body">
          {sizes.length > 1 && (
            <div className="flex gap-2 flex-wrap mb-3">
              <button type="button"
                className={`apt-chip cursor-pointer ${selectedSize === null ? 'bg-primary text-white' : ''}`}
                onClick={() => setSelectedSize(null)}>전체</button>
              {sizes.map(s => (
                <button key={s} type="button"
                  className={`apt-chip cursor-pointer ${selectedSize === s ? 'bg-primary text-white' : ''}`}
                  onClick={() => setSelectedSize(s)}>{s}㎡</button>
              ))}
            </div>
          )}
          {loading && monthlyData.length === 0 ? (
            <div className="h-[200px] bg-slate-50 rounded-lg animate-pulse" />
          ) : monthlyData.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              <p className="text-3xl mb-2">📊</p>
              <p className="text-sm">{apt.lawdCd ? '실거래 데이터가 없습니다.' : '주소 정보가 없어 조회할 수 없습니다.'}</p>
            </div>
          ) : (
            <div style={{ height: 240 }}>
              <canvas ref={canvasRef} />
            </div>
          )}
        </div>
      </div>

      {/* 실거래 목록 */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">🏛️ 국토교통부 실거래가</h3>
          <p className="text-xs text-text-muted">최근 6개월{displayItems.length > 0 ? ` · ${displayItems.length}건` : ''}</p>
        </div>
        <div className="card-body">
          {loading && displayItems.length === 0 ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-slate-50 rounded animate-pulse" />)}
            </div>
          ) : displayItems.length === 0 ? (
            <p className="text-center text-sm text-text-muted py-4">
              {apt.lawdCd ? '실거래 데이터가 없습니다.' : '주소 정보가 없어 조회할 수 없습니다.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-border">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-text-secondary text-xs">거래일</th>
                    <th className="text-left px-3 py-2 font-semibold text-text-secondary text-xs">면적(㎡)</th>
                    <th className="text-left px-3 py-2 font-semibold text-text-secondary text-xs">층</th>
                    <th className="text-left px-3 py-2 font-semibold text-text-secondary text-xs">실거래가</th>
                  </tr>
                </thead>
                <tbody>
                  {displayItems.slice(0, 30).map((tx, i) => (
                    <tr key={i} className="border-b border-border last:border-b-0">
                      <td className="px-3 py-2 text-text-muted">
                        {tx.dealYear}.{String(tx.dealMonth).padStart(2, '0')}.{String(tx.dealDay).padStart(2, '0')}
                      </td>
                      <td className="px-3 py-2">{parseFloat(tx.excluUseAr).toFixed(1)}</td>
                      <td className="px-3 py-2">{tx.floor}층</td>
                      <td className="px-3 py-2 font-semibold text-primary">
                        {formatPrice(parseInt(String(tx.dealAmount).replace(/,/g, '').trim()))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
