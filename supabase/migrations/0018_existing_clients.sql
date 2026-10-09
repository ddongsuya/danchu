-- 단추(Danchu) 18차: 기존 고객 면제 (성사수수료 신규 의뢰자 한정)
-- 0017 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경 (내부분석·참여 약정서 제5조 6항)
-- 기관이 이미 거래하던 의뢰자가 단추를 통해 같은 기관에 발주하면 성사수수료를 면제한다.
-- 기관이 기존 고객 목록을 등록해 두면 선정 시 자동으로 표시되고, 기관이 직접 신고할 수도 있다. 면제 확정은 운영자가 한다.

create table if not exists public.cro_org_clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.cro_orgs(id) on delete cascade,
  name text not null,
  name_norm text generated always as (lower(regexp_replace(name, '\s+', '', 'g'))) stored,
  business_no text,
  business_no_norm text generated always as (nullif(regexp_replace(coalesce(business_no, ''), '[^0-9]', '', 'g'), '')) stored,
  last_contract_on date,
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);
create unique index if not exists cro_org_clients_org_name_key on public.cro_org_clients (org_id, name_norm);
create index if not exists cro_org_clients_org_idx on public.cro_org_clients (org_id);
alter table public.cro_org_clients enable row level security;

alter table public.rfq_awards
  add column if not exists existing_client_claim text,
  add column if not exists existing_client_claimed_at timestamptz,
  add column if not exists fee_exempt boolean not null default false,
  add column if not exists fee_exempt_reason text,
  add column if not exists fee_exempt_at timestamptz,
  add column if not exists fee_exempt_by uuid;

-- 집계: 면제된 수주는 선정 견적 합계(성사수수료 기준)에서 빼고 건수를 따로 센다. 반환 열이 바뀌므로 지우고 다시 만든다
drop function if exists public.billing_summary(date, date);
create or replace function public.billing_summary(p_from date, p_to date)
returns table (
  org_id uuid, org_name text, per_request_fee int, monthly_cap int,
  delivered int, billable int, excluded int, matched int, nominated int, manual int,
  replied int, declined int, unanswered int, selected int, selected_amount bigint, exempt int
)
language sql
security definer set search_path = public
as $$
  with inv as (
    select i.*, (i.sent_at at time zone 'Asia/Seoul')::date as sent_day
    from public.rfq_invites i
    where i.cro_org_id is not null
      and (i.sent_at at time zone 'Asia/Seoul')::date >= p_from
      and (i.sent_at at time zone 'Asia/Seoul')::date <  p_to
  ),
  aw as (
    select a.invite_id, a.fee_basis_amount, a.fee_exempt
    from public.rfq_awards a
    where a.invite_id is not null
  )
  select
    o.id, o.name, o.per_request_fee, o.monthly_cap,
    count(inv.id)::int,
    count(inv.id) filter (where inv.billable)::int,
    count(inv.id) filter (where not inv.billable)::int,
    count(inv.id) filter (where inv.source = 'matched')::int,
    count(inv.id) filter (where inv.source = 'nominated')::int,
    count(inv.id) filter (where inv.source = 'manual')::int,
    count(inv.id) filter (where inv.status = 'submitted')::int,
    count(inv.id) filter (where inv.status = 'declined')::int,
    count(inv.id) filter (where inv.status in ('sent', 'draft', 'expired'))::int,
    count(aw.invite_id)::int,
    coalesce(sum(aw.fee_basis_amount) filter (where not aw.fee_exempt), 0)::bigint,
    count(aw.invite_id) filter (where aw.fee_exempt)::int
  from public.cro_orgs o
  join inv on inv.cro_org_id = o.id
  left join aw on aw.invite_id = inv.id
  group by o.id, o.name, o.per_request_fee, o.monthly_cap
  order by count(inv.id) desc, o.name;
$$;
revoke execute on function public.billing_summary(date, date) from public, anon, authenticated;
