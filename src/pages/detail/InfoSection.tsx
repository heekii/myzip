import { useState } from 'react'
import type { ApartmentDetail } from '@/types'

const FACING_MAP: Record<string, string> = {
  south: '남향', 'south-east': '남동향', 'south-west': '남서향',
  east: '동향', west: '서향', north: '북향',
}

const COMMUTE_SPEED = (mins: string) => {
  const n = parseInt(mins)
  if (isNaN(n)) return ''
  return n <= 25 ? 'text-success font-bold' : n <= 40 ? 'text-warning font-bold' : 'text-danger font-bold'
}

interface Props {
  detailInfo: Partial<ApartmentDetail>
  onInfoChange: (updates: Partial<ApartmentDetail>) => Promise<void>
  onAutoStation: () => Promise<void>
  onAutoCommute: () => Promise<void>
  onAutoSchool: () => Promise<void>
}

const INFO_FIELDS = [
  'nearStation', 'stationDist', 'isStationZone', 'southFacing',
  'commuteGangnam', 'commuteYeouido', 'commuteJongno',
  'schoolName', 'floorAreaRatio', 'buildingCoverage',
  'targetSize', 'preferredFloor',
] as const

export default function InfoSection({ detailInfo, onInfoChange, onAutoStation, onAutoCommute, onAutoSchool }: Props) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [autoLoading, setAutoLoading] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  function startEdit() {
    const filled: Record<string, string> = {}
    INFO_FIELDS.forEach(k => { filled[k] = String((detailInfo as any)[k] ?? '') })
    setForm(filled)
    setEditing(true)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const updates: Partial<ApartmentDetail> = {}
      INFO_FIELDS.forEach(k => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (updates as any)[k] = form[k]?.trim() || null
      })
      await onInfoChange(updates)
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  async function runAuto(key: string, fn: () => Promise<void>) {
    setAutoLoading(prev => ({ ...prev, [key]: true }))
    try { await fn() } finally {
      setAutoLoading(prev => ({ ...prev, [key]: false }))
      // refresh form values from updated detailInfo
      if (editing) {
        const filled: Record<string, string> = {}
        INFO_FIELDS.forEach(k => { filled[k] = String((detailInfo as any)[k] ?? '') })
        setForm(filled)
      }
    }
  }

  const val = (key: keyof ApartmentDetail) => String((detailInfo as any)[key] ?? '').trim() || '-'

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">단지 상세 정보</h3>
        <div className="flex gap-2">
          {editing && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>취소</button>
          )}
          <button type="button" className="btn btn-primary btn-sm" onClick={editing ? handleSave : startEdit} disabled={saving}>
            {editing ? (saving ? '저장 중...' : '저장') : '수정'}
          </button>
        </div>
      </div>

      <div className="card-body space-y-6">
        {/* ── 교통 ── */}
        <Section title="🚇 교통">
          {editing && (
            <div className="flex justify-end mb-2">
              <button type="button" className="btn btn-secondary btn-sm" disabled={autoLoading.station}
                onClick={() => runAuto('station', onAutoStation)}>
                {autoLoading.station ? '검색 중...' : '역 자동 검색'}
              </button>
            </div>
          )}
          {editing ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="가장 가까운 역">
                <input className="form-input" placeholder="예: 신반포역 3호선" value={form.nearStation ?? ''} onChange={e => setForm(f => ({ ...f, nearStation: e.target.value }))} />
              </Field>
              <Field label="역까지 도보(m)">
                <input className="form-input" type="number" placeholder="예: 350" value={form.stationDist ?? ''} onChange={e => setForm(f => ({ ...f, stationDist: e.target.value }))} />
              </Field>
              <Field label="역세권 여부">
                <select className="form-input" value={form.isStationZone ?? ''} onChange={e => setForm(f => ({ ...f, isStationZone: e.target.value }))}>
                  <option value="">선택</option><option value="yes">역세권</option><option value="no">비역세권</option>
                </select>
              </Field>
              <Field label="향/조망">
                <select className="form-input" value={form.southFacing ?? ''} onChange={e => setForm(f => ({ ...f, southFacing: e.target.value }))}>
                  <option value="">선택</option>
                  {Object.entries(FACING_MAP).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <InfoItem label="가장 가까운 역" value={val('nearStation')} />
              <InfoItem label="역까지 도보" value={detailInfo.stationDist ? `${detailInfo.stationDist}m` : '-'} />
              <InfoItem label="역세권 여부" value={detailInfo.isStationZone === 'yes' ? '역세권' : detailInfo.isStationZone === 'no' ? '비역세권' : '-'} />
              <InfoItem label="향/조망" value={FACING_MAP[detailInfo.southFacing ?? ''] ?? '-'} />
            </div>
          )}
        </Section>

        {/* ── 업무지구 접근성 ── */}
        <Section title="🗺️ 업무지구 접근성">
          {editing && (
            <div className="flex justify-end mb-2">
              <button type="button" className="btn btn-secondary btn-sm" disabled={autoLoading.commute}
                onClick={() => runAuto('commute', onAutoCommute)}>
                {autoLoading.commute ? '계산 중...' : '자동 계산'}
              </button>
            </div>
          )}
          {editing ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="강남역까지">
                <input className="form-input" placeholder="예: 25분" value={form.commuteGangnam ?? ''} onChange={e => setForm(f => ({ ...f, commuteGangnam: e.target.value }))} />
              </Field>
              <Field label="여의도역까지">
                <input className="form-input" placeholder="예: 15분" value={form.commuteYeouido ?? ''} onChange={e => setForm(f => ({ ...f, commuteYeouido: e.target.value }))} />
              </Field>
              <Field label="종로3가역까지">
                <input className="form-input" placeholder="예: 30분" value={form.commuteJongno ?? ''} onChange={e => setForm(f => ({ ...f, commuteJongno: e.target.value }))} />
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '강남역', key: 'commuteGangnam' },
                { label: '여의도역', key: 'commuteYeouido' },
                { label: '종로3가역', key: 'commuteJongno' },
              ].map(({ label, key }) => {
                const raw = (detailInfo as any)[key]
                const mins = parseInt(raw)
                return (
                  <div key={key} className="card p-3 text-center">
                    <p className="text-xs text-text-muted mb-1">{label}</p>
                    {raw ? (
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
          )}
        </Section>

        {/* ── 교육 ── */}
        <Section title="🏫 교육">
          {editing && (
            <div className="flex justify-end mb-2">
              <button type="button" className="btn btn-secondary btn-sm" disabled={autoLoading.school}
                onClick={() => runAuto('school', onAutoSchool)}>
                {autoLoading.school ? '검색 중...' : '인근 검색'}
              </button>
            </div>
          )}
          {editing ? (
            <Field label="초등학교 배정">
              <input className="form-input" placeholder="예: 반포초등학교" value={form.schoolName ?? ''} onChange={e => setForm(f => ({ ...f, schoolName: e.target.value }))} />
            </Field>
          ) : (
            <InfoItem label="초등학교 배정" value={val('schoolName')} />
          )}
        </Section>

        {/* ── 건축 ── */}
        <Section title="🏗️ 건축">
          {!editing && <p className="form-hint mb-2">용적률·건폐율은 <a href="https://www.k-apt.go.kr/" target="_blank" rel="noopener" className="text-primary">K-Apt</a>에서 확인 후 수정 버튼으로 입력하세요.</p>}
          {editing ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="용적률(%)">
                <input className="form-input" type="number" placeholder="예: 269" value={form.floorAreaRatio ?? ''} onChange={e => setForm(f => ({ ...f, floorAreaRatio: e.target.value }))} />
              </Field>
              <Field label="건폐율(%)">
                <input className="form-input" type="number" placeholder="예: 19" value={form.buildingCoverage ?? ''} onChange={e => setForm(f => ({ ...f, buildingCoverage: e.target.value }))} />
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <InfoItem label="용적률" value={detailInfo.floorAreaRatio ? `${detailInfo.floorAreaRatio}%` : '-'} />
              <InfoItem label="건폐율" value={detailInfo.buildingCoverage ? `${detailInfo.buildingCoverage}%` : '-'} />
            </div>
          )}
        </Section>

        {/* ── 관심 타입 ── */}
        <Section title="⭐ 관심 타입">
          {editing ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="관심 면적(㎡)">
                <input className="form-input" placeholder="예: 59, 84" value={form.targetSize ?? ''} onChange={e => setForm(f => ({ ...f, targetSize: e.target.value }))} />
              </Field>
              <Field label="관심 동/층">
                <input className="form-input" placeholder="예: 20층 이상" value={form.preferredFloor ?? ''} onChange={e => setForm(f => ({ ...f, preferredFloor: e.target.value }))} />
              </Field>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <InfoItem label="관심 면적" value={val('targetSize')} />
              <InfoItem label="관심 동/층" value={val('preferredFloor')} />
            </div>
          )}
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

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bg rounded-lg px-3 py-2">
      <p className="text-xs text-text-muted mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-text">{value}</p>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      {children}
    </div>
  )
}
