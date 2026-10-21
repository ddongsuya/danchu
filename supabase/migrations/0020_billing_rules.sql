-- 단추(Danchu) 20차: 청구 기준 변경 (2026-10-18 대표 결정) · 월 전달 한도 삭제 · 월 구독료 · 마감 월 고정
-- 0019 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경 (2026-10-18 결정, 이 파일이 기준)
-- 1) 의뢰자는 비용을 내지 않는다.
-- 2) 청구 단위는 "기관이 실제로 제출한 견적 1건"이다. 초대 1건에서 청구 견적은 많아야 1건이다.
--    요청을 받고 견적을 내지 않은 기관에는 청구하지 않는다 (0009 의 "전달 1건 = 청구 1건"을 대신한다).
--    같은 초대의 재제출·수정은 다시 청구하지 않는다. 허위·중복·분야 불일치는 지금처럼 운영자가
--    rfq_invites.billable = false 와 사유로 뺀다 (감사 기록).
-- 3) 견적을 낸 기관은 모두 청구 대상이다. 운영자 관리 기관(managed)과 운영자 대리 입력 견적도 같다. 면제는 없다.
-- 4) 구간은 그 견적의 총액(cro_quotes.total_amount, 부가세 별도)으로 정한다.
--      1,000만 원 미만     : 건당 이용료 없음. 기관의 월 구독료(cro_orgs.monthly_fee)에 포함된다
--      1,000만 원 이상     : 건당 이용료 cro_orgs.per_request_fee (서면 합의 금액, null 이면 미정)
--      5,000만 원 이상     : 건당 이용료 + 단추를 통해 계약이 체결되면 성사수수료 cro_orgs.fee_rate (합의 3%, null 이면 미정)
--      금액 없음(null·0)   : 아직 청구하지 않는다 (금액 미입력)
--    기준 금액은 lib/billing.ts 의 SUBSCRIPTION_MAX_EXCL·SUCCESS_FEE_MIN 과 같다 (tests/billing-rules.test.ts 가 맞는지 본다).
-- 5) 성사수수료: 대상 여부는 선정 견적 금액(rfq_awards.fee_basis_amount)이 5,000만 원 이상인지로 정한다.
--    예상(견적 기준) = 선정 견적 금액 × 요율. 안내용이며 합계에 넣지 않는다. 선정한 달에 보인다.
--    정산(계약 기준) = 체결 계약 금액(rfq_awards.contract_amount) × 요율. contract_status = 'signed' 일 때만.
--    정산 월은 체결이 단추에 확인된 달(rfq_awards.contract_reported_at, 서울)이다. 전달한 달이 아니다.
--    contract_date(기관이 적은 체결일)는 늦게 보고되면 이미 마감한 달을 가리킬 수 있어 쓰지 않는다.
--    그래서 체결 정정(report_contract p_force)은 contract_reported_at 을 처음 확인 시각 그대로 둔다 (아래 6).
-- 6) 월 전달 한도(cro_orgs.monthly_cap)를 없앤다. 배포는 한도 때문에 기관을 건너뛰지 않는다 (lib/distribute.ts).
--    한도를 읽는 billing_summary 를 먼저 다시 만든 뒤 열을 지운다.
-- 7) 월 구독료 cro_orgs.monthly_fee (원, null 이면 구독하지 않음). 승인된 기관이면 구독 시작 월(cro_orgs.monthly_fee_from)부터
--    이번 달까지 명세에 매달 나오고 합계에 들어간다. 시작 월 전 달과 아직 오지 않은 달에는 나오지 않는다.
--    시작 월을 따로 적지 않으면 구독료를 처음 적은 달(서울)이 시작 월이 된다. 구독료를 지우면 시작 월도 지운다.
-- 8) 건당 이용료의 청구 월은 견적을 처음 제출한 달(서울)이다. save_quote 는 재제출 때마다 submitted_at 을 새로 찍으므로
--    처음 제출 시각 cro_quotes.first_submitted_at 을 따로 두고 트리거로 한 번만 채운다.
--    금액 없이(null·0) 처음 제출된 견적은 아직 청구하지 않으므로, 금액이 있는 상태로 처음 제출된 시각
--    cro_quotes.billing_at 을 따로 두고 그 달에 청구한다 (금액 없이 제출한 달을 마감해도 나중에 금액이 들어오면 그 달에 잡힌다).
--    처음부터 금액이 있으면 billing_at = first_submitted_at 이다. 한 번 채우면 바꾸지 않는다.
-- 9) 마감한 달은 고정한다: 마감할 때 그 달 명세(요약·견적·성사수수료)를 billing_periods.snapshot 에 저장하고,
--    화면과 CSV 는 마감한 달에 이 저장본을 쓴다. 마감 뒤 바뀐 단가·금액·체결 정정은 마감을 해제하고 다시 마감해야 반영된다.

