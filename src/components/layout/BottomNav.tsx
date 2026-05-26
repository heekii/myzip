import { NavLink } from 'react-router-dom'

const ITEMS = [
  { to: '/dashboard', icon: '📊', label: '대시보드' },
  { to: '/compare',   icon: '📋', label: '비교' },
  { to: '/register',  icon: '➕', label: '등록' },
  { to: '/profile',   icon: '👤', label: '프로필' },
]

export default function BottomNav() {
  return (
    <nav className="hidden max-md:block fixed bottom-0 left-0 right-0 bg-white border-t border-border z-[100] pb-safe">
      <ul className="flex justify-around">
        {ITEMS.map(({ to, icon, label }) => (
          <li key={to}>
            <NavLink
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-4 py-2 text-[11px] font-medium transition-colors ${
                  isActive ? 'text-primary' : 'text-text-muted'
                }`
              }
            >
              <span className="text-xl">{icon}</span>
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
