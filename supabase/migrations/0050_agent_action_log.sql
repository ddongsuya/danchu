-- 단추(Danchu) 50차: 견적 에이전트 실행 기록과 되돌리기 (2026-11-19, 에이전트 액션 등록부)
-- 0049 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 에이전트가 단추에서 한 일(액션)을 한 줄씩 남긴다. 누가 시켰고(user_id) 무엇을 했는지(action, 대상).
--   · 바로 실행(auto): 기관 안의 기록(고객관리·할 일·일정). 사람이 "되돌리기"를 누르면 before 로 되돌린다.
--   · 확인 후 실행(confirm): 기관 밖으로 나가는 일(질의·제출·선정 등). 사람이 에이전트 앱에서 승인한 것. 되돌리기 없음.
-- before: 되돌리기에 쓸 바꾸기 전 값(고친 칸만). 7일이 지나면 매일 예약 작업이 비운다(되돌리기 기간).
-- after_updated_at: 에이전트가 바꾼 뒤 그 행의 updated_at. 그 뒤 사람이 또 고쳤으면 되돌리지 않는다.
-- 처리방침 3항 "견적 에이전트 대화와 승인 기록: 탈퇴하거나 동의를 철회할 때까지": 탈퇴하면 계정과 함께 지워지고(참조),
--   동의를 철회하면 lib/agent-purge.ts 가 그 사람의 줄을 지운다. 본문·프롬프트는 넣지 않는다.
-- 서버(service role)만 읽고 쓴다.
--
-- 되돌리기(앞으로 가는 새 마이그레이션으로): drop table public.agent_action_log; 스키마 판을 49 로.

do $$ begin
  if public.danchu_schema_version() < 49 then
    raise exception '0049_agent_consent_retention.sql 을 먼저 적용해 주세요';
  end if;
end $$;

create table if not exists public.agent_action_log (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  org_id           uuid references public.cro_orgs(id) on delete cascade,
  role             text not null check (role in ('requester', 'cro')),
  action           text not null check (action ~ '^[a-z][a-z_]{1,39}$'),
  level            text not null check (level in ('auto', 'confirm')),
  rfq_no           text check (rfq_no ~ '^DC-[0-9]{4}-[0-9]{4,6}$'),
  target_kind      text check (target_kind in ('companies', 'contacts', 'deals', 'activities', 'events', 'tasks')),
  target_id        uuid,
  undo             text check (undo in ('delete', 'patch', 'move')),
  before           jsonb,
  after_updated_at timestamptz,
  status           int not null check (status between 100 and 599),
  undone_at        timestamptz,
  created_at       timestamptz not null default now(),
  constraint agent_action_log_undo_target check (undo is null or (target_kind is not null and target_id is not null and level = 'auto'))
);
create index if not exists agent_action_log_user_idx on public.agent_action_log (user_id, created_at desc);
create index if not exists agent_action_log_org_idx on public.agent_action_log (org_id, created_at desc) where org_id is not null;
create index if not exists agent_action_log_before_idx on public.agent_action_log (created_at) where before is not null;
alter table public.agent_action_log enable row level security;
revoke all on public.agent_action_log from anon, authenticated;
comment on table public.agent_action_log is
  '견적 에이전트가 단추에서 실행한 액션 기록 (0050). 바로 실행한 기관 내부 기록은 before 로 되돌린다. 본문은 넣지 않는다';
comment on column public.agent_action_log.before is '되돌리기용 바꾸기 전 값(고친 칸만). 7일 뒤 예약 작업이 비운다';

create or replace function public.danchu_schema_version()
returns int
language sql
immutable
as $$ select 50 $$;
comment on function public.danchu_schema_version() is
  '마지막으로 적용한 마이그레이션 번호 (0050). 앱(lib/schema-version.ts REQUIRED_SCHEMA_VERSION)과 npm run check:schema 가 확인한다. 다음 마이그레이션이 새 번호로 바꾼다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;
grant execute on function public.danchu_schema_version() to service_role;
