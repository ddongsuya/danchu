---
name: replica-backend
description: >-
  Builds the backend of an app clone: auth, database migrations and access
  rules, payments with Stripe, email, background jobs and third-party
  integrations through official APIs only, plus a security checklist. Use when
  the user says "add login", "set up auth", "wire up the database", "add
  payments", "connect Stripe", "add Google Calendar", "send emails",
  "backend for my clone", or when /replica-build is running on fake data.
---

> **단추에서 쓸 때 (이 블록이 아래 원문보다 우선)**
> - 단추는 이미 운영 중인 서비스다. 이 묶음은 "앱 복제"가 아니라 **다른 서비스의 흐름·화면 구조를 분석해 단추에 맞게 다시 만드는 데**만 쓴다. 원본의 코드·로고·문구·이미지는 가져오지 않는다(원문 규칙과 같다).
> - 산출물 폴더 `replica/`는 커밋하지 않는다(.gitignore). 남의 화면 캡처는 절대 커밋하지 않는다. 사용자에게 줄 결과는 `/mnt/project-files/danchu-replica/`에 둔다.
> - CLAUDE.md, DESIGN.md가 이 스킬보다 우선한다: Tailwind 미사용(CSS 변수), 단추 중립, 브랜드 색 고정, 해요체/합니다체 규칙.
> - 국내 CRO 사이트 스크래핑 금지. 사내 자료(csco-tech-knowledge)의 단가·기간을 화면·테스트 데이터에 쓰지 않는다.
> - 단추 백엔드는 이미 있다. 결제는 사업자 등록 전이라 Stripe·PG를 붙이지 않는다(계좌 이체 + 운영자 입금 확인). 보안 점검표 부분만 참고한다.
> - 출처와 고친 내용: 이 폴더의 SOURCE.md.

# replica-backend

Reads `replica/architecture.md`. Writes migrations and server code, and keeps
`replica/backend.md` (checklist below) up to date.

## The rules

- **Official, public APIs only, with the user's own keys.** Never call the
  original app's private endpoints, never reuse its OAuth client, never proxy
  through it.
- **The user creates accounts and keys.** Claude never signs up for services,
  never types a password, card or live key. The user creates the Stripe,
  Supabase, Resend or Google Cloud project and puts keys in `.env.local`.
  Claude writes `.env.example` with every variable name and no values.
- **Test mode first.** Stripe test keys and test cards until replica-deploy.

## Auth

- Email sign up with verification, password reset, magic link if the original
  has it. OAuth (Google, Apple) with the user's own developer apps.
- Sessions: http-only secure cookies. Sign out everywhere.
- Roles and teams if the recon map has them: owner, admin, member, with one
  function that answers "can this user do this to this record".
- Account deletion that actually deletes. Apple requires it for apps with
  sign up.

## Database

- Migrations from `architecture.md`, checked in, run by a script.
- Access rules on every table: row level security policies on Supabase, or
  the authorisation function called in every query. Test it: a second user
  must get nothing back.
- Seed script with realistic fake data (no real people).
- Backups on (the host's daily backups count, check they are enabled).

## Payments

- Stripe Checkout for sign up to a plan, the Customer Portal for changes and
  cancelling. Do not build card forms.
- Webhooks: verify the signature, store the event id, make every handler
  idempotent (Stripe retries). Handle `checkout.session.completed`,
  `customer.subscription.updated`, `customer.subscription.deleted`,
  `invoice.payment_failed`.
- Subscription status lives in your database, updated by webhooks, read by
  your app. Never trust the client.
- Cancelling is one click. Hard-to-cancel billing is a top complaint about
  most apps, and in many places it is illegal.

## Email and jobs

- Transactional email through Resend or Postmark from your own domain.
  Templates written fresh.
- Jobs for anything time-based (reminders, digests, sync, cleanup) with
  retries and a dead-letter log. Times in UTC, shown in the user's zone.

## Integrations

For each integration in the feature matrix: the official API, the OAuth
scopes needed (fewest possible), the provider's review process, rate limits.
Google scopes like Calendar need Google's OAuth verification before public
launch, which takes weeks. Start it early and write that in `backend.md`.

## Security checklist

- [ ] secrets only in env vars, `.env*` in `.gitignore`, nothing in client bundles
- [ ] input validated on the server (zod or similar) on every route
- [ ] authorisation checked on every read and write, tested with a second user
- [ ] rate limits on auth, sign up, and anything that sends email or SMS
- [ ] webhooks verify signatures
- [ ] uploads: size and type limits, served from a separate domain or bucket
- [ ] no user data in URLs or logs
- [ ] dependencies audited (`npm audit`)
- [ ] privacy policy lists every processor (Stripe, Resend, host, analytics)

## Output

Working auth, database, payments in test mode, email and the integrations,
`.env.example`, `replica/backend.md` with the checklist ticked, feature
matrix rows updated. Next: `/replica-test`.
