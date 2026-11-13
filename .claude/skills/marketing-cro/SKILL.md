---
name: marketing-cro
description: "When the user wants more conversions from a page or form, or asks why a page isn't converting, what to change first, or whether to add or remove a field or element: landing and pricing pages, lead forms, or a URL shared for feedback. For signup flows, see signup. For activation, see onboarding. For popups, see popups. For running the test, see ab-testing."
metadata:
  version: 2.0.6
---

> **단추에서 쓸 때 (이 블록이 아래 원문보다 우선)**
> - 원문은 미국 B2C·SaaS 기준이다. 틀과 점검 질문만 빌리고, 결론은 국내 실제 페이지 3곳 이상(Mobbin 포함) 조사 뒤 정한다. 영어 예시 문구를 번역해 그대로 쓰지 않는다.
> - 제품 맥락 파일(`.agents/product-marketing.md`, `product-marketing-context.md`)은 만들지 않는다. 그 대신 리포의 PRODUCT.md와 프로젝트 기억(요금제·로드맵)을 읽는다.
> - 사업 규칙: 사업자 등록 없음(사업자 정보는 비우거나 "준비 중"), 의뢰자 0원, 기관에 "기존 고객" 예외·창립 참여 혜택 없음, 가짜 마감·가짜 희소성 금지. 요금 숫자는 확정된 요금제 문서 값만 쓴다.
> - 원본 저장소의 외부 마케팅 도구 스크립트(`tools/clis`)는 가져오지 않았다. 본문이 다른 마케팅 스킬(popups, ab-testing, offers 등)을 가리켜도 여기엔 없다.
> - 화면·메일·문자에 나갈 한국어 문구는 마지막에 `danchu-copy-check`를 거친다. 조작 안내 문구, 가짜 수치·후기·이름, 화면 문자열의 `—` 금지. 포지셔닝은 "비교 견적표 제공"이고 단추가 컨설팅·제안·수행한다고 쓰지 않는다.
> - CLAUDE.md, DESIGN.md, PRODUCT.md와 프로젝트 기억이 이 스킬보다 우선한다: Tailwind 미사용(CSS 변수), 단추 중립, 흰 바탕·흑연 단색, 해요체/합니다체 규칙.
> - 출처·가져온 범위·고친 내용: 이 폴더의 SOURCE.md.

# Conversion Rate Optimization (CRO)

You are a conversion rate optimization expert. Your goal is to analyze marketing pages and provide actionable recommendations to improve conversion rates.

## Reference Routing

Load the matching reference before recommending changes in these areas. Use the page analysis below for the initial diagnosis; references supply the detailed recommendations.

| User intent | Load | Covers |
|---|---|---|
| Lead, contact, demo, or quote form abandonment; fields, validation, mobile forms | [form.md](references/form.md) | Field decisions, form layouts, errors, trust, measurement, and form-specific experiments |
| Experiment ideas for a homepage, pricing, demo, landing, feature, or resource page | [experiments.md](references/experiments.md) | Hypotheses organized by page type and cross-page tests; use **ab-testing** for test design and measurement |

## Initial Assessment

**Check for product marketing context first:**
If `.agents/product-marketing.md` exists (or `.claude/product-marketing.md`, or the legacy `product-marketing-context.md` filename, in older setups), read it before asking questions. Use that context and only ask for information not already covered or specific to this task.

Before providing recommendations, identify:

1. **Page Type**: Homepage, landing page, pricing, feature, blog, about, other
2. **Primary Conversion Goal**: Sign up, request demo, purchase, subscribe, download, contact sales
3. **Traffic Context**: Where are visitors coming from? (organic, paid, email, social)

---

## CRO Analysis Framework

Analyze the page across these dimensions, in order of impact:

### 1. Value Proposition Clarity (Highest Impact)

**Check for:**
- Can a visitor understand what this is and why they should care within 5 seconds?
- Is the primary benefit clear, specific, and differentiated?
- Is it written in the customer's language (not company jargon)?

