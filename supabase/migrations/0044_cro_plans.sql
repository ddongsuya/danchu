-- 단추(Danchu) 44차: 기관 요금제 무료·Plus·Pro (2026-11-13)
-- 0043 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 요금제 (2026-11-13 확정, lib/plans.ts 와 같은 값):
--   free 0원      5,000만 원 미만 견적 월 5건, 담당자 1명
--   plus 50만 원  5,000만 원 미만 견적 무제한, 시험 관리, 담당자 3명
--   pro  100만 원 plus 전체 + 견적서 작성 툴, 견적서 디자인 브랜딩 연 1회, 고객 관리, 담당자 무제한
-- 시범 운영(2027-12-31까지)은 전 요금제 무료이고 기능 제한이 없다. 요금제는 2028-01-01(billing_paid_from)부터 효력이 있다.
--
-- cro_orgs.plan       지금 요금제. 기본 free
-- cro_orgs.plan_next  예약한 요금제. plan_next_from 날짜(서울)부터 plan 대신 쓴다. 시범 운영 중 고른 요금제는 2028-01-01 예약이다
-- cro_plan_changes    바꾼 기록. 올리기 차액(prorated)은 결제 연동 뒤 청구에 쓴다. 지금은 기록만 한다
-- 더하기만 하는 변경이라 옛 코드는 그대로 돈다. 월 구독료 청구(cro_orgs.monthly_fee)는 건드리지 않는다.

do $$ begin
  if public.danchu_schema_version() < 43 then
    raise exception '0043_early_done_mail.sql 을 먼저 적용해 주세요';
  end if;
end $$;

alter table public.cro_orgs add column if not exists plan text not null default 'free';
alter table public.cro_orgs add column if not exists plan_next text;
alter table public.cro_orgs add column if not exists plan_next_from date;

do $$ begin
  alter table public.cro_orgs add constraint cro_orgs_plan_check check (plan in ('free', 'plus', 'pro'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.cro_orgs add constraint cro_orgs_plan_next_check check (
    (plan_next is null and plan_next_from is null) or (plan_next in ('free', 'plus', 'pro') and plan_next_from is not null)
  );
exception when duplicate_object then null; end $$;

comment on column public.cro_orgs.plan is '지금 요금제 free·plus·pro (0044). 2028-01-01 전에는 기능 제한 없음';
comment on column public.cro_orgs.plan_next is '예약한 요금제 (0044). plan_next_from(서울 날짜)부터 plan 대신 쓴다';
comment on column public.cro_orgs.plan_next_from is '예약한 요금제 적용일 (0044)';

create table if not exists public.cro_plan_changes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.cro_orgs(id) on delete cascade,
  from_plan text not null check (from_plan in ('free', 'plus', 'pro')),
  to_plan text not null check (to_plan in ('free', 'plus', 'pro')),
  effective_from date not null,
  -- 올리기 차액 (원, 부가세 별도). 내리기·예약은 0
  prorated_amount int not null default 0,
  requested_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists cro_plan_changes_org_idx on public.cro_plan_changes (org_id, created_at desc);
alter table public.cro_plan_changes enable row level security;
revoke all on public.cro_plan_changes from anon, authenticated;
comment on table public.cro_plan_changes is '기관 요금제 변경 기록 (0044). 서비스 키로만 읽고 쓴다';

create or replace function public.danchu_schema_version()
returns int
language sql
immutable
as $$ select 44 $$;
comment on function public.danchu_schema_version() is
  '마지막으로 적용한 마이그레이션 번호 (0044). 앱(lib/schema-version.ts REQUIRED_SCHEMA_VERSION)과 npm run check:schema 가 확인한다. 다음 마이그레이션이 새 번호로 바꾼다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;
grant execute on function public.danchu_schema_version() to service_role;
