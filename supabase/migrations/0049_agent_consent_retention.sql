-- 단추(Danchu) 49차: 견적 에이전트 동의 기록 보존과 에이전트 삭제 요청 (2026-11-19)
-- 0048 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 처리방침(2026-12-17 시행) 3항과 맞춘다.
--   · 견적 에이전트 이용 동의 기록: 동의를 철회하거나 탈퇴한 날부터 3년 보관 (동의 여부 확인과 분쟁 대응)
--   · 견적 에이전트 대화와 승인 기록: 탈퇴하거나 동의를 철회할 때까지 → 에이전트 서버에 삭제를 요청한다
--
-- 1) agent_consents 의 profiles 참조(on delete cascade)를 푼다. 탈퇴해도 동의 기록이 남고, 3년 뒤 정리 작업(lib/retention.ts)이 지운다.
--    account_deleted_at: 탈퇴한 시각. 탈퇴 처리(lib/account.ts)가 철회 시각과 함께 적는다.
-- 2) agent_purge_requests: 에이전트 서버에 보낼 대화·승인 기록 삭제 요청. 보내지 못하면 매일 예약 작업이 다시 보낸다.
--    user_id 는 지워진 계정일 수 있으므로 참조를 두지 않는다. 같은 계정·사유의 열린 요청은 하나만.
-- 3) 두 표 모두 서버(service role)만 읽고 쓴다.
--
-- 되돌리기(앞으로 가는 새 마이그레이션으로): agent_purge_requests 를 지우고, account_deleted_at 열을 지운 뒤
--   남은 user_id 가 모두 profiles 에 있을 때만 0046 의 참조를 다시 건다. 탈퇴 뒤 남은 기록이 있으면 참조를 다시 걸 수 없다(되돌릴 수 없는 부분).

do $$ begin
  if public.danchu_schema_version() < 48 then
    raise exception '0048_quote_layout.sql 을 먼저 적용해 주세요';
  end if;
end $$;

-- 1) 동의 기록 보존
alter table public.agent_consents drop constraint if exists agent_consents_user_id_fkey;
alter table public.agent_consents add column if not exists account_deleted_at timestamptz;
create index if not exists agent_consents_revoked_idx on public.agent_consents (revoked_at) where revoked_at is not null;
comment on table public.agent_consents is
  '견적 에이전트 앱의 개인정보 국외 이전·AI 처리 동의 (연동 3단계). 판마다 한 줄. 탈퇴해도 남기고 철회·탈퇴 3년 뒤 지운다 (0049)';
comment on column public.agent_consents.account_deleted_at is '탈퇴한 시각 (0049). 이때 revoked_at 도 함께 채운다';

-- 2) 에이전트 삭제 요청 대기열
create table if not exists public.agent_purge_requests (
  id          bigint generated always as identity primary key,
  user_id     uuid not null,
  reason      text not null check (reason in ('account_deleted', 'consent_revoked')),
  created_at  timestamptz not null default now(),
  attempts    int not null default 0 check (attempts >= 0),
  last_error  text check (char_length(last_error) <= 200),
  done_at     timestamptz
);
create unique index if not exists agent_purge_requests_open_uq on public.agent_purge_requests (user_id, reason) where done_at is null;
create index if not exists agent_purge_requests_pending_idx on public.agent_purge_requests (created_at) where done_at is null;
alter table public.agent_purge_requests enable row level security;
revoke all on public.agent_purge_requests from anon, authenticated;
comment on table public.agent_purge_requests is
  '견적 에이전트 서버에 보낼 대화·승인 기록 삭제 요청 (0049). lib/agent-purge.ts 가 보내고, 못 보낸 것은 매일 예약 작업이 다시 보낸다';

create or replace function public.danchu_schema_version()
returns int
language sql
immutable
as $$ select 49 $$;
comment on function public.danchu_schema_version() is
  '마지막으로 적용한 마이그레이션 번호 (0049). 앱(lib/schema-version.ts REQUIRED_SCHEMA_VERSION)과 npm run check:schema 가 확인한다. 다음 마이그레이션이 새 번호로 바꾼다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;
grant execute on function public.danchu_schema_version() to service_role;
