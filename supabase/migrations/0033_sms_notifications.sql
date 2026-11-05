-- 단추(Danchu) 33차: 문자 알림 (2026-11-03 대표 결정 "알림은 이메일, 등록한 연락처, 사이트 대시보드 세 곳으로")
-- 0032 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경
-- 1) 알림은 세 곳으로 간다: 사이트 알림(notifications), 이메일(Resend), 문자(이 파일). 문자는 프로필에 적은 휴대전화로 보낸다.
-- 2) 문자는 꼭 알아야 하는 순간에만 보낸다(비용·피로): 기관 새 참여 안내, 기관 선정, 의뢰자 비교표 공개,
--    의뢰자 계약 체결 확인 요청, 청구서 발행·납부 기한 지남. 나머지는 사이트 알림과 이메일만.
-- 3) 서비스 이용에 따른 안내(거래 정보)라 광고성 정보 수신 동의 대상은 아니다. 그래도 프로필에서 끌 수 있다(sms_notifications).
-- 4) 보낸 기록(sms_log)은 번호를 가린 채 남긴다. 실패 원인 확인과 같은 알림 중복 발송 방지에 쓴다. 90일 뒤 보존기간 정리 작업이 지운다.

do $$ begin
  if to_regclass('public.billing_invoices') is null then
    raise exception '0032_billing_invoices.sql 을 먼저 적용해 주세요';
  end if;
end $$;

alter table public.profiles add column if not exists sms_notifications boolean not null default true;
comment on column public.profiles.sms_notifications is '문자 알림 받기 (0033). 꺼도 사이트 알림·이메일은 그대로';

create table if not exists public.sms_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  phone_masked text not null,
  kind         text not null,
  dedupe_key   text,
  status       text not null check (status in ('sent', 'failed', 'skipped')),
  reason       text,
  provider_id  text,
  created_at   timestamptz not null default now()
);
-- 같은 알림(dedupe_key)은 한 사람에게 한 번만 보낸다 (재시도·중복 호출 방지)
create unique index if not exists sms_log_dedupe on public.sms_log (user_id, dedupe_key) where dedupe_key is not null and status = 'sent';
create index if not exists sms_log_created on public.sms_log (created_at desc);
alter table public.sms_log enable row level security;
revoke all on public.sms_log from anon, authenticated;
grant select, insert, delete on public.sms_log to service_role;
comment on table public.sms_log is '문자 알림 기록 (0033). 번호는 가려서 남긴다. 서버만 읽고 쓴다. 90일 보존';

create or replace function public.danchu_schema_version()
returns int
language sql
immutable
as $$ select 33 $$;
comment on function public.danchu_schema_version() is
  '마지막으로 적용한 마이그레이션 번호 (0033). 앱(lib/schema-version.ts REQUIRED_SCHEMA_VERSION)과 npm run check:schema 가 확인한다. 다음 마이그레이션이 새 번호로 바꾼다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;
grant execute on function public.danchu_schema_version() to service_role;
