// 실행: node scripts/parsePaste.check.mjs   (Node 22+ 타입 스트리핑 사용)
import assert from 'node:assert/strict'
import { parsePaste } from '../src/lib/parsePaste.ts'

const SAMPLE = `장미
387세대(아파트)\t24평
119세대　\t1994-07
(32년차)\t
초지상공
68,670\t
2,184
34,282\t
258
50%\t34,388\t\t
마곡중앙하이츠
930세대(아파트)\t23평
270세대　\t1994-05
(32년차)\t
초버지상공마
65,414\t
-68
39,706\t
407
61%\t25,708\t\t중앙화곡하이츠
473세대(아파트)\t21평
252세대　\t1988-12
(37년차)\t
버지상공
47,645\t
1,786
29,804\t
-364
63%\t17,841
센터스퀘어발산
716세대(아파트)\t9평`

const { rows, skipped } = parsePaste(SAMPLE)

assert.equal(rows.length, 3)
assert.equal(skipped, 1) // 값 없이 잘린 마지막 행
assert.deepEqual(rows[0], {
  name: '장미', size: 24, totalUnits: '387', completionYear: '1994',
  salePrice: 68670, saleChange: 2184, jeonsePrice: 34282, jeonseRatio: '50%', gap: 34388,
})
assert.equal(rows[1].saleChange, -68)          // 하락 부호 유지
assert.equal(rows[2].name, '중앙화곡하이츠')    // 앞 행 꼬리에 붙어온 단지명 분리
assert.equal(rows[2].gap, 17841)

// 같은 단지·같은 평형 중복은 첫 건만
const dup = parsePaste(SAMPLE + '\n' + SAMPLE)
assert.equal(dup.rows.length, 3)

console.log('ok — rows', rows.length, 'skipped', skipped)
