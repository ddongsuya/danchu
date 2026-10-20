# 단추 (Danchu) — 비임상 CRO 견적 중개 플랫폼

Next.js(App Router) + Supabase(DB·Auth·Storage) + Resend · Vercel 배포 · 반응형 웹(PWA 설치 가능)

## 흐름

```
의뢰자  가입(/signup) → /app/new 접수 ─→ [운영자 /admin 배포] ─→ CRO /q/{token} 또는 /cro 회신
        ─→ 의뢰자 /app 비교표(제출 즉시 표시, 기한 전 선정 가능)·CRO 선택 ─→ CRO /cro/awards 연락처·계약 보고 ─→ [운영자 종료]
        (기한 다음 날 cron 또는 운영자가 회신 마감 = compared_at, lib/reply-window.ts)
```

상태: `received → distributed → quoted → compared → selected → contracting → closed` (`cancelled`)

## 화면

| 영역 | 경로 | 설명 |
|---|---|---|
| 공개 | `/` `/about` `/faq` `/partners` `/for-cro` `/privacy` `/terms` | 랜딩. "견적 요청하기"는 로그인 전이면 가입(`/signup?next=/app/new`)으로, 확인 메일 버튼을 누르면 바로 위자드. 옛 `/rfq`는 가입으로 리다이렉트 |
| 인증 | `/login` `/signup` `/signup/cro` `/forgot` `/reset-password` `/auth/confirm` | 비밀번호 + 이메일 링크 로그인, 의뢰자 가입, CRO 가입 신청 |
| 의뢰자 | `/app` `/app/new` `/app/r/[no]` `/app/r/[no]/compare` `/app/r/[no]/q/[quoteId]` `/app/notifications` `/app/profile` | 내 요청·진행 타임라인·비교표·CRO 선택·알림 |
| CRO | `/cro` `/cro/r/[id]` `/cro/r/[id]/reply` `/cro/quotes` `/cro/awards` `/cro/org` | 받은 요청·회신·제출 목록·수주(연락처·계약 보고)·기관 정보 |
| CRO 토큰 | `/q/[token]` `/q/[token]/reply` | 로그인 없이 배포 메일 링크로 회신 |
| 운영자 | `/admin` `/admin/r/[no]` `/admin/cros` `/admin/awards` `/admin/users` | 접수 현황, 배포, 회신 마감·기한 연장, 종료·취소, CRO 승인, 역할 관리 |

`/app` `/cro` `/admin`은 로그인 필수([proxy.ts](proxy.ts)). 역할이 다르면 각자의 홈으로 보낸다. 운영자는 모든 영역을 볼 수 있다.

## 데이터 접근 원칙
모든 표는 RLS로 잠겨 있고 정책이 없다. 브라우저의 anon 키는 세션 쿠키 처리에만 쓰인다.
데이터는 서버가 세션 사용자를 확인한 뒤 service role로 읽고 쓴다 (`lib/auth.ts` → `lib/data.ts`).
표·함수 타입은 `lib/db-types.ts` 에 있고 클라이언트가 이 타입으로 묶여 있어 컬럼 오타와 잘못된 insert 값은 `npm run typecheck` 에서 잡힌다.
CRO 선택·회신 저장·계약 보고처럼 여러 표를 함께 고치는 전이는 Postgres 함수(`select_quote`, `save_quote`, `report_contract`, `lib/rpc.ts`)가 한 트랜잭션으로 처리한다.

## 로컬 실행
```bash
npm install
cp .env.example .env.local   # 키 입력
npm run dev                  # http://localhost:3000
npm run typecheck
npm test                     # Vitest (lib 순수 함수)
npm run test:db              # 실제 PostgreSQL 16 으로 마이그레이션·DB 함수 검사 (Docker 불필요, tests/db/README.md)
```
CI(GitHub Actions)는 push·PR마다 typecheck → test → build를 돌린다.

