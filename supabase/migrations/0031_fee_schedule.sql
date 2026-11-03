-- 단추(Danchu) 31차: 정식 요금표 (2026-11-03 대표 결정) · 시범 운영·유료 시작 날짜
-- 0030 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경 (2026-11-03 결정, 이 파일이 기준. 0020 의 구간 4) 과 0024 의 참고 단가를 대신한다)
-- 1) 일정: 사전예약 2027-01-01 ~ 2027-05-31, 시범 운영 2027-06-01 ~ 2027-12-31(기관도 전부 무료), 정식 서비스 2028-01-01.
--    청구는 2028-01-01 (서울) 부터다. 그 전에 참여한 요청은 끝까지 청구하지 않는다(약관 "시범 기간에 참여한 요청은 그 뒤에도 무료").
--    그래서 참여 판(join_terms_version)이 pilot- 으로 시작하거나 참여 시각이 billing_paid_from() 전이면 join_status = pilot 이다.
--    월 구독료도 billing_paid_from() 이 속한 달부터만 명세에 나온다 (0020 은 시범 기간에도 구독료가 합계에 들어갈 수 있었다).
-- 2) 요금표 (모든 금액 부가세 별도). 구간은 견적 총액(cro_quotes.total_amount)으로 정한다.
--      1원 ~ 49,999,999원          : 월 구독료(1,000,000원)에 포함. 건당 비용 없음
--      50,000,000원 ~ 99,999,999원 : 견적서 송부 비용 30,000원 · 계약 성사 수수료 2%
--      100,000,000원 ~ 499,999,999원: 견적서 송부 비용 50,000원 · 계약 성사 수수료 5%
--      500,000,000원 이상           : 견적서 송부 비용 50,000원 · 계약 성사 수수료 7%
--    구간 이름(billing_tier)은 0020 과 같게 둔다: subscription(5천만 원 미만) · per_quote_success(5천만 원 이상) · no_amount.
--    per_quote(1,000만~5,000만 원)는 더 나오지 않는다 (그 구간이 구독에 들어갔다).
-- 3) 성사 수수료율은 선정 견적 금액(rfq_awards.fee_basis_amount)의 구간으로 정하고, 확정된 계약 금액에 곱한다.
--    계약 금액을 구간 경계 아래로 낮춰 보고해도 요율이 내려가지 않는다. 정산 시점·조건(확정된 달, 참여 기록)은 0025 그대로다.
-- 4) 기관별 값(cro_orgs.per_request_fee·fee_rate)은 이제 "요금표 대신 쓸 특별 조건"이다. 비어 있으면 요금표를 쓴다.
--    그래서 단가·요율이 "미정"인 경우가 없다 (billing_summary.terms_pending 은 늘 false).
--    월 구독료(cro_orgs.monthly_fee)는 운영자가 구독을 시작한 기관에 넣는 금액이다. 기준 금액은 billing_subscription_fee().
-- 5) 시범 기간 참고 수치(billing_reference)도 이 요금표로 계산한다 ("유료였다면"). 0024 의 참고 단가 30,000원·3% 는 쓰지 않는다.
-- 기준 값은 lib/billing.ts 와 같다 (tests/billing-rules.test.ts 가 같은지 본다).

-- ─────────────────────────────────────────────
-- 0) 선행 마이그레이션 확인
-- ─────────────────────────────────────────────
do $$ begin
  if to_regclass('public.early_signups') is null then
    raise exception '0030_early_signups.sql 을 먼저 적용해 주세요';
  end if;
end $$;

-- ─────────────────────────────────────────────
-- 1) 날짜와 요금표
-- ─────────────────────────────────────────────
create or replace function public.billing_pilot_from() returns date
language sql immutable as $$ select date '2027-06-01' $$;   -- 시범 운영 시작 (서울)
create or replace function public.billing_paid_from() returns date
language sql immutable as $$ select date '2028-01-01' $$;   -- 청구 시작 (서울). 이 날 전에 참여한 요청은 청구하지 않는다
create or replace function public.billing_subscription_fee() returns int
language sql immutable as $$ select 1000000 $$;             -- 월 구독료 기준 금액 (원)

