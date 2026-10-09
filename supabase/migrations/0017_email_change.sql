-- 단추(Danchu) 17차: 로그인 이메일 변경
-- 0016 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 새 주소로 보낸 확인 링크의 토큰 해시와 만료를 프로필에 둔다. 확인되면 auth.users 와 profiles.email 을 함께 바꾼다.
-- (Supabase 의 이메일 변경 흐름은 기본 SMTP 를 타므로 쓰지 않는다. 메일은 Resend 로 보낸다)

alter table public.profiles
  add column if not exists pending_email text,
  add column if not exists pending_email_hash text,
  add column if not exists pending_email_expires_at timestamptz;