## Supabase 설정 (1회)
1. SQL Editor에서 `supabase/migrations/` 의 파일을 번호 순서대로 실행 (`0001_rfq.sql` → … → `0023_opt_in.sql`). 이미 운영 중인 DB 에 0019 이후를 올릴 때는 아래 "배포 순서"를 따른다. 새 마이그레이션은 다음 번호로 추가하고, 그 파일에서 `danchu_schema_version()` 을 새 번호로 바꾸고 `lib/schema-version.ts` 의 `REQUIRED_SCHEMA_VERSION` 과 `scripts/check-schema.mjs` 의 `REQUIRED` 도 올린다. 표를 바꾸면 `lib/db-types.ts` 도 함께 고친다
2. Storage에 비공개 버킷 `rfq-files`, `cro-files`가 있는지 확인 (스키마가 만들지만 없으면 직접 생성)
3. Authentication → Providers → Email: 켜 둔다. **Confirm email 켜짐** 유지 (가입 확인은 우리가 보내는 메일 링크로 처리)
   - Authentication → Sign In / Providers → **"Allow new users to sign up" 끄기**. 가입은 서버가 `auth.admin.createUser`로만 만든다. 켜 두면 anon 키로 직접 가입해 프로필을 만들 수 있다 (역할·기관은 어차피 서버만 적지만, 불필요한 계정이 생긴다)
4. Project Settings → API에서 `URL`, `anon`, `service_role` 키 → 환경변수

### 배포 순서 (0019 → 0023, 운영 DB 에 처음 올릴 때)
0019·0020·0021·0022·0023 은 서로 이어져 있고, 새 코드는 0023 까지 적용된 DB 를 전제로 한다. 코드와 DB 가 어긋난 채 돌면 회신 저장·선정·청구가 실패하고, 예전에는 배포 대상 조회 오류가 "맞는 기관 없음"으로 보였다. 지금은 DB 판이 모자라면 배포(`lib/distribute.ts`)가 멈추고 오류를 내며, 운영자 홈에 "운영 설정 확인" 경고가 뜬다. 순서는 다음과 같다.

1. **쓰기 중지.** 앱에는 점검 모드가 없으므로, 접수·회신·선정이 없는 시간을 고르고 매일 크론(09:00 KST, `vercel.json`) 시각을 피한다. 필요하면 Vercel 에서 프로젝트를 잠시 멈추거나(Pause) 배포 보호를 켜 외부 요청을 막는다. 시작 전에 DB 백업을 받아 둔다 (Supabase → Database → Backups).
2. **마이그레이션 적용.** SQL Editor 에서 `0019_concierge_mode.sql` → `0020_billing_rules.sql` → `0021_security_hardening.sql` → `0022_selection_integrity.sql` → `0023_opt_in.sql` 을 순서대로 하나씩 실행한다. 파일 하나는 한 트랜잭션으로 적용한다 (SQL Editor 실행 또는 `psql -1 -f 파일`). 문장마다 커밋되는 방식으로 돌리다 중간에 실패하면 판 번호는 올라갔는데 권한 정리 같은 뒷부분이 빠질 수 있다. 0022 는 0019~0021 이, 0023 은 0019~0022 가 빠졌으면 아무것도 바꾸지 않고 멈춘다.
3. **검증 (코드 배포 전).** 로컬에서 `npm run test:db` 가 모두 통과하는지 본다 (같은 SQL 을 빈 PostgreSQL 에 두 번씩 적용하고, 선정 경합·배포 순서·직접 접근 차단을 검사한다). 운영 DB 에는 `node --env-file=.env.local scripts/check-schema.mjs` (또는 환경변수를 넣고 `npm run check:schema`) 로 `DB 판 23` 이 나오는지 확인한다. 실패하면 코드를 배포하지 않는다.
4. **코드 배포.** `main` 에 올려 Vercel 이 배포하게 한다. 멈춘 프로젝트·배포 보호를 되돌린다.
5. **검증 (배포 뒤).** `npm run check:schema` 를 한 번 더 돌리고, `/admin` 에 "운영 설정 확인" 경고가 없는지, 시험 요청 1건이 기관에 배포되는지(배포 0곳이면 오류 기록부터 확인) 본다.