-- ─────────────────────────────────────────────
-- 1) 구간 기준 금액 (lib/billing.ts 와 같은 값)
-- ─────────────────────────────────────────────
create or replace function public.billing_subscription_max_excl() returns bigint
language sql immutable as $$ select 10000000::bigint $$;   -- 이 금액 미만은 월 구독료 구간
create or replace function public.billing_success_fee_min() returns bigint
language sql immutable as $$ select 50000000::bigint $$;   -- 이 금액 이상은 성사수수료 대상

-- 견적 총액의 청구 구간. no_amount 금액 미입력 · subscription 구독 · per_quote 건당 · per_quote_success 건당 + 성사
create or replace function public.billing_tier(p_amount bigint) returns text
language sql immutable as $$
  select case
    when p_amount is null or p_amount <= 0 then 'no_amount'
    when p_amount < public.billing_subscription_max_excl() then 'subscription'
    when p_amount < public.billing_success_fee_min() then 'per_quote'
    else 'per_quote_success'
  end
$$;

-- ─────────────────────────────────────────────
-- 2) 월 구독료
-- ─────────────────────────────────────────────
alter table public.cro_orgs add column if not exists monthly_fee int;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'cro_orgs_monthly_fee_chk') then
    alter table public.cro_orgs add constraint cro_orgs_monthly_fee_chk check (monthly_fee is null or monthly_fee >= 0);
  end if;
end $$;

-- 구독 시작 월 (그 달 1일). 이 달부터 명세에 월 구독료가 나온다
alter table public.cro_orgs add column if not exists monthly_fee_from date;
create or replace function public.cro_orgs_monthly_fee_from()
returns trigger language plpgsql as $$
begin
  if new.monthly_fee is null then
    new.monthly_fee_from := null;
  elsif new.monthly_fee_from is null then
    new.monthly_fee_from := date_trunc('month', now() at time zone 'Asia/Seoul')::date;
  else
    new.monthly_fee_from := date_trunc('month', new.monthly_fee_from)::date;
  end if;
  return new;
end;
$$;
drop trigger if exists cro_orgs_monthly_fee_from on public.cro_orgs;
create trigger cro_orgs_monthly_fee_from before insert or update of monthly_fee, monthly_fee_from on public.cro_orgs
  for each row execute function public.cro_orgs_monthly_fee_from();
-- 시작 월 없이 구독료만 있는 기관은 이 파일을 적용한 달부터
update public.cro_orgs set monthly_fee_from = date_trunc('month', now() at time zone 'Asia/Seoul')::date
 where monthly_fee is not null and monthly_fee_from is null;

-- ─────────────────────────────────────────────
-- 3) 처음 제출 시각
--    채우기: 지금 submitted_at 은 마지막 제출 시각이라, 제출 이력(rfq_events quote_submitted)이 더 이르면 그 시각을 쓴다
-- ─────────────────────────────────────────────
alter table public.cro_quotes add column if not exists first_submitted_at timestamptz;
alter table public.cro_quotes add column if not exists billing_at timestamptz;