-- 0020 의 기준 금액을 새 요금표로: 5천만 원 미만은 구독, 5천만 원 이상은 송부 비용 + 성사 수수료
create or replace function public.billing_subscription_max_excl() returns bigint
language sql immutable as $$ select 50000000::bigint $$;
create or replace function public.billing_success_fee_min() returns bigint
language sql immutable as $$ select 50000000::bigint $$;

-- 견적서 송부 비용 (원). 5천만 원 미만·금액 없음은 0
create or replace function public.billing_send_fee(p_amount bigint) returns int
language sql immutable as $$
  select case
    when p_amount is null or p_amount < 50000000 then 0
    when p_amount < 100000000 then 30000
    else 50000
  end
$$;

-- 계약 성사 수수료율. 기준 금액(선정 견적)이 5천만 원 미만이면 0
create or replace function public.billing_success_rate(p_amount bigint) returns numeric
language sql immutable as $$
  select case
    when p_amount is null or p_amount < 50000000 then 0::numeric
    when p_amount < 100000000 then 0.02::numeric
    when p_amount < 500000000 then 0.05::numeric
    else 0.07::numeric
  end
$$;

-- 이 참여가 청구 대상 참여인가: 포털·회신 링크로 본인이 참여했고, 시범 판이 아니며, 청구 시작일 뒤에 참여했다
create or replace function public.billing_join_paid(p_joined_at timestamptz, p_channel text, p_version text) returns boolean
language sql stable as $$
  select coalesce(
    p_joined_at is not null
    and p_channel in ('portal', 'token')
    and coalesce(p_version, '') not like 'pilot-%'
    and (p_joined_at at time zone 'Asia/Seoul')::date >= public.billing_paid_from(),
    false)
$$;

-- 시범(무료) 참여인가: 본인 참여 기록이 있지만 시범 판이거나 청구 시작일 전에 참여했다
create or replace function public.billing_join_pilot(p_joined_at timestamptz, p_channel text, p_version text) returns boolean
language sql stable as $$
  select coalesce(
    p_joined_at is not null
    and p_channel in ('portal', 'token')
    and (coalesce(p_version, '') like 'pilot-%'
         or (p_joined_at at time zone 'Asia/Seoul')::date < public.billing_paid_from()),
    false)
$$;

-- ─────────────────────────────────────────────
-- 2) 견적 줄: 송부 비용은 기관 특별 조건(per_request_fee)이 없으면 요금표
--    반환 열은 0023 과 같다. per_request_fee 열은 이 줄에 적용한 송부 비용이다
-- ─────────────────────────────────────────────
create or replace function public.billing_lines(p_from date, p_to date)
returns table (
  quote_id uuid, invite_id uuid, rfq_id uuid, rfq_no text, org_id uuid, org_name text, managed boolean,
  first_submitted_at timestamptz, billing_at timestamptz, total_amount bigint, entry_source text, auto boolean, invite_source text,
  billable boolean, bill_excluded_reason text, tier text, chargeable boolean, per_request_fee int, fee_due bigint,
  join_status text, joined_at timestamptz
)
language sql stable
security definer set search_path = public
as $$
  select
    q.id, q.invite_id, q.rfq_id, q.rfq_no, o.id, o.name, o.managed,
    q.first_submitted_at, q.billing_at, q.total_amount, q.entry_source, q.auto, i.source,
    i.billable, i.bill_excluded_reason,
    public.billing_tier(q.total_amount),
    (i.billable and j.ok and public.billing_tier(q.total_amount) = 'per_quote_success'),
    coalesce(o.per_request_fee, public.billing_send_fee(q.total_amount)),
    case when i.billable and j.ok and public.billing_tier(q.total_amount) = 'per_quote_success'
         then coalesce(o.per_request_fee, public.billing_send_fee(q.total_amount))::bigint else 0 end,
    j.status, i.joined_at
  from public.cro_quotes q
  join public.rfq_invites i on i.id = q.invite_id
  join public.cro_orgs o on o.id = coalesce(q.cro_org_id, i.cro_org_id)
  cross join lateral (
    select case when i.joined_at is null then 'not_joined' when i.join_channel = 'legacy' then 'legacy'
                when public.billing_join_pilot(i.joined_at, i.join_channel, i.join_terms_version) then 'pilot' else 'joined' end as status,
           public.billing_join_paid(i.joined_at, i.join_channel, i.join_terms_version) as ok
  ) j
  where q.status = 'submitted'
    and q.first_submitted_at is not null
    and (coalesce(q.billing_at, q.first_submitted_at) at time zone 'Asia/Seoul')::date >= p_from
    and (coalesce(q.billing_at, q.first_submitted_at) at time zone 'Asia/Seoul')::date <  p_to
  order by o.name, coalesce(q.billing_at, q.first_submitted_at);
