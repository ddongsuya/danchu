-- 단추(Danchu) 38차: 기관 CRM 1단계 (2026-11-07, 스레드 "기관용 CRM 기능 검토하기", 시안 v5)
-- 0037_catalog_routes.sql 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경
-- 기관의 영업은 "안건" 하나를 따라 움직인다: 문의 → 견적 → 협의 → 접수 → 계약, 끝은 수주 또는 실패.
-- 안건마다 고객사·담당자·금액·담당 영업이 있고, 미팅·통화·메일·메모 기록과 할 일·일정이 안건에 붙는다.
-- 구조는 사용자가 만든 CRMQUOTATION(안건 진행·수주/실패 사유·견적 추적)과 Pipedrive·HubSpot 의 deal 모델을 기관 단위로 옮겼다.
--
-- 지키는 것
-- 1) 단추 요청은 기관이 참여하면 안건이 된다 (source=danchu, invite_id). 단추에서 일어난 일(견적 제출·선정·계약 보고)은
--    앱이 안건을 앞으로만 옮긴다. 선정 전에는 고객사·담당자가 비어 있다 (의뢰자 이름·회사는 선정 뒤에만 보인다).
-- 2) 모든 행은 org_id 로 갈린다. 서버(service role)만 읽고 쓴다. 기관 확인은 앱이 세션의 기관 id 로 한다.
-- 3) 단추는 이 데이터를 요청 전달 순서·비교표·노출·청구에 쓰지 않는다. 실패한 안건에 다른 기관의 이름·금액을 넣지 않는다.
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
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.cro_orgs(id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 200),
  aliases      text[] not null default '{}' check (cardinality(aliases) <= 20),
  industry     text not null default '' check (char_length(industry) <= 60),
  biz_no       text not null default '' check (char_length(biz_no) <= 20),
  address      text not null default '' check (char_length(address) <= 300),
  website      text not null default '' check (char_length(website) <= 300),
  email_domain text not null default '' check (char_length(email_domain) <= 120),
  memo         text not null default '' check (char_length(memo) <= 4000),
  owner        uuid references public.profiles(id) on delete set null,
  source       text not null default 'manual' check (source in ('manual', 'danchu', 'import')),
  first_deal_on date,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists cro_crm_companies_org_idx on public.cro_crm_companies (org_id, updated_at desc);
comment on table public.cro_crm_companies is '기관 CRM 고객사 (0038). source: manual 직접 · danchu 단추에서 이 기관을 선정한 의뢰자의 회사 · import 엑셀 가져오기. first_deal_on 은 가져온 엑셀의 첫 거래일 (없으면 안건에서 계산)';
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
  source      text not null default 'manual' check (source in ('manual', 'danchu', 'import')),
  danchu_key  text check (danchu_key is null or char_length(danchu_key) between 1 and 240),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists cro_crm_contacts_danchu_key_uq on public.cro_crm_contacts (org_id, danchu_key) where danchu_key is not null;
create index if not exists cro_crm_contacts_company_idx on public.cro_crm_contacts (company_id, name);
create index if not exists cro_crm_contacts_email_idx on public.cro_crm_contacts (org_id, lower(email)) where email <> '';
comment on table public.cro_crm_contacts is '기관 CRM 담당자 (0038). role: decision 결정권자 · user 실무 · contract 계약 · finance 정산 · other. danchu_key 는 이 기관을 선정한 단추 의뢰자(계정 id 또는 co:회사명).';
alter table public.cro_crm_contacts enable row level security;

