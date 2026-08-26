---
name: decision-framework-selector
description: |
  Automatically selects and applies the right thinking framework or product tool based on the current conversation context in the myzip project. Use this skill proactively whenever the conversation reaches a decision point, planning moment, or moment of confusion — including: "뭘 먼저 해야 할까", "이게 맞는 방향인지 모르겠어", "기능이 너무 많은 것 같아", "어떤 게 더 중요해?", "이 아이디어 어때?", scope creep moments, or any time the user seems stuck. Don't wait to be asked — if the situation calls for a framework, suggest and apply it.
---

# Decision Framework Selector

This skill reads the current conversation context and selects the most useful framework to apply. The goal is to prevent the myzip project from getting stuck in vague discussion — every ambiguous moment should resolve into a structured next step.

---

## Context Detection → Framework Mapping

Read the current situation and pick the best fit:

| Situation Signal | Apply This Framework |
|-----------------|---------------------|
| "뭘 만들어야 할지 모르겠어" / confused about what to build | **Jobs-to-be-Done** |
| "기능이 너무 많아" / scope creep / feature list growing | **MoSCoW Prioritization** |
| "이 아이디어가 맞는지 모르겠어" / validating assumptions | **Assumption Mapping** |
| Comparing two directions / "A로 갈까 B로 갈까" | **Decision Matrix** |
| "언제 뭘 해야 해?" / sequencing work | **Now / Next / Later Roadmap** |
| "경쟁 서비스랑 뭐가 달라야 해?" | **Differentiation Frame** |
| "유저가 뭘 원해?" / user need clarity | **Jobs-to-be-Done** |
| Planning is confirmed, ready to build | **User Story → Dev Ticket** |

Apply one framework per conversation turn. Don't stack multiple frameworks at once.

---

## Framework Playbooks

### 1. Jobs-to-be-Done (JTBD)
**When**: User is unclear about what the service is really for, or keeps adding features without a clear center.

**Apply**:
```
핵심 질문:
"사람들이 이 서비스를 '고용'하는 이유가 뭘까?"

Job Statement 형식:
"[상황]에서 [동기]를 가진 사람이 [결과]를 달성하기 위해 사용한다"

myzip 예시:
"후보 단지를 좁혀가는 과정에서 판단 피로를 느끼는 사람이
빠르게 확신을 얻고 싶어서 사용한다"
```

**Output**: 1–2개의 명확한 Job Statement → 이게 기준이 되어 이후 모든 기능 판단에 사용

---

### 2. MoSCoW Prioritization
**When**: Feature list is getting long, or user is unsure what's in MVP vs later.

**Apply**:
Sort every feature into:
- **Must Have**: MVP 없으면 안 되는 것 (서비스의 존재 이유)
- **Should Have**: 중요하지만 없어도 MVP는 동작함
- **Could Have**: 있으면 좋은 것 (시간 남으면)
- **Won't Have (Now)**: 나중에 / 절대 안 함

**myzip 기본 분류 (참고용)**:
```
Must:
- 단지 최대 10개 등록
- 비교 항목 자동 표시 (가격, 연식, 출퇴근 등)
- 탈락 추천 기능

Should:
- 가중치 설정 UI
- 자동 점수 계산

Could:
- 의사결정 리포트 PDF 출력
- 단지별 메모 기능

Won't (Now):
- 실거래가 API 연동
- 커뮤니티/공유 기능
```

---

### 3. Assumption Mapping
**When**: User has a plan but isn't sure if it's based on real user needs or just assumptions.

**Apply**: List all assumptions behind the current plan, then rate each:

```
가정 목록 → 중요도(H/M/L) × 확신도(H/M/L) 매트릭스

[위험 구간]: 중요도 High + 확신도 Low → 먼저 검증해야 할 것들
[안전 구간]: 중요도 Low or 확신도 High → 일단 진행해도 OK

myzip 예시 가정들:
- "사용자는 단지를 10개씩 비교한다" — 중요 H / 확신 M
- "탈락 기능이 비교보다 더 유용하다" — 중요 H / 확신 M
- "출퇴근 시간이 가장 중요한 기준이다" — 중요 H / 확신 H (본인 케이스)
```

---

### 4. Decision Matrix
**When**: Two clear options, user can't choose.

**Apply**:
```
기준 설정 (3–5개) → 각 기준별 가중치 → 옵션별 점수 → 총점 비교

예시: "React 앱으로 만들까 vs 노션 기반으로 만들까"
기준          | 가중치 | React | 노션
개발 속도      |  30%  |   6   |  9
UI 자유도      |  25%  |   9   |  4
유지보수 편의  |  20%  |   7   |  8
모바일 경험    |  25%  |   8   |  5
총점           |  100% |  7.45 | 6.55
```

---

### 5. Now / Next / Later Roadmap
**When**: Work is sequenced wrong, or user isn't sure what to tackle first.

**Apply**:
```
Now (이번 주):  즉시 필요한 것, 현재 의사결정에 영향 있는 것
Next (다음):    Now가 완성되면 바로 이어서 할 것
Later (나중):   중요하지만 지금 안 해도 되는 것

myzip 예시:
Now:   단지 등록 + 비교표 + 탈락 기능
Next:  가중치 설정 + 자동 점수
Later: 리포트 출력 + API 연동
```

---

### 6. Differentiation Frame
**When**: User asks why myzip is different from 호갱노노 / 네이버부동산.

**Apply**:
```
3가지 관점으로 정리:

1. 무엇을 안 하는가 (경쟁사가 하는 것 중 myzip은 하지 않는 것)
2. 무엇을 다르게 하는가 (같은 기능이지만 다른 방식)
3. 무엇만 하는가 (myzip의 유일한 것)

myzip 예시:
안 함: 매물 목록 제공, 실거래가 차트, 시세 알림
다르게: 단지 비교를 "선택"이 아니라 "탈락" 관점으로
유일함: 사용자의 개인 가중치 기반 후보 압축 → 결정 지원
```

---

### 7. User Story → Dev Ticket
**When**: Planning is confirmed and user is ready to start building.

**Apply**:
Convert confirmed features into buildable units:

```
형식:
As a [user], I want to [action] so that [outcome].

Acceptance Criteria:
- [ ] 조건 1
- [ ] 조건 2

myzip 예시:
"집 보는 중인 나는 관심 단지를 최대 10개 등록하고 싶다.
그래서 후보를 한눈에 볼 수 있게."

AC:
- [ ] 단지명, 위치, 가격 입력 가능
- [ ] 최대 10개 제한 (초과 시 안내)
- [ ] 등록된 단지 목록 표시
```

---

## How to Apply

1. **Detect situation** from conversation context (see mapping table above)
2. **Name the framework** you're applying and why — one sentence
3. **Run the framework** with myzip-specific content, not generic examples
4. **Output a concrete next step** — framework result should always end with "그래서 다음에 뭘 할지"

Don't apply a framework just to apply one. If the situation is clear and the next step is obvious, just do it.
