-- 단추(Danchu) 6차: 기관 합류 승인 · 가입 트리거 신뢰 제거 · 공유 속도 제한 · 상태 CHECK
-- schema_catalog_variants.sql 실행 후 Supabase SQL Editor에 그대로 붙여 넣어 실행하세요.
--
-- 배경
-- 1) 기존 기관 이름으로 CRO 가입하면 바로 그 기관 담당자가 되던 문제를 막는다.
--    합류 신청은 pending_org_id 에 두고, 운영자가 사용자 화면에서 연결해야 cro_org_id 가 채워진다.
-- 2) 가입 트리거는 user_metadata 의 role · cro_org_id 를 더 이상 믿지 않는다.
--    (anon 키로 auth.signUp 을 직접 호출해 역할·기관을 주입하는 경로 차단)
--    역할과 기관은 서버가 계정을 만든 뒤 service role 로 직접 적는다.
-- 3) 서버리스 인스턴스마다 초기화되던 메모리 속도 제한을 DB 함수로 옮긴다.

-- ─────────────────────────────────────────────
-- 1) 합류 신청 상태
-- ─────────────────────────────────────────────
alter table public.profiles
  add column if not exists pending_org_id uuid references public.cro_orgs(id) on delete set null;
create index if not exists profiles_pending_org_idx on public.profiles (pending_org_id);

-- ─────────────────────────────────────────────
-- 2) 가입 트리거: 이름·회사 같은 표시 정보만 옮기고 역할·기관은 기본값
-- ─────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  md jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, email, role, name, company, dept, phone, org_type, cro_org_id)
  values (new.id, new.email, 'requester', md->>'name', md->>'company', md->>'dept', md->>'phone', md->>'org_type', null)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ─────────────────────────────────────────────
-- 3) 공유 속도 제한 — 키별 고정 윈도 카운터. true 면 제한 초과.
-- ─────────────────────────────────────────────
create table if not exists public.rate_limits (
  key          text primary key,
  window_start timestamptz not null default now(),
  count        int not null default 0
);
alter table public.rate_limits enable row level security;

create or replace function public.rate_limit_hit(p_key text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_count int;
  v_cutoff timestamptz := now() - make_interval(secs => p_window_seconds);
begin
  insert into public.rate_limits (key, window_start, count) values (p_key, now(), 1)
  on conflict (key) do update set
    count        = case when public.rate_limits.window_start < v_cutoff then 1 else public.rate_limits.count + 1 end,
    window_start = case when public.rate_limits.window_start < v_cutoff then now() else public.rate_limits.window_start end
  returning count into v_count;
  return v_count > p_limit;
end;
$$;
revoke execute on function public.rate_limit_hit(text, int, int) from public, anon, authenticated;

-- 오래된 카운터 정리 (매일 크론이 부른다)
create or replace function public.rate_limit_cleanup()
returns int
language plpgsql
security definer set search_path = public
as $$
declare n int;
begin
  delete from public.rate_limits where window_start < now() - interval '1 day';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.rate_limit_cleanup() from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 4) 상태 열거 CHECK — 코드가 쓰는 값만 허용
-- ─────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rfq_requests_status_chk') then
    alter table public.rfq_requests add constraint rfq_requests_status_chk
      check (status in ('received','distributed','quoted','compared','selected','contracting','closed','cancelled'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rfq_invites_status_chk') then
    alter table public.rfq_invites add constraint rfq_invites_status_chk
      check (status in ('sent','draft','submitted','declined','expired'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cro_quotes_status_chk') then
    alter table public.cro_quotes add constraint cro_quotes_status_chk
      check (status in ('draft','submitted'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cro_orgs_status_chk') then
    alter table public.cro_orgs add constraint cro_orgs_status_chk
      check (status in ('pending','approved','rejected','suspended'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_chk') then
    alter table public.profiles add constraint profiles_role_chk
      check (role in ('requester','cro','admin'));
  end if;
end $$;

-- 대시보드에서 함께 할 일 (SQL로는 바꿀 수 없다)
-- Authentication → Sign In / Providers → "Allow new users to sign up" 끄기.
-- 가입은 서버가 auth.admin.createUser 로만 만들므로 공개 가입은 필요 없다.
