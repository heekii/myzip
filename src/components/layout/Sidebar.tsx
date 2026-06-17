import { NavLink, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'

interface Props {
  open: boolean
  onClose: () => void
}

const NAV = [
  { to: '/dashboard', icon: '📊', label: '대시보드' },
  { to: '/compare', icon: '📋', label: '단지 비교' },
  { to: '/register', icon: '➕', label: '아파트 등록' },
]

export default function Sidebar({ open, onClose }: Props) {
  const navigate = useNavigate()
  const { user, isGuest } = useAuthStore()

  async function handleLogout() {
    if (!confirm('로그아웃 하시겠습니까?')) return
    await signOut(auth)
    navigate('/login')
  }

  return (
    <aside
      className={[
        'w-60 bg-white border-r border-border flex flex-col flex-shrink-0',
        'sticky top-0 h-screen self-start overflow-y-auto z-[200]',
        'transition-transform duration-200',
        // mobile: fixed, slides in
        'max-md:fixed max-md:left-0 max-md:top-0',
        open ? 'max-md:translate-x-0' : 'max-md:-translate-x-full',
      ].join(' ')}
    >
      {/* Logo */}
      <NavLink
        to="/dashboard"
        onClick={onClose}
        className="h-[60px] px-5 border-b border-border flex items-center flex-shrink-0 hover:opacity-80 transition-opacity"
      >
        <img src="/logo-hori.png" alt="myzip" className="h-8 w-auto" />
      </NavLink>

      {/* Nav */}
      <nav className="p-2.5 flex-1">
        <p className="text-[11px] font-semibold text-text-muted px-2.5 py-2 uppercase tracking-wider">메뉴</p>
        {NAV.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm mb-0.5 transition-all ${
                isActive
                  ? 'bg-blue-50 text-primary font-semibold'
                  : 'text-text hover:bg-blue-50 hover:text-primary'
              }`
            }
          >
            <span className="w-5 text-center">{icon}</span>
            {label}
          </NavLink>
        ))}

        <p className="text-[11px] font-semibold text-text-muted px-2.5 py-2 uppercase tracking-wider mt-3">계정</p>
        <NavLink
          to="/profile"
          onClick={onClose}
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm mb-0.5 transition-all ${
              isActive
                ? 'bg-blue-50 text-primary font-semibold'
                : 'text-text hover:bg-blue-50 hover:text-primary'
            }`
          }
        >
          <span className="w-5 text-center">👤</span>
          프로필/설정
        </NavLink>

        {!isGuest && user ? (
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-text hover:bg-blue-50 hover:text-primary transition-all"
          >
            <span className="w-5 text-center">🚪</span>
            로그아웃
          </button>
        ) : (
          <NavLink
            to="/login"
            onClick={onClose}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-text hover:bg-blue-50 hover:text-primary transition-all"
          >
            <span className="w-5 text-center">🔑</span>
            로그인
          </NavLink>
        )}
      </nav>
    </aside>
  )
}