-- 채우기는 견적 수정이 아니므로 updated_at 을 건드리지 않게 갱신 트리거를 잠시 끈다
alter table public.cro_quotes disable trigger cro_quotes_touch;
update public.cro_quotes q
   set first_submitted_at = least(
         q.submitted_at,
         (select min(e.created_at) from public.rfq_events e
           where e.kind = 'quote_submitted' and e.rfq_id = q.rfq_id and e.meta->>'quoteId' = q.id::text)
       )
 where q.first_submitted_at is null and q.status = 'submitted' and q.submitted_at is not null;
-- 지금 금액이 있는 제출 견적은 처음 제출한 달에 청구한다 (언제 금액이 들어왔는지 기록이 없다)
update public.cro_quotes q set billing_at = q.first_submitted_at
 where q.billing_at is null and q.status = 'submitted' and q.first_submitted_at is not null and coalesce(q.total_amount, 0) > 0;
alter table public.cro_quotes enable trigger cro_quotes_touch;

-- 한 번 채우면 바꾸지 않는다. 처음 제출(status = submitted)될 때 submitted_at 또는 지금 시각으로 채운다
-- billing_at: 금액이 있는 상태로 처음 제출된 시각. 처음 제출에 금액이 있으면 first_submitted_at, 나중에 금액이 들어오면 그때(지금 시각)
create or replace function public.cro_quotes_first_submitted()
returns trigger language plpgsql as $$
declare v_first_now boolean := false;
begin
  if tg_op = 'UPDATE' and old.first_submitted_at is not null then
    new.first_submitted_at := old.first_submitted_at;
  elsif new.status = 'submitted' and new.first_submitted_at is null then
    new.first_submitted_at := coalesce(new.submitted_at, now());
    v_first_now := true;
  end if;
  if tg_op = 'UPDATE' and old.billing_at is not null then
    new.billing_at := old.billing_at;
  elsif new.status = 'submitted' and coalesce(new.total_amount, 0) > 0 and new.billing_at is null then
    new.billing_at := case when v_first_now then new.first_submitted_at else now() end;
  end if;
  return new;
end;
$$;
drop trigger if exists cro_quotes_first_submitted on public.cro_quotes;
create trigger cro_quotes_first_submitted before insert or update on public.cro_quotes
  for each row execute function public.cro_quotes_first_submitted();

create index if not exists cro_quotes_first_submitted_idx on public.cro_quotes (first_submitted_at) where first_submitted_at is not null;
create index if not exists cro_quotes_billing_at_idx on public.cro_quotes (billing_at) where billing_at is not null;
create index if not exists rfq_awards_reported_idx on public.rfq_awards (contract_reported_at) where contract_reported_at is not null;

-- ─────────────────────────────────────────────
-- 4) 마감 저장본 자리
-- ─────────────────────────────────────────────
alter table public.billing_periods add column if not exists snapshot jsonb;

-- ─────────────────────────────────────────────
-- 5) 청구 집계 함수. 기간은 [p_from, p_to) 서울 기준 날짜. service role 만 호출한다
-- ─────────────────────────────────────────────

