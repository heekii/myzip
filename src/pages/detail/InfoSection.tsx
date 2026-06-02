import { useState } from 'react'
import type { ApartmentDetail } from '@/types'

const COMMUTE_SPEED = (mins: string) => {
  const n = parseInt(mins)
  if (isNaN(n)) return ''
  return n <= 25 ? 'text-success font-bold' : n <= 40 ? 'text-warning font-bold' : 'text-danger font-bold'
}

interface Props {
  detailInfo: Partial<ApartmentDetail>
  onAutoRefresh: () => Promise<unknown>
}

export default function InfoSection({ detailInfo, onAutoRefresh }: Props) {
  const [refreshing, setRefreshing] = useState(false)

  async function handleRefresh() {
    setRefreshing(true)
    try { await onAutoRefresh() } finally { setRefreshing(false) }
  }

  const val = (key: keyof ApartmentDetail) => String((detailInfo as any)[key] ?? '').trim() || '-'
  const hasAny = Object.values(detailInfo).some(v => v != null && String(v).trim() !== '')

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">단지 상세 정보</h3>
        <button type="button" className="btn btn-secondary btn-sm" disabled={refreshing} onClick={handleRefresh}>
          {refreshing ? '조회 중...' : '정보 새로고침'}
        </button>
      </div>

      <div className="card-body space-y-6">
        {!hasAny && !refreshing && (
          <p className="text-sm text-text-muted text-center py-2">정보를 불러오는 중이에요. 잠시 후 새로고침을 눌러주세요.</p>
        )}

        {/* ── 교통 ── */}
        <Section title="🚇 교통">
          <div className="grid grid-cols-2 gap-3">
            <InfoItem label="가장 가까운 역" value={val('nearStation')} loading={refreshing} />
            <InfoItem label="역까지 도보" value={detailInfo.stationDist ? `${detailInfo.stationDist}m` : '-'} loading={refreshing} />
            <InfoItem label="역세권 여부" value={detailInfo.isStationZone === 'yes' ? '역세권' : detailInfo.isStationZone === 'no' ? '비역세권' : '-'} loading={refreshing} />
          </div>
        </Section>

        {/* ── 업무지구 접근성 ── */}
        <Section title="🗺️ 업무지구 접근성">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: '강남역', key: 'commuteGangnam' },
              { label: '여의도역', key: 'commuteYeouido' },
              { label: '종로3가역', key: 'commuteJongno' },
            ].map(({ label, key }) => {
              const raw = (detailInfo as any)[key] as string | undefined
              const mins = parseInt(raw ?? '')
              return (
                <div key={key} className="card p-3 text-center">
                  <p className="text-xs text-text-muted mb-1">{label}</p>
                  {refreshing && !raw ? (
                    <div className="h-8 bg-slate-100 rounded animate-pulse mx-auto w-12" />
                  ) : raw ? (
                    <>
                      <p className={`text-2xl ${COMMUTE_SPEED(raw)}`}>{isNaN(mins) ? raw : mins}</p>
                      {!isNaN(mins) && <p className="text-xs text-text-muted">분</p>}
                    </>
                  ) : (
                    <p className="text-lg text-text-muted">-</p>
                  )}
                </div>
              )
            })}
          </div>
        </Section>

        {/* ── 교육 ── */}
        <Section title="🏫 교육">
          <InfoItem label="인근 초등학교" value={val('schoolName')} loading={refreshing} />
        </Section>

        {/* ── 건축 ── */}
        <Section title="🏗️ 건축">
          <div className="grid grid-cols-2 gap-3">
            <InfoItem label="용적률" value={detailInfo.floorAreaRatio ? `${detailInfo.floorAreaRatio}%` : '-'} loading={refreshing} />
            <InfoItem label="건폐율" value={detailInfo.buildingCoverage ? `${detailInfo.buildingCoverage}%` : '-'} loading={refreshing} />
          </div>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">{title}</p>
      {children}
    </div>
  )
}

function InfoItem({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
  return (
    <div className="bg-bg rounded-lg px-3 py-2">
      <p className="text-xs text-text-muted mb-0.5">{label}</p>
      {loading && value === '-' ? (
        <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4 mt-1" />
      ) : (
        <p className="text-sm font-semibold text-text">{value}</p>
      )}
    </div>
  )
}
