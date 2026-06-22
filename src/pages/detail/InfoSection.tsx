import { useEffect, useState } from 'react'
import type { ApartmentDetail } from '@/types'

const COMMUTE_SPEED = (mins: string) => {
  const n = parseInt(mins)
  if (isNaN(n)) return ''
  return n <= 25 ? 'text-success font-bold' : n <= 40 ? 'text-warning font-bold' : 'text-danger font-bold'
}

interface Props {
  aptId: string
  detailInfo: Partial<ApartmentDetail>
  onAutoRefresh: () => Promise<unknown>
  onSaveInfo: (updates: Partial<ApartmentDetail>) => Promise<void>
}

export default function InfoSection({ aptId, detailInfo, onAutoRefresh, onSaveInfo }: Props) {
  const [refreshing, setRefreshing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Partial<ApartmentDetail>>({})

  useEffect(() => {
    setForm({
      nearStation: detailInfo.nearStation ?? '',
      stationDist: detailInfo.stationDist ?? '',
      schoolName: detailInfo.schoolName ?? '',
      floorAreaRatio: detailInfo.floorAreaRatio ?? '',
      buildingCoverage: detailInfo.buildingCoverage ?? '',
      commuteGangnam: detailInfo.commuteGangnam ?? '',
      commuteYeouido: detailInfo.commuteYeouido ?? '',
      commuteJongno: detailInfo.commuteJongno ?? '',
    })
  }, [aptId, detailInfo])

  async function handleRefresh() {
    setRefreshing(true)
    try { await onAutoRefresh() } finally { setRefreshing(false) }
  }

  async function handleSaveManual() {
    setSaving(true)
    try {
      await onSaveInfo({
        nearStation: form.nearStation?.trim() || undefined,
        stationDist: form.stationDist?.trim() || undefined,
        schoolName: form.schoolName?.trim() || undefined,
        floorAreaRatio: form.floorAreaRatio?.trim() || undefined,
        buildingCoverage: form.buildingCoverage?.trim() || undefined,
        commuteGangnam: form.commuteGangnam?.trim() || undefined,
        commuteYeouido: form.commuteYeouido?.trim() || undefined,
        commuteJongno: form.commuteJongno?.trim() || undefined,
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  const val = (key: keyof ApartmentDetail) => String((detailInfo as any)[key] ?? '').trim() || '-'
  const hasAny = Object.values(detailInfo).some(v => v != null && String(v).trim() !== '')

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">단지 상세 정보</h3>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button type="button" className="btn btn-secondary btn-sm" disabled={saving} onClick={() => setEditing(false)}>취소</button>
              <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={handleSaveManual}>
                {saving ? '저장 중...' : '직접입력 저장'}
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
              직접입력
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-sm" disabled={refreshing} onClick={handleRefresh}>
            {refreshing ? '조회 중...' : '정보 새로고침'}
          </button>
        </div>
      </div>

      <div className="card-body space-y-6">
        {!hasAny && !refreshing && (
          <p className="text-sm text-text-muted text-center py-2">
            자동 조회 데이터가 아직 없어요. 잠시 후 새로고침을 누르거나 직접입력으로 먼저 기록해둘 수 있어요.
          </p>
        )}

        {/* ── 교통 ── */}
        <Section title="🚇 교통">
          <div className="grid grid-cols-2 gap-3">
            <InfoItem
              label="가장 가까운 역"
              value={val('nearStation')}
              loading={refreshing}
              fallbackText="자동 조회 역 정보 없음"
              editing={editing}
              editValue={form.nearStation ?? ''}
              onEdit={v => setForm(prev => ({ ...prev, nearStation: v }))}
            />
            <InfoItem
              label="역까지 도보"
              value={detailInfo.stationDist ? `${detailInfo.stationDist}m` : '-'}
              loading={refreshing}
              fallbackText="자동 조회 도보거리 없음"
              editing={editing}
              editValue={form.stationDist ?? ''}
              editSuffix="m"
              onEdit={v => setForm(prev => ({ ...prev, stationDist: v.replace(/[^0-9]/g, '') }))}
            />
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
                  {editing ? (
                    <div className="max-w-[120px] mx-auto">
                      <input
                        className="form-input text-center"
                        value={(form as any)[key] ?? ''}
                        placeholder="분"
                        onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value.replace(/[^0-9]/g, '') }))}
                      />
                    </div>
                  ) : refreshing && !raw ? (
                    <div className="h-8 bg-slate-100 rounded animate-pulse mx-auto w-12" />
                  ) : raw ? (
                    <>
                      <p className={`text-2xl ${COMMUTE_SPEED(raw)}`}>{isNaN(mins) ? raw : mins}</p>
                      {!isNaN(mins) && <p className="text-xs text-text-muted">분</p>}
                    </>
                  ) : (
                    <p className="text-xs text-text-muted">자동 조회 없음</p>
                  )}
                </div>
              )
            })}
          </div>
        </Section>

        {/* ── 교육 ── */}
        <Section title="🏫 교육">
          <InfoItem
            label="인근 초등학교"
            value={val('schoolName')}
            loading={refreshing}
            fallbackText="자동 조회 학교 정보 없음"
            editing={editing}
            editValue={form.schoolName ?? ''}
            onEdit={v => setForm(prev => ({ ...prev, schoolName: v }))}
          />
        </Section>

        {/* ── 건축 ── */}
        <Section title="🏗️ 건축">
          <div className="grid grid-cols-2 gap-3">
            <InfoItem
              label="용적률"
              value={detailInfo.floorAreaRatio ? `${detailInfo.floorAreaRatio}%` : '-'}
              loading={refreshing}
              fallbackText="자동 조회 용적률 없음"
              editing={editing}
              editValue={form.floorAreaRatio ?? ''}
              editSuffix="%"
              onEdit={v => setForm(prev => ({ ...prev, floorAreaRatio: v.replace(/[^0-9.]/g, '') }))}
            />
            <InfoItem
              label="건폐율"
              value={detailInfo.buildingCoverage ? `${detailInfo.buildingCoverage}%` : '-'}
              loading={refreshing}
              fallbackText="자동 조회 건폐율 없음"
              editing={editing}
              editValue={form.buildingCoverage ?? ''}
              editSuffix="%"
              onEdit={v => setForm(prev => ({ ...prev, buildingCoverage: v.replace(/[^0-9.]/g, '') }))}
            />
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

function InfoItem({
  label,
  value,
  loading,
  fallbackText,
  editing,
  editValue,
  editSuffix,
  onEdit,
}: {
  label: string
  value: string
  loading?: boolean
  fallbackText?: string
  editing?: boolean
  editValue?: string
  editSuffix?: string
  onEdit?: (next: string) => void
}) {
  return (
    <div className="bg-bg rounded-lg px-3 py-2">
      <p className="text-xs text-text-muted mb-0.5">{label}</p>
      {editing && onEdit ? (
        <div className="flex items-center gap-2">
          <input className="form-input py-2" value={editValue ?? ''} onChange={e => onEdit(e.target.value)} />
          {editSuffix && <span className="text-xs text-text-muted">{editSuffix}</span>}
        </div>
      ) : loading && value === '-' ? (
        <div className="h-4 bg-slate-100 rounded animate-pulse w-3/4 mt-1" />
      ) : value === '-' && fallbackText ? (
        <p className="text-xs text-text-muted">{fallbackText}</p>
      ) : (
        <p className="text-sm font-semibold text-text">{value}</p>
      )}
    </div>
  )
}
