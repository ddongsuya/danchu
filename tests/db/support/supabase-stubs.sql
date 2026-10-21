-- 단추 DB 테스트용 Supabase 최소 대역 (scripts/db-test.sh 가 마이그레이션 전에 한 번 적용한다)
-- 실제 Supabase 에는 이미 있는 것들이다. 운영 DB 에는 적용하지 않는다.
-- 마이그레이션이 참조하는 만큼만 흉내 낸다: 역할, auth 스키마(users, uid/role/jwt), storage 스키마(buckets, objects).

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;

create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text,
  email_confirmed_at  timestamptz,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  raw_app_meta_data   jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- Supabase 와 같게 request.jwt.claims 설정값에서 읽는다. 테스트는 set_config('request.jwt.claims', '{"sub": "..."}', true) 로 흉내 낸다
create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(auth.jwt()->>'sub', '')::uuid
$$;
create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(auth.jwt()->>'role', 'anon')
$$;

create table if not exists storage.buckets (
  id                  text primary key,
  name                text not null,
  owner               uuid,
  public              boolean default false,
  file_size_limit     bigint,
  allowed_mime_types  text[],
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);
create table if not exists storage.objects (
  id          uuid primary key default gen_random_uuid(),
  bucket_id   text references storage.buckets(id),
  name        text,
  owner       uuid,
  metadata    jsonb,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

grant usage on schema auth, storage to anon, authenticated, service_role;

-- Supabase 기본 권한 흉내: public 스키마에 새로 만드는 표·함수·시퀀스는 anon·authenticated·service_role 에 모두 열린다.
-- 그래서 마이그레이션이 RLS 를 켜고 함수 실행권을 회수(revoke)해야만 막힌다. 이 대역이 없으면 권한 테스트가 그냥 통과한다
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
