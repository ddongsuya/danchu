-- 단추(Danchu) 38차: 기관 CRM 1차 (2026-11-07, 스레드 "기관용 CRM 제대로 만들기")
-- 0037_catalog_routes.sql 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경
-- 기관이 고객사 → 담당자 → 담당자에게 보낸 견적 → 미팅·통화·메일 기록 → 할 일 → 일정을 한곳에서 관리한다.
-- 구조는 사용자가 만든 CRMQUOTATION(Company·Contact·Quote·Note·Task·TaskAction·CalendarEvent)을 기관 단위로 옮겼다.
-- 계약 단계·지급 회차·시험 추적은 2차다.
--
-- 지키는 것
-- 1) 고객사는 두 곳에서 생긴다: 기관이 직접 추가(source=manual), 단추에서 이 기관을 선정한 의뢰자의 회사(source=danchu).
--    단추 쪽 연결은 담당자에 둔다 (cro_crm_contacts.danchu_key = 의뢰자 계정 id, 계정이 지워졌으면 co:회사명).
--    한 회사의 의뢰자가 여러 명이어도 고객사는 하나고 담당자가 여럿이다. 선정 전 의뢰자는 담당자가 될 수 없다 (앱이 선정된 키만 받는다).
-- 2) 모든 행은 org_id 로 갈린다. 서버(service role)만 읽고 쓴다. 기관 확인은 앱이 세션의 기관 id 로 한다.
-- 3) 단추는 이 데이터를 요청 전달 순서·비교표·노출에 쓰지 않는다.
-- 4) 담당자 개인정보는 기관이 넣는다. 단추는 처리를 맡는 쪽이다. 기관이 지우면 바로 지운다 (보관 행 없음).

do $$ begin
  if to_regclass('public.cro_quote_docs') is null or public.danchu_schema_version() < 37 then
    raise exception '0037_catalog_routes.sql 을 먼저 적용해 주세요';
  end if;
end $$;

-- ─────────────────────────────────────────────
-- 1) 고객사
-- ─────────────────────────────────────────────
create table if not exists public.cro_crm_companies (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.cro_orgs(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 200),
  aliases     text[] not null default '{}' check (cardinality(aliases) <= 20),
  industry    text not null default '' check (char_length(industry) <= 60),
  biz_no      text not null default '' check (char_length(biz_no) <= 20),
  address     text not null default '' check (char_length(address) <= 300),
  website     text not null default '' check (char_length(website) <= 300),
  memo        text not null default '' check (char_length(memo) <= 4000),
  first_deal  boolean not null default true,
  source      text not null default 'manual' check (source in ('manual', 'danchu')),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists cro_crm_companies_org_idx on public.cro_crm_companies (org_id, updated_at desc);
comment on table public.cro_crm_companies is '기관 CRM 고객사 (0038). source=danchu 는 단추에서 이 기관을 선정한 의뢰자의 회사로 만들어진 것';
alter table public.cro_crm_companies enable row level security;

-- ─────────────────────────────────────────────
-- 2) 담당자
-- ─────────────────────────────────────────────
create table if not exists public.cro_crm_contacts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.cro_orgs(id) on delete cascade,
  company_id  uuid not null references public.cro_crm_companies(id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 100),
  dept        text not null default '' check (char_length(dept) <= 100),
  title       text not null default '' check (char_length(title) <= 60),
  role        text check (role is null or role in ('decision', 'user', 'contract', 'finance', 'other')),
  email       text not null default '' check (char_length(email) <= 200),
  phone       text not null default '' check (char_length(phone) <= 40),
  mobile      text not null default '' check (char_length(mobile) <= 40),
  memo        text not null default '' check (char_length(memo) <= 2000),
  source      text not null default 'manual' check (source in ('manual', 'danchu')),
  danchu_key  text check (danchu_key is null or char_length(danchu_key) between 1 and 240),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists cro_crm_contacts_danchu_key_uq on public.cro_crm_contacts (org_id, danchu_key) where danchu_key is not null;
