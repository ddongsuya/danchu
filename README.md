# 단추 (Danchu) — 비임상 CRO 견적 중개 플랫폼 MVP

Next.js(App Router) + Supabase + Resend · Vercel 배포

## 화면

### 실제 동작 (공개)
- `/` 랜딩
- `/rfq` 견적 요청 폼 — 담당자 정보(순차 노출 6) → 위자드(한 화면 한 질문 12) → 상세 조건(선택)
- `/rfq/complete?no=DC-2026-0001` 접수 완료
- `/app/cro/r/[token]` CRO 요청서 열람 · `/app/cro/r/[token]/reply` 견적 회신 (로그인 없음, 토큰이 인증)
- `/privacy`, `/terms`

### 데모 (비밀번호 뒤)
`/app` 아래 나머지 화면(의뢰자 홈·비교표·CRO 받은 요청 등)은 예시 데이터로 만든 프로토타입이다.
`APP_DEMO_PASSWORD`를 설정하면 [proxy.ts](proxy.ts)가 `/app/login`에서 비밀번호를 받은 브라우저에만 열어 준다.
CRO 토큰 링크(`/app/cro/r/*`)와 로그인 화면은 예외. 비워 두면 제한 없음(로컬용).

## API
| 경로 | 설명 |
|---|---|
| `POST /api/rfq` | 접수. JSON `{ payload, files:[{name,size,type}] }` → `{ rfqNo, uploads:[{name,path,signedUrl}] }`. 파일 본문은 브라우저가 `signedUrl`로 Storage에 직접 PUT |
| `GET/PUT/POST /api/quote/[token]` | CRO 회신 조회 · 초안 저장 · 제출(JSON, `pdf:{path,name,size}` 참조) |
| `POST /api/quote/[token]/upload-url` | 정식 견적서 PDF 서명 업로드 URL 발급 |
| `POST /api/support` | 앱 문의 → 운영자 메일 |
| `POST /api/demo-login` | 데모 비밀번호 확인 → 쿠키 |

파일을 서버로 보내지 않는 이유: Vercel 함수 요청 본문 한도가 4.5MB라서 20MB 첨부를 받을 수 없다.

접수 API 남용 방어: 숨은 허니팟 칸(`website`) + IP당 10분 5건 속도 제한(인스턴스 단위).

## 로컬 실행
```bash
npm install
cp .env.example .env.local   # 키 입력
npm run dev                  # http://localhost:3000
npm run typecheck
```

## Supabase 설정 (1회)
1. 프로젝트 생성 → SQL Editor에 `supabase/schema.sql` 실행
   - `rfq_requests`, `rfq_files`, `rfq_counters`, 함수 `next_rfq_no`, 버킷 `rfq-files`
2. 이어서 `supabase/schema_cro.sql` 실행
   - `rfq_invites`(토큰 링크), `cro_quotes`, `cro_quote_items`, `cro_quote_addons`, `rfq_awards`, 버킷 `cro-files`
3. Project Settings → API에서 `URL`, `service_role` 키 복사 → 환경변수

### CRO에 배포하기 (아직 수동)
운영자 화면이 없어 SQL Editor에서 초대 행을 넣는다. 토큰이 곧 회신 링크다.
```sql
insert into rfq_invites (rfq_id, rfq_no, cro_name, cro_email, reply_by, expires_at)
select id, rfq_no, 'CRO명', 'cro@example.com', '2026-09-20', '2026-09-27'
from rfq_requests where rfq_no = 'DC-2026-0001'
returning token;   -- https://danchu.kr/app/cro/r/{token}
```
`expires_at`이 지나면 열람만 가능, 제출 후 `reply_by`가 지나면 수정 불가.

## Resend 설정
1. API 키 발급 → `RESEND_API_KEY`
2. 도메인(danchu.kr) 인증 후 `RESEND_FROM=단추 <hello@danchu.kr>`
   - 인증 전에는 `onboarding@resend.dev`로만 발신되고, Resend 가입 메일 주소로만 수신됨
3. `ADMIN_EMAIL`에 운영자 메일 (쉼표로 여러 개)

## Vercel 환경변수
Project → Settings → Environment Variables에 `.env.example`의 변수를 넣고 Redeploy.
키가 없어도 배포는 동작하며, 이때 접수는 임시 번호(DC-YYYY-9xxx)로 응답하고 서버 로그에만 기록된다(데모 모드).

## 폼 스키마 수정
`lib/rfq-schema.ts`의 `CONTACT` / `WIZ` / `STEP2` / `DETAILS` / `CATS` 만 고치면 화면·검증·메일·CRO 회신 행이 함께 바뀐다.
디자인 토큰은 `app/globals.css` 상단 `:root`(웹), `app/app/app.css`의 `.mob`(앱).

## 아직 없는 것
- 의뢰자 계정(로그인) — `/app/new`는 계정 정보를 전제로 하므로 로그인 연동 전에는 웹 폼(`/rfq`)만 공개
- 운영자 화면: RFQ 배포(초대 생성·CRO 메일), 비교표 생성·발송
- CRO 선택(수주) 저장, GLP 대응 자동 판정(`lib/quote-items.ts`의 `glpCoverage`는 준비만 됨)
