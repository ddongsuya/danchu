-- 단추(Danchu) 30차: 사전예약 (2026-11-03)
-- 0029 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경
--   정식 오픈(2027-01-01) 전 danchu.kr/early 에서 의뢰자·기관이 미리 예약한다.
--   오픈 안내 메일을 보내고, 갈래·예정 시기·참여 생각을 세어 기관 설득에 쓴다.
--   같은 갈래에 같은 이메일로 다시 예약하면 새 행 대신 고른 값을 바꾼다.
--   개인정보처리방침 3항: 정식 오픈일부터 6개월(2027-07-01) 뒤 매일 정리 작업이 지운다 (lib/retention.ts).
--   서비스 키로만 읽고 쓴다 (RLS 켜짐·정책 없음·anon·authenticated 권한 회수). IP 는 남기지 않는다.

create table if not exists public.early_signups (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  email text not null,
  org text,
  org_type text,
  kinds text[] not null default '{}',
  timing text,
  glp text[] not null default '{}',
  intent text,
  ask text,
  source text,
  agreed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'early_signups_role_chk') then
    alter table public.early_signups add constraint early_signups_role_chk check (role in ('req', 'cro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'early_signups_email_chk') then
    alter table public.early_signups add constraint early_signups_email_chk check (email = lower(btrim(email)) and email like '%_@_%' and length(email) <= 320);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'early_signups_kinds_chk') then
    alter table public.early_signups add constraint early_signups_kinds_chk check (cardinality(kinds) between 1 and 4 and kinds <@ array['Tox', 'PD', 'PK', 'Other']);
  end if;
  -- 기관 예약은 기관명과 참여 생각이 있다
  if not exists (select 1 from pg_constraint where conname = 'early_signups_cro_chk') then
    alter table public.early_signups add constraint early_signups_cro_chk check (role <> 'cro' or (org is not null and intent is not null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'early_signups_len_chk') then
    alter table public.early_signups add constraint early_signups_len_chk check (coalesce(length(org), 0) <= 100 and coalesce(length(ask), 0) <= 1000 and coalesce(length(source), 0) <= 120);
  end if;
end $$;

create unique index if not exists early_signups_role_email_key on public.early_signups (role, email);
create index if not exists early_signups_created_idx on public.early_signups (created_at desc);

alter table public.early_signups enable row level security;
revoke all on table public.early_signups from public, anon, authenticated;
grant select, insert, update, delete on table public.early_signups to service_role;
comment on table public.early_signups is
  '사전예약 (0030). /early 양식. 같은 갈래·이메일은 한 행. 정식 오픈 6개월 뒤(2027-07-01) 정리 작업이 지운다. 서비스 키로만 읽고 쓴다';

-- ─────────────────────────────────────────────
-- 스키마 버전
-- ─────────────────────────────────────────────
create or replace function public.danchu_schema_version() returns int language sql immutable as $$ select 30 $$;
comment on function public.danchu_schema_version() is '마지막으로 적용한 마이그레이션 번호 (0030). lib/schema-version.ts REQUIRED_SCHEMA_VERSION 과 맞춘다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;
grant execute on function public.danchu_schema_version() to service_role;
