---
name: apartment-scoring
description: |
  Structured scoring, ranking, and elimination logic for comparing Korean apartment complexes (아파트 단지). Use this skill whenever the user wants to compare, score, rank, or eliminate candidate complexes in myzip. Trigger on: "이 단지들 비교해줘", "점수 매겨줘", "어디를 탈락시킬까", "순위 매겨줘", "어디가 나한테 맞아?", or any request involving evaluating multiple complexes against each other. Also trigger proactively when the user has listed 2+ complexes and seems to be weighing options.
---

# Apartment Scoring & Elimination Engine

Core principle: **탈락이 먼저, 비교는 나중.** The goal is not to find the best — it's to eliminate the clearly wrong ones fast, then deeply compare the survivors.

---

## Phase 1: Collect Inputs

### 1a. Get Candidate Complexes
Ask user to list up to 10 단지. For each, collect what they know:
- 단지명
- 매매 호가 or 실거래가 (recent)
- 위치 (구/동)

If they don't have data, note it as unknown — don't block progress.

### 1b. Get User Constraints (Hard Filters)
These are elimination criteria — if a complex fails any, it's out immediately.

```
Hard Filter Checklist:
[ ] 최대 예산 (매매가 기준)
[ ] 최대 출퇴근 시간 (분)
[ ] 직장 위치 (출퇴근 계산용)
[ ] 최소 입주 가능 시기
[ ] 전세가 없어야 하는 조건 등 특수 요건
```

Use `ask_user_input_v0` to collect these if not already known.

### 1c. Get User Priority Weights
Ask user to distribute 100 points across these categories:

| Category | Default Weight | Description |
|----------|---------------|-------------|
| 가격 | 35% | 예산 대비 매매가 |
| 출퇴근 | 25% | 직장까지 도어-투-도어 |
| 미래가치 | 15% | 재건축, 개발호재, 입지 성장성 |
| 생활인프라 | 15% | 마트, 병원, 공원, 편의시설 |
| 학군 | 10% | 초등학교 배정, 학원가 |

Offer defaults if user doesn't want to set manually. Adjust categories if user has different priorities (e.g., replace 학군 with 커뮤니티시설 for childless couples).

---

## Phase 2: Elimination Round

Run hard filters first. Any complex that fails → mark as **탈락** immediately with reason.

```
탈락 사유 코드:
[예산초과] 매매가 > 최대예산
[출퇴근불가] 통근시간 > 최대허용
[거래량부족] 최근 6개월 거래 1건 이하
[대출불가] DSR 기준 대출 불가 예상
[구축리스크] 30년 이상 + 재건축 가능성 없음
[주차부족] 세대당 주차 1대 미만
```

Present elimination results clearly:
```
탈락 단지 (4개):
❌ XX아파트 — [예산초과] 15억 > 예산 12억
❌ YY타워 — [거래량부족] 최근 6개월 0건
❌ ZZ아파트 — [출퇴근불가] 도어투도어 95분
❌ AA아파트 — [구축리스크] 1988년 준공, 재건축 불투명

생존 단지 (6개) → 점수 계산 진행
```

---

## Phase 3: Weighted Scoring

For surviving complexes, score each category 1–10, then apply weights.

### Scoring Rubric

**가격 점수** (예산 대비)
- 10: 예산의 70% 이하
- 7: 예산의 80%
- 5: 예산의 90%
- 3: 예산의 95%
- 1: 예산의 99% (빠듯)

**출퇴근 점수**
- 10: 30분 이하
- 7: 45분
- 5: 60분
- 3: 75분
- 1: 89분 (한계치)

**미래가치 점수** (정성 + 정량 혼합)
- 10: 재건축 임박(안전진단 통과) + 역세권 + 개발호재
- 7: 신축 or 용적률 낮음 + 입지 안정
- 5: 준신축, 특이사항 없음
- 3: 구축, 용적률 높음
- 1: 30년 이상 + 고용적률 + 개발호재 없음

**생활인프라 점수**
- 10: 대형마트·병원·공원 모두 도보 10분
- 5: 일부만 해당
- 1: 자차 필수

**학군 점수** (학교알리미 기준)
- 10: 강남 8학군 or 지역 최상위 초등학교
- 5: 무난한 공립
- 1: 학원가 없음, 학교 평판 낮음

### Score Calculation
```
총점 = Σ(카테고리 점수 × 가중치)
예시:
가격 7점 × 35% = 2.45
출퇴근 8점 × 25% = 2.00
미래가치 6점 × 15% = 0.90
인프라 9점 × 15% = 1.35
학군 4점 × 10% = 0.40
총점 = 7.10 / 10
```

Present as a sortable table:
```
순위 | 단지명        | 가격 | 출퇴근 | 미래가치 | 인프라 | 학군 | 총점
1위  | 헬리오시티    |  6   |   8    |    7     |   9   |  6   | 7.15
2위  | 고덕그라시움  |  8   |   6    |    8     |   7   |  5   | 7.05
3위  | 마포래미안    |  7   |   9    |    5     |   8   |  4   | 6.95
```

---

## Phase 4: Final 3 Deep Dive

After ranking, focus on top 3 survivors for head-to-head comparison.

For each of the top 3, generate a **단지 프로파일**:
```
[단지명]
✅ 선택 이유 (3가지)
⚠️ 포기해야 할 요소 (2가지)
🔑 결정적 변수 (이 단지를 선택하려면 이것이 해결되어야 함)
```

Then show a **결승전 비교표** — only the 3 finalists, side by side on the factors that actually differ between them (ignore factors where they score similarly).

---

## Phase 5: Decision Report

Produce a one-page summary:

```
🏆 1순위 추천: [단지명]
이유:
- [가장 강한 이유]
- [두 번째 이유]
- [세 번째 이유]

⚠️ 감수해야 할 부분:
- [trade-off 1]
- [trade-off 2]

📌 최종 결정 전 확인사항:
- [ ] 현장 방문 체크리스트 항목
- [ ] 추가로 확인할 데이터

❓ 결정이 어렵다면:
→ [단지 A] vs [단지 B] 중 [핵심 변수]가 더 중요하다면 A
→ [핵심 변수]보다 [다른 변수]가 중요하다면 B
```

---

## Rules

- Never score a complex without flagging missing data — show as "데이터 없음" and note the assumption made
- If user only has 2–3 complexes, skip Phase 2 (no point eliminating when list is small) and go straight to Phase 3
- Recalculate scores immediately if user changes weights — don't require a restart
- Keep report tight — one screen of output, not a wall of text
- Surface the honest trade-off: the top-ranked complex is not always "best" — help user see what they're giving up