사이에 남는 틈: 0021 적용부터 코드 배포까지 옛 코드는 회신 저장(5개 인자 `save_quote`)과 선정(3개 인자 `select_quote`)이 실패하고, 0020 은 `cro_orgs.monthly_cap` 을 지워 옛 코드의 배포 대상 조회가 실패한다. 0023(참여 선택형)은 참여 기록이 없는 초대의 견적 저장을 막으므로, 참여 화면이 없는 옛 코드에서는 열린 초대(아직 작성 전)의 회신 저장이 실패한다 (작성 중·제출 초대는 전환되어 그대로 저장된다). 그래서 1번에서 쓰기를 멈추고 0023 과 참여 화면 코드를 함께 배포한다.

인증 메일(가입 확인·로그인 링크·비밀번호 재설정)은 Supabase SMTP가 아니라 **Resend로 보낸다**
(`auth.admin.generateLink` → `/auth/confirm`). Supabase 무료 SMTP의 시간당 발송 한도를 타지 않는다.

### 운영자 계정
운영자 권한은 DB의 `profiles.role`로만 정한다. 가입한 뒤 SQL로 지정하거나, 이미 운영자인 계정이 `/admin/users`에서 바꾼다:
```sql
update public.profiles set role = 'admin' where lower(email) = 'ops@example.com';
```
`ADMIN_EMAIL`은 운영자 알림 메일 수신 주소일 뿐 권한과 무관하다. 운영자 관리 기관(계정 없음)에 보내는 메일의 회신 주소는 `OPERATOR_REPLY_TO`(비우면 hello@danchu.kr)이며, 견적서 PDF와 계약 결과가 이 주소로 오므로 개인 메일함이 아닌 역할 주소를 쓴다.

### CRO 담당자 합류
같은 이름의 기관으로 CRO 가입 신청이 오면 계정은 만들되 기관에 연결하지 않는다 (`profiles.pending_org_id`).
운영자가 `/admin/cros/[id]`의 "담당자 합류 신청"에서 연결해야 그 기관의 요청서를 볼 수 있다.

## 환경변수
`.env.example` 참고. Vercel → Settings → Environment Variables에 넣고 Redeploy.
`NEXT_PUBLIC_SITE_URL`은 메일 속 링크의 기준 주소다.

운영(`NODE_ENV=production`)에서는 `lib/env.ts`의 `PROD_REQUIRED_ENV` 8개가 비어 있으면 기동 로그에 오류를 남기고 운영자 홈(`/admin`) 상단에 누락 목록을 띄운다. 로컬에서는 없어도 fallback으로 돈다.

