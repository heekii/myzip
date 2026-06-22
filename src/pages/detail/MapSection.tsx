import type { Apartment } from '@/types'

interface Props {
  apt: Apartment
}

export default function MapSection({ apt }: Props) {
  return (
    <div className="card overflow-hidden">
      <div className="card-header">
        <h3 className="card-title">📍 위치</h3>
      </div>
      <div className="card-body space-y-4">
        {apt.address && <p className="text-sm text-text">{apt.address}</p>}

        {apt.lat != null && apt.lng != null ? (
          <div className="grid grid-cols-2 gap-2">
            <a
              href={`https://map.kakao.com/link/map/${encodeURIComponent(apt.name)},${apt.lat},${apt.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              🗺️ 지도 보기
            </a>
            <a
              href={`https://map.kakao.com/link/to/${encodeURIComponent(apt.name)},${apt.lat},${apt.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              🧭 길찾기
            </a>
          </div>
        ) : (
          <p className="text-sm text-text-muted text-center py-2">
            위치 정보가 없어 지도를 표시할 수 없습니다.
          </p>
        )}
      </div>
    </div>
  )
}
