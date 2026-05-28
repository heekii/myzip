import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

type Mode = 'login' | 'signup'

export default function LoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [agreed, setAgreed] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (mode === 'signup' && !agreed) {
      setError('개인정보 수집 및 이용에 동의해주세요.')
      return
    }
    setLoading(true)
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password)
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password)
        await updateProfile(cred.user, { displayName: name })
        await setDoc(doc(db, 'users', cred.user.uid), {
          name, email, createdAt: serverTimestamp(),
        })
      }
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '오류가 발생했습니다.'
      setError(
        msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential')
          ? '이메일 또는 비밀번호가 올바르지 않습니다.'
          : msg.includes('email-already-in-use')
          ? '이미 사용 중인 이메일입니다.'
          : '오류가 발생했습니다. 다시 시도해주세요.'
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setLoading(true)
    try {
      const provider = new GoogleAuthProvider()
      const cred = await signInWithPopup(auth, provider)
      await setDoc(doc(db, 'users', cred.user.uid), {
        name: cred.user.displayName ?? '',
        email: cred.user.email ?? '',
        createdAt: serverTimestamp(),
      }, { merge: true })
      navigate('/dashboard')
    } catch {
      setError('Google 로그인에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🏠</div>
          <h1 className="text-2xl font-bold text-text">내집마련 트래커</h1>
          <p className="text-text-muted text-sm mt-1">부동산 시세 추적 서비스</p>
        </div>

        <div className="card">
          <div className="card-body">
            <div className="flex mb-6 bg-slate-100 rounded-lg p-1">
              {(['login', 'signup'] as Mode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => { setMode(m); setError('') }}
                  className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${
                    mode === m ? 'bg-white text-primary shadow-sm' : 'text-text-secondary'
                  }`}
                >
                  {m === 'login' ? '로그인' : '회원가입'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="form-label">이름</label>
                  <input className="form-input" type="text" value={name}
                    onChange={e => setName(e.target.value)} placeholder="홍길동" required />
                </div>
              )}
              <div>
                <label className="form-label">이메일</label>
                <input className="form-input" type="email" value={email}
                  onChange={e => setEmail(e.target.value)} placeholder="example@email.com" required />
              </div>
              <div>
                <label className="form-label">비밀번호</label>
                <input className="form-input" type="password" value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="6자 이상" required minLength={6} />
              </div>

              {mode === 'signup' && (
                <label className="flex items-start gap-2 text-xs text-text-muted cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 shrink-0"
                    checked={agreed}
                    onChange={e => setAgreed(e.target.checked)}
                  />
                  <span>
                    <Link to="/privacy" target="_blank" className="text-primary underline">개인정보처리방침</Link>에 동의합니다. (필수)
                  </span>
                </label>
              )}

              {error && <p className="text-danger text-sm">{error}</p>}

              <button type="submit" disabled={loading} className="btn btn-primary btn-full py-3">
                {loading ? '처리 중...' : mode === 'login' ? '로그인' : '회원가입'}
              </button>
            </form>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-2 text-xs text-text-muted">또는</span>
              </div>
            </div>

            <button onClick={handleGoogle} disabled={loading}
              className="btn btn-secondary btn-full py-3">
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                alt="" className="w-4 h-4" />
              Google로 계속하기
            </button>

            <p className="text-center mt-4">
              <Link to="/dashboard" className="text-xs text-text-muted hover:text-primary underline">
                로그인 없이 둘러보기
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
