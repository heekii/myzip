import { useEffect, useState } from 'react'
import { baseAptName } from '@/lib/utils'

interface NewsItem {
  title: string
  link: string
  pubDate: string
  description: string
}

interface Props {
  aptName: string
  region?: string
}

export default function NewsSection({ aptName, region }: Props) {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!aptName) return
    fetchNews(aptName)
  }, [aptName, region])

  async function fetchNews(name: string) {
    setLoading(true)
    setError(false)
    try {
      // 지역명을 붙여 동명(同名) 브랜드 아파트의 타지역 뉴스 과매칭 방지
      const query = [region, baseAptName(name), '아파트'].filter(Boolean).join(' ')
      const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`
      const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}&count=10`
      const res = await fetch(proxyUrl)
      const data = await res.json()
      if (data.status !== 'ok') { setError(true); return }
      setItems(
        (data.items ?? []).map((item: any) => ({
          title: item.title?.replace(/<[^>]+>/g, '') ?? '',
          link: item.link ?? '',
          pubDate: item.pubDate ?? '',
          description: item.description?.replace(/<[^>]+>/g, '').slice(0, 100) ?? '',
        }))
      )
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  function formatDate(str: string) {
    if (!str) return ''
    const d = new Date(str)
    if (isNaN(d.getTime())) return ''
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">📰 관련 뉴스</h3>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => fetchNews(aptName)}
          disabled={loading}
        >
          {loading ? '불러오는 중...' : '새로고침'}
        </button>
      </div>
      <div className="card-body p-0">
        {loading ? (
          <div className="space-y-0 divide-y divide-border">
            {[1, 2, 3].map(i => (
              <div key={i} className="px-4 py-3 animate-pulse">
                <div className="h-4 bg-slate-100 rounded w-4/5 mb-1.5" />
                <div className="h-3 bg-slate-100 rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : error || items.length === 0 ? (
          <div className="text-center py-8 text-text-muted">
            <p className="text-2xl mb-2">📭</p>
            <p className="text-sm">관련 뉴스를 불러올 수 없습니다.</p>
            <a
              href={`https://search.naver.com/search.naver?where=news&query=${encodeURIComponent([region, baseAptName(aptName), '아파트'].filter(Boolean).join(' '))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 text-xs text-primary underline"
            >
              네이버에서 직접 검색하기
            </a>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item, i) => (
              <li key={i}>
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-4 py-3 hover:bg-slate-50 transition-colors no-underline"
                >
                  <p className="text-sm font-medium text-text leading-snug line-clamp-2">{item.title}</p>
                  {item.description && (
                    <p className="text-xs text-text-muted mt-1 line-clamp-1">{item.description}</p>
                  )}
                  <p className="text-[11px] text-text-muted mt-1.5">{formatDate(item.pubDate)}</p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