-- 견적 1건 = 1행. 그 달에 청구 기준 시각(billing_at, 아직 금액이 없으면 first_submitted_at)이 있는 견적
--   재제출은 처음 제출한 달에만 나온다. 금액 없이 제출된 견적은 처음 제출한 달에 금액 미입력으로 나오고,
--   금액이 들어오면 그 달(billing_at)로 옮겨 청구한다
--   fee_due: 청구할 건당 이용료. 청구 대상이 아니면 0, 대상인데 단가가 미정이면 null
drop function if exists public.billing_lines(date, date);
create or replace function public.billing_lines(p_from date, p_to date)
returns table (
  quote_id uuid, invite_id uuid, rfq_id uuid, rfq_no text, org_id uuid, org_name text, managed boolean,
  first_submitted_at timestamptz, billing_at timestamptz, total_amount bigint, entry_source text, auto boolean, invite_source text,
  billable boolean, bill_excluded_reason text, tier text, chargeable boolean, per_request_fee int, fee_due bigint
)
language sql stable
security definer set search_path = public
as $$
  select
    q.id, q.invite_id, q.rfq_id, q.rfq_no, o.id, o.name, o.managed,
    q.first_submitted_at, q.billing_at, q.total_amount, q.entry_source, q.auto, i.source,
    i.billable, i.bill_excluded_reason,
    public.billing_tier(q.total_amount),
    (i.billable and public.billing_tier(q.total_amount) in ('per_quote', 'per_quote_success')),
    o.per_request_fee,
    case when i.billable and public.billing_tier(q.total_amount) in ('per_quote', 'per_quote_success')
         then o.per_request_fee::bigint else 0 end
  from public.cro_quotes q
  join public.rfq_invites i on i.id = q.invite_id
  join public.cro_orgs o on o.id = coalesce(q.cro_org_id, i.cro_org_id)
  where q.status = 'submitted'
    and q.first_submitted_at is not null
    and (coalesce(q.billing_at, q.first_submitted_at) at time zone 'Asia/Seoul')::date >= p_from
    and (coalesce(q.billing_at, q.first_submitted_at) at time zone 'Asia/Seoul')::date <  p_to
  order by o.name, coalesce(q.billing_at, q.first_submitted_at);
$$;
revoke execute on function public.billing_lines(date, date) from public, anon, authenticated;

-- 성사수수료 1건 = 1행. 대상(선정 견적 5,000만 원 이상)만
--   kind 'guidance' 예상(견적 기준): 그 달에 선정, 미체결이 아닌 것. 선정 견적 금액 × 요율. 합계에 넣지 않는다
--   kind 'settlement' 정산(계약 기준): 그 달에 체결 확인(contract_reported_at), signed. 계약 금액 × 요율
--   fee: 요율이 미정이면 null
--   invite_billable: 그 초대를 운영자가 청구 제외(rfq_invites.billable = false)했는지. 성사수수료는 제외와 상관없이 잡고 화면에 표시만 한다
drop function if exists public.billing_awards(date, date);
create or replace function public.billing_awards(p_from date, p_to date)
returns table (
  kind text, award_id uuid, rfq_id uuid, rfq_no text, org_id uuid, org_name text,
  quote_amount bigint, contract_amount bigint, contract_status text,
  awarded_at timestamptz, contract_date date, contract_reported_at timestamptz,
  fee_rate numeric, fee bigint, invite_billable boolean
)
language sql stable
security definer set search_path = public
as $$
  with a as (
    select a.*, coalesce(a.fee_basis_amount, q.total_amount) as basis, r.rfq_no as no,
           o.id as oid, o.name as oname, o.fee_rate as rate, coalesce(i.billable, true) as ibill
    from public.rfq_awards a
    join public.rfq_requests r on r.id = a.rfq_id
    left join public.cro_quotes q on q.id = a.quote_id
    left join public.rfq_invites i on i.id = a.invite_id
    join public.cro_orgs o on o.id = coalesce(a.cro_org_id, q.cro_org_id)
    where coalesce(a.fee_basis_amount, q.total_amount) >= public.billing_success_fee_min()
  )
  select 'guidance', a.id, a.rfq_id, a.no, a.oid, a.oname, a.basis, a.contract_amount, a.contract_status,
         a.awarded_at, a.contract_date, a.contract_reported_at, a.rate, round(a.basis * a.rate)::bigint, a.ibill
  from a
  where a.contract_status <> 'not_signed'
    and (a.awarded_at at time zone 'Asia/Seoul')::date >= p_from
    and (a.awarded_at at time zone 'Asia/Seoul')::date <  p_to
  union all
  select 'settlement', a.id, a.rfq_id, a.no, a.oid, a.oname, a.basis, a.contract_amount, a.contract_status,
         a.awarded_at, a.contract_date, a.contract_reported_at, a.rate, round(a.contract_amount * a.rate)::bigint, a.ibill
  from a
  where a.contract_status = 'signed'
    and a.contract_reported_at is not null
    and a.contract_amount is not null
    and (a.contract_reported_at at time zone 'Asia/Seoul')::date >= p_from
    and (a.contract_reported_at at time zone 'Asia/Seoul')::date <  p_to
  order by 1, 6, 10;
