import { useState } from 'react'
import {
  collection, addDoc, doc, updateDoc, deleteDoc,
  serverTimestamp, query, getDocs, orderBy
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { guestDB } from '@/lib/guestDB'
import { tsToDate } from '@/lib/utils'
import type { Apartment, Memo } from '@/types'

interface Props {
  apt: Apartment
  isGuest: boolean
  memos: Memo[]
  onMemosChange: (memos: Memo[]) => void
}

export default function MemoSection({ apt, isGuest, memos, onMemosChange }: Props) {
  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [sortDesc, setSortDesc] = useState(true)

  async function handleSave() {
    const text = content.trim()
    if (!text) { alert('메모 내용을 입력해주세요.'); return }
    if (text.length > 5000) { alert('5000자를 초과할 수 없습니다.'); return }
    setSaving(true)
    try {
      if (isGuest) {
        guestDB.addMemo(apt.id, text)
      } else {
        await addDoc(collection(db, 'apartments', apt.id, 'memos'), {
          content: text,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      }
      setContent('')
      await reloadMemos()
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdate(id: string) {
    const text = editContent.trim()
    if (!text) { alert('내용을 입력해주세요.'); return }
    if (isGuest) {
      guestDB.updateMemo(apt.id, id, text)
    } else {
      await updateDoc(doc(db, 'apartments', apt.id, 'memos', id), {
        content: text,
        updatedAt: serverTimestamp(),
      })
    }
    setEditId(null)
    await reloadMemos()
  }

  async function handleDelete(id: string) {
    if (!confirm('이 메모를 삭제하시겠습니까?')) return
    if (isGuest) {
      guestDB.deleteMemo(apt.id, id)
    } else {
      await deleteDoc(doc(db, 'apartments', apt.id, 'memos', id))
    }
    await reloadMemos()
  }

  async function reloadMemos() {
    if (isGuest) {
      onMemosChange(guestDB.getMemos(apt.id))
    } else {
      const snap = await getDocs(
        query(collection(db, 'apartments', apt.id, 'memos'), orderBy('createdAt', 'desc'))
      )
      onMemosChange(snap.docs.map(d => ({ id: d.id, ...d.data() } as Memo)))
    }
  }

  const sorted = sortDesc ? memos : [...memos].reverse()

  return (
    <>
      {/* 메모 작성 */}
      <div className="card">
        <div className="card-header"><h3 className="card-title">메모 작성</h3></div>
        <div className="card-body">
          <textarea
            className="form-input mb-2"
            rows={4}
            maxLength={5000}
            placeholder={"이 아파트에 대한 개인 메모를 자유롭게 작성하세요.\n예: 커뮤니티 시설 우수, 주차 공간 협소, 인근 재개발 예정 등"}
            value={content}
            onChange={e => setContent(e.target.value)}
          />
          <div className="flex items-center justify-between">
            <span className="form-hint">{content.length}/5000자</span>
            <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSave}>
              {saving ? '저장 중...' : '메모 저장'}
            </button>
          </div>
        </div>
      </div>

      {/* 메모 목록 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-text">메모 목록</h3>
          <div className="flex gap-2">
            <button type="button" className={`btn btn-sm ${sortDesc ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSortDesc(true)}>최신순</button>
            <button type="button" className={`btn btn-sm ${!sortDesc ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setSortDesc(false)}>오래된순</button>
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-3xl mb-2">📝</p>
            <p className="text-sm text-text-muted">작성된 메모가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map(m => (
              <div key={m.id} className="card p-4">
                {editId === m.id ? (
                  <>
                    <textarea
                      className="form-input mb-2"
                      rows={4}
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                    />
                    <div className="flex gap-2 justify-end">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditId(null)}>취소</button>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => handleUpdate(m.id)}>저장</button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-text whitespace-pre-wrap mb-3">{m.content}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-muted">
                        {tsToDate(m.createdAt)}
                        {m.updatedAt && (m.updatedAt as any) !== (m.createdAt as any) && ' (수정됨)'}
                      </span>
                      <div className="flex gap-2">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setEditId(m.id); setEditContent(m.content) }}>수정</button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(m.id)}>삭제</button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