$$;
revoke execute on function public.billing_lines(date, date) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 3) 성사 수수료: 요율은 기관 특별 조건(fee_rate)이 없으면 선정 견적 금액의 구간 요율. 반환 열은 0025 와 같다
-- ─────────────────────────────────────────────
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
           coalesce(o.fee_rate, public.billing_success_rate(coalesce(a.fee_basis_amount, q.total_amount))) as rate,
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
         a.awarded_at, a.contract_date, a.contract_reported_at, a.rate, round(a.basis * a.rate)::bigint, a.ibill, a.ijoined,
         a.contract_confirmed_at, a.contract_confirmed_via
  from a
  where a.contract_status <> 'not_signed'
    and (a.awarded_at at time zone 'Asia/Seoul')::date >= p_from
    and (a.awarded_at at time zone 'Asia/Seoul')::date <  p_to
  union all
  select 'settlement', a.id, a.rfq_id, a.no, a.oid, a.oname, a.basis, a.contract_amount, a.contract_status,
         a.awarded_at, a.contract_date, a.contract_reported_at, a.rate, round(a.contract_amount * a.rate)::bigint, a.ibill, a.ijoined,
         a.contract_confirmed_at, a.contract_confirmed_via
  from a
  where a.contract_status = 'signed'
    and a.contract_confirmed_at is not null
    and a.contract_amount is not null
    and (a.contract_confirmed_at at time zone 'Asia/Seoul')::date >= p_from
    and (a.contract_confirmed_at at time zone 'Asia/Seoul')::date <  p_to
  order by 1, 6, 10;
$$;
revoke execute on function public.billing_awards(date, date) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 4) 시범 기간 참고 수치: 요금표로 "유료였다면"을 센다. 반환 열은 0024 와 같다.
--    per_quote_unit 은 기관 특별 조건이 있으면 그 값, 없으면 0 (견적마다 요금표 금액이 달라 한 단가로 적지 않는다).
--    source: org 기관 특별 조건 · schedule 요금표
-- ─────────────────────────────────────────────
create or replace function public.billing_reference(p_from date, p_to date)
returns table (
  org_id uuid, org_name text,
  subscription_count int, per_quote_count int, per_quote_unit int, per_quote_unit_source text, per_quote_fee bigint,
  success_count int, success_contract_amount bigint, success_rate numeric, success_rate_source text, success_fee bigint
)
language sql stable
security definer set search_path = public
as $$
  with ln as (
    select l.org_id as oid,
           count(*) filter (where l.tier = 'subscription')::int as sub_n,
           count(*) filter (where l.tier = 'per_quote_success')::int as pq_n,
           coalesce(sum(l.per_request_fee) filter (where l.tier = 'per_quote_success'), 0)::bigint as pq_fee
    from public.billing_lines(p_from, p_to) l
    where l.billable and l.join_status in ('pilot', 'legacy')
    group by l.org_id
  ),
  aw as (
    select b.org_id as oid,
           count(*)::int as n,
           coalesce(sum(b.contract_amount), 0)::bigint as amt,
           coalesce(sum(b.fee), 0)::bigint as fee
    from public.billing_awards(p_from, p_to) b
    join public.rfq_awards a on a.id = b.award_id
    left join public.rfq_invites i on i.id = a.invite_id
    where b.kind = 'settlement'
      and (i.join_channel = 'legacy' or public.billing_join_pilot(i.joined_at, i.join_channel, i.join_terms_version))
    group by b.org_id
  ),
  ids as (
    select oid from ln where ln.sub_n + ln.pq_n > 0 union select oid from aw
  )
  select o.id, o.name,
         coalesce(ln.sub_n, 0), coalesce(ln.pq_n, 0),
         coalesce(o.per_request_fee, 0),
         case when o.per_request_fee is null then 'schedule' else 'org' end,
         coalesce(ln.pq_fee, 0)::bigint,
         coalesce(aw.n, 0), coalesce(aw.amt, 0)::bigint,
         coalesce(o.fee_rate, 0),
         case when o.fee_rate is null then 'schedule' else 'org' end,
         coalesce(aw.fee, 0)::bigint
  from ids
  join public.cro_orgs o on o.id = ids.oid
  left join ln on ln.oid = o.id
  left join aw on aw.oid = o.id
  order by o.name;
