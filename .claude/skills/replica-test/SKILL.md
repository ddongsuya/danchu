---
name: replica-test
description: >-
  Clicks through every flow of an app clone and tests it for bugs: a test plan
  generated from the recon flows with happy paths and edge cases, Playwright
  end-to-end tests where possible, a browser click-through where not, and bug
  reports in a fixed format with severity, steps and evidence. Use when the
  user says "test my clone", "find bugs", "QA this", "click through
  everything", "write e2e tests", "does it work", or after /replica-build or
  /replica-backend.
---

> **단추에서 쓸 때 (이 블록이 아래 원문보다 우선)**
> - 단추는 이미 운영 중인 서비스다. 이 묶음은 "앱 복제"가 아니라 **다른 서비스의 흐름·화면 구조를 분석해 단추에 맞게 다시 만드는 데**만 쓴다. 원본의 코드·로고·문구·이미지는 가져오지 않는다(원문 규칙과 같다).
> - 산출물 폴더 `replica/`는 커밋하지 않는다(.gitignore). 남의 화면 캡처는 절대 커밋하지 않는다. 사용자에게 줄 결과는 `/mnt/project-files/danchu-replica/`에 둔다.
> - CLAUDE.md, DESIGN.md가 이 스킬보다 우선한다: Tailwind 미사용(CSS 변수), 단추 중립, 브랜드 색 고정, 해요체/합니다체 규칙.
> - 국내 CRO 사이트 스크래핑 금지. 사내 자료(csco-tech-knowledge)의 단가·기간을 화면·테스트 데이터에 쓰지 않는다.
> - 테스트 대상은 단추뿐이다. Playwright는 설치된 것을 쓰고 `playwright install`은 하지 않는다. 1440·390 두 폭으로 확인한다. 운영 DB에 테스트 데이터를 넣지 않는다.
> - 출처와 고친 내용: 이 폴더의 SOURCE.md.

# replica-test

Reads the flows in `replica/recon.md`. Writes `replica/test-plan.md`,
`replica/bugs.md`, and end-to-end tests in the project (`e2e/`). Templates in
this folder: `test-plan.md`, `bug-report.md`, `e2e.example.spec.ts`.

## The rule

**Test your clone, not the original.** Never load test, fuzz, script or
hammer the original app's servers. Using the original by hand, as a normal
user, to see how it behaves is fine.

## Step 1: the plan

For every flow F01, F02... in the recon map, write:

- **Happy path**: the steps, and what the user should see at the end.
- **Edge cases** that apply. Go down this list for every flow:
  empty input, very long input, emoji and accents, two tabs at once,
  double click on submit, back button mid-flow, refresh mid-flow, slow
  network, offline, expired session, second user's data (must be invisible),
  time zones and daylight saving, mobile width, keyboard only, screen reader
  labels.
- **Negative cases**: wrong password, card declined (Stripe test card
  `4000 0000 0000 0002`), permission denied, deleted record.

Number every case: F01-H1, F01-E3, F01-N2.

## Step 2: automate what you can

Playwright, one spec per flow, against the local dev server with seed data.
Use roles and labels for selectors (`getByRole('button', { name: 'Book' })`),
never CSS classes. See `e2e.example.spec.ts`.

```bash
npm i -D @playwright/test && npx playwright install chromium
npx playwright test
```

Add to every spec: fail on console errors, fail on any 5xx response, and an
axe accessibility scan (`@axe-core/playwright`) on each screen.

## Step 3: click through the rest

What cannot be automated (emails arriving, OAuth with real providers,
payments end to end, visual glitches) gets a manual pass. If a browser tool is
available, drive the local clone with it and screenshot each step. Otherwise
give the user the checklist and wait for answers.

## Step 4: report bugs

Every bug goes in `replica/bugs.md` in the `bug-report.md` format: an ID, a
severity, exact steps, expected, actual, evidence. Severity:

| | means |
| --- | --- |
| S1 | data loss, security hole, payments wrong, core flow blocked |
| S2 | a feature broken, no workaround |
| S3 | broken with a workaround, or visibly wrong |
| S4 | cosmetic |

Only report what you reproduced. "Might be an issue" goes in a separate
"to check" list.

## Step 5: fix loop

Fix S1 and S2 first. For every fix: write the failing test first, fix, watch
it pass, keep the test. Re-run the whole suite after each batch. Update
`bugs.md` with the commit that fixed each one.

## Output

`test-plan.md`, the specs, `bugs.md`, and a summary: cases run, passed,
failed, bugs by severity, fixed so far. Ship nothing with an open S1. Next:
`/replica-diff`.