## 운영
| 항목 | 어떻게 |
|---|---|
| 오류 모니터링 | `SENTRY_DSN`·`NEXT_PUBLIC_SENTRY_DSN`을 넣으면 서버·브라우저 오류가 Sentry로 간다(`instrumentation.ts`, `lib/observe.ts`). 없으면 콘솔 로그만 남고 `/admin`에 경고가 뜬다 |
| 예약 작업 | `/api/cron/daily` 매일 09:00 KST(`vercel.json`). 단계(보충 배포·리마인더·자동 회신·회신 마감·결과 문의)마다 오류를 격리하고, 실패한 단계가 있으면 운영자에게 앱 알림+메일을 보낸다. `CRON_SECRET`이 비어 있으면 500과 함께 운영자에게 알린다 |
| 메일 | Resend. 전송 예외는 한 번 재시도하고 실패해도 호출부를 끊지 않는다. 운영에서 `RESEND_FROM`이 비면 Resend 기본 발신자로만 나가 외부에 배달되지 않으므로 도메인 인증(SPF·DKIM·DMARC) 후 반드시 설정한다 |
| 첨부 한도 | 버킷 수준에서 20MB·허용 형식만 받는다(`0010`). 서버 검사는 메타데이터만 보므로 버킷 한도가 실제 방어선이다 |
| 백업 | Supabase Pro + PITR을 켠다. Storage 객체는 DB 백업에 포함되지 않으므로 `rfq-files`·`cro-files`를 주기적으로 외부에 복제한다. 출시 전 복구 리허설 1회 |
| 로그 | 이메일 주소는 마스킹(`maskEmail`), 요청서·문의 본문은 로그에 남기지 않는다 |
| 기관 중복·메일 추적 | 기관은 사업자번호(숫자만, `business_no_norm`)와 이름(소문자·공백 제거)에 unique. 가입 시 사업자번호 → 이름 순으로 기존 기관을 찾아 합류 신청으로 받고, 동시 가입은 DB 가 막는다. 승인된 기관의 이름·사업자번호는 운영자만 바꾼다. 배포 메일이 가면 `rfq_invites.mailed_at`, 안 갔으면 요청 상세에 "메일 미발송" 표시 + cron 이 3일 안에 재발송 |
| 운영자 목록·청구 | 요청·사용자·기관 목록은 `?q=` 검색과 50건 페이지(`lib/data.ts` `ADMIN_PAGE`). 운영자 알림은 종류 필터·페이지. 새 요청·회신 안 함도 운영자 메일. 청구 명세(`/admin/billing`, 0020): 청구 단위는 기관이 제출한 견적 1건(견적을 내지 않은 기관은 청구 없음, 재제출은 처음 제출한 달 `cro_quotes.first_submitted_at`에 한 번, 금액 없이 제출했으면 금액이 들어온 달 `cro_quotes.billing_at`에 청구). 견적 총액 1,000만 원 미만은 월 구독료(`cro_orgs.monthly_fee`, 구독 시작 월 `monthly_fee_from`부터 이번 달까지), 1,000만 원 이상은 건당 이용료(`per_request_fee`), 선정 견적 5,000만 원 이상이 체결(`contract_status = 'signed'`)되면 성사수수료(계약 금액 × `fee_rate`, 체결 확인한 달). 예상(선정 견적 × 요율)은 안내용. 기준 금액은 `lib/billing.ts`와 SQL `billing_tier()`가 같다. 운영자 관리 기관·대리 입력도 청구 대상, 허위·중복은 청구 제외(`rfq_invites.billable`, 성사수수료는 제외와 상관없이 잡고 "견적 청구 제외한 초대"로 표시). `CSV 내려받기`(`/api/admin/billing/export`), 월 마감(`close_billing_month`, 마감한 달은 저장본 `billing_periods.snapshot`으로 고정, 청구 토글 불가) |
| 기관 내 역할 | `profiles.org_role` owner/member. 기관을 처음 만든 계정이 owner. owner 만 기관 정보 수정(`/api/cro/org`), 합류 승인·거절·내보내기(`/api/cro/org/members`). 내보내면 그 기관의 열린 회신 링크가 새로 발급된다(`rotate_org_invite_tokens`). 대표 변경은 운영자가 SQL 로 |
| 익명화 | 선정 전 기관에는 회사명·연락처뿐 아니라 첨부 파일명도 "첨부 1 (PDF, 2.1MB)"로 보이고 다운로드 이름도 같다(`anonymousFileLabel`). 토큰 제출은 `cro_quotes.submitted_ip`·`submitted_ua` 를 남긴다 |
| 운영 기록 | `/admin/audit`. 기관 승인·반려·중지·약정 변경, 역할·기관 연결, 계정 삭제, 청구 제외, 기한 변경을 `admin_audit`에 남긴다(`lib/audit.ts`) |
| 자동 회신 | 출시 범위 밖. `DANCHU_AUTO_REPLY=1`일 때만 기관·운영자 화면에 토글이 보이고 cron 2단계가 돈다. 회신이 마감되면(`compared_at`) 미제출 기관의 링크도 닫힌다(`lib/quote-load.ts` `closed`). 기관을 중지하면 열린 초대가 만료된다 |
| 운영자 예외 처리 | 회신 0건으로 기한이 지난 요청: `/admin/r/[no]` 회신 현황의 "회신 기한 변경"(`POST …/deadline`)으로 늘린 뒤 재배포. 초대 한도는 살아 있는 초대만 센다(회신하지 않음·만료 제외, 0012 트리거). 수동 배포 때 "이후 자동 보충 안 함"을 켜면 cron·기관 승인이 그 요청에 기관을 더하지 않는다(`rfq_requests.auto_distribute`). 기관 월 구독료(구독 시작 월)·건당 이용료·성사수수료율·분야·대표 연락처·자동 회신은 `/admin/cros/[id]` 약정 카드(`PATCH /api/admin/cros/[id]`). 월 전달 한도는 없다(0020) |
| 회원 탈퇴·보존기간 | 프로필 → 회원 탈퇴(`/app/profile/delete`), 운영자는 `/admin/users`의 삭제. 둘 다 `lib/account.ts`가 진행 중 요청 취소 → 요청서 익명화(미선정 첨부 삭제) → `auth.admin.deleteUser` 순으로 처리한다. 운영자 계정과 선정 후 계약 진행 중인 의뢰자는 막힌다. cron 이 매일 접속 기록 90일·요청서 3년·읽은 알림 180일 기준으로 정리한다(`lib/retention.ts`, 개인정보처리방침 3항과 같은 값) |
| 운영 계정 | 2개 이상 두고, `ADMIN_EMAIL`에 운영자 메일을 모두 넣는다 |

