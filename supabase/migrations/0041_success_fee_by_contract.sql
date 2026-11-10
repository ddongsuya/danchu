-- 단추(Danchu) 41차: 성사 수수료 대상 판정을 확정된 계약 금액으로 (2026-11-10 대표 결정 3)
-- 0040 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경
-- 0039 까지는 대상 판정은 선정 견적 금액(5,000만 원 이상)으로, 계산은 확정된 계약 금액으로 했다. 기준이 둘이라
-- 선정 견적 6,000만 원에 계약 4,000만 원이면 대상이면서 수수료 0원, 선정 견적 4,000만 원에 계약 7,000만 원이면 대상이 아니었다.
-- 이제 정산(settlement)은 확정된 계약 금액 하나로 본다: 계약 금액이 5,000만 원 이상인 확정 계약만 정산 행으로 나온다.
-- 예상(guidance)은 계약 전 안내라서 그대로 선정 견적 금액 5,000만 원 이상만 보여 준다 (청구 합계에 들어가지 않는다).
-- 바뀌지 않는 것: 구간 초과분 누진 계산(billing_success_fee), 기관 특별 조건 요율, 송부 비용, 월 구독료, 청구 시작일.
-- 기관 이용약관(app/terms/cro) 제9조 제4항, lib/billing.ts successFeeView 와 같다.

do $$ begin
  if public.danchu_schema_version() < 40 then
    raise exception '0040_crm_purge.sql 을 먼저 적용해 주세요';
  end if;
end $$;

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
  )
  select 'guidance', a.id, a.rfq_id, a.no, a.oid, a.oname, a.basis, a.contract_amount, a.contract_status,
         a.awarded_at, a.contract_date, a.contract_reported_at, a.rate,
         case when a.rate is null then public.billing_success_fee(a.basis) else round(a.basis * a.rate)::bigint end,
         a.ibill, a.ijoined, a.contract_confirmed_at, a.contract_confirmed_via
  from a
  where a.basis >= public.billing_success_fee_min()
    and a.contract_status <> 'not_signed'
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
    and a.contract_amount >= public.billing_success_fee_min()
    and (a.contract_confirmed_at at time zone 'Asia/Seoul')::date >= p_from
    and (a.contract_confirmed_at at time zone 'Asia/Seoul')::date <  p_to
  order by 1, 6, 10;
$$;

comment on function public.billing_awards(date, date) is '성사 수수료 행 (0041). guidance = 선정 견적 5,000만 원 이상의 예상(안내), settlement = 확정된 계약 금액 5,000만 원 이상의 정산';

revoke execute on function public.billing_awards(date, date) from public, anon, authenticated;
grant execute on function public.billing_awards(date, date) to service_role;

create or replace function public.danchu_schema_version()
returns int
language sql
immutable
as $$ select 41 $$;
comment on function public.danchu_schema_version() is
  '마지막으로 적용한 마이그레이션 번호 (0041). 앱(lib/schema-version.ts REQUIRED_SCHEMA_VERSION)과 npm run check:schema 가 확인한다. 다음 마이그레이션이 새 번호로 바꾼다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;
grant execute on function public.danchu_schema_version() to service_role;