$$;
revoke execute on function public.billing_awards(date, date) from public, anon, authenticated;

-- 월별 기관 명세. 반환 열이 바뀌므로 지우고 다시 만든다 (monthly_cap 이 빠진다)
--   전달 통계(delivered…unanswered): 그 달에 보낸 초대. 청구와 무관한 운영 지표
--   견적(quoted…selected): 그 달에 청구 기준 시각이 있는 견적 (billing_lines). billable = 청구 대상(제외되지 않았고 금액이 있는 것)
--   monthly_fee: 승인된 기관의 구독 시작 월(monthly_fee_from)부터 이번 달까지만
--   per_quote_fee·guidance_fee·settled_fee: 해당 건이 있는데 단가·요율이 미정이면 null
--   total_due = 월 구독료 + 건당 이용료 + 성사수수료 정산 (미정인 부분은 0 으로 더하고 terms_pending 을 켠다)
drop function if exists public.billing_summary(date, date);
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
           count(*) filter (where l.billable and l.tier <> 'no_amount')::int as billable,
           count(*) filter (where not l.billable)::int as excluded,
           count(*) filter (where l.billable and l.tier = 'no_amount')::int as no_amount,
           count(*) filter (where l.billable and l.tier = 'subscription')::int as subscription,
           count(*) filter (where l.chargeable)::int as per_quote,
           count(*) filter (where l.billable and l.tier = 'per_quote_success')::int as success_eligible,
           count(aw.id)::int as selected
    from public.billing_lines(p_from, p_to) l
    left join public.rfq_awards aw on aw.quote_id = l.quote_id
    group by l.org_id
  ),
  ga as (
    select b.org_id as oid,
           count(*) filter (where b.kind = 'guidance')::int as guidance_count,
           sum(b.fee) filter (where b.kind = 'guidance')::bigint as guidance_fee,
           count(*) filter (where b.kind = 'settlement')::int as settled_count,
           coalesce(sum(b.contract_amount) filter (where b.kind = 'settlement'), 0)::bigint as settled_contract_amount,
           sum(b.fee) filter (where b.kind = 'settlement')::bigint as settled_fee
    from public.billing_awards(p_from, p_to) b
    group by b.org_id
  ),
  sub as (
    select o.id as oid, o.monthly_fee
    from public.cro_orgs o
    where o.monthly_fee is not null and o.status = 'approved'
      and o.monthly_fee_from is not null and o.monthly_fee_from < p_to
      and p_from <= (now() at time zone 'Asia/Seoul')::date
  ),
  ids as (
    select oid from inv union select oid from ln union select oid from ga union select oid from sub
  ),
  t as (
    select o.id, o.name, o.managed, o.per_request_fee, o.fee_rate,
           sub.monthly_fee,
           coalesce(inv.delivered, 0) as delivered, coalesce(inv.matched, 0) as matched,
           coalesce(inv.nominated, 0) as nominated, coalesce(inv.manual, 0) as manual,
           coalesce(inv.declined, 0) as declined, coalesce(inv.unanswered, 0) as unanswered,
           coalesce(ln.quoted, 0) as quoted, coalesce(ln.billable, 0) as billable,
           coalesce(ln.excluded, 0) as excluded, coalesce(ln.no_amount, 0) as no_amount,
           coalesce(ln.subscription, 0) as subscription, coalesce(ln.per_quote, 0) as per_quote,
           coalesce(ln.success_eligible, 0) as success_eligible, coalesce(ln.selected, 0) as selected,
           coalesce(ga.guidance_count, 0) as guidance_count,
           case when coalesce(ga.guidance_count, 0) = 0 then 0
                when o.fee_rate is null then null else ga.guidance_fee end as guidance_fee,
           coalesce(ga.settled_count, 0) as settled_count,
           coalesce(ga.settled_contract_amount, 0) as settled_contract_amount,
           case when coalesce(ga.settled_count, 0) = 0 then 0
                when o.fee_rate is null then null else ga.settled_fee end as settled_fee
    from ids
    join public.cro_orgs o on o.id = ids.oid
    left join inv on inv.oid = o.id
    left join ln on ln.oid = o.id
    left join ga on ga.oid = o.id
    left join sub on sub.oid = o.id
  ),
  f as (
    select t.*,
           case when t.per_quote = 0 then 0
                when t.per_request_fee is null then null
                else t.per_quote::bigint * t.per_request_fee end as per_quote_fee
    from t
  )
  select
    f.id, f.name, f.managed, f.per_request_fee, f.fee_rate, f.monthly_fee,
    f.delivered, f.matched, f.nominated, f.manual, f.declined, f.unanswered,
    f.quoted, f.billable, f.excluded, f.no_amount, f.subscription, f.per_quote, f.success_eligible,
    f.per_quote_fee, f.selected,
    f.guidance_count, f.guidance_fee,
    f.settled_count, f.settled_contract_amount, f.settled_fee,
    (coalesce(f.monthly_fee, 0) + coalesce(f.per_quote_fee, 0) + coalesce(f.settled_fee, 0))::bigint,
    (f.per_quote_fee is null or f.settled_fee is null)
  from f
  order by 27 desc, f.quoted desc, f.name;