-- ─────────────────────────────────────────────
-- 2-1) 가져오기 묶음 (엑셀 한 번 = 한 줄. 24시간 안에 한 번 되돌릴 수 있다)
-- ─────────────────────────────────────────────
create table if not exists public.cro_crm_imports (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.cro_orgs(id) on delete cascade,
  file_name   text not null default '' check (char_length(file_name) <= 200),
  row_count   int not null default 0 check (row_count >= 0),
  company_ids uuid[] not null default '{}',
  contact_ids uuid[] not null default '{}',
  deal_ids    uuid[] not null default '{}',
  undone_at   timestamptz,
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists cro_crm_imports_org_idx on public.cro_crm_imports (org_id, created_at desc);
comment on table public.cro_crm_imports is '엑셀 가져오기 한 번 (0038). 새로 만든 행 id 만 적는다. 되돌리면 그 행들을 지운다 (합친 기존 고객사는 지우지 않는다)';
alter table public.cro_crm_imports enable row level security;

-- ─────────────────────────────────────────────
-- 2-2) 안건
-- ─────────────────────────────────────────────
create table if not exists public.cro_crm_deals (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.cro_orgs(id) on delete cascade,
  company_id   uuid references public.cro_crm_companies(id) on delete set null,
  contact_ids  uuid[] not null default '{}' check (cardinality(contact_ids) <= 10),
  title        text not null check (char_length(btrim(title)) between 1 and 200),
  kind         text not null default '' check (kind in ('', 'tox', 'pd', 'pk', 'other')),
  substance    text not null default '' check (char_length(substance) <= 200),
  submit_to    text not null default '' check (char_length(submit_to) <= 100),
  report_lang  text not null default '' check (char_length(report_lang) <= 40),
  amount       bigint check (amount is null or amount >= 0),
  expected_on  date,
  stage        text not null default 'inquiry' check (stage in ('inquiry', 'quote', 'negotiation', 'intake', 'contract')),
  status       text not null default 'open' check (status in ('open', 'won', 'lost')),
  stage_at     timestamptz not null default now(),
  lost_reason  text not null default '' check (char_length(lost_reason) <= 40),
  lost_note    text not null default '' check (char_length(lost_note) <= 2000),
  won_amount   bigint check (won_amount is null or won_amount >= 0),
  closed_at    timestamptz,
  owner        uuid references public.profiles(id) on delete set null,
  source       text not null default 'manual' check (source in ('manual', 'danchu', 'import')),
  invite_id    uuid references public.rfq_invites(id) on delete set null,
  rfq_no       text not null default '' check (char_length(rfq_no) <= 40),
  memo         text not null default '' check (char_length(memo) <= 4000),
  import_id    uuid references public.cro_crm_imports(id) on delete set null,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check ((status = 'open') = (closed_at is null)),
  check (status <> 'lost' or char_length(lost_reason) > 0)
);
create unique index if not exists cro_crm_deals_invite_uq on public.cro_crm_deals (org_id, invite_id) where invite_id is not null;
create index if not exists cro_crm_deals_org_idx on public.cro_crm_deals (org_id, status, stage);
create index if not exists cro_crm_deals_company_idx on public.cro_crm_deals (company_id) where company_id is not null;
comment on table public.cro_crm_deals is '기관 CRM 안건 (0038). stage: inquiry 문의 · quote 견적 · negotiation 협의 · intake 접수 · contract 계약. status: open 진행 · won 수주 · lost 실패. source=danchu 는 단추 요청에 참여해 생긴 안건 (invite_id). 선정 전에는 company_id 가 비어 있다';
alter table public.cro_crm_deals enable row level security;

-- 단계·상태가 바뀔 때마다 한 줄 (보고서의 단계별 머문 날·전환율, 타임라인의 단계 변경)
create table if not exists public.cro_crm_deal_history (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.cro_orgs(id) on delete cascade,
  deal_id     uuid not null references public.cro_crm_deals(id) on delete cascade,
  from_stage  text,
  to_stage    text not null,
  from_status text,
  to_status   text not null,
  reason      text not null default '' check (char_length(reason) <= 40),
  actor       text not null default 'member' check (actor in ('member', 'danchu', 'import')),
  created_by  uuid references public.profiles(id) on delete set null,
  at          timestamptz not null default now()
);
create index if not exists cro_crm_deal_history_deal_idx on public.cro_crm_deal_history (deal_id, at);
create index if not exists cro_crm_deal_history_org_idx on public.cro_crm_deal_history (org_id, at);
comment on table public.cro_crm_deal_history is '안건 단계·상태 변경 이력 (0038). actor: member 기관 담당자 · danchu 단추 이벤트(견적 제출·선정·계약 보고) · import 엑셀. 첫 줄(from_stage null)은 안건이 생긴 때';
alter table public.cro_crm_deal_history enable row level security;


