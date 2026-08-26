import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { collection, addDoc, query, where, getDocs, serverTimestamp, setDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { useScenarioStore } from '@/store/scenarioStore'
import { useUIStore } from '@/store/uiStore'
import { guestDB } from '@/lib/guestDB'
import { formatPrice } from '@/lib/utils'
import { parsePaste, type ParsedRow } from '@/lib/parsePaste'

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
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setPageTitle('여러 건 추가')
    return () => setPageTitle('내집마련 트래커')
  }, [setPageTitle])

  const { rows, skipped } = useMemo(() => parsePaste(text), [text])

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

        const payload = {
          name,
          address: region.trim(),
          region: region.trim(),
          lawdCd: null,
          completionYear: r.completionYear,
          totalUnits: r.totalUnits,
          maxFloor: null,
          lat: null,
          lng: null,
          latestMaxPrice: r.salePrice,
          latestMinPrice: r.salePrice,
          // 붙여넣기의 변동폭을 역산해 대시보드 상승/하락 표시에 쓴다
          ...(r.saleChange != null ? { prevMaxPrice: r.salePrice - r.saleChange } : {}),
          ...(activeScenarioId ? { scenarioId: activeScenarioId } : {}),
        }
        const memo = memoOf(r)

        if (isGuest) {
          const id = guestDB.addApartment(payload)
          guestDB.setInfo(id, { targetSize: `${r.size}평` })
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

  return (
    <div className="max-w-[560px] mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-text">여러 건 한 번에 추가</h1>
        <p className="text-sm text-text-muted mt-1">호갱노노 단지 목록을 그대로 복사해 붙여넣으세요. 단지명·평형·매매가·갭을 읽어옵니다.</p>
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

          <label className="form-label mt-3" htmlFor="region">지역 (선택)</label>
          <input
            id="region"
            type="text"
            className="form-input"
            placeholder="예: 서울특별시 강서구"
            value={region}
            onChange={e => setRegion(e.target.value)}
          />
          <p className="form-hint">붙여넣기에는 주소가 없어요. 여기에 적으면 모든 단지에 같이 들어갑니다.</p>

          {text.trim() && (
            <div className="bg-bg rounded-lg px-4 py-3 my-4 text-sm">
              <div className="font-bold mb-2 text-text">
                {rows.length}건 인식{skipped > 0 && <span className="text-text-muted font-normal"> · {skipped}건 건너뜀(값 부족·중복)</span>}
              </div>
              <div className="max-h-[220px] overflow-y-auto">
                {rows.map((r, i) => (
                  <div key={i} className="flex justify-between gap-2 py-1 border-b border-border last:border-b-0">
                    <span className="text-text truncate">{r.name} {r.size}평</span>
                    <span className="text-text-muted whitespace-nowrap">
                      {formatPrice(r.salePrice)}{r.gap ? ` · 갭 ${formatPrice(r.gap)}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-danger mb-3">{error}</p>}

          <button
            type="button"
            className="btn btn-primary btn-full"
            style={{ padding: '14px', fontSize: '1rem', borderRadius: '12px' }}
            disabled={submitting || rows.length === 0}
            onClick={handleImport}
          >
            {submitting ? '추가 중...' : rows.length ? `${rows.length}건 추가하기` : '붙여넣으면 미리보기가 나와요'}
          </button>
        </div>
      </div>
    </div>
  )
}
