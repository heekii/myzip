---
name: kr-real-estate-context
description: |
  Korean real estate domain knowledge for the myzip project. Use this skill whenever the user asks about or references Korean real estate concepts, terms, or data — including KB시세, 실거래가, 전세/매매, DSR/LTV/DTI, 호가, 갭투자, 용적률, 세대수, 브랜드 아파트, 재건축/재개발, or any apartment complex evaluation criteria. Also trigger when evaluating specific complexes like 헬리오시티, 고덕그라시움, etc. Even if the user doesn't ask for an explanation, use this skill to apply correct Korean market context when giving any analysis or recommendation.
---

# Korean Real Estate Context

This skill ensures all myzip conversations are grounded in accurate Korean real estate market knowledge. Apply these concepts silently when relevant — don't lecture unless the user asks for an explanation.

---

## Price Concepts

| Term | Description | myzip Relevance |
|------|-------------|-----------------|
| **KB시세** | KB국민은행 estimated price — lender standard for loan calculation | Use as floor for "realistic" price; not always aligned with actual trades |
| **실거래가** | Actual registered transaction price (국토부 실거래가 공개시스템) | Most reliable signal; compare recent (within 6 months) trades only |
| **호가** | Asking price set by seller/agent | Often 3–10% above 실거래가; discount it heavily |
| **갭** | Difference between 매매가 and 전세가 | Low gap = high 전세 demand = defensive; high gap = risky |

**Rule**: When discussing price, always distinguish which price type is being referenced.

---

## Ownership & Transaction Types

- **매매**: Outright purchase. Full ownership. Price is 매매가.
- **전세**: Lump-sum deposit (typically 60–80% of 매매가), live rent-free for 2 years, deposit returned. No monthly payment. Risk: 역전세 if prices fall.
- **월세**: Monthly rent. Low upfront, high ongoing cost.
- **갭투자**: Buy at 매매가, immediately lease as 전세. Buyer only pays the gap. High leverage, high risk.

For myzip: user is evaluating **매매** purchases.

---

## Loan & Finance Concepts

| Term | Full Name | Meaning |
|------|-----------|---------|
| **LTV** | Loan-to-Value | Max loan % of property value. Regulated zone: typically 40–70% |
| **DTI** | Debt-to-Income | Annual debt repayment / annual income. Cap: usually 40–60% |
| **DSR** | Debt Service Ratio | Total debt payments / income. Stricter than DTI. Cap: 40% for most borrowers |
| **중도금** | Interim payment | Staged payment during new builds (분양) |
| **잔금** | Balance payment | Final payment at move-in |

**Rule**: When user discusses affordability, always surface DSR constraint first — it's the binding limit for most buyers.

---

## Apartment Complex Evaluation Criteria

### Tier 1: Hard Filters (deal-breakers)
- **예산 초과**: 매매가 > user's max → immediate elimination
- **출퇴근 시간**: Door-to-door > user's threshold (typically 60–90min)
- **DSR 초과**: Can't get a loan for this price → eliminate

### Tier 2: Quality Signals
| Factor | Good Signal | Weak Signal |
|--------|------------|-------------|
| **연식** | Under 10 years or scheduled 재건축 | 20–30년 with no 재건축 prospect |
| **세대수** | 1,000+ (liquidity, facilities) | Under 300 (illiquid, limited amenities) |
| **브랜드** | 래미안, 힐스테이트, 아이파크, 자이, 푸르지오 | 무브랜드 or regional builder |
| **용적률** | Under 200% (재건축 potential) | Over 250% (little upside) |
| **주차** | 1.5대/세대 or more | Under 1대/세대 |
| **거래량** | 5+ trades in last 6 months | 0–1 trades (illiquid, hard to exit) |

### Tier 3: Lifestyle Fit
- **학군**: 학교알리미 기준 — relevant if user has/plans kids
- **생활인프라**: 마트, 병원, 공원 within 10min walk
- **소음/환경**: 도로변, 공장, 고압선 proximity

---

## Well-Known Complexes (Quick Reference)

| Complex | Location | 세대수 | 특징 |
|---------|----------|--------|------|
| 헬리오시티 | 송파 가락동 | 9,510 | 국내 최대 단지, 강남 접근성, 높은 거래량 |
| 고덕그라시움 | 강동 고덕동 | 4,932 | 강동 대장, 9호선, 재건축 수혜 인접 |
| 마포래미안푸르지오 | 마포 아현동 | 3,885 | 도심 접근성, 래미안+푸르지오 브랜드 |
| 올림픽파크포레온 | 송파 둔촌동 | 12,032 | 국내 최대 신축, 강동구 대장 |
| 잠실엘스 | 송파 잠실동 | 5,678 | 잠실 대장, 2호선, 재건축 가능성 |

---

## Market Context (as of 2025–2026)

- 금리: 한국은행 기준금리 인하 사이클 — 주택담보대출 4–5%대
- 규제: 스트레스 DSR 2단계 시행 → 대출 한도 이전보다 축소
- 시장: 서울 핵심지 회복세, 외곽/비인기 단지는 여전히 약세
- 청약: 높은 경쟁률 → 기존 매매로 내집마련이 현실적

**Rule**: Apply this context when user asks "지금 사도 될까요?" type questions. Don't give investment advice, but do surface relevant market conditions.

---

## How to Use This Skill

1. **Silently apply** domain knowledge when analyzing complexes or discussing price
2. **Explain terms** only when user asks or seems confused
3. **Always distinguish** 실거래가 vs 호가 vs KB시세 in any price discussion
4. **Flag DSR first** whenever loan/affordability comes up
5. **Reference this skill's Tier 1/2/3 framework** when building elimination criteria

Load `references/elimination-criteria-template.md` when user wants to set up scoring/elimination for specific complexes.