create index if not exists cro_crm_contacts_company_idx on public.cro_crm_contacts (company_id, name);
create index if not exists cro_crm_contacts_org_idx on public.cro_crm_contacts (org_id);
comment on table public.cro_crm_contacts is '기관 CRM 담당자 (0038). role: decision 결정권자 · user 실무 · contract 계약 · finance 정산 · other. danchu_key 는 이 기관을 선정한 단추 의뢰자(계정 id 또는 co:회사명)';
alter table public.cro_crm_contacts enable row level security;

-- ─────────────────────────────────────────────
-- 3) 일정 (기록보다 먼저: 기록이 일정을 가리킨다)
-- ─────────────────────────────────────────────
create table if not exists public.cro_crm_events (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.cro_orgs(id) on delete cascade,
  company_id        uuid references public.cro_crm_companies(id) on delete cascade,
  contact_id        uuid references public.cro_crm_contacts(id) on delete set null,
  quote_doc_id      uuid references public.cro_quote_docs(id) on delete set null,
  kind              text not null default 'meeting' check (kind in ('meeting', 'call', 'deadline', 'other')),
  title             text not null check (char_length(btrim(title)) between 1 and 200),
  starts_at         timestamptz not null,
  ends_at           timestamptz,
  all_day           boolean not null default false,
  mode              text check (mode is null or mode in ('in_person', 'video', 'phone')),
  location          text not null default '' check (char_length(location) <= 300),
  attendee_contacts uuid[] not null default '{}' check (cardinality(attendee_contacts) <= 30),
  attendee_members  uuid[] not null default '{}' check (cardinality(attendee_members) <= 30),
  attendees_extra   text not null default '' check (char_length(attendees_extra) <= 300),
  requests          text not null default '' check (char_length(requests) <= 2000),
  remind            boolean not null default true,
  reminded_at       timestamptz,
  done_at           timestamptz,
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);
create index if not exists cro_crm_events_org_idx on public.cro_crm_events (org_id, starts_at);
create index if not exists cro_crm_events_company_idx on public.cro_crm_events (company_id, starts_at);
create index if not exists cro_crm_events_remind_idx on public.cro_crm_events (starts_at) where remind and reminded_at is null and done_at is null;
comment on table public.cro_crm_events is '기관 CRM 일정 (0038). remind=true 면 매일 작업이 하루 전 아침에 참석자(우리)에게 알린다';
alter table public.cro_crm_events enable row level security;

-- ─────────────────────────────────────────────
-- 4) 기록 (미팅·통화·메일·메모)
-- ─────────────────────────────────────────────
create table if not exists public.cro_crm_activities (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.cro_orgs(id) on delete cascade,
  company_id        uuid not null references public.cro_crm_companies(id) on delete cascade,
  contact_id        uuid references public.cro_crm_contacts(id) on delete set null,
  quote_doc_id      uuid references public.cro_quote_docs(id) on delete set null,
  event_id          uuid references public.cro_crm_events(id) on delete set null,
  kind              text not null check (kind in ('meeting', 'call', 'email', 'memo')),
  occurred_at       timestamptz not null default now(),
  duration_min      int check (duration_min is null or duration_min between 0 and 1440),
  title             text not null default '' check (char_length(title) <= 200),
  body              text not null default '' check (char_length(body) <= 8000),
  attendee_contacts uuid[] not null default '{}' check (cardinality(attendee_contacts) <= 30),
  attendee_members  uuid[] not null default '{}' check (cardinality(attendee_members) <= 30),
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (char_length(btrim(title)) + char_length(btrim(body)) > 0)
);
create index if not exists cro_crm_activities_company_idx on public.cro_crm_activities (company_id, occurred_at desc);
create index if not exists cro_crm_activities_contact_idx on public.cro_crm_activities (contact_id, occurred_at desc) where contact_id is not null;
create index if not exists cro_crm_activities_org_idx on public.cro_crm_activities (org_id, occurred_at desc);
comment on table public.cro_crm_activities is '기관 CRM 기록 (0038). 미팅·통화·메일·메모. 단추에서 일어난 일(선정·계약 보고·견적서)은 저장하지 않고 화면에서 합친다';
alter table public.cro_crm_activities enable row level security;

