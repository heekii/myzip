import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/authStore'
import { useScenarioStore } from '@/store/scenarioStore'
import { guestDB } from '@/lib/guestDB'
import { formatPrice } from '@/lib/utils'
import type { Apartment } from '@/types'

export default function DashboardPage() {
  const { user, isGuest } = useAuthStore()
  const activeId = useScenarioStore(s => s.activeId)
  const [allApartments, setAllApartments] = useState<Apartment[]>([])
  const [loading, setLoading] = useState(true)

  // 시나리오가 지정되지 않은 기존 단지는 모든 시나리오에 노출
  const apartments = allApartments.filter(a => !a.scenarioId || a.scenarioId === activeId)

  useEffect(() => {
    if (isGuest) {
      setAllApartments(guestDB.getApartments())
      setLoading(false)
      return
    }
    if (!user) return

    getDocs(query(collection(db, 'apartments'), where('userId', '==', user.uid)))
      .then(snap => {
        const apts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Apartment))
        apts.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
        setAllApartments(apts)
      })
      .finally(() => setLoading(false))
  }, [user, isGuest])

  const displayName = user?.displayName ?? user?.email?.split('@')[0] ?? '게스트'
  const upCount = apartments.filter(
    a => a.latestMaxPrice != null && a.prevMaxPrice != null && a.latestMaxPrice > a.prevMaxPrice
  ).length
  const downCount = apartments.filter(
    a => a.latestMaxPrice != null && a.prevMaxPrice != null && a.latestMaxPrice < a.prevMaxPrice
  ).length

  return (
    <>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold text-text">
            {isGuest ? '내집마련 트래커에 오신 걸 환영해요! 👋' : `${displayName}님, 안녕하세요! 👋`}
          </h1>
          <p className="text-sm text-text-muted mt-1">등록한 아파트의 시세와 정보를 한눈에 확인하세요.</p>
        </div>
        <Link to="/register" className="btn btn-primary shrink-0">
          <span>➕</span> 아파트 등록
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard icon="🏢" label="관심 단지" value={apartments.length} sub="개 등록됨" />
        <StatCard icon="📈" label="시세 상승" value={loading ? '-' : upCount} sub="개 단지" valueClass="text-danger" />
        <StatCard icon="📉" label="시세 하락" value={loading ? '-' : downCount} sub="개 단지" valueClass="text-primary" />
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-text">관심 아파트</h2>
        <Link to="/register" className="btn btn-secondary btn-sm">+ 추가</Link>
      </div>

      {loading ? (
        <SkeletonGrid />
      ) : apartments.length === 0 ? (
        <EmptyState filtered={allApartments.length > 0} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {apartments.map(apt => <AptCard key={apt.id} apt={apt} />)}
        </div>
      )}
    </>
  )
}

function StatCard({ icon, label, value, sub, valueClass = '' }: {
  icon: string; label: string; value: number | string; sub: string; valueClass?: string
}) {
  return (
    <div className="card p-4 flex flex-col gap-1 min-w-0">
      <span className="text-xl">{icon}</span>
      <p className="text-xs text-text-muted">{label}</p>
      <p className={`text-2xl font-bold ${valueClass || 'text-text'}`}>{value}</p>
      <p className="text-xs text-text-muted">{sub}</p>
    </div>
  )
}

function AptCard({ apt }: { apt: Apartment }) {
  const tags = [
    apt.completionYear && `${apt.completionYear}년 준공`,
    apt.totalUnits && `${Number(apt.totalUnits).toLocaleString()}세대`,
  ].filter(Boolean) as string[]

  const change =
    apt.latestMaxPrice != null && apt.prevMaxPrice != null
      ? apt.latestMaxPrice > apt.prevMaxPrice ? 'up'
      : apt.latestMaxPrice < apt.prevMaxPrice ? 'down'
      : 'same'
      : null

  return (
    <Link
      to={`/apartments/${apt.id}`}
      className="card p-4 block hover:shadow-md transition-shadow no-underline text-inherit"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="font-bold text-text text-sm truncate">{apt.name}</p>
          <p className="text-xs text-text-muted truncate mt-0.5">{apt.address || apt.region || ''}</p>
        </div>
        {change === 'up' && (
          <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-danger">▲ 상승</span>
        )}
        {change === 'down' && (
          <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-primary">▼ 하락</span>
        )}
      </div>

      {tags.length > 0 && (
        <div className="flex gap-1.5 mb-2.5 flex-wrap">
          {tags.map(t => <span key={t} className="apt-chip">{t}</span>)}
        </div>
      )}

      <div className="grid grid-cols-3 gap-1 pt-2 border-t border-border">
        <PriceItem label="최근 최고가" value={apt.latestMaxPrice ? formatPrice(apt.latestMaxPrice) : '미입력'} />
        <PriceItem label="최근 최저가" value={apt.latestMinPrice ? formatPrice(apt.latestMinPrice) : '미입력'} />
        <PriceItem label="기록 수" value={`${apt.priceCount || 0}건`} />
      </div>
    </Link>
  )
}

function PriceItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] text-text-muted">{label}</p>
      <p className="text-xs font-semibold text-text mt-0.5">{value}</p>
    </div>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {[0, 1].map(i => (
        <div key={i} className="card p-4 animate-pulse">
          <div className="h-4 bg-slate-100 rounded w-3/5 mb-2" />
          <div className="h-3 bg-slate-100 rounded w-4/5 mb-4" />
          <div className="grid grid-cols-3 gap-1 pt-2 border-t border-border">
            {[0, 1, 2].map(j => <div key={j} className="h-8 bg-slate-100 rounded" />)}
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="text-center py-16">
      <p className="text-4xl mb-3">🏢</p>
      <p className="font-bold text-text mb-1">
        {filtered ? '이 시나리오에 단지가 없습니다' : '등록된 아파트가 없습니다'}
      </p>
      <p className="text-sm text-text-muted mb-5">
        {filtered
          ? <>다른 시나리오를 선택하거나<br />이 시나리오에 단지를 등록해보세요.</>
          : <>관심 있는 아파트를 등록하고<br />시세 변화를 직접 추적해보세요.</>}
      </p>
      <Link to="/register" className="btn btn-primary">{filtered ? '단지 등록하기' : '첫 아파트 등록하기'}</Link>
    </div>
  )
}
