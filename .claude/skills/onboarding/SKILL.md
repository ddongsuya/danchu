---
name: onboarding
description: "When the user wants better onboarding and activation, or asks why new users don't stick or what the first session should do: first-run experience, aha moments, checklists, empty states, time to value. For the signup flow itself, see signup. For onboarding emails, see emails."
metadata:
  version: 2.0.5
---

> **단추에서 쓸 때 (이 블록이 아래 원문보다 우선)**
> - 원문은 미국 B2C·SaaS 기준이다. 틀과 점검 질문만 빌리고, 결론은 국내 실제 페이지 3곳 이상(Mobbin 포함) 조사 뒤 정한다. 영어 예시 문구를 번역해 그대로 쓰지 않는다.
> - 제품 맥락 파일(`.agents/product-marketing.md`, `product-marketing-context.md`)은 만들지 않는다. 그 대신 리포의 PRODUCT.md와 프로젝트 기억(요금제·로드맵)을 읽는다.
> - 사업 규칙: 사업자 등록 없음(사업자 정보는 비우거나 "준비 중"), 의뢰자 0원, 기관에 "기존 고객" 예외·창립 참여 혜택 없음, 가짜 마감·가짜 희소성 금지. 요금 숫자는 확정된 요금제 문서 값만 쓴다.
> - 원본 저장소의 외부 마케팅 도구 스크립트(`tools/clis`)는 가져오지 않았다. 본문이 다른 마케팅 스킬(popups, ab-testing, offers 등)을 가리켜도 여기엔 없다.
> - 화면·메일·문자에 나갈 한국어 문구는 마지막에 `danchu-copy-check`를 거친다. 조작 안내 문구, 가짜 수치·후기·이름, 화면 문자열의 `—` 금지. 포지셔닝은 "비교 견적표 제공"이고 단추가 컨설팅·제안·수행한다고 쓰지 않는다.
> - CLAUDE.md, DESIGN.md, PRODUCT.md와 프로젝트 기억이 이 스킬보다 우선한다: Tailwind 미사용(CSS 변수), 단추 중립, 흰 바탕·흑연 단색, 해요체/합니다체 규칙.
> - 출처·가져온 범위·고친 내용: 이 폴더의 SOURCE.md.

# Onboarding CRO

You are an expert in user onboarding and activation. Your goal is to help users reach their "aha moment" as quickly as possible and establish habits that lead to long-term retention.

## Initial Assessment

**Check for product marketing context first:**
If `.agents/product-marketing.md` exists (or `.claude/product-marketing.md`, or the legacy `product-marketing-context.md` filename, in older setups), read it before asking questions. Use that context and only ask for information not already covered or specific to this task.

Before providing recommendations, understand:

1. **Product Context** - What type of product? B2B or B2C? Core value proposition?
2. **Activation Definition** - What's the "aha moment"? What action indicates a user "gets it"?
3. **Current State** - What happens after signup? Where do users drop off?

---

## Core Principles

### 1. Time-to-Value Is Everything
Remove every step between signup and experiencing core value. Design the **Minimum Path to Value (MPTV)** — the least number of steps to experience enough value to make a confident decision (see [references/minimum-path-to-value.md](references/minimum-path-to-value.md)).

### 2. One Goal Per Session
Focus first session on one successful outcome. Save advanced features for later.

### 3. Do, Don't Show
Interactive > Tutorial. Doing the thing > Learning about the thing.

### 4. Progress Creates Motivation
Show advancement. Celebrate completions. Make the path visible. (See onboarding psychology below for the mechanisms.)

---

## Onboarding Psychology

The principles that make progress mechanics, checklists, and prompts actually work:

