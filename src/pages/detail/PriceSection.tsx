import { useState, useEffect, useRef } from 'react'
import {
  collection, addDoc, doc, updateDoc, deleteDoc,
  serverTimestamp, increment, query, getDocs, orderBy
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { guestDB } from '@/lib/guestDB'
import { formatPrice, formatDate } from '@/lib/utils'
import type { Apartment, PriceEntry, RealTxItem } from '@/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Chart: any

const MOLIT_KEY = '90072a18f3a77423afbb4652e22f161c810ae15acc14654ea0ea3ec276ca4fce'

interface Props {
  apt: Apartment
  isGuest: boolean
  prices: PriceEntry[]
  onPricesChange: (prices: PriceEntry[]) => void
  onAptChange: (updater: (prev: Apartment | null) => Apartment | null) => void
}

export default function PriceSection({ apt, isGuest, prices, onPricesChange, onAptChange }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [maxPrice, setMaxPrice] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [period, setPeriod] = useState<'3' | '6' | '12' | '0'>('3')
  const [saving, setSaving] = useState(false)
  const [editModal, setEditModal] = useState<PriceEntry | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editMax, setEditMax] = useState('')
  const [editMin, setEditMin] = useState('')

  // Real transaction state
  const [realTxItems, setRealTxItems] = useState<RealTxItem[]>([])
  const [selectedSize, setSelectedSize] = useState<number | null>(null)
  const [realTxLoading, setRealTxLoading] = useState(false)

  useEffect(() => {
    if (!isGuest && apt.realTxCache?.items?.length) {
      setRealTxItems(apt.realTxCache.items)
    }
    fetchRealTx(false)
  }, [apt.id])

  // ── Price CRUD ────────────────────────────────────────────────────────────

  async function handleSavePrice() {
    if (!date) { alert('날짜를 선택해주세요.'); return }
    const max = parseFloat(maxPrice) || null
    const min = parseFloat(minPrice) || null
    if (!max && !min) { alert('최고가 또는 최저가를 입력해주세요.'); return }
    if (max && min && min > max) { alert('최저가는 최고가보다 클 수 없습니다.'); return }

    const dup = prices.find(p => p.date === date)
    if (dup && !confirm(`${formatDate(date)}에 이미 데이터가 있습니다. 덮어쓰시겠습니까?`)) return

    setSaving(true)
    try {
      if (isGuest) {
        if (dup) guestDB.updatePrice(apt.id, dup.id, { maxPrice: max, minPrice: min })
        else guestDB.addPrice(apt.id, { date, maxPrice: max, minPrice: min })
      } else {
        if (dup) {
          await updateDoc(doc(db, 'apartments', apt.id, 'prices', dup.id), { maxPrice: max, minPrice: min })
        } else {
          await addDoc(collection(db, 'apartments', apt.id, 'prices'), {
            date, maxPrice: max, minPrice: min,
            createdAt: serverTimestamp(),
          })
          await updateDoc(doc(db, 'apartments', apt.id), {
            priceCount: increment(1),
            latestMaxPrice: max, latestMinPrice: min,
            prevMaxPrice: apt.latestMaxPrice ?? null,
          })
        }
      }
      setMaxPrice(''); setMinPrice('')
      await reloadPrices()
    } finally {
      setSaving(false)
    }
  }

  async function openEdit(p: PriceEntry) {
    setEditModal(p)
    setEditDate(p.date)
    setEditMax(p.maxPrice ? String(p.maxPrice) : '')
    setEditMin(p.minPrice ? String(p.minPrice) : '')
  }

  async function handleUpdatePrice() {
    if (!editModal || !editDate) return
    const max = parseFloat(editMax) || null
    const min = parseFloat(editMin) || null
    if (isGuest) {
      guestDB.updatePrice(apt.id, editModal.id, { date: editDate, maxPrice: max, minPrice: min })
    } else {
      await updateDoc(doc(db, 'apartments', apt.id, 'prices', editModal.id), { date: editDate, maxPrice: max, minPrice: min })
    }
    setEditModal(null)
    await reloadPrices()
  }

  async function handleDeletePrice(id: string) {
    if (!confirm('이 시세 데이터를 삭제하시겠습니까?')) return
    if (isGuest) {
      guestDB.deletePrice(apt.id, id)
    } else {
      await deleteDoc(doc(db, 'apartments', apt.id, 'prices', id))
      await updateDoc(doc(db, 'apartments', apt.id), { priceCount: increment(-1) })
    }
    await reloadPrices()
  }

  async function reloadPrices() {
    if (isGuest) {
      onPricesChange(guestDB.getPrices(apt.id))
    } else {
      const snap = await getDocs(
        query(collection(db, 'apartments', apt.id, 'prices'), orderBy('date', 'asc'))
      )
      onPricesChange(snap.docs.map(d => ({ id: d.id, ...d.data() } as PriceEntry)))
    }
  }

  // ── Real Transaction ──────────────────────────────────────────────────────

  async function fetchRealTx(showFeedback = false) {
    if (!apt.lawdCd) return
    setRealTxLoading(true)
    try {
      const now = new Date()
      const months = [0, 1, 2, 3].map(i => {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
      })

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

      const flat = results.flat()
      const toJibun = (v: unknown) => (v != null ? String(v).trim() : '')
      const norm = (s: string) => s.replace(/[\s()（）아파트]/g, '').toLowerCase()
      const aptNorm = norm(apt.name)

      let all: RealTxItem[]
      if (apt.aptJibun) {
        all = flat.filter(tx => toJibun(tx.jibun) === apt.aptJibun)
      } else {
        let candidates = flat.filter(tx => {
          const n = norm(tx.aptNm ?? '')
          return n === aptNorm
        })
        if (!candidates.length) {
          candidates = flat.filter(tx => {
            const n = norm(tx.aptNm ?? '')
            return (n.includes(aptNorm) && aptNorm.length >= 4) || (aptNorm.includes(n) && n.length >= 4)
          })
        }
        if (candidates.length) {
          const jibunMap: Record<string, number> = {}
          candidates.forEach(tx => {
            const j = toJibun(tx.jibun)
            if (j) jibunMap[j] = (jibunMap[j] ?? 0) + 1
          })
          const topJibun = Object.entries(jibunMap).sort((a, b) => b[1] - a[1])[0]?.[0]
          if (topJibun) {
            onAptChange(prev => prev ? { ...prev, aptJibun: topJibun } : prev)
            if (!isGuest) {
              updateDoc(doc(db, 'apartments', apt.id), { aptJibun: topJibun }).catch(() => {})
            } else {
              guestDB.updateApartment(apt.id, { aptJibun: topJibun })
            }
            all = candidates.filter(tx => toJibun(tx.jibun) === topJibun)
          } else {
            all = candidates
          }
        } else {
          all = []
        }
      }

      all.sort((a, b) => {
        const da = `${a.dealYear}-${String(a.dealMonth).padStart(2,'0')}-${String(a.dealDay).padStart(2,'0')}`
        const db2 = `${b.dealYear}-${String(b.dealMonth).padStart(2,'0')}-${String(b.dealDay).padStart(2,'0')}`
        return db2.localeCompare(da)
      })

      const toCache = all.slice(0, 50)
      setRealTxItems(toCache)

      if (!isGuest) {
        updateDoc(doc(db, 'apartments', apt.id), {
          realTxCache: { items: toCache, cachedAt: serverTimestamp() },
        }).catch(() => {})
      }

      if (showFeedback) alert(toCache.length > 0 ? `${toCache.length}건 조회됨` : '조회된 거래가 없습니다.')
    } catch {
      if (showFeedback) alert('조회 중 오류가 발생했습니다.')
    } finally {
      setRealTxLoading(false)
    }
  }

  // ── Chart ─────────────────────────────────────────────────────────────────

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<any>(null)

  const filteredPrices = (() => {
    if (period === '0') return prices
    const cutoff = new Date()
    cutoff.setMonth(cutoff.getMonth() - parseInt(period))
    const cutoffStr = cutoff.toISOString().split('T')[0]
    return prices.filter(p => p.date >= cutoffStr)
  })()

  useEffect(() => {
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null }
    if (!canvasRef.current || !filteredPrices.length || typeof Chart === 'undefined') return
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: filteredPrices.map(p => formatDate(p.date)),
        datasets: [
          {
            label: '최고 호가',
            data: filteredPrices.map(p => p.maxPrice ?? null),
            borderColor: '#EF4444',
            backgroundColor: 'rgba(239,68,68,0.1)',
            tension: 0.4, fill: false, pointRadius: 4, borderWidth: 2.5,
          },
          {
            label: '최저 호가',
            data: filteredPrices.map(p => p.minPrice ?? null),
            borderColor: '#2563EB',
            backgroundColor: 'rgba(37,99,235,0.05)',
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
              callback: (v: number) => {
                const uk = Math.floor(v / 10000)
                return uk > 0 ? `${uk}억` : `${v.toLocaleString()}만`
              },
              font: { size: 11 },
            },
            grid: { color: 'rgba(0,0,0,0.05)' },
          },
        },
      },
    })
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null } }
  }, [filteredPrices])

  // ── Size chip logic ───────────────────────────────────────────────────────

  const sizes = [...new Set(realTxItems.map(tx => parseFloat(parseFloat(tx.excluUseAr).toFixed(1))))].sort((a, b) => a - b)
  const showSizeChips = sizes.length > 1

  const displayedRealTx = selectedSize != null
    ? realTxItems.filter(tx => Math.abs(parseFloat(tx.excluUseAr) - selectedSize) <= 0.5)
    : realTxItems

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* 시세 입력 */}
      <div className="card">
        <div className="card-header"><h3 className="card-title">시세 입력</h3></div>
        <div className="card-body space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="form-label">날짜</label>
              <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label className="form-label">최고 호가</label>
              <div className="flex items-center gap-1">
                <input type="number" className="form-input" placeholder="예: 85000" min="0" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} />
                <span className="text-xs text-text-muted shrink-0">만원</span>
              </div>
            </div>
            <div>
              <label className="form-label">최저 호가</label>
              <div className="flex items-center gap-1">
                <input type="number" className="form-input" placeholder="예: 80000" min="0" value={minPrice} onChange={e => setMinPrice(e.target.value)} />
                <span className="text-xs text-text-muted shrink-0">만원</span>
              </div>
            </div>
          </div>
          <p className="form-hint">💡 호가(매도 호가) 기준. 단위: 만원 (예: 8억5천만원 → 85000)</p>
          <div className="flex justify-end">
            <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSavePrice}>
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>

      {/* 차트 */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">시세 추이</h3>
          <div className="flex gap-1">
            {(['3', '6', '12', '0'] as const).map(p => (
              <button key={p} type="button"
                className={`btn btn-sm ${period === p ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPeriod(p)}
              >
                {p === '0' ? '전체' : p === '12' ? '1년' : `${p}개월`}
              </button>
            ))}
          </div>
        </div>
        <div className="card-body">
          {filteredPrices.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              <p className="text-3xl mb-2">📊</p>
              <p className="text-sm">시세를 입력하면 그래프가 나타납니다.</p>
            </div>
          ) : (
            <div style={{ height: 240 }}>
              <canvas ref={canvasRef} />
            </div>
          )}
        </div>
      </div>

      {/* 입력 내역 */}
      <div className="card">
        <div className="card-header"><h3 className="card-title">입력 내역</h3></div>
        <div className="card-body p-0">
          {prices.length === 0 ? (
            <p className="text-center text-sm text-text-muted py-6">입력된 시세 데이터가 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold text-text-secondary text-xs">날짜</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-danger text-xs">최고 호가</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-primary text-xs">최저 호가</th>
                    <th className="px-4 py-2.5 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {[...prices].reverse().map(p => (
                    <tr key={p.id} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-2.5">{formatDate(p.date)}</td>
                      <td className="px-4 py-2.5 font-semibold text-danger">{p.maxPrice ? formatPrice(p.maxPrice) : '-'}</td>
                      <td className="px-4 py-2.5 font-semibold text-primary">{p.minPrice ? formatPrice(p.minPrice) : '-'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1.5">
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(p)}>수정</button>
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeletePrice(p.id)}>삭제</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 실거래가 */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">🏛️ 국토교통부 실거래가</h3>
          <button type="button" className="btn btn-secondary btn-sm" disabled={realTxLoading} onClick={() => fetchRealTx(true)}>
            {realTxLoading ? '조회 중...' : '새로고침'}
          </button>
        </div>
        <div className="card-body">
          <p className="form-hint mb-3">실제 거래 완료된 가격이에요. 호가와 다를 수 있어요.</p>

          {showSizeChips && (
            <div className="flex gap-2 flex-wrap mb-3">
              <button
                type="button"
                className={`apt-chip cursor-pointer ${selectedSize === null ? 'bg-primary text-white' : ''}`}
                onClick={() => setSelectedSize(null)}
              >전체</button>
              {sizes.map(s => (
                <button
                  key={s}
                  type="button"
                  className={`apt-chip cursor-pointer ${selectedSize === s ? 'bg-primary text-white' : ''}`}
                  onClick={() => setSelectedSize(s)}
                >
                  {s}㎡
                </button>
              ))}
            </div>
          )}

          {displayedRealTx.length === 0 ? (
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
                  {displayedRealTx.slice(0, 20).map((tx, i) => (
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

      {/* 수정 모달 */}
      {editModal && (
        <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <span className="font-bold">시세 수정</span>
              <button type="button" className="text-text-muted hover:text-text" onClick={() => setEditModal(null)}>✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="form-label">날짜</label>
                <input type="date" className="form-input" value={editDate} onChange={e => setEditDate(e.target.value)} />
              </div>
              <div>
                <label className="form-label">최고 호가 (만원)</label>
                <input type="number" className="form-input" value={editMax} onChange={e => setEditMax(e.target.value)} />
              </div>
              <div>
                <label className="form-label">최저 호가 (만원)</label>
                <input type="number" className="form-input" value={editMin} onChange={e => setEditMin(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2 justify-end px-5 pb-4">
              <button type="button" className="btn btn-secondary" onClick={() => setEditModal(null)}>취소</button>
              <button type="button" className="btn btn-primary" onClick={handleUpdatePrice}>저장</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