-- ─────────────────────────────────────────────
-- 3) 일정 (기록보다 먼저: 기록이 일정을 가리킨다)
-- ─────────────────────────────────────────────
create table if not exists public.cro_crm_events (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.cro_orgs(id) on delete cascade,
  company_id        uuid references public.cro_crm_companies(id) on delete cascade,
  deal_id           uuid references public.cro_crm_deals(id) on delete cascade,
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
create index if not exists cro_crm_events_deal_idx on public.cro_crm_events (deal_id, starts_at) where deal_id is not null;
create index if not exists cro_crm_events_remind_idx on public.cro_crm_events (starts_at) where remind and reminded_at is null and done_at is null;
comment on table public.cro_crm_events is '기관 CRM 일정 (0038). remind=true 면 매일 작업이 하루 전 아침에 참석자(우리)에게 알린다';
alter table public.cro_crm_events enable row level security;

-- ─────────────────────────────────────────────
-- 4) 기록 (미팅·통화·메일·메모)
-- ─────────────────────────────────────────────
create table if not exists public.cro_crm_activities (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.cro_orgs(id) on delete cascade,
  company_id        uuid references public.cro_crm_companies(id) on delete cascade,
  deal_id           uuid references public.cro_crm_deals(id) on delete cascade,
  contact_id        uuid references public.cro_crm_contacts(id) on delete set null,
  quote_doc_id      uuid references public.cro_quote_docs(id) on delete set null,
  event_id          uuid references public.cro_crm_events(id) on delete set null,
  kind              text not null check (kind in ('meeting', 'call', 'email', 'memo')),
  occurred_at       timestamptz not null default now(),
  duration_min      int check (duration_min is null or duration_min between 0 and 1440),
  title             text not null default '' check (char_length(title) <= 200),
  body              text not null default '' check (char_length(body) <= 20000),
  attendee_contacts uuid[] not null default '{}' check (cardinality(attendee_contacts) <= 30),
  attendee_members  uuid[] not null default '{}' check (cardinality(attendee_members) <= 30),
  created_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (char_length(btrim(title)) + char_length(btrim(body)) > 0)
);
create index if not exists cro_crm_activities_company_idx on public.cro_crm_activities (company_id, occurred_at desc) where company_id is not null;
create index if not exists cro_crm_activities_deal_idx on public.cro_crm_activities (deal_id, occurred_at desc) where deal_id is not null;
create index if not exists cro_crm_activities_contact_idx on public.cro_crm_activities (contact_id, occurred_at desc) where contact_id is not null;
create index if not exists cro_crm_activities_org_idx on public.cro_crm_activities (org_id, occurred_at desc);
comment on table public.cro_crm_activities is '기관 CRM 기록 (0038). 미팅·통화·메일·메모. 메일은 기관 담당자가 직접 남긴 기록. 단추에서 일어난 일(참여·견적 제출·선정·계약 보고)은 저장하지 않고 화면에서 합친다';
alter table public.cro_crm_activities enable row level security;

-- ─────────────────────────────────────────────
-- 5) 할 일 + 시도 기록
-- ─────────────────────────────────────────────
create table if not exists public.cro_crm_tasks (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.cro_orgs(id) on delete cascade,
  company_id   uuid references public.cro_crm_companies(id) on delete cascade,
  deal_id      uuid references public.cro_crm_deals(id) on delete cascade,
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
create index if not exists cro_crm_tasks_deal_idx on public.cro_crm_tasks (deal_id) where deal_id is not null;
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
-- 6) 견적서 ↔ 안건·고객사·담당자
-- ─────────────────────────────────────────────
alter table public.cro_quote_docs
  add column if not exists deal_id    uuid references public.cro_crm_deals(id) on delete set null,
  add column if not exists company_id uuid references public.cro_crm_companies(id) on delete set null,
  add column if not exists contact_id uuid references public.cro_crm_contacts(id) on delete set null,
  add column if not exists sent_at    timestamptz;
create index if not exists cro_quote_docs_deal_idx on public.cro_quote_docs (deal_id) where deal_id is not null;
create index if not exists cro_quote_docs_company_idx on public.cro_quote_docs (company_id) where company_id is not null;
comment on column public.cro_quote_docs.deal_id is 'CRM 안건 (0038). 같은 안건의 견적서가 여러 장이면 1차·2차로 보인다 (만든 순서)';

-- 서버(service role)만 쓴다. RLS 정책이 없어 막히지만, 권한도 걷어 둔다
revoke all on public.cro_crm_companies, public.cro_crm_contacts, public.cro_crm_imports, public.cro_crm_deals, public.cro_crm_deal_history,
  public.cro_crm_events, public.cro_crm_activities, public.cro_crm_tasks, public.cro_crm_task_actions from anon, authenticated;

-- updated_at
do $$
declare t text;
begin
  foreach t in array array['cro_crm_companies', 'cro_crm_contacts', 'cro_crm_deals', 'cro_crm_events', 'cro_crm_activities', 'cro_crm_tasks'] loop
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
