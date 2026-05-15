// ============================================================
//  Firebase 설정 파일
//  사용 전 아래 YOUR_* 값을 실제 Firebase 프로젝트 값으로 교체하세요.
//
//  설정 방법:
//  1. https://console.firebase.google.com 접속
//  2. 새 프로젝트 생성 (또는 기존 프로젝트 선택)
//  3. 프로젝트 설정 > 일반 > 내 앱 > 웹 앱 추가
//  4. 아래 firebaseConfig 값을 복사하여 붙여넣기
//  5. Authentication > 로그인 방법에서 이메일/비밀번호, Google 활성화
//  6. Firestore Database 생성 (테스트 모드로 시작)
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyA8bB0qSlAzOIznbaKdDhFmS4kmLqeTBpQ",
  authDomain: "myzip-de785.firebaseapp.com",
  projectId: "myzip-de785",
  storageBucket: "myzip-de785.firebasestorage.app",
  messagingSenderId: "555298220578",
  appId: "1:555298220578:web:c85a6616151ce110a0b87b",
  measurementId: "G-8BJGWBM5WK"
};

// Firebase 초기화
firebase.initializeApp(firebaseConfig);

// 전역 객체로 export
const auth = firebase.auth();
const db = firebase.firestore();

// Firestore 설정 (오프라인 지원)
db.settings({ experimentalForceLongPolling: true });

// ============================================================
//  Firestore 데이터 구조:
//
//  users/{uid}
//    - name, email, createdAt
//
//  apartments/{aptId}
//    - userId, name, address, region, createdAt
//    - info/detail: { school, stationDistance, floorAreaRatio, ... }
//    - prices/{priceId}: { date, maxPrice, minPrice, createdAt }
//    - memos/{memoId}: { content, createdAt, updatedAt }
// ============================================================

// ============================================================
//  공통 유틸리티
// ============================================================

// 숫자를 억/만원 단위로 포맷 (예: 85000 → 8억 5,000만원)
function formatPrice(manwon) {
  if (!manwon || isNaN(manwon)) return '-';
  const n = parseInt(manwon);
  const uk = Math.floor(n / 10000);
  const man = n % 10000;
  if (uk > 0 && man > 0) return `${uk}억 ${man.toLocaleString()}만원`;
  if (uk > 0) return `${uk}억원`;
  return `${man.toLocaleString()}만원`;
}

// 날짜 포맷 (YYYY-MM-DD → YYYY.MM.DD)
function formatDate(dateStr) {
  if (!dateStr) return '-';
  return dateStr.replace(/-/g, '.');
}

// Firestore Timestamp → 날짜 문자열
function tsToDate(ts) {
  if (!ts) return '-';
  if (ts.toDate) return ts.toDate().toLocaleDateString('ko-KR');
  return new Date(ts).toLocaleDateString('ko-KR');
}

// 상승/하락 뱃지 HTML
function changeBadge(prev, curr) {
  if (!prev || !curr) return '';
  const diff = curr - prev;
  const pct = ((diff / prev) * 100).toFixed(1);
  if (diff > 0) return `<span class="badge badge-up">▲ ${formatPrice(diff)}</span>`;
  if (diff < 0) return `<span class="badge badge-down">▼ ${formatPrice(Math.abs(diff))}</span>`;
  return `<span class="badge badge-neutral">변동없음</span>`;
}

// 토스트 알림
function showToast(msg, type = 'success') {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.style.cssText = `
    position: fixed; bottom: 88px; left: 50%; transform: translateX(-50%);
    background: ${type === 'error' ? '#EF4444' : type === 'info' ? '#2563EB' : '#10B981'};
    color: white; padding: 12px 24px; border-radius: 9999px;
    font-size: 0.875rem; font-weight: 600; z-index: 9999;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15); white-space: nowrap;
    animation: toastIn 0.3s ease;
  `;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.animation = 'toastOut 0.3s ease forwards'; setTimeout(() => toast.remove(), 300); }, 2500);
}

// 토스트 CSS 삽입
const toastStyle = document.createElement('style');
toastStyle.textContent = `
  @keyframes toastIn { from { opacity:0; transform: translateX(-50%) translateY(10px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }
  @keyframes toastOut { from { opacity:1; } to { opacity:0; transform: translateX(-50%) translateY(10px); } }
`;
document.head.appendChild(toastStyle);

// 로딩 표시/숨김
function showLoading() { const el = document.getElementById('loadingOverlay'); if (el) el.classList.add('show'); }
function hideLoading() { const el = document.getElementById('loadingOverlay'); if (el) el.classList.remove('show'); }

// 모달 열기/닫기
function openModal(id) { document.getElementById(id)?.classList.add('show'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('show'); }

// 사이드바 토글 (모바일)
function initSidebar() {
  const hamburger = document.getElementById('hamburger');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (!hamburger || !sidebar) return;

  hamburger.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay?.classList.toggle('show');
  });
  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  });
}

// 탭 전환
function initTabs(containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      container.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      container.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(target)?.classList.add('active');
    });
  });
}

// 인증 상태 확인 (보호된 페이지용)
// allowGuest: true 이면 ?guest=1 파라미터로 비로그인 접근 허용 (callback에 null 전달)
function requireAuth(callback, { allowGuest = false } = {}) {
  const isGuest = getParam('guest') === '1';
  auth.onAuthStateChanged(user => {
    if (user) {
      callback(user);
    } else if (allowGuest && isGuest) {
      callback(null);
    } else {
      window.location.href = 'index.html';
    }
  });
}

// URL 파라미터 가져오기
function getParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

// 사용자 이니셜 (아바타용)
function getInitial(name, email) {
  if (name) return name.charAt(0).toUpperCase();
  if (email) return email.charAt(0).toUpperCase();
  return 'U';
}

// 게스트 배너 표시
function showGuestBanner(msg = '게스트 모드입니다. 데이터는 저장되지 않아요.') {
  const banner = document.createElement('div');
  banner.id = 'guestBanner';
  banner.className = 'guest-banner';
  banner.innerHTML = `<span>👀 ${msg}</span><a href="index.html#signup" class="btn btn-primary btn-sm">회원가입</a>`;
  document.querySelector('.page-content, .auth-page, main')?.prepend(banner);
}

// 장식성 이모지·아이콘 스크린리더 숨김, 버튼 레이블 보완
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-icon, .empty-icon, .stat-icon').forEach(el => {
    el.setAttribute('aria-hidden', 'true');
  });
  document.querySelectorAll('.hamburger').forEach(el => {
    el.setAttribute('aria-label', '메뉴 열기');
    el.setAttribute('aria-expanded', 'false');
  });
  document.querySelectorAll('.modal-close').forEach(el => {
    if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', '닫기');
  });
});
