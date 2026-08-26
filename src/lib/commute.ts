// 주요 업무지구까지 대중교통 소요시간 (ODsay). 등록·일괄추가 두 화면에서 함께 쓴다.
const ODSAY_KEY = import.meta.env.VITE_ODSAY_KEY as string

const STATIONS = {
  gangnam: { name: '강남역', lng: 127.027621, lat: 37.497942 },
  yeouido: { name: '여의도역', lng: 126.924171, lat: 37.521574 },
  jongno: { name: '종로3가역', lng: 126.991854, lat: 37.571607 },
} as const

export interface Commute {
  commuteGangnam: string | null
  commuteYeouido: string | null
  commuteJongno: string | null
}

export async function fetchCommute(fromLat: number, fromLng: number): Promise<Commute> {
  const entries = await Promise.allSettled(
    (Object.entries(STATIONS) as [keyof typeof STATIONS, typeof STATIONS[keyof typeof STATIONS]][]).map(
      async ([key, station]) => {
        const data = await fetch(
          `https://api.odsay.com/v1/api/searchPubTransPathR?apiKey=${encodeURIComponent(ODSAY_KEY)}&SX=${fromLng}&SY=${fromLat}&EX=${station.lng}&EY=${station.lat}&SearchType=0`
        ).then(r => r.json())
        const mins = data.result?.path?.[0]?.info?.totalTime
        return { key, time: mins != null ? `${mins}분` : null }
      }
    )
  )

  const result: Commute = { commuteGangnam: null, commuteYeouido: null, commuteJongno: null }
  const keyMap: Record<keyof typeof STATIONS, keyof Commute> = {
    gangnam: 'commuteGangnam',
    yeouido: 'commuteYeouido',
    jongno: 'commuteJongno',
  }
  for (const r of entries) {
    if (r.status === 'fulfilled') result[keyMap[r.value.key]] = r.value.time
  }
  return result
}
