import { useState } from 'react'
import { useScenarioStore } from '@/store/scenarioStore'

export default function ScenarioSwitcher() {
  const { scenarios, activeId, loaded, setActive } = useScenarioStore()
  const [manageOpen, setManageOpen] = useState(false)

  if (!loaded) return null

  return (
    <div className="bg-white border-b border-border">
      <div className="flex items-center gap-2 px-4 py-2">
        <span className="text-[11px] font-semibold text-text-muted shrink-0">시나리오</span>
        <div className="flex items-center gap-1.5 flex-1 overflow-x-auto no-scrollbar">
          {scenarios.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              className={[
                'shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors',
                s.id === activeId
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 text-text-secondary hover:bg-blue-50 hover:text-primary',
              ].join(' ')}
            >
              {s.name}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setManageOpen(true)}
          className="shrink-0 text-xs text-text-muted hover:text-primary px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
        >
          관리
        </button>
      </div>
      {manageOpen && <ManageModal onClose={() => setManageOpen(false)} />}
    </div>
  )
}

function ManageModal({ onClose }: { onClose: () => void }) {
  const { scenarios, add, rename, remove } = useScenarioStore()
  const [newName, setNewName] = useState('')

  return (
    <div className="fixed inset-0 bg-black/40 z-[300] flex items-center justify-center p-4" onClick={onClose}>
      <div className="card w-full max-w-md p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-text">시나리오 관리</h3>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text text-lg leading-none">✕</button>
        </div>

        <div className="space-y-2">
          {scenarios.map(s => (
            <div key={s.id} className="flex items-center gap-2">
              <input
                className="form-input text-sm flex-1"
                defaultValue={s.name}
                onBlur={e => { if (e.target.value.trim() && e.target.value.trim() !== s.name) rename(s.id, e.target.value) }}
              />
              <button
                type="button"
                disabled={scenarios.length <= 1}
                onClick={() => { if (confirm(`'${s.name}' 시나리오를 삭제할까요? 소속 단지는 미배정 상태가 됩니다.`)) remove(s.id) }}
                className="shrink-0 text-xs text-danger px-2 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                삭제
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <input
            className="form-input text-sm flex-1"
            placeholder="새 시나리오 이름 (예: 갈아타기)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) { add(newName); setNewName('') } }}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm shrink-0"
            disabled={!newName.trim()}
            onClick={() => { add(newName); setNewName('') }}
          >
            추가
          </button>
        </div>

        <p className="text-[11px] text-text-muted">시나리오를 전환하면 대시보드·비교·등록이 해당 후보 세트로 필터링됩니다. 시나리오가 지정되지 않은 기존 단지는 모든 시나리오에 표시됩니다.</p>
      </div>
    </div>
  )
}
