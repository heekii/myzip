import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import BottomNav from './BottomNav'
import { useAuthStore } from '@/store/authStore'
import { Link } from 'react-router-dom'

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { isGuest } = useAuthStore()

  return (
    <div className="flex min-h-screen max-w-[1000px] mx-auto shadow-[0_0_40px_rgba(0,0,0,0.08)] bg-bg">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[199] md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-col flex-1 min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {isGuest && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-700 text-center">
            게스트 모드입니다. 탭을 닫으면 데이터가 사라져요.{' '}
            <Link to="/login" className="font-semibold underline">로그인하기</Link>
          </div>
        )}

        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
          <Outlet />
        </main>

        <BottomNav />
      </div>
    </div>
  )
}