$$;
revoke execute on function public.billing_reference(date, date) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 5) 월별 기관 명세: 반환 열은 0024 와 같다.
--    송부 비용 합계는 견적마다 다른 금액을 더한다(fee_due). 구독료는 청구 시작 월부터만. 미정(null)은 더 나오지 않는다
-- ─────────────────────────────────────────────
create or replace function public.billing_summary(p_from date, p_to date)
returns table (
  org_id uuid, org_name text, managed boolean, per_request_fee int, fee_rate numeric, monthly_fee int,
  delivered int, matched int, nominated int, manual int, declined int, unanswered int,
  quoted int, billable int, excluded int, no_amount int, subscription int, per_quote int, success_eligible int,
  per_quote_fee bigint, selected int,
  guidance_count int, guidance_fee bigint,
  settled_count int, settled_contract_amount bigint, settled_fee bigint,
  total_due bigint, terms_pending boolean
)
language sql stable
security definer set search_path = public
as $$
  with inv as (
    select i.cro_org_id as oid,
           count(*)::int as delivered,
           count(*) filter (where i.source = 'matched')::int as matched,
           count(*) filter (where i.source = 'nominated')::int as nominated,
           count(*) filter (where i.source = 'manual')::int as manual,
           count(*) filter (where i.status = 'declined')::int as declined,
           count(*) filter (where i.status in ('sent', 'draft', 'expired'))::int as unanswered
    from public.rfq_invites i
    where i.cro_org_id is not null
      and (i.sent_at at time zone 'Asia/Seoul')::date >= p_from
      and (i.sent_at at time zone 'Asia/Seoul')::date <  p_to
    group by i.cro_org_id
  ),
  ln as (
    select l.org_id as oid,
           count(*)::int as quoted,
           count(*) filter (where l.billable and l.join_status = 'joined' and l.tier <> 'no_amount')::int as billable,
           count(*) filter (where not (l.billable and l.join_status = 'joined'))::int as excluded,
           count(*) filter (where l.billable and l.join_status = 'joined' and l.tier = 'no_amount')::int as no_amount,
           count(*) filter (where l.billable and l.join_status = 'joined' and l.tier = 'subscription')::int as subscription,
           count(*) filter (where l.chargeable)::int as per_quote,
           count(*) filter (where l.billable and l.join_status = 'joined' and l.tier = 'per_quote_success')::int as success_eligible,
           coalesce(sum(l.fee_due), 0)::bigint as per_quote_fee,
           count(aw.id)::int as selected
    from public.billing_lines(p_from, p_to) l
    left join public.rfq_awards aw on aw.quote_id = l.quote_id
    group by l.org_id
  ),
  ga as (
    select b.org_id as oid,
           count(*) filter (where b.kind = 'guidance' and b.invite_joined)::int as guidance_count,
           coalesce(sum(b.fee) filter (where b.kind = 'guidance' and b.invite_joined), 0)::bigint as guidance_fee,
           count(*) filter (where b.kind = 'settlement' and b.invite_joined)::int as settled_count,
           coalesce(sum(b.contract_amount) filter (where b.kind = 'settlement' and b.invite_joined), 0)::bigint as settled_contract_amount,
           coalesce(sum(b.fee) filter (where b.kind = 'settlement' and b.invite_joined), 0)::bigint as settled_fee
    from public.billing_awards(p_from, p_to) b
    group by b.org_id
  ),
  sub as (
    select o.id as oid, o.monthly_fee
    from public.cro_orgs o
    where o.monthly_fee is not null and o.status = 'approved'
      and o.monthly_fee_from is not null and o.monthly_fee_from < p_to
      and p_from <= (now() at time zone 'Asia/Seoul')::date
      and p_from >= public.billing_paid_from()
  ),
  adj as (
    select a.org_id as oid, sum(a.amount)::bigint as amount
    from public.billing_adjustments a
    where a.month >= p_from and a.month < p_to
    group by a.org_id
  ),
  ids as (
    select oid from inv union select oid from ln union select oid from ga union select oid from sub union select oid from adj
  )
  select
    o.id, o.name, o.managed, o.per_request_fee, o.fee_rate, sub.monthly_fee,
    coalesce(inv.delivered, 0), coalesce(inv.matched, 0), coalesce(inv.nominated, 0), coalesce(inv.manual, 0),
    coalesce(inv.declined, 0), coalesce(inv.unanswered, 0),
    coalesce(ln.quoted, 0), coalesce(ln.billable, 0), coalesce(ln.excluded, 0), coalesce(ln.no_amount, 0),
    coalesce(ln.subscription, 0), coalesce(ln.per_quote, 0), coalesce(ln.success_eligible, 0),
    coalesce(ln.per_quote_fee, 0)::bigint, coalesce(ln.selected, 0),
    coalesce(ga.guidance_count, 0), coalesce(ga.guidance_fee, 0)::bigint,
    coalesce(ga.settled_count, 0), coalesce(ga.settled_contract_amount, 0)::bigint, coalesce(ga.settled_fee, 0)::bigint,
    (coalesce(sub.monthly_fee, 0) + coalesce(ln.per_quote_fee, 0) + coalesce(ga.settled_fee, 0) + coalesce(adj.amount, 0))::bigint,
    false
  from ids
  join public.cro_orgs o on o.id = ids.oid
  left join inv on inv.oid = o.id
  left join ln on ln.oid = o.id
  left join ga on ga.oid = o.id
  left join sub on sub.oid = o.id
  left join adj on adj.oid = o.id
  order by 27 desc, 13 desc, 2;
