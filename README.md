# 단추 (Danchu) — 비임상 CRO 견적 중개 플랫폼 MVP

Next.js(App Router) + Supabase + Resend · Vercel 배포

## 화면
- `/` 랜딩
- `/rfq` 견적 요청 폼 (2단계, 1단계만 제출해도 접수)
- `/rfq/complete?no=DC-2026-0001` 접수 완료
- `POST /api/rfq` 접수 API (multipart: `payload` JSON + `files[]`)

## 로컬 실행
```bash
npm install
cp .env.example .env.local   # 키 입력
npm run dev                  # http://localhost:3000
```

## Supabase 설정 (1회)
1. 프로젝트 생성 → SQL Editor에 `supabase/schema.sql` 전체 붙여넣기 실행
   - 테이블 `rfq_requests`, `rfq_files`, `rfq_counters`, 함수 `next_rfq_no`, 버킷 `rfq-files` 생성
2. Project Settings → API에서 `URL`, `service_role` 키 복사 → 환경변수

## Resend 설정
1. API 키 발급 → `RESEND_API_KEY`
2. 도메인(danchu.kr) 인증 후 `RESEND_FROM=단추 <hello@danchu.kr>`
   - 인증 전에는 `onboarding@resend.dev`로만 발신되고, Resend 가입 메일 주소로만 수신됨
3. `ADMIN_EMAIL`에 운영자 메일 (쉼표로 여러 개)

## Vercel 환경변수
Project → Settings → Environment Variables에 `.env.example`의 변수를 넣고 Redeploy.
키가 없어도 배포는 동작하며, 이때 접수는 임시 번호(DC-YYYY-9xxx)로 응답하고 서버 로그에만 기록된다(데모 모드).

## 폼 스키마 수정
`lib/rfq-schema.ts`의 `STEP1` / `STEP2` / `DETAILS` / `CATS` 만 고치면 화면·검증·메일이 함께 바뀐다.
디자인 토큰은 `app/globals.css` 상단 `:root`.
