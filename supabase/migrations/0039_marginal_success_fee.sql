-- 단추(Danchu) 39차: 성사 수수료를 구간 초과분 누진으로 (2026-11-10 대표 결정)
-- 0038 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경
-- 0031 은 금액이 속한 구간의 요율 하나를 금액 전체에 곱했다. 그래서 구간 경계에서 수수료가 한꺼번에 뛰었다
-- (9,999만 원 약 200만 원, 1억 원 500만 원 / 4억 9,999만 원 약 2,500만 원, 5억 원 3,500만 원).
-- 이제는 구간마다 그 구간에 걸친 금액에만 그 구간의 요율을 곱해 더한다.
--   5,000만 원까지 0 / 5,000만 원 초과 1억 원까지 2% / 1억 원 초과 5억 원까지 5% / 5억 원 초과분 7%
--   예: 8,000만 원 60만 원, 1억 원 100만 원, 3억 원 1,100만 원, 5억 원 2,100만 원, 7억 원 3,500만 원
-- 바뀌지 않는 것
-- - 대상 판정: 선정 견적 금액이 5,000만 원 이상인 수주만 (billing_success_fee_min).
-- - 예상(guidance)은 선정 견적 금액으로, 정산(settlement)은 확정된 계약 금액으로 계산한다.
-- - 기관 특별 조건(cro_orgs.fee_rate)이 있으면 그 요율을 금액 전체에 곱한다.
-- - 견적서 송부 비용(billing_send_fee), 월 구독료, 청구 시작일.
-- billing_awards 의 fee_rate 열은 이제 기관 특별 조건 요율만 돌려준다. 요금표로 계산한 행은 null 이다 (요율이 하나가 아니다).
-- billing_success_rate(bigint) 는 그 금액이 걸친 가장 높은 구간의 요율로 남긴다. 수수료 계산에는 쓰지 않는다.

do $$ begin
  if to_regclass('public.cro_crm_deals') is null or public.danchu_schema_version() < 38 then
    raise exception '0038_cro_crm.sql 을 먼저 적용해 주세요';
  end if;
end $$;

-- 요금표 성사 수수료 (원). 구간 초과분 누진. 금액 없음·5,000만 원 이하는 0
create or replace function public.billing_success_fee(p_amount bigint) returns bigint
language sql immutable as $$
  select case when p_amount is null or p_amount <= 50000000 then 0::bigint else round((
      (least(p_amount, 100000000) - 50000000) * 2
    + greatest(least(p_amount, 500000000) - 100000000, 0) * 5
    + greatest(p_amount - 500000000, 0) * 7
  )::numeric / 100)::bigint end
$$;
comment on function public.billing_success_fee(bigint) is '요금표 성사 수수료 (0039). 5,000만 원 초과 1억 원까지 2%, 1억 원 초과 5억 원까지 5%, 5억 원 초과분 7% 를 더한 값. lib/billing.ts scheduleSuccessFee 와 같다';
comment on function public.billing_success_rate(bigint) is '그 금액이 걸친 가장 높은 구간의 요율 (0031). 0039 부터 수수료 계산에는 쓰지 않는다 (billing_success_fee)';

create or replace function public.billing_awards(p_from date, p_to date)
returns table (
  kind text, award_id uuid, rfq_id uuid, rfq_no text, org_id uuid, org_name text,
  quote_amount bigint, contract_amount bigint, contract_status text,
  awarded_at timestamptz, contract_date date, contract_reported_at timestamptz,
  fee_rate numeric, fee bigint, invite_billable boolean, invite_joined boolean,
  contract_confirmed_at timestamptz, contract_confirmed_via text
)
language sql stable
security definer set search_path = public
as $$
  with a as (
    select a.*, coalesce(a.fee_basis_amount, q.total_amount) as basis, r.rfq_no as no,
           o.id as oid, o.name as oname,
           o.fee_rate as rate,
           coalesce(i.billable, true) as ibill,
           public.billing_join_paid(i.joined_at, i.join_channel, i.join_terms_version) as ijoined
    from public.rfq_awards a
    join public.rfq_requests r on r.id = a.rfq_id
    left join public.cro_quotes q on q.id = a.quote_id
    left join public.rfq_invites i on i.id = a.invite_id
    join public.cro_orgs o on o.id = coalesce(a.cro_org_id, q.cro_org_id)
    where coalesce(a.fee_basis_amount, q.total_amount) >= public.billing_success_fee_min()
  )
  select 'guidance', a.id, a.rfq_id, a.no, a.oid, a.oname, a.basis, a.contract_amount, a.contract_status,
         a.awarded_at, a.contract_date, a.contract_reported_at, a.rate,
         case when a.rate is null then public.billing_success_fee(a.basis) else round(a.basis * a.rate)::bigint end,
         a.ibill, a.ijoined, a.contract_confirmed_at, a.contract_confirmed_via
  from a
  where a.contract_status <> 'not_signed'
    and (a.awarded_at at time zone 'Asia/Seoul')::date >= p_from
    and (a.awarded_at at time zone 'Asia/Seoul')::date <  p_to
  union all
  select 'settlement', a.id, a.rfq_id, a.no, a.oid, a.oname, a.basis, a.contract_amount, a.contract_status,
         a.awarded_at, a.contract_date, a.contract_reported_at, a.rate,
         case when a.rate is null then public.billing_success_fee(a.contract_amount) else round(a.contract_amount * a.rate)::bigint end,
         a.ibill, a.ijoined, a.contract_confirmed_at, a.contract_confirmed_via
  from a
  where a.contract_status = 'signed'
    and a.contract_confirmed_at is not null
    and a.contract_amount is not null
    and (a.contract_confirmed_at at time zone 'Asia/Seoul')::date >= p_from
    and (a.contract_confirmed_at at time zone 'Asia/Seoul')::date <  p_to
  order by 1, 6, 10;
$$;

comment on column public.cro_orgs.fee_rate is '계약 성사 수수료율 특별 조건 (0031). 비어 있으면 요금표의 구간 초과분 누진(billing_success_fee, 0039)';

revoke execute on function public.billing_success_fee(bigint) from public, anon, authenticated;
grant execute on function public.billing_success_fee(bigint) to service_role;
revoke execute on function public.billing_awards(date, date) from public, anon, authenticated;
grant execute on function public.billing_awards(date, date) to service_role;

create or replace function public.danchu_schema_version()
returns int
language sql
immutable
as $$ select 39 $$;
comment on function public.danchu_schema_version() is
  '마지막으로 적용한 마이그레이션 번호 (0039). 앱(lib/schema-version.ts REQUIRED_SCHEMA_VERSION)과 npm run check:schema 가 확인한다. 다음 마이그레이션이 새 번호로 바꾼다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;
grant execute on function public.danchu_schema_version() to service_role;