$$;
revoke execute on function public.billing_summary(date, date) from public, anon, authenticated;

-- 마감 저장본: 그 달 명세 전체 (요약·견적·성사수수료)
create or replace function public.billing_snapshot(p_from date, p_to date)
returns jsonb
language sql stable
security definer set search_path = public
as $$
  select jsonb_build_object(
    'taken_at', now(),
    'summary', coalesce((select jsonb_agg(to_jsonb(s)) from public.billing_summary(p_from, p_to) s), '[]'::jsonb),
    'lines',   coalesce((select jsonb_agg(to_jsonb(l)) from public.billing_lines(p_from, p_to) l), '[]'::jsonb),
    'awards',  coalesce((select jsonb_agg(to_jsonb(b)) from public.billing_awards(p_from, p_to) b), '[]'::jsonb)
  );
$$;
revoke execute on function public.billing_snapshot(date, date) from public, anon, authenticated;

-- 월 마감: 그 달 1일을 받아 저장본과 함께 마감한다. 이미 마감한 달이면 저장본을 새로 찍는다 (해제 없이 다시 마감)
create or replace function public.close_billing_month(p_month date, p_actor uuid, p_note text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_snap jsonb := public.billing_snapshot(v_month, (v_month + interval '1 month')::date);
begin
  insert into public.billing_periods (month, closed_at, closed_by, note, snapshot)
  values (v_month, now(), p_actor, nullif(p_note, ''), v_snap)
  on conflict (month) do update
    set closed_at = excluded.closed_at, closed_by = excluded.closed_by, note = excluded.note, snapshot = excluded.snapshot;
  return jsonb_build_object('ok', true, 'month', v_month, 'orgs', jsonb_array_length(v_snap->'summary'));
end;
$$;
revoke execute on function public.close_billing_month(date, uuid, text) from public, anon, authenticated;

-- 이미 마감된 달(0014 이후)에 저장본이 없으면 지금 기준으로 찍어 둔다. 시범운영 기간이라 청구한 달은 없다
update public.billing_periods
   set snapshot = public.billing_snapshot(month, (month + interval '1 month')::date)
 where snapshot is null;

-- ─────────────────────────────────────────────
-- 6) 체결 보고: 0019 와 같고, 정정(p_force) 때 contract_reported_at 을 처음 확인 시각 그대로 둔다
--    성사수수료 정산 월의 기준이라, 정정으로 다른 달 명세에 다시 잡히지 않게 한다 (위 배경 5)
-- ─────────────────────────────────────────────
create or replace function public.report_contract(p_award_id uuid, p_date date, p_amount bigint, p_note text, p_force boolean default false)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  a public.rfq_awards%rowtype;
  r public.rfq_requests%rowtype;
