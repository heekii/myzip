import { useUIStore } from '@/store/uiStore'
import Icon from '@/components/Icon'

interface Props {
  onMenuClick: () => void
}

export default function Header({ onMenuClick }: Props) {
  const { pageTitle, headerRight } = useUIStore()

  return (
    <header className="h-[60px] bg-white border-b border-border flex items-center justify-between px-4 sticky top-0 z-10 shadow-sm flex-shrink-0">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="hidden max-md:flex items-center justify-center w-9 h-9 rounded-lg text-text-secondary hover:bg-slate-100 transition-colors"
          aria-label="메뉴 열기"
        >
          <Icon name="menu" className="w-5 h-5" />
        </button>
        <span className="text-base font-semibold">{pageTitle}</span>
      </div>
      {headerRight && <div className="flex items-center gap-2">{headerRight}</div>}
    </header>
  )
}
