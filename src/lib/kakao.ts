/* eslint-disable @typescript-eslint/no-explicit-any */

// Kakao 장소/주소 조회 (Maps JS SDK).
//
// REST 키(KakaoAK 헤더)는 도메인 제한이 걸리지 않아, 번들에 실리는 순간 누구나 도용할 수 있다.
// VITE_ 환경변수는 빌드 시 코드에 그대로 박히므로 .env 로 옮겨도 숨겨지지 않는다.
// JavaScript 키는 카카오 콘솔에 등록된 도메인에서만 동작하므로 브라우저에 노출돼도 안전하다.
// 따라서 키는 index.html 의 SDK 로더 URL 에만 두고, 이 모듈은 키를 직접 다루지 않는다.

declare global {
  interface Window {
    kakao?: any
  }
}

export interface KakaoPlace {
  place_name: string
  category_name?: string
  road_address_name: string
  address_name: string
  x: string
  y: string
  distance?: string
}

export interface KakaoAddress {
  region_1depth_name: string
  region_2depth_name: string
  region_3depth_name: string
  main_address_no: string
  sub_address_no: string
  b_code: string
  x: string
  y: string
}

let readyPromise: Promise<any> | null = null

// index.html 에서 autoload=false 로 불렀으므로 load() 이후에야 services 가 존재한다.
// SDK 가 없거나(로드 실패·오프라인) 초기화가 안 되면 null 을 돌려주고, 호출부는 조용히 건너뛴다.
function ready(): Promise<any> {
  if (!readyPromise) {
    readyPromise = new Promise(resolve => {
      const kakao = window.kakao
      if (!kakao?.maps?.load) { resolve(null); return }
      try {
        kakao.maps.load(() => resolve(kakao.maps.services ? kakao : null))
      } catch { resolve(null) }
    })
  }
  return readyPromise
}

// SDK 는 콜백 기반이다. 실패·무결과를 모두 빈 배열로 흡수해 기존 호출부의 예외 처리를 유지한다.
async function search<T>(
  run: (services: any, cb: (data: T[], status: string) => void) => void
): Promise<T[]> {
  const kakao = await ready()
  if (!kakao) return []
  const services = kakao.maps.services
  return new Promise<T[]>(resolve => {
    try {
      run(services, (data, status) =>
        resolve(status === services.Status.OK ? (data ?? []) : [])
      )
    } catch { resolve([]) }
  })
}

/** 키워드로 장소 검색. REST 의 /v2/local/search/keyword.json 대체. */
export function searchKeyword(
  keyword: string,
  opts: { size?: number; page?: number } = {}
): Promise<KakaoPlace[]> {
  return search<KakaoPlace>((s, cb) => new s.Places().keywordSearch(keyword, cb, opts))
}

/** 좌표 주변 카테고리 검색(SW8 지하철역, SC4 학교 등). REST 의 /search/category.json 대체. */
export function searchCategory(
  code: string,
  loc: { lat: number; lng: number },
  opts: { radius?: number; size?: number; sortByDistance?: boolean } = {}
): Promise<KakaoPlace[]> {
  return search<KakaoPlace>((s, cb) =>
    new s.Places().categorySearch(code, cb, {
      location: new window.kakao.maps.LatLng(loc.lat, loc.lng),
      radius: opts.radius ?? 1500,
      ...(opts.size ? { size: opts.size } : {}),
      ...(opts.sortByDistance ? { sort: s.SortBy.DISTANCE } : {}),
    })
  )
}

/** 주소 → 법정동코드·좌표. REST 의 /search/address.json 대체. */
export async function searchAddress(query: string): Promise<KakaoAddress | null> {
  const docs = await search<any>((s, cb) => new s.Geocoder().addressSearch(query, cb, { size: 1 }))
  return docs[0]?.address ?? null
}

// 목록 붙여넣기용: 단지명 검색 결과에서 실제 아파트 한 곳을 고른다.
// 호갱노노 이름과 카카오 등록명이 자주 어긋나므로(도시개발공사2단지 ↔ 방화2단지도시개발공사)
// 이름 일치를 요구하지 않고, "아파트 시설이면서 부속동이 아닌 것" 중 검색 상위를 쓴다.
export function pickAptPlace(places: KakaoPlace[], name: string): KakaoPlace | null {
  const norm = (s: string) => s.replace(/[\s()]/g, '').replace(/아파트$/, '')
  const n = norm(name)

  const candidates = places.filter(p =>
    (p.category_name?.includes('아파트') || /아파트/.test(p.place_name)) &&
    !/(상가|후문|정문|주차|경비|관리사무소|충전소|전기차|어린이집|경로당)/.test(p.place_name)
  )
  if (!candidates.length) return null

  const named = candidates.find(p => {
    const pn = norm(p.place_name)
    return pn.includes(n) || n.includes(pn)
  })
  return named ?? candidates[0]
}

/** 국토부 실거래 자료의 지번 표기("839", "351-89")로 맞춘다. */
export function jibunOf(a: KakaoAddress): string {
  return a.sub_address_no ? `${a.main_address_no}-${a.sub_address_no}` : a.main_address_no
}
