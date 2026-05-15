# 내집마련 트래커 (myzip) — Claude 작업 지침서

## 프로젝트 개요
부동산 시세 트래킹 및 정보 관리 서비스. 바닐라 HTML/CSS/JS + Firebase(Auth, Firestore, Hosting).

- **배포 주소**: https://myzip-de785.web.app
- **Firebase 프로젝트**: myzip-de785
- **GitHub**: https://github.com/heekii/myzip

## 기술 스택
- Frontend: 바닐라 HTML, CSS, JavaScript (프레임워크 없음)
- Backend: Firebase Firestore (NoSQL)
- 인증: Firebase Auth (이메일/비밀번호, Google OAuth)
- 호스팅: Firebase Hosting
- 차트: Chart.js 4.4.0
- Firebase SDK: 10.12.0 (compat 버전)

## 파일 구조
```
index.html              # 로그인/회원가입
dashboard.html          # 메인 대시보드
apartment-register.html # 아파트 등록 (2단계)
apartment-detail.html   # 아파트 상세 (시세/정보/뉴스/메모 탭)
profile.html            # 프로필/설정
js/firebase-config.js   # Firebase 초기화 + 공통 유틸리티
css/style.css           # 전체 스타일
```

## 공통 유틸리티 (firebase-config.js)
새 코드 작성 전에 아래 함수들이 이미 있는지 확인할 것:
- `formatPrice(manwon)` — 숫자 → "X억 Y만원" 포맷
- `formatDate(dateStr)` — "YYYY-MM-DD" → "YYYY.MM.DD"
- `tsToDate(ts)` — Firestore Timestamp → 날짜 문자열
- `changeBadge(prev, curr)` — 상승/하락 뱃지 HTML
- `showToast(msg, type)` — 토스트 알림 (success/error/info)
- `showLoading() / hideLoading()` — 로딩 오버레이
- `openModal(id) / closeModal(id)` — 모달
- `initSidebar()` — 사이드바 토글
- `requireAuth(callback)` — 인증 확인 후 콜백
- `getParam(key)` — URL 파라미터
- `getInitial(name, email)` — 아바타 이니셜

## Firestore 컬렉션 구조
```
users/{uid}
  - name, email, createdAt

apartments/{aptId}
  - userId, name, address, region, completionYear, totalUnits, maxFloor
  - createdAt, priceCount, latestMaxPrice, latestMinPrice, prevMaxPrice
  info/detail: { nearStation, stationDist, isStationZone, southFacing, schoolName, floorAreaRatio, buildingCoverage, targetSize, preferredFloor }
  prices/{priceId}: { date, maxPrice, minPrice, createdAt }
  news/{newsId}: { title, summary, url, publishedAt, createdAt }
  memos/{memoId}: { content, createdAt, updatedAt }
```

---

## 해도 되는 것
- HTML/CSS/JS 파일 읽기, 수정, 생성
- `firebase deploy --only hosting` 실행 (단, 커밋 후에)
- `git add`, `git commit`, `git push` 실행
- npm 패키지 설치 (devDependency 한정)
- Firestore 쿼리 최적화 (where, orderBy, limit)
- 공통 유틸리티 추가 (firebase-config.js에 append)

## 절대 하지 말 것
- `js/firebase-config.js`의 `firebaseConfig` 객체 수정 금지 (API 키 변경 절대 불가)
- `firebase.json`, `.firebaserc` 수정 금지
- `git push --force` 금지
- 파일 삭제 전 반드시 사용자 확인
- `git reset --hard` 금지
- 사용자 확인 없이 외부 API 키/시크릿 코드에 삽입 금지
- 새 npm 패키지를 프로덕션 dependency로 추가 금지 (CDN 사용 중)

## 코딩 컨벤션
- 주석은 WHY만 (WHAT은 코드가 말함)
- Firestore 쿼리: where + orderBy 동시 사용 시 복합 인덱스 필요 → JS에서 정렬할 것
- 병렬 가능한 async 작업은 `Promise.all()` 사용
- 알림은 `showToast()` 단일 사용 (alert div와 혼용 금지)
- 모듈 스코프 변수는 최소화 (write-once인 경우 지역변수로)

## 배포 프로세스
1. 코드 수정
2. `git add -A && git commit -m "설명"`
3. `git push`
4. `firebase deploy --only hosting`

---

## 상시 적용 지침 (박제 — 매 작업마다 반드시 준수)

이 지침은 사용자가 매번 언급하지 않아도 모든 작업에 자동으로 적용된다.

1. **레이아웃 중앙 정렬**: 전체 틀(`.page-content`)은 어떤 화면 크기에서든 항상 중앙에 배치. 사이드바가 있어도, 없어도 콘텐츠 영역이 좌측으로 치우치지 않도록 `margin: 0 auto` + `width: 100%` 유지.

2. **게스트 모드 지원**: 로그인하지 않아도 탭이 열려있는 동안 데이터가 유지되어야 한다. `guestDB` (sessionStorage 기반)를 사용해 모든 CRUD 동작을 지원. 새 페이지를 추가하거나 기능을 수정할 때도 `isGuest` 분기를 반드시 유지.

3. **게스트 경고 유지**: 게스트 모드일 때는 항상 "탭을 닫으면 데이터가 사라진다"는 경고 배너(`showGuestBanner`)를 표시. 절대 제거하지 말 것.

4. **작업 전 UX 검토**: 기능 추가 또는 UI 변경 시, 코드 작성 전에 UX 전문가 관점에서 사용성을 검토하고 문제점을 먼저 보고할 것. 변경이 기존 흐름을 방해하거나 사용자를 혼란스럽게 하는지 확인.

5. **배포 전 UI 깨짐 확인**: 커밋/배포 전에 변경된 컴포넌트의 HTML/CSS 구조가 실제로 렌더링될 때 깨지지 않는지 확인. 특히 grid/flex 레이아웃, 반응형 미디어쿼리, 동적으로 삽입되는 HTML 확인.
