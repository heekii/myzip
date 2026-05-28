import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  updateProfile, updatePassword, deleteUser,
  reauthenticateWithCredential, EmailAuthProvider, signOut,
  GoogleAuthProvider, reauthenticateWithPopup,
} from 'firebase/auth'
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
import { useEffect } from 'react'

export default function ProfilePage() {
  const { user, isGuest } = useAuthStore()
  const { setPageTitle, setHeaderRight } = useUIStore()
  const navigate = useNavigate()

  const [nameEdit, setNameEdit] = useState(false)
  const [nameValue, setNameValue] = useState(user?.displayName ?? '')
  const [nameSaving, setNameSaving] = useState(false)

  const [pwEdit, setPwEdit] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwError, setPwError] = useState('')

  const [deletePw, setDeletePw] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setPageTitle('프로필/설정')
    setHeaderRight(null)
    return () => { setPageTitle('내집마련 트래커'); setHeaderRight(null) }
  }, [])

  const isGoogle = user?.providerData?.[0]?.providerId === 'google.com'
  const initial = (user?.displayName || user?.email || '?')[0].toUpperCase()

  async function handleNameSave() {
    if (!user || !nameValue.trim()) return
    setNameSaving(true)
    try {
      await updateProfile(user, { displayName: nameValue.trim() })
      setNameEdit(false)
    } catch {
      alert('이름 변경에 실패했습니다.')
    } finally {
      setNameSaving(false)
    }
  }

  async function handlePwSave() {
    if (!user) return
    setPwError('')
    if (newPw.length < 6) { setPwError('새 비밀번호는 6자 이상이어야 합니다.'); return }
    if (newPw !== confirmPw) { setPwError('새 비밀번호가 일치하지 않습니다.'); return }
    setPwSaving(true)
    try {
      const cred = EmailAuthProvider.credential(user.email!, currentPw)
      await reauthenticateWithCredential(user, cred)
      await updatePassword(user, newPw)
      setPwEdit(false)
      setCurrentPw(''); setNewPw(''); setConfirmPw('')
      alert('비밀번호가 변경되었습니다.')
    } catch (e: any) {
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        setPwError('현재 비밀번호가 올바르지 않습니다.')
      } else {
        setPwError('비밀번호 변경에 실패했습니다.')
      }
    } finally {
      setPwSaving(false)
    }
  }

  async function handleLogout() {
    if (!confirm('로그아웃 하시겠습니까?')) return
    await signOut(auth)
    navigate('/login')
  }

  async function handleDelete() {
    if (!user) return
    if (!confirm('정말로 탈퇴하시겠습니까?\n모든 아파트, 시세, 메모 데이터가 영구 삭제됩니다.')) return
    setDeleting(true)
    try {
      // re-auth first
      if (isGoogle) {
        await reauthenticateWithPopup(user, new GoogleAuthProvider())
      } else {
        if (!deletePw) { alert('비밀번호를 입력해주세요.'); setDeleting(false); return }
        const cred = EmailAuthProvider.credential(user.email!, deletePw)
        await reauthenticateWithCredential(user, cred)
      }

      // delete all apartments + subcollections
      const apts = await getDocs(collection(db, 'apartments'))
      const mine = apts.docs.filter(d => d.data().userId === user.uid)
      const batch = writeBatch(db)
      for (const apt of mine) {
        for (const col of ['prices', 'memos', 'info'] as const) {
          const sub = await getDocs(collection(db, 'apartments', apt.id, col))
          sub.docs.forEach(d => batch.delete(d.ref))
        }
        batch.delete(doc(db, 'apartments', apt.id))
      }
      await batch.commit()

      await deleteUser(user)
      navigate('/login')
    } catch (e: any) {
      if (e.code === 'auth/wrong-password' || e.code === 'auth/invalid-credential') {
        alert('비밀번호가 올바르지 않습니다.')
      } else {
        alert('탈퇴 처리 중 오류가 발생했습니다.')
      }
    } finally {
      setDeleting(false)
    }
  }

  // ── Guest view ────────────────────────────────────────────────────────────

  if (isGuest) {
    return (
      <div className="space-y-4 max-w-md mx-auto">
        <div className="card p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-2xl mx-auto">
            👤
          </div>
          <div>
            <p className="font-bold text-text">게스트로 이용 중</p>
            <p className="text-sm text-text-muted mt-1">로그인하면 데이터가 영구 저장됩니다.</p>
          </div>
          <button className="btn btn-primary w-full" onClick={() => navigate('/login')}>
            로그인 / 회원가입
          </button>
        </div>
      </div>
    )
  }

  // ── Logged-in view ────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 max-w-md mx-auto">

      {/* 프로필 카드 */}
      <div className="card p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="font-bold text-text truncate">{user?.displayName || '(이름 없음)'}</p>
            <p className="text-sm text-text-muted truncate">{user?.email}</p>
            <span className="inline-block mt-1 text-[11px] bg-blue-50 text-primary px-2 py-0.5 rounded-full">
              {isGoogle ? 'Google 계정' : '이메일 계정'}
            </span>
          </div>
        </div>
      </div>

      {/* 이름 변경 */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">이름 변경</h3>
          {nameEdit && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setNameEdit(false); setNameValue(user?.displayName ?? '') }}>
              취소
            </button>
          )}
        </div>
        <div className="card-body">
          {nameEdit ? (
            <div className="flex gap-2">
              <input
                className="form-input flex-1"
                value={nameValue}
                onChange={e => setNameValue(e.target.value)}
                placeholder="이름을 입력하세요"
                maxLength={20}
                onKeyDown={e => e.key === 'Enter' && handleNameSave()}
              />
              <button className="btn btn-primary btn-sm" onClick={handleNameSave} disabled={nameSaving || !nameValue.trim()}>
                {nameSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-text">{user?.displayName || '(미설정)'}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setNameEdit(true)}>수정</button>
            </div>
          )}
        </div>
      </div>

      {/* 비밀번호 변경 (이메일 계정만) */}
      {!isGoogle && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">비밀번호 변경</h3>
            {pwEdit && (
              <button className="btn btn-secondary btn-sm" onClick={() => { setPwEdit(false); setCurrentPw(''); setNewPw(''); setConfirmPw(''); setPwError('') }}>
                취소
              </button>
            )}
          </div>
          <div className="card-body">
            {pwEdit ? (
              <div className="space-y-3">
                <div>
                  <label className="form-label">현재 비밀번호</label>
                  <input type="password" className="form-input" value={currentPw} onChange={e => setCurrentPw(e.target.value)} placeholder="현재 비밀번호" />
                </div>
                <div>
                  <label className="form-label">새 비밀번호</label>
                  <input type="password" className="form-input" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="6자 이상" />
                </div>
                <div>
                  <label className="form-label">새 비밀번호 확인</label>
                  <input type="password" className="form-input" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="비밀번호 재입력" />
                </div>
                {pwError && <p className="text-xs text-danger">{pwError}</p>}
                <button className="btn btn-primary w-full" onClick={handlePwSave} disabled={pwSaving}>
                  {pwSaving ? '변경 중...' : '비밀번호 변경'}
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm text-text-muted">••••••••</span>
                <button className="btn btn-secondary btn-sm" onClick={() => setPwEdit(true)}>변경</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 로그아웃 */}
      <div className="card p-4">
        <button className="btn btn-secondary w-full" onClick={handleLogout}>
          로그아웃
        </button>
      </div>

      {/* 회원 탈퇴 */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title text-danger">회원 탈퇴</h3>
        </div>
        <div className="card-body space-y-3">
          <p className="text-xs text-text-muted">탈퇴 시 모든 아파트 데이터, 시세 기록, 메모가 영구 삭제됩니다.</p>
          {!isGoogle && (
            <div>
              <label className="form-label">비밀번호 확인</label>
              <input type="password" className="form-input" value={deletePw} onChange={e => setDeletePw(e.target.value)} placeholder="비밀번호를 입력하세요" />
            </div>
          )}
          <button
            className="btn btn-danger w-full"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? '탈퇴 처리 중...' : '회원 탈퇴'}
          </button>
        </div>
      </div>

    </div>
  )
}