-- ─────────────────────────────────────────────
-- 5) 할 일 + 시도 기록
-- ─────────────────────────────────────────────
create table if not exists public.cro_crm_tasks (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.cro_orgs(id) on delete cascade,
  company_id   uuid references public.cro_crm_companies(id) on delete cascade,
  contact_id   uuid references public.cro_crm_contacts(id) on delete set null,
  quote_doc_id uuid references public.cro_quote_docs(id) on delete set null,
  activity_id  uuid references public.cro_crm_activities(id) on delete set null,
  title        text not null check (char_length(btrim(title)) between 1 and 200),
  memo         text not null default '' check (char_length(memo) <= 2000),
  category     text not null default 'other' check (category in ('contact', 'reply', 'material', 'meeting', 'internal', 'other')),
  due_on       date,
  assignee     uuid references public.profiles(id) on delete set null,
  done_at      timestamptz,
  done_by      uuid references public.profiles(id) on delete set null,
  notified_on  date,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists cro_crm_tasks_org_idx on public.cro_crm_tasks (org_id, done_at, due_on);
create index if not exists cro_crm_tasks_company_idx on public.cro_crm_tasks (company_id) where company_id is not null;
comment on table public.cro_crm_tasks is '기관 CRM 할 일 (0038). due_on 날 아침 매일 작업이 맡은 사람에게 알린다 (notified_on)';
alter table public.cro_crm_tasks enable row level security;

create table if not exists public.cro_crm_task_actions (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.cro_orgs(id) on delete cascade,
  task_id    uuid not null references public.cro_crm_tasks(id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 500),
  at         timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists cro_crm_task_actions_task_idx on public.cro_crm_task_actions (task_id, at desc);
comment on table public.cro_crm_task_actions is '할 일에 대해 한 일 (0038). "전화함(부재중)", "자료 보냄"처럼 시간순으로 쌓인다';
alter table public.cro_crm_task_actions enable row level security;

-- ─────────────────────────────────────────────
-- 6) 견적서 ↔ 고객사·담당자 + 진행 상태 · 추적 이력
-- ─────────────────────────────────────────────
alter table public.cro_quote_docs
  add column if not exists company_id      uuid references public.cro_crm_companies(id) on delete set null,
  add column if not exists contact_id      uuid references public.cro_crm_contacts(id) on delete set null,
  add column if not exists sent_at         timestamptz,
  add column if not exists deal_stage      text check (deal_stage is null or deal_stage in ('negotiating', 'won', 'lost')),
  add column if not exists lost_reason     text not null default '' check (char_length(lost_reason) <= 100),
  add column if not exists contract_amount bigint check (contract_amount is null or contract_amount >= 0);
create index if not exists cro_quote_docs_company_idx on public.cro_quote_docs (company_id) where company_id is not null;
comment on column public.cro_quote_docs.deal_stage is 'CRM 진행 (0038). null 이면 status(draft·sent)를 따른다. negotiating 협의 · won 수주 · lost 실패';

create table if not exists public.cro_quote_tracking (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.cro_orgs(id) on delete cascade,
  doc_id     uuid not null references public.cro_quote_docs(id) on delete cascade,
  stage      text check (stage is null or stage in ('draft', 'sent', 'negotiating', 'won', 'lost')),
  note       text not null default '' check (char_length(note) <= 2000),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists cro_quote_tracking_doc_idx on public.cro_quote_tracking (doc_id, created_at desc);
comment on table public.cro_quote_tracking is '견적서 추적 이력 (0038). 상태가 바뀌거나 추적 메모를 남길 때 한 줄씩 쌓인다';
alter table public.cro_quote_tracking enable row level security;

-- updated_at
do $$
declare t text;
begin
  foreach t in array array['cro_crm_companies', 'cro_crm_contacts', 'cro_crm_events', 'cro_crm_activities', 'cro_crm_tasks'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_updated_at()', t || '_touch', t);
  end loop;
end $$;

create or replace function public.danchu_schema_version()
returns int
language sql
immutable
as $$ select 38 $$;
comment on function public.danchu_schema_version() is
  '마지막으로 적용한 마이그레이션 번호 (0038). 앱(lib/schema-version.ts REQUIRED_SCHEMA_VERSION)과 npm run check:schema 가 확인한다. 다음 마이그레이션이 새 번호로 바꾼다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;
grant execute on function public.danchu_schema_version() to service_role;