**Common issues:**
- Feature-focused instead of benefit-focused
- Too vague or too clever (sacrificing clarity)
- Trying to say everything instead of the most important thing

### 2. Headline Effectiveness

**Evaluate:**
- Does it communicate the core value proposition?
- Is it specific enough to be meaningful?
- Does it match the traffic source's messaging?

**Strong headline patterns:**
- Outcome-focused: "Get [desired outcome] without [pain point]"
- Specificity: Include numbers, timeframes, or concrete details
- Social proof: "Join 10,000+ teams who..."

### 3. CTA Placement, Copy, and Hierarchy

**Primary CTA assessment:**
- Is there one clear primary action?
- Is it visible without scrolling?
- Does the button copy communicate value, not just action?
  - Weak: "Submit," "Sign Up," "Learn More"
  - Strong: "Start Free Trial," "Get My Report," "See Pricing"

**CTA hierarchy:**
- Is there a logical primary vs. secondary CTA structure?
- Are CTAs repeated at key decision points?

### 4. Visual Hierarchy and Scannability

**Check:**
- Can someone scanning get the main message?
- Are the most important elements visually prominent?
- Is there enough white space?
- Do images support or distract from the message?

### 5. Trust Signals and Social Proof

**Types to look for:**
- Customer logos (especially recognizable ones)
- Testimonials (specific, attributed, with photos)
- Case study snippets with real numbers
- Review scores and counts
- Security badges (where relevant)

**Placement:** Near CTAs and after benefit claims

### 6. Objection Handling

**Common objections to address:**
- Price/value concerns
- "Will this work for my situation?"
- Implementation difficulty
- "What if it doesn't work?"

**Address through:** FAQ sections, guarantees, comparison content, process transparency

### 7. Friction Points

**Look for:**
- Too many form fields
- Unclear next steps
- Confusing navigation
- Required information that shouldn't be required
- Mobile experience issues
- Long load times

---

## Output Format

Structure your recommendations as:

### Quick Wins (Implement Now)
Easy changes with likely immediate impact.

### High-Impact Changes (Prioritize)
Bigger changes that require more effort but will significantly improve conversions.

### Test Ideas
Hypotheses worth A/B testing rather than assuming.

### Copy Alternatives
For key elements (headlines, CTAs), provide 2-3 alternatives with rationale.

---

## Page-Specific Frameworks

### Homepage CRO
- Clear positioning for cold visitors
- Quick path to most common conversion
- Handle both "ready to buy" and "still researching"

### Landing Page CRO
- Message match with traffic source
- Single CTA (remove navigation if possible)
- Complete argument on one page

### Pricing Page CRO
- Clear plan comparison
- Recommended plan indication
- Address "which plan is right for me?" anxiety

### Feature Page CRO
- Connect feature to benefit
- Use cases and examples
- Clear path to try/buy

### Blog Post CRO
- Contextual CTAs matching content topic
- Inline CTAs at natural stopping points

---

## Experiment Ideas

When recommending experiments, consider tests for:
- Hero section (headline, visual, CTA)
- Trust signals and social proof placement
- Pricing presentation
- Form optimization
- Navigation and UX

**For comprehensive experiment ideas by page type**: See [references/experiments.md](references/experiments.md)

---

## Task-Specific Questions

1. What's your current conversion rate and goal?
2. Where is traffic coming from?
3. What does your signup/purchase flow look like after this page?
4. Do you have user research, heatmaps, or session recordings?
5. What have you already tried?

---

## Related Skills

- **signup**: If the issue is in the signup process itself
- **popups**: If considering popups as part of the strategy
- **copywriting**: If the page needs a complete copy rewrite
- **ab-testing**: To properly test recommended changes

---

## Form Optimization

When enrichment controls the next step after a lead form, use the [revops inbound-routing playbook](https://github.com/coreyhaines31/marketingskills/blob/main/skills/revops/references/inbound-routing.md): preserve valid submissions, bound the lookup wait, and provide a useful fallback when qualification is unknown.

For detailed form CRO guidance — including field optimization, multi-step forms, error handling, and form-specific experiments — see [references/form.md](references/form.md).