begin
  select * into a from public.rfq_awards where id = p_award_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if a.contract_reported_at is not null and not p_force then return jsonb_build_object('ok', false, 'code', 'already'); end if;
  if p_amount is null or p_amount <= 0 then return jsonb_build_object('ok', false, 'code', 'amount'); end if;
  if p_date is null or p_date < (a.awarded_at at time zone 'Asia/Seoul')::date then return jsonb_build_object('ok', false, 'code', 'date'); end if;
  if p_date > (now() at time zone 'Asia/Seoul')::date then return jsonb_build_object('ok', false, 'code', 'future'); end if;

  update public.rfq_awards
     set contract_date = p_date, contract_amount = p_amount, contract_note = nullif(p_note, ''),
         contract_reported_at = coalesce(a.contract_reported_at, now()),
         contract_status = 'signed'
   where id = a.id;
  update public.rfq_requests set status = 'contracting' where id = a.rfq_id and status = 'selected';

  select * into r from public.rfq_requests where id = a.rfq_id;
  return jsonb_build_object('ok', true, 'rfq_id', a.rfq_id, 'rfq_no', r.rfq_no, 'user_id', r.user_id, 'substance', r.substance, 'corrected', a.contract_reported_at is not null);
end;
$$;
revoke execute on function public.report_contract(uuid, date, bigint, text, boolean) from public, anon, authenticated;

-- 0009 전에 선정된 수주는 선정 견적 금액·기관이 비어 있다. 수주 화면(/admin/awards)과 집계가 같은 값을 보게 견적에서 채운다
-- (선정 뒤 견적은 save_quote 가 막으므로 지금 견적 금액이 선정 때 금액이다)
update public.rfq_awards a
   set fee_basis_amount = coalesce(a.fee_basis_amount, q.total_amount),
       cro_org_id = coalesce(a.cro_org_id, q.cro_org_id)
  from public.cro_quotes q
 where q.id = a.quote_id
   and ((a.fee_basis_amount is null and q.total_amount is not null) or (a.cro_org_id is null and q.cro_org_id is not null));

-- ─────────────────────────────────────────────
-- 7) 월 전달 한도 삭제. 한도를 읽던 billing_summary 는 위에서 한도 없이 다시 만들었다
-- ─────────────────────────────────────────────
alter table public.cro_orgs drop column if exists monthly_cap;

comment on column public.cro_orgs.per_request_fee is '건당 이용료 (원, 0020). 1,000만 원 이상 견적 1건마다. null 이면 미정';
comment on column public.cro_orgs.fee_rate is '성사수수료율 (0.03 = 3%). 선정 견적 5,000만 원 이상이 체결되면 계약 금액에 곱한다 (0020). null 이면 미정';
comment on column public.cro_orgs.monthly_fee is '월 구독료 (원, 0020). 1,000만 원 미만 견적을 포함한다. null 이면 구독하지 않음';
comment on column public.cro_orgs.monthly_fee_from is '구독 시작 월 (그 달 1일, 0020). 이 달부터 명세에 월 구독료가 나온다. 비우면 구독료를 적은 달';
comment on column public.cro_quotes.billing_at is '청구 기준 시각 (0020). 금액이 있는 상태로 처음 제출된 시각. 한 번 채우면 바뀌지 않는다. 건당 이용료의 청구 월';
comment on column public.cro_quotes.first_submitted_at is '처음 제출 시각 (0020). 한 번 채우면 바뀌지 않는다. 건당 이용료의 청구 월 기준';
comment on column public.billing_periods.snapshot is '마감 때 저장한 그 달 명세 (0020). 마감한 달은 이 값을 보여 준다';