$$;
revoke execute on function public.billing_summary(date, date) from public, anon, authenticated;

comment on column public.cro_orgs.per_request_fee is '견적서 송부 비용 특별 조건 (원, 0031). 비어 있으면 요금표(billing_send_fee)';
comment on column public.cro_orgs.fee_rate is '계약 성사 수수료율 특별 조건 (0031). 비어 있으면 선정 견적 구간 요율(billing_success_rate)';
comment on column public.cro_orgs.monthly_fee is '월 구독료 (원). 구독하는 기관에만 넣는다. 기준 금액 billing_subscription_fee(). 청구 시작 월(billing_paid_from)부터 명세에 나온다 (0031)';

-- ─────────────────────────────────────────────
-- 6) 스키마 판과 실행 권한
-- ─────────────────────────────────────────────
create or replace function public.danchu_schema_version() returns int language sql immutable as $$ select 31 $$;
comment on function public.danchu_schema_version() is '마지막으로 적용한 마이그레이션 번호 (0031). lib/schema-version.ts REQUIRED_SCHEMA_VERSION 과 맞춘다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'billing_pilot_from()', 'billing_paid_from()', 'billing_subscription_fee()',
    'billing_send_fee(bigint)', 'billing_success_rate(bigint)',
    'billing_join_paid(timestamptz, text, text)', 'billing_join_pilot(timestamptz, text, text)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
grant execute on function public.billing_lines(date, date) to service_role;
grant execute on function public.billing_awards(date, date) to service_role;
grant execute on function public.billing_reference(date, date) to service_role;
grant execute on function public.billing_summary(date, date) to service_role;
grant execute on function public.danchu_schema_version() to service_role;
