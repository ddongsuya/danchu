# 단추 (Danchu) — 비임상 CRO 견적 중개 플랫폼

Next.js(App Router) + Supabase(DB·Auth·Storage) + Resend · Vercel 배포 · 반응형 웹(PWA 설치 가능)

## 흐름

```
의뢰자  가입(/signup) → /app/new 접수 ─→ [운영자 /admin 배포] ─→ CRO /q/{token} 또는 /cro 회신
        ─→ [운영자 비교표 공개] ─→ 의뢰자 /app 비교표·CRO 선택 ─→ CRO /cro/awards 연락처·계약 보고 ─→ [운영자 종료]
```

상태: `received → distributed → quoted → compared → selected → contracting → closed` (`cancelled`)

## 화면

| 영역 | 경로 | 설명 |
|---|---|---|
| 공개 | `/` `/privacy` `/terms` | 랜딩. "견적 요청하기"는 로그인 전이면 가입(`/signup?next=/app/new`)으로, 확인 메일 버튼을 누르면 바로 위자드. 옛 `/rfq`는 가입으로 리다이렉트 |
| 인증 | `/login` `/signup` `/signup/cro` `/forgot` `/reset-password` `/auth/confirm` | 비밀번호 + 이메일 링크 로그인, 의뢰자 가입, CRO 가입 신청 |
| 의뢰자 | `/app` `/app/new` `/app/r/[no]` `/app/r/[no]/compare` `/app/r/[no]/q/[quoteId]` `/app/notifications` `/app/profile` | 내 요청·진행 타임라인·비교표·CRO 선택·알림 |
| CRO | `/cro` `/cro/r/[id]` `/cro/r/[id]/reply` `/cro/quotes` `/cro/awards` `/cro/org` | 받은 요청·회신·제출 목록·수주(연락처·계약 보고)·기관 정보 |
| CRO 토큰 | `/q/[token]` `/q/[token]/reply` | 로그인 없이 배포 메일 링크로 회신 |
| 운영자 | `/admin` `/admin/r/[no]` `/admin/cros` `/admin/awards` `/admin/users` | 접수 현황, 배포, 비교표 공개, 종료·취소, CRO 승인, 역할 관리 |

`/app` `/cro` `/admin`은 로그인 필수([proxy.ts](proxy.ts)). 역할이 다르면 각자의 홈으로 보낸다. 운영자는 모든 영역을 볼 수 있다.

## 데이터 접근 원칙
모든 표는 RLS로 잠겨 있고 정책이 없다. 브라우저의 anon 키는 세션 쿠키 처리에만 쓰인다.
데이터는 서버가 세션 사용자를 확인한 뒤 service role로 읽고 쓴다 (`lib/auth.ts` → `lib/data.ts`).

## 로컬 실행
```bash
npm install
cp .env.example .env.local   # 키 입력
npm run dev                  # http://localhost:3000
npm run typecheck
```

## Supabase 설정 (1회)
1. SQL Editor에서 순서대로 실행: `supabase/schema.sql` → `supabase/schema_cro.sql` → `supabase/schema_accounts.sql`
2. Storage에 비공개 버킷 `rfq-files`, `cro-files`가 있는지 확인 (스키마가 만들지만 없으면 직접 생성)
3. Authentication → Providers → Email: 켜 둔다. **Confirm email 켜짐** 유지 (가입 확인은 우리가 보내는 메일 링크로 처리)
4. Project Settings → API에서 `URL`, `anon`, `service_role` 키 → 환경변수

인증 메일(가입 확인·로그인 링크·비밀번호 재설정)은 Supabase SMTP가 아니라 **Resend로 보낸다**
(`auth.admin.generateLink` → `/auth/confirm`). Supabase 무료 SMTP의 시간당 발송 한도를 타지 않는다.

### 운영자 계정
`ADMIN_EMAIL`에 적은 주소로 가입하면 첫 로그인 때 자동으로 운영자가 된다. 또는 SQL:
```sql
update public.profiles set role = 'admin' where lower(email) = 'ops@example.com';
```

## 환경변수
`.env.example` 참고. Vercel → Settings → Environment Variables에 넣고 Redeploy.
`NEXT_PUBLIC_SITE_URL`은 메일 속 링크의 기준 주소다.

## API 요약
| 경로 | 설명 |
|---|---|
| `POST /api/rfq` | 접수. JSON `{ payload, files:[{name,size,type}] }` → 서명 업로드 URL. 파일은 브라우저가 Storage로 직접 PUT |
| `GET/PUT/POST /api/quote/[token]` | CRO 회신 조회·초안 저장·제출. `POST …/upload-url` PDF 서명 URL, `POST …/decline` 회신 안 함 |
| `POST /api/rfq/[no]/select` | 의뢰자 CRO 선택 → `rfq_awards`, 양측 알림 |
| `POST /api/awards/[id]/contract` | CRO 계약 체결 보고 |
| `POST /api/admin/rfqs/[no]/distribute` · `/compare` · `/status` | 배포(초대·메일), 비교표 공개, 종료·취소·메모 |
| `POST /api/admin/cros/[id]` · `/api/admin/users/[id]` | CRO 승인·반려·중지, 역할·기관 연결 |
| `GET /api/files/[id]` · `/api/quotes/[id]/pdf` | 첨부·정본 PDF (권한 확인 후 서명 URL) |
| `/api/auth/*` | signup, signup-cro, login, magic, forgot, reset, logout, me |

파일을 서버로 보내지 않는 이유: Vercel 함수 요청 본문 한도가 4.5MB라서 20MB 첨부를 받을 수 없다.
접수 API 남용 방어: 숨은 허니팟 칸(`website`) + IP당 10분 5건 속도 제한(인스턴스 단위).

## 폼 스키마 수정
`lib/rfq-schema.ts`의 `CONTACT` / `WIZ` / `STEP2` / `DETAILS` / `CATS`만 고치면 화면·검증·메일·CRO 회신 행이 함께 바뀐다.
디자인 토큰: `app/globals.css`(공개·인증), `components/shell/portal.css`(의뢰자·CRO·운영자 포털).

## 앱(PWA)
`app/manifest.ts` + `public/icons/`. 브라우저 "홈 화면에 추가"로 설치되며, 웹과 같은 코드가 돈다.
스토어 배포가 필요하면 이 URL을 감싸는 래퍼(예: Capacitor/TWA)를 붙인다.

## 아직 없는 것
- 푸시 알림(앱 내 알림·이메일은 동작). 웹 푸시는 설치 후 권한 흐름과 서버 키가 필요하다.
- CDA 전자서명 흐름(현재는 메일로 요청). 마스킹 해제는 운영자가 기밀 등급을 바꾸는 방식.
- 비교표 PDF 내보내기. 화면과 정본 PDF 링크로 대체.
