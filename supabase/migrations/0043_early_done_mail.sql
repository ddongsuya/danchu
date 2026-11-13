-- 단추(Danchu) 43차: 사전예약 완료 메일 (2026-11-13)
-- 0042 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 사전예약(/early)을 마치면 문자(0035 done_sms_at)와 함께 완료 메일을 한 번 보낸다.
-- 같은 갈래·이메일로 다시 예약해도 다시 보내지 않도록 보낸 시각을 남긴다. 더하기만 하는 변경이라 옛 코드는 그대로 돈다.

do $$ begin
  if public.danchu_schema_version() < 42 then
    raise exception '0042_detail_quote.sql 을 먼저 적용해 주세요';
  end if;
end $$;

alter table public.early_signups add column if not exists done_mail_at timestamptz;
comment on column public.early_signups.done_mail_at is '사전예약 완료 메일을 보낸 시각. 처음 한 번만 보낸다 (app/api/early)';

create or replace function public.danchu_schema_version()
returns int
language sql
immutable
as $$ select 43 $$;
comment on function public.danchu_schema_version() is
  '마지막으로 적용한 마이그레이션 번호 (0043). 앱(lib/schema-version.ts REQUIRED_SCHEMA_VERSION)과 npm run check:schema 가 확인한다. 다음 마이그레이션이 새 번호로 바꾼다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;
grant execute on function public.danchu_schema_version() to service_role;
