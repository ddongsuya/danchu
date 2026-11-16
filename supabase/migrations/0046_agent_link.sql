-- 단추(Danchu) 46차: 견적 에이전트 연동 3단계 (2026-11-17, 기준 handoff-to-gpt-1117 5장)
-- 0045 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 1) 에이전트 이용 동의 기록: 에이전트 앱에서 개인정보 국외 이전(AI 처리 미국, 대화 저장 일본)에 동의한 기록을 단추에도 남긴다.
--    판(version)마다 한 줄. 철회하면 revoked_at. 에이전트 서버가 사용자의 토큰으로 /api/agent/consent 를 불러 적는다.
-- 2) 에이전트에서 처리한 건 표시: 요청·견적·질의·선정·2차 요청·계약 보고가 어디서 일어났는지(via). 기본 'web'.
--    에이전트 입구(/api/agent/*)로 들어온 쓰기만 'agent' 로 적는다. 화면 표시는 앱이 이 값을 읽어서 한다.
-- 3) 표는 anon·authenticated 에 닫는다. 서비스 키(서버)로만 읽고 쓴다.

do $$ begin
  if public.danchu_schema_version() < 45 then
    raise exception '0045_rfq_questions.sql 을 먼저 적용해 주세요';
  end if;
end $$;

-- ─────────────────────────────────────────────
-- 1) 에이전트 이용 동의
-- ─────────────────────────────────────────────
create table if not exists public.agent_consents (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  version    text not null check (char_length(version) between 1 and 40),
  agreed_at  timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, version)
);
alter table public.agent_consents enable row level security;
revoke all on public.agent_consents from anon, authenticated;
comment on table public.agent_consents is '견적 에이전트 앱의 개인정보 국외 이전·AI 처리 동의 (연동 3단계). 판마다 한 줄';

-- ─────────────────────────────────────────────
-- 2) 어디서 처리했나 (via)
-- ─────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['rfq_requests', 'cro_quotes', 'rfq_questions', 'rfq_awards', 'rfq_details', 'rfq_events', 'cro_crm_activities'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I add column if not exists via text not null default %L', t, 'web');
      execute format('alter table public.%I drop constraint if exists %I', t, t || '_via_check');
      execute format('alter table public.%I add constraint %I check (via in (%L, %L))', t, t || '_via_check', 'web', 'agent');
    end if;
  end loop;
end $$;

-- ─────────────────────────────────────────────
-- 3) 스키마 판
-- ─────────────────────────────────────────────
create or replace function public.danchu_schema_version()
returns int
language sql
immutable
as $$ select 46 $$;
comment on function public.danchu_schema_version() is
  '마지막으로 적용한 마이그레이션 번호 (0046). 앱(lib/schema-version.ts REQUIRED_SCHEMA_VERSION)과 npm run check:schema 가 확인한다. 다음 마이그레이션이 새 번호로 바꾼다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;
grant execute on function public.danchu_schema_version() to service_role;
