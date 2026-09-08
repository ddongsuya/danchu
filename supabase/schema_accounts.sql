-- 단추(Danchu) 계정·기관·알림 스키마 (3차)
-- schema.sql, schema_cro.sql 실행 후 Supabase SQL Editor에 그대로 붙여 넣어 실행하세요.
--
-- 원칙: 모든 데이터 접근은 서버(service role)가 세션 사용자를 확인한 뒤 수행한다.
--       anon/authenticated 키로는 어떤 표도 직접 읽거나 쓰지 못한다 (RLS 켜고 정책 없음).

-- ─────────────────────────────────────────────
-- 1) CRO 기관 — CRO가 스스로 가입 신청하고 운영자가 승인한다
-- ─────────────────────────────────────────────
create table if not exists public.cro_orgs (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  status         text not null default 'pending',        -- pending | approved | rejected | suspended
  business_no    text,                                     -- 사업자등록번호
  website        text,
  address        text,
  contact_name   text,
  contact_email  text,
  contact_phone  text,
  glp_certs      text[] not null default '{}',             -- 식약처(KGLP) / OECD GLP / US FDA GLP / ...
  aaalac         boolean,
  other_certs    text,
  categories     text[] not null default '{}',             -- 수행 가능 시험 대분류 (배포 대상 필터)
  intro          text,
  created_at     timestamptz not null default now(),
  approved_at    timestamptz,
  updated_at     timestamptz not null default now()
);
create index if not exists cro_orgs_status_idx on public.cro_orgs (status);

-- ─────────────────────────────────────────────
-- 2) 사용자 프로필 — auth.users 1:1. 역할과 소속
-- ─────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  role        text not null default 'requester',           -- requester | cro | admin
  name        text,
  company     text,                                        -- 의뢰자 회사·기관명
  dept        text,
  phone       text,
  org_type    text,                                        -- 의뢰자 기관 유형
  cro_org_id  uuid references public.cro_orgs(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists profiles_email_idx on public.profiles (lower(email));
create index if not exists profiles_cro_org_idx on public.profiles (cro_org_id);

-- 가입 시 프로필 자동 생성 (메타데이터: role, name, company, dept, phone, org_type, cro_org_id)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  md jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  r  text := coalesce(md->>'role', 'requester');
begin
  if r not in ('requester', 'cro', 'admin') then r := 'requester'; end if;
  insert into public.profiles (id, email, role, name, company, dept, phone, org_type, cro_org_id)
  values (
    new.id, new.email, r,
    md->>'name', md->>'company', md->>'dept', md->>'phone', md->>'org_type',
    nullif(md->>'cro_org_id', '')::uuid
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────
-- 3) 기존 표 확장 — 계정·기관 연결, 진행 단계
-- ─────────────────────────────────────────────
alter table public.rfq_requests
  add column if not exists user_id          uuid references auth.users(id) on delete set null,
  add column if not exists distributed_at   timestamptz,
  add column if not exists compared_at      timestamptz,
  add column if not exists selected_quote_id uuid,
  add column if not exists closed_at        timestamptz,
  add column if not exists admin_note       text;
create index if not exists rfq_requests_user_idx on public.rfq_requests (user_id);
create index if not exists rfq_requests_status_idx on public.rfq_requests (status);

-- 접수 시 계정이 없었던 요청을 같은 이메일로 가입한 계정에 연결
create or replace function public.claim_rfqs_by_email(p_user uuid, p_email text)
returns int
language plpgsql
security definer set search_path = public
as $$
declare n int;
begin
  update public.rfq_requests set user_id = p_user
   where user_id is null and lower(email) = lower(p_email);
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.claim_rfqs_by_email(uuid, text) from public, anon, authenticated;

alter table public.rfq_invites
  add column if not exists cro_org_id uuid references public.cro_orgs(id) on delete set null,
  add column if not exists declined_at timestamptz,
  add column if not exists decline_reason text;
create index if not exists rfq_invites_org_idx on public.rfq_invites (cro_org_id);

alter table public.cro_quotes
  add column if not exists cro_org_id uuid references public.cro_orgs(id) on delete set null,
  add column if not exists submitted_by uuid references auth.users(id) on delete set null,
  add column if not exists includes text[] not null default '{}';   -- 기본 포함 항목 (임상병리 / 조직병리 / TK / …)

alter table public.rfq_awards
  add column if not exists invite_id       uuid references public.rfq_invites(id) on delete set null,
  add column if not exists cro_org_id      uuid references public.cro_orgs(id) on delete set null,
  add column if not exists selected_by     uuid references auth.users(id) on delete set null,
  add column if not exists contract_reported_at timestamptz,
  add column if not exists contract_note   text;

-- ─────────────────────────────────────────────
-- 4) 진행 이력 — 요청 상세의 타임라인이 된다
-- ─────────────────────────────────────────────
create table if not exists public.rfq_events (
  id         uuid primary key default gen_random_uuid(),
  rfq_id     uuid not null references public.rfq_requests(id) on delete cascade,
  kind       text not null,            -- received | distributed | quote_submitted | compared | selected | contract | closed | note
  title      text not null,
  body       text,
  actor_id   uuid references auth.users(id) on delete set null,
  meta       jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists rfq_events_rfq_idx on public.rfq_events (rfq_id, created_at);

-- ─────────────────────────────────────────────
-- 5) 알림 — 앱 내 알림. 이메일은 서버가 Resend로 함께 보낸다
-- ─────────────────────────────────────────────
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null,            -- 접수 | 배포 | 견적 | 비교 | 선정 | 계약 | 기관 | 시스템
  title      text not null,
  body       text,
  href       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- updated_at 자동 갱신
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
drop trigger if exists cro_orgs_touch on public.cro_orgs;
create trigger cro_orgs_touch before update on public.cro_orgs
  for each row execute function public.touch_updated_at();

-- RLS: 서버(service role)만 접근
alter table public.cro_orgs      enable row level security;
alter table public.profiles      enable row level security;
alter table public.rfq_events    enable row level security;
alter table public.notifications enable row level security;

-- 운영자 지정: 가입한 뒤 아래를 실행 (또는 ADMIN_EMAIL 환경변수와 같은 이메일로 가입하면 서버가 자동 지정)
-- update public.profiles set role = 'admin' where lower(email) = 'ops@example.com';
