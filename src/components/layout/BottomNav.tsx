import { NavLink } from 'react-router-dom'
import Icon, { type IconName } from '@/components/Icon'

const ITEMS: { to: string; icon: IconName; label: string }[] = [
  { to: '/dashboard', icon: 'dashboard', label: '대시보드' },
  { to: '/compare',   icon: 'compare',   label: '비교' },
  { to: '/register',  icon: 'register',  label: '등록' },
  { to: '/profile',   icon: 'profile',   label: '프로필' },
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
              <Icon name={icon} className="w-6 h-6" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