- **Endowed Progress Effect** — people finish faster when progress is already started for them. A checklist that opens at "20% done" (a step pre-completed on their behalf) drives roughly **+40% completion** vs. starting at 0%. Give users a head start, don't make them start from nothing.
- **Peak-End Rule** — users remember an experience by its most intense moment (the *peak*) and its *end*, not the average. Engineer a clear high point (a win, a wow, a celebration) and end each session on a positive note.
- **Goldilocks Rule** — motivation peaks when a task is neither too easy nor too hard, but *just right* on the edge of ability. Tune early steps so they're achievable but not trivial.
- **BJ Fogg Behavior Model** — a behavior happens only when **Motivation × Ability × Prompt** converge at the same moment. If a step isn't happening, one of the three is missing: raise motivation, make it easier (Ability), or add a better-timed Prompt.
- **Mario Kart boosters & blockers** (Ramli John) — treat onboarding like a race track. Add **boosters** (accelerants: pre-filled data, templates, quick wins, celebrations) and remove **blockers** (friction: required fields, dead ends, confusing empty states). Speed users toward value and clear obstacles from the lane.

## Onboarding Toolkit (10 Components)

The components you assemble an onboarding experience from. Use the fewest that reach value:

| Component | Purpose |
|-----------|---------|
| Welcome forms | Capture role/goal to personalize the path (keep short — Hick's Law) |
| Initial screens | First-run screens that orient and point to one clear action |
| Drip emails | Multi-touch nurture — **one concept per email**, don't overload |
| Skippable tutorials | Optional guidance users can bypass — never trap them |
| Videos | Show complex workflows visually |
| Docs / help center | Self-serve reference for when users get stuck |
| Onboarding calls | Human touch for complex or high-value accounts |
| Data inputs | Getting the user's real data in so value feels "real" |
| Checklists | Ordered, value-first steps with visible progress (see below) |
| Empty states | Guided first-action opportunities, not dead ends (see below) |

---

## Defining Activation

**Judge activation by lead→customer conversion + 90-day retention, not lead volume.** More signups mean nothing if they don't convert and stick.

Choose an **activation model** (freemium, free trial, paid trial, money-back, consultation) before designing the flow — the model shapes the whole onboarding path. See [references/activation-models.md](references/activation-models.md) for the 5 models, the credit-card tradeoff, Model-Market Fit, and the Evernote-vs-Notion parable.

### Find Your Aha Moment

Find early value actions associated with later retention, using a defined cohort and timeline:

1. Define signup as time zero, an early activation window, and a separate retention outcome after the activation window. For example, first-seven-day actions and return activity in week four; choose windows that fit the product cadence.
2. Include all eligible signups with full follow-up through the retention window. Show recent, immature cohorts separately; do not count them as churned or restrict the denominator to users who already activated.
3. Compare actions recorded within the early window. Exclude behavior during the retention outcome window: a week-four return cannot also be the early activation predictor of week-four retention.
4. Treat high-correlation events and frequency thresholds as candidate hypotheses. Report counts, uncertainty, and acquisition/product segments; confirm the definition on a later mature cohort before adopting it.
5. Test whether an onboarding intervention improves later retention or customer conversion. Correlation alone does not prove that forcing the action causes retention.

[Amplitude's Compass setup](https://amplitude.com/docs/analytics/charts/compass/compass-aha-moment) separates early actions from later retention and requires time for every cohort member to retain; its [interpretation guide](https://amplitude.com/docs/analytics/charts/compass/compass-interpret-1) distinguishes correlation from causation.

**Examples by product type:**
- Project management: Create first project + add team member
- Analytics: Install tracking + see first report
- Design tool: Create first design + export/share
- Marketplace: Complete first transaction

### Activation Metrics
- % of signups who reach activation
- Time to activation
- Steps to activation
- Activation by cohort/source

---

## Onboarding Flow Design

### Immediate Post-Signup (First 30 Seconds)

| Approach | Best For | Risk |
|----------|----------|------|
| Product-first | Simple products, B2C, mobile | Blank slate overwhelm |
| Guided setup | Products needing personalization | Adds friction before value |
| Value-first | Products with demo data | May not feel "real" |

**Whatever you choose:**
- Clear single next action
- No dead ends
- Progress indication if multi-step

### Onboarding Checklist Pattern

**When to use:**
- Multiple setup steps required
- Product has several features to discover
- Self-serve B2B products

**Best practices:**
- 3-7 items (not overwhelming)
- Order by value (most impactful first)
- Start with quick wins
- Progress bar/completion %
- Celebration on completion
- Dismiss option (don't trap users)

### Empty States

Empty states are onboarding opportunities, not dead ends.

**Good empty state:**
- Explains what this area is for
- Shows what it looks like with data
- Clear primary action to add first item
- Optional: Pre-populate with example data

### Tooltips and Guided Tours

**When to use:** Complex UI, features that aren't self-evident, power features users might miss

**Best practices:**
- Max 3-5 steps per tour
- Dismissable at any time
- Don't repeat for returning users

---

## Multi-Channel Onboarding

### Email + In-App Coordination

**Trigger-based emails:**
- Welcome email (immediate)
- Incomplete onboarding (24h, 72h)
- Activation achieved (celebration + next step)
- Feature discovery (days 3, 7, 14)

**Email should:**
- Reinforce in-app actions, not duplicate them
- Drive back to product with specific CTA
- Be personalized based on actions taken

---

## Handling Stalled Users

### Detection
Define "stalled" criteria (X days inactive, incomplete setup)

### Re-engagement Tactics

1. **Email sequence** - Reminder of value, address blockers, offer help
2. **In-app recovery** - Welcome back, pick up where left off
3. **Human touch** - For high-value accounts, personal outreach

---

## Measurement

### Key Metrics

| Metric | Description |
|--------|-------------|
| Activation rate | % reaching activation event |
| Time to activation | How long to first value |
| Onboarding completion | % completing setup |
| Day 1/7/30 retention | Return rate by timeframe |

### Funnel Analysis

Track drop-off at each step:
```
Signup → Step 1 → Step 2 → Activation → Retention
100%      80%       60%       40%         25%
```

Identify biggest drops and focus there.

---

## Output Format

### Onboarding Audit
For each issue: Finding → Impact → Recommendation → Priority

### Onboarding Flow Design
- Activation goal
- Step-by-step flow
- Checklist items (if applicable)
- Empty state copy
- Email sequence triggers
- Metrics plan

---

## Common Patterns by Product Type

| Product Type | Key Steps |
|--------------|-----------|
| B2B SaaS | Setup wizard → First value action → Team invite → Deep setup |
| Marketplace | Complete profile → Browse → First transaction → Repeat loop |
| Mobile App | Permissions → Quick win → Push setup → Habit loop |
| Content Platform | Follow/customize → Consume → Create → Engage |

---

## Experiment Ideas

When recommending experiments, consider tests for:
- Flow simplification (step count, ordering)
- Progress and motivation mechanics
- Personalization by role or goal
- Support and help availability

**For comprehensive experiment ideas**: See [references/experiments.md](references/experiments.md)

---

## References

- **[references/minimum-path-to-value.md](references/minimum-path-to-value.md)** — MPTV, Hick's Law, the inventory→remove→reconstruct process, abandonment benchmarks (40–60% after one session; 75–80% within day one), and patterns (Stripe, Calendly, Notion).
- **[references/activation-models.md](references/activation-models.md)** — the 5 activation models, credit-card tradeoff, Model-Market Fit, Evernote vs. Notion.
- **[references/experiments.md](references/experiments.md)** — comprehensive A/B test and experiment ideas.

---

## Task-Specific Questions

1. Which early action predicts later retention, using what activation window and fully observed signup cohort?
2. What happens immediately after signup?
3. Where do users currently drop off?
4. What's your activation rate target?
5. Do you have cohort analysis on successful vs. churned users?

---

## Related Skills

- **signup**: For optimizing the signup before onboarding
- **emails**: For onboarding email series
- **paywalls**: For converting to paid during/after onboarding
- **ab-testing**: For testing onboarding changes
