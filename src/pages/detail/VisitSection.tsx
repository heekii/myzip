import { useEffect, useState } from 'react'
import type { ApartmentVisit, DecisionStatus, VisitStatus } from '@/types'

interface Props {
  visit: Partial<ApartmentVisit>
  saving?: boolean
  onSave: (updates: Partial<ApartmentVisit>) => Promise<void>
}

const STATUS_LABEL: Record<VisitStatus, string> = {
  'not-planned': '미정',
  scheduled: '방문 예정',
  visited: '방문 완료',
  'on-hold': '보류',
}

const DECISION_STATUS_LABEL: Record<DecisionStatus, string> = {
  active: '검토중',
  eliminated: '탈락',
  finalist: '최종 후보',
}

export default function VisitSection({ visit, saving, onSave }: Props) {
  const [form, setForm] = useState<Partial<ApartmentVisit>>(visit)
  const [localSaving, setLocalSaving] = useState(false)

  useEffect(() => {
    setForm(visit)
  }, [visit])

  async function handleSave() {
    setLocalSaving(true)
    try {
      await onSave(form)
    } finally {
      setLocalSaving(false)
    }
  }

  const isSaving = saving || localSaving

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">현장 방문 관리</h3>
        <button type="button" className="btn btn-primary btn-sm" disabled={isSaving} onClick={handleSave}>
          {isSaving ? '저장 중...' : '저장'}
        </button>
      </div>

      <div className="card-body space-y-5 sm:space-y-6">
        <div className="rounded-xl border border-border/70 bg-slate-50/60 p-3 sm:p-4 space-y-3">
          <p className="text-[11px] font-semibold tracking-wide text-text-muted uppercase">일정</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="방문 상태">
              <select
                className="form-input"
                value={form.status ?? 'not-planned'}
                onChange={e => setForm(prev => ({ ...prev, status: e.target.value as VisitStatus }))}
              >
                {Object.entries(STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
            <Field label="방문 예정일">
              <input
                type="date"
                className="form-input"
                value={form.scheduledAt ?? ''}
                onChange={e => setForm(prev => ({ ...prev, scheduledAt: e.target.value || undefined }))}
              />
            </Field>
            <Field label="실방문일">
              <input
                type="date"
                className="form-input"
                value={form.visitedAt ?? ''}
                onChange={e => setForm(prev => ({ ...prev, visitedAt: e.target.value || undefined }))}
              />
            </Field>
          </div>
        </div>

        <div className="space-y-3 sm:space-y-4">
          <p className="text-[11px] font-semibold tracking-wide text-text-muted uppercase">현장 상태</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="동/외관 상태">
              <input
                className="form-input"
                placeholder="예: 동 간격 양호, 외벽 보통"
                value={form.buildingCondition ?? ''}
                onChange={e => setForm(prev => ({ ...prev, buildingCondition: e.target.value || undefined }))}
              />
            </Field>
            <Field label="호실 상태">
              <input
                className="form-input"
                placeholder="예: 84A, 채광 양호"
                value={form.unitCondition ?? ''}
                onChange={e => setForm(prev => ({ ...prev, unitCondition: e.target.value || undefined }))}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="인테리어/수리 상태">
              <textarea
                className="form-input min-h-20 resize-y"
                placeholder="예: 욕실 수리 필요, 샷시 양호"
                value={form.interiorCondition ?? ''}
                onChange={e => setForm(prev => ({ ...prev, interiorCondition: e.target.value || undefined }))}
              />
            </Field>
            <Field label="하자/이슈 메모">
              <textarea
                className="form-input min-h-20 resize-y"
                placeholder="예: 결로 흔적, 소음 체크 필요"
                value={form.defectNotes ?? ''}
                onChange={e => setForm(prev => ({ ...prev, defectNotes: e.target.value || undefined }))}
              />
            </Field>
          </div>
        </div>

        <div className="space-y-3 sm:space-y-4">
          <p className="text-[11px] font-semibold tracking-wide text-text-muted uppercase">가격/협의</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="세입자/공실 상태">
              <input
                className="form-input"
                placeholder="예: 전세 거주 중, 만기 2027-02"
                value={form.tenantStatus ?? ''}
                onChange={e => setForm(prev => ({ ...prev, tenantStatus: e.target.value || undefined }))}
              />
            </Field>
            <Field label="중개사 메모">
              <input
                className="form-input"
                placeholder="예: 매도자 협의 가능"
                value={form.brokerNotes ?? ''}
                onChange={e => setForm(prev => ({ ...prev, brokerNotes: e.target.value || undefined }))}
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="호가 메모">
              <input
                className="form-input"
                placeholder="예: 10.8억"
                value={form.askingPriceNote ?? ''}
                onChange={e => setForm(prev => ({ ...prev, askingPriceNote: e.target.value || undefined }))}
              />
            </Field>
            <Field label="희망가 메모">
              <input
                className="form-input"
                placeholder="예: 10.3억 이하"
                value={form.expectedPriceNote ?? ''}
                onChange={e => setForm(prev => ({ ...prev, expectedPriceNote: e.target.value || undefined }))}
              />
            </Field>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-[11px] font-semibold tracking-wide text-text-muted uppercase">의사결정</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="의사결정 상태">
              <select
                className="form-input"
                value={form.decisionStatus ?? 'active'}
                onChange={e => setForm(prev => ({
                  ...prev,
                  decisionStatus: e.target.value as DecisionStatus,
                  eliminationReason: e.target.value === 'eliminated' ? prev.eliminationReason : undefined,
                }))}
              >
                {Object.entries(DECISION_STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </Field>
            <Field label="탈락 사유">
              <input
                className="form-input"
                placeholder="예: 역과 거리 멀고 수리비 과다"
                value={form.eliminationReason ?? ''}
                disabled={(form.decisionStatus ?? 'active') !== 'eliminated'}
                onChange={e => setForm(prev => ({ ...prev, eliminationReason: e.target.value || undefined }))}
              />
            </Field>
          </div>
          <Field label="다음 액션">
            <textarea
              className="form-input min-h-20 resize-y"
              placeholder="예: 일요일 재방문 후 최종 결정"
              value={form.nextAction ?? ''}
              onChange={e => setForm(prev => ({ ...prev, nextAction: e.target.value || undefined }))}
            />
          </Field>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <p className="text-xs font-medium text-text-muted">{label}</p>
      {children}
    </label>
  )
}
