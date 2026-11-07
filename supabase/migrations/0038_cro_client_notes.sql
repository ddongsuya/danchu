-- 단추(Danchu) 38차: 기관 고객 메모 (2026-11-07, 견적 진행판·고객 화면)
-- 0037_catalog_routes.sql 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경
-- 기관이 선정된 의뢰자(고객)와의 통화 내용·다음에 챙길 일을 적어 두는 메모. 날짜를 달면 그날 알린다.
-- 고객은 그 기관을 선정한 의뢰자만이다 (선정 전에는 의뢰자 회사·연락처가 공개되지 않는다).
-- client_key 는 의뢰자 계정 id, 계정이 지워졌으면 'co:' + 회사명이다.
-- 메모는 그 기관만 본다. 단추는 이 메모를 요청 전달 순서·비교표·노출에 쓰지 않는다.
-- 서버(service role)만 읽고 쓴다. 기관 확인은 앱이 세션의 기관 id 로 한다.

do $$ begin
  if to_regclass('public.cro_quote_docs') is null or public.danchu_schema_version() < 37 then
    raise exception '0037_catalog_routes.sql 을 먼저 적용해 주세요';
  end if;
end $$;

create table if not exists public.cro_client_notes (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.cro_orgs(id) on delete cascade,
  client_key  text not null check (char_length(client_key) between 1 and 240),
  body        text not null check (char_length(body) between 1 and 2000),
  remind_on   date,
  reminded_at timestamptz,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists cro_client_notes_client_idx on public.cro_client_notes (org_id, client_key, created_at desc);
create index if not exists cro_client_notes_remind_idx on public.cro_client_notes (remind_on) where reminded_at is null and remind_on is not null;
comment on table public.cro_client_notes is '기관 고객 메모 (0038). 선정된 의뢰자별 내부 메모. remind_on 이 오면 매일 작업이 작성자에게 알리고 reminded_at 을 채운다';
alter table public.cro_client_notes enable row level security;

create or replace function public.danchu_schema_version()
returns int
language sql
immutable
as $$ select 38 $$;
comment on function public.danchu_schema_version() is
  '마지막으로 적용한 마이그레이션 번호 (0038). 앱(lib/schema-version.ts REQUIRED_SCHEMA_VERSION)과 npm run check:schema 가 확인한다. 다음 마이그레이션이 새 번호로 바꾼다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;
grant execute on function public.danchu_schema_version() to service_role;