## API 요약
| 경로 | 설명 |
|---|---|
| `POST /api/rfq` | 접수. JSON `{ payload, files:[{name,size,type}] }` → 서명 업로드 URL. 파일은 브라우저가 Storage로 직접 PUT |
| `GET/PUT/POST /api/quote/[token]` | CRO 회신 조회·초안 저장·제출. `POST …/upload-url` PDF 서명 URL, `POST …/decline` 회신 안 함 |
| `POST /api/rfq/[no]/select` | 의뢰자 CRO 선택 → `rfq_awards`, 양측 알림 |
| `POST /api/awards/[id]/contract` | CRO 계약 체결 보고 |
| `POST /api/admin/rfqs/[no]/distribute` · `/close-replies` · `/deadline` · `/status` | 배포(초대·메일), 회신 마감, 기한 변경(마감된 회신 다시 열기), 종료·취소·메모 |
| `POST /api/admin/cros/[id]` · `/api/admin/users/[id]` | CRO 승인·반려·중지, 역할·기관 연결 |
| `GET /api/files/[id]` · `/api/quotes/[id]/pdf` | 첨부·정본 PDF (권한 확인 후 서명 URL) |
| `/api/auth/*` | signup, signup-cro, login, magic, forgot, reset, logout, me |

파일을 서버로 보내지 않는 이유: Vercel 함수 요청 본문 한도가 4.5MB라서 20MB 첨부를 받을 수 없다.
접수 API는 로그인 필수이며 의뢰자 이메일은 항상 계정 이메일이다. 남용 방어: 숨은 허니팟 칸(`website`) + 공유 속도 제한(`rate_limit_hit` DB 함수, `lib/rate-limit.ts`). 인증 메일·문의 API도 같은 제한을 쓴다.
배포·기관 메일·접수 확인 메일은 응답 뒤(`after()`)에 보낸다.

## 폼 스키마 수정
`lib/rfq-schema.ts`의 `CONTACT` / `WIZ` / `STEP2` / `DETAILS` / `CATS`만 고치면 화면·검증·메일·CRO 회신 행이 함께 바뀐다.
디자인 토큰: `app/globals.css`(공개·인증), `components/shell/portal.css`(의뢰자·CRO·운영자 포털).

## 앱(PWA)
`app/manifest.ts` + `public/icons/`. 브라우저 "홈 화면에 추가"로 설치되며, 웹과 같은 코드가 돈다.
스토어 배포가 필요하면 이 URL을 감싸는 래퍼(예: Capacitor/TWA)를 붙인다.

## 아직 없는 것
- 푸시 알림(앱 내 알림·이메일은 동작). 웹 푸시는 설치 후 권한 흐름과 서버 키가 필요하다.
- CDA 전자서명 흐름(현재는 메일로 요청). 첨부 비공개 해제는 운영자가 기밀 등급을 바꾸는 방식(신원은 선정 시에만 공개).
- 비교표 PDF 내보내기. 화면과 정본 PDF 링크로 대체.
