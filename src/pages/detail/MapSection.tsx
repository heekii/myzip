import { useEffect, useRef } from 'react'
import type { Apartment } from '@/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const kakao: any

interface Props {
  apt: Apartment
}

export default function MapSection({ apt }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    if (!apt.lat || !apt.lng || !containerRef.current) return
    if (typeof kakao === 'undefined') return

    const pos = new kakao.maps.LatLng(apt.lat, apt.lng)

    if (!mapRef.current) {
      mapRef.current = new kakao.maps.Map(containerRef.current, {
        center: pos,
        level: 4,
      })
    } else {
      mapRef.current.setCenter(pos)
    }

    const marker = new kakao.maps.Marker({ map: mapRef.current, position: pos })
    const infoWindow = new kakao.maps.InfoWindow({
      content: `<div style="padding:6px 12px;font-size:13px;font-weight:700;white-space:nowrap">${apt.name}</div>`,
    })
    infoWindow.open(mapRef.current, marker)

    return () => {
      infoWindow.close()
      marker.setMap(null)
    }
  }, [apt.lat, apt.lng, apt.name])

  if (!apt.lat || !apt.lng) {
    return (
      <div className="card p-6 text-center text-text-muted text-sm">
        위치 정보가 없어 지도를 표시할 수 없습니다.
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="card-header">
        <h3 className="card-title">📍 위치</h3>
        <a
          href={`https://map.kakao.com/link/map/${encodeURIComponent(apt.name)},${apt.lat},${apt.lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-secondary btn-sm"
        >
          카카오맵에서 보기
        </a>
      </div>
      <div ref={containerRef} style={{ height: 300 }} />
    </div>
  )
}
