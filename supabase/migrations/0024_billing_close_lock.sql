-- 단추(Danchu) 24차: 마감한 청구 월 고정 (2026-10-20 대표 결정 "추천대로") · 조정 항목 · 시범 기간 참고 수치
-- 0023 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경 (2026-10-20 결정, 이 파일이 기준)
-- 1) 마감한 달은 다시 열지 않는다. 기관 이용 조건의 "마감한 달의 명세는 고정, 다시 청구하지 않음"을 DB 에서 지킨다.
--    billing_periods 의 행이 곧 마감이다(0014). 그래서 마감 해제는 행 삭제였다. 이제 트리거가 행 삭제(마감 해제)와
--    저장본·마감 시각·메모·월 변경을 모두 거절한다. 예외는 마감한 운영자 계정이 실제로 지워져 closed_by 가 비는 것
--    (auth.users on delete set null, 0023 auth_user_exists 로 확인)뿐이다. 표 전체 비우기(truncate)도 거절한다.
--    close_billing_month 는 이미 마감한 달을 다시 찍지 않고 already 로 돌려준다 (0020 은 다시 마감하면 저장본을 새로 찍었다).
--    되돌릴 수 없으므로 끝나지 않은 달(이번 달·다음 달 이후)은 마감하지 않는다 (code not_ended). 표에 직접 넣어도 같다(트리거).
--    처음 적용할 때 끝나지 않은 달이 이미 마감돼 있으면(0020 까지는 가능했다) 아무것도 바꾸지 않고 멈춘다.
-- 2) 바로잡을 금액은 다음 열린 달의 조정 항목(billing_adjustments)으로 넣는다.
--    기관 · 적용 월(그 달 1일) · 금액(원, 음수 가능, 0 은 안 됨) · 사유(필수) · 바로잡는 마감 월(선택, 적용 월보다 앞선 마감한 달) ·
--    입력한 운영자 · 시각. 마감한 달에는 넣을 수 없고, 그 달을 마감하면 바꾸거나 지울 수 없다 (트리거).
--    조정은 기관 합계(billing_summary.total_due)와 마감 저장본(snapshot.adjustments)에 들어간다.
--    마감과 조정 입력이 동시에 일어나도 저장본과 조정이 어긋나지 않게, 같은 달의 마감·조정 쓰기는 달마다 하나의
--    트랜잭션 잠금(billing_month_lock, pg_advisory_xact_lock)으로 줄을 세운다.
--    billing_summary 의 반환 열은 0020·0023 과 같게 둔다 (조정 내역은 billing_adjustment_lines 로 따로 읽는다).
-- 3) 시범 기간 참고 수치 (billing_reference): 시범 판(pilot-…)이나 legacy 참여라 청구하지 않는 견적·수주를 "유료였다면"으로 센다.
--    기관별로 1,000만 원 미만 견적 수(구독 구간, 구독료가 정해지지 않아 금액 없음), 1,000만 원 이상 견적 수와 참고 건당 이용료,
--    체결 확인된 수주(선정 견적 5,000만 원 이상, signed)의 참고 성사수수료(계약 금액 × 요율).
--    기관 약정 값(per_request_fee·fee_rate)이 있으면 그 값을, 없으면 참고 단가(예시, 시장 검증 전)
--    billing_reference_per_quote_fee() = 30,000원 · billing_reference_success_rate() = 3% 를 쓴다 (lib/billing.ts 와 같은 값).
--    참고 수치는 합계·청구에 넣지 않는다. 운영자 청구 제외(rfq_invites.billable = false) 견적은 세지 않는다.
--    마감 저장본에는 따로(snapshot.reference) 남긴다.
--
-- 알려진 한계: 이 파일 뒤에 0020·0023 을 다시 적용하면 billing_summary·close_billing_month·billing_snapshot 이 그 판으로 돌아간다.
-- 그때는 이 파일을 한 번 더 적용한다. 마감 고정 트리거와 조정 표는 그대로 남는다.

-- ─────────────────────────────────────────────
-- 0) 선행 마이그레이션 확인 (빠졌으면 여기서 멈춘다)
-- ─────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.danchu_schema_version()') is null
     or to_regprocedure('public.join_offer(uuid, text, uuid, text, text, text, text)') is null
     or to_regclass('public.billing_periods') is null then
    raise exception '0024 를 적용하기 전에 0019, 0020, 0021, 0022, 0023 을 순서대로 적용해 주세요.';
  end if;
end $$;

-- 0) 처음 적용할 때: 끝나지 않은 달(서울 기준 이번 달 이후)이 마감돼 있으면 멈춘다.
--    0020 까지는 이번 달도 마감할 수 있었다. 이 파일 뒤로는 마감을 풀 수 없어, 달 중간 저장본이 영영 고정된다.
--    마감 고정 트리거가 이미 있으면(재적용) 이 확인은 건너뛴다 (그 뒤로는 끝나지 않은 달을 마감할 수 없다).
do $$
declare
  v_months text;
begin
  if not exists (select 1 from pg_trigger where tgname = 'billing_periods_guard' and not tgisinternal) then
    select string_agg(to_char(month, 'YYYY-MM'), ', ' order by month) into v_months
    from public.billing_periods
    where month >= date_trunc('month', (now() at time zone 'Asia/Seoul'))::date;
    if v_months is not null then
      raise exception '끝나지 않은 달(%)이 마감돼 있습니다. 0024 를 적용하기 전에 그 달 마감을 해제해 주세요 (delete from public.billing_periods where month >= date_trunc(''month'', now() at time zone ''Asia/Seoul'')::date).', v_months;
    end if;
  end if;
end $$;

-- ─────────────────────────────────────────────
-- 1) 달마다 하나의 잠금. 마감(close_billing_month·billing_periods 삽입)과 조정 쓰기가 같은 달에서 줄을 선다
-- ─────────────────────────────────────────────
create or replace function public.billing_month_lock(p_month date)
returns void
language plpgsql
as $$
begin
  perform pg_advisory_xact_lock(240024, (extract(year from p_month)::int * 100 + extract(month from p_month)::int));
end;
$$;
revoke execute on function public.billing_month_lock(date) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 2) 참고 단가 (예시, 시장 검증 전. lib/billing.ts REFERENCE_PER_QUOTE_FEE·REFERENCE_SUCCESS_RATE 와 같은 값)
-- ─────────────────────────────────────────────
create or replace function public.billing_reference_per_quote_fee() returns int
language sql immutable as $$ select 30000 $$;          -- 참고 건당 이용료 (원)
create or replace function public.billing_reference_success_rate() returns numeric
language sql immutable as $$ select 0.03::numeric $$;  -- 참고 성사수수료율
revoke execute on function public.billing_reference_per_quote_fee() from public, anon, authenticated;
revoke execute on function public.billing_reference_success_rate() from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 3) 조정 항목
-- ─────────────────────────────────────────────
create table if not exists public.billing_adjustments (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.cro_orgs(id) on delete restrict,
  month          date not null,                       -- 적용 월 (그 달 1일). 이 달 명세에 들어간다
  amount         bigint not null,                     -- 원. 더하면 양수, 돌려주면 음수
  reason         text not null,
  corrects_month date references public.billing_periods(month),  -- 바로잡는 마감 월 (선택). 마감한 달은 지울 수 없어 늘 남는다
  created_by     uuid references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint billing_adjustments_month_chk check (month = date_trunc('month', month)::date),
  constraint billing_adjustments_amount_chk check (amount <> 0),
  constraint billing_adjustments_reason_chk check (length(btrim(reason)) between 1 and 500),
  constraint billing_adjustments_corrects_chk check (corrects_month is null or (corrects_month = date_trunc('month', corrects_month)::date and corrects_month < month))
);
alter table public.billing_adjustments enable row level security;
create index if not exists billing_adjustments_month_idx on public.billing_adjustments (month, org_id);

comment on table public.billing_adjustments is '청구 조정 항목 (0024). 마감한 달을 바로잡는 금액은 다음 열린 달에 이 항목으로 넣는다. 그 달을 마감하면 바꾸거나 지울 수 없다';
comment on column public.billing_adjustments.month is '적용 월 (그 달 1일, 0024). 이 달 명세 합계에 들어간다. 마감한 달에는 넣을 수 없다';
comment on column public.billing_adjustments.amount is '조정 금액 (원, 0024). 더하면 양수, 돌려주면 음수. 0 은 안 된다';
comment on column public.billing_adjustments.corrects_month is '바로잡는 마감 월 (0024, 선택). 적용 월보다 앞선 마감한 달';

-- 조정 항목 보호: 마감한 달에는 넣지 못하고, 마감한 달의 항목은 바꾸거나 지우지 못한다
create or replace function public.billing_adjustments_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.billing_month_lock(old.month);
    if exists (select 1 from public.billing_periods p where p.month = old.month) then
      -- 입력한 운영자 계정이 실제로 지워져(on delete set null) 그 칸만 비는 것은 허용한다
      if tg_op = 'UPDATE' and old.created_by is not null and new.created_by is null
         and not public.auth_user_exists(old.created_by)
         and (new.id, new.org_id, new.month, new.amount, new.reason, new.corrects_month, new.created_at)
             is not distinct from (old.id, old.org_id, old.month, old.amount, old.reason, old.corrects_month, old.created_at) then
        return new;
      end if;
      raise exception 'billing_month_closed: 마감한 달(%)의 조정 항목은 바꾸거나 지울 수 없습니다', to_char(old.month, 'YYYY-MM');
    end if;
    if tg_op = 'DELETE' then
      return old;
    end if;
    if new.month is distinct from old.month then
      perform public.billing_month_lock(new.month);
    end if;
  else
    perform public.billing_month_lock(new.month);
  end if;

  if exists (select 1 from public.billing_periods p where p.month = new.month) then
    raise exception 'billing_month_closed: 마감한 달(%)에는 조정 항목을 넣을 수 없습니다. 다음 열린 달에 넣어 주세요', to_char(new.month, 'YYYY-MM');
  end if;
  return new;
end;
$$;
revoke execute on function public.billing_adjustments_guard() from public, anon, authenticated;
drop trigger if exists billing_adjustments_guard on public.billing_adjustments;
create trigger billing_adjustments_guard before insert or update or delete on public.billing_adjustments
  for each row execute function public.billing_adjustments_guard();

-- 표 전체 비우기(truncate)는 행 트리거를 거치지 않으므로 따로 거절한다 (마감한 달의 조정 항목이 사라지지 않게)
create or replace function public.billing_adjustments_no_truncate()
returns trigger
language plpgsql
as $$
begin
  raise exception 'billing_month_closed: 조정 항목 표는 비울 수 없습니다 (마감한 달의 조정 항목은 바꾸거나 지울 수 없습니다)';
end;
$$;
revoke execute on function public.billing_adjustments_no_truncate() from public, anon, authenticated;
drop trigger if exists billing_adjustments_no_truncate on public.billing_adjustments;
create trigger billing_adjustments_no_truncate before truncate on public.billing_adjustments
  for each statement execute function public.billing_adjustments_no_truncate();

-- ─────────────────────────────────────────────
-- 4) 마감 고정: 마감한 달(billing_periods 행)은 지우거나(다시 열기) 바꾸지 못한다
--    마감할 때(삽입) 같은 달 잠금을 잡고, 그 자리에서 저장본을 찍는다. 넣는 쪽이 준 저장본은 쓰지 않는다
--    (어느 경로로 마감해도 실제 명세가 남게). 그 달 1일이 아니거나 끝나지 않은 달(서울 기준)은 마감하지 않는다
-- ─────────────────────────────────────────────
create or replace function public.billing_periods_guard()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.month is null or new.month <> date_trunc('month', new.month)::date then
      raise exception 'billing_month_bad: 마감 월은 그 달 1일이어야 합니다 (%)', new.month;
    end if;
    if new.month >= date_trunc('month', (now() at time zone 'Asia/Seoul'))::date then
      raise exception 'billing_month_not_ended: 끝나지 않은 달(%)은 마감할 수 없습니다', to_char(new.month, 'YYYY-MM');
    end if;
    perform public.billing_month_lock(new.month);
    new.snapshot := public.billing_snapshot(new.month, (new.month + interval '1 month')::date);
    return new;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'billing_month_locked: 마감한 달(%)은 다시 열 수 없습니다. 바로잡을 금액은 다음 달 명세에 조정 항목으로 넣습니다', to_char(old.month, 'YYYY-MM');
  end if;
  -- UPDATE: 마감한 운영자 계정이 실제로 지워져 closed_by 만 비는 것만 허용한다
  if (new.month, new.closed_at, new.note, new.snapshot) is not distinct from (old.month, old.closed_at, old.note, old.snapshot)
     and (new.closed_by is not distinct from old.closed_by
          or (old.closed_by is not null and new.closed_by is null and not public.auth_user_exists(old.closed_by))) then
    return new;
  end if;
  raise exception 'billing_month_locked: 마감한 달(%)의 명세는 바꿀 수 없습니다. 바로잡을 금액은 다음 달 명세에 조정 항목으로 넣습니다', to_char(old.month, 'YYYY-MM');
end;
$$;
revoke execute on function public.billing_periods_guard() from public, anon, authenticated;
drop trigger if exists billing_periods_guard on public.billing_periods;
create trigger billing_periods_guard before insert or update or delete on public.billing_periods
  for each row execute function public.billing_periods_guard();

create or replace function public.billing_periods_no_truncate()
returns trigger
language plpgsql
as $$
begin
  raise exception 'billing_month_locked: 마감한 달은 다시 열 수 없습니다 (billing_periods 를 비울 수 없습니다)';
end;
$$;
revoke execute on function public.billing_periods_no_truncate() from public, anon, authenticated;
drop trigger if exists billing_periods_no_truncate on public.billing_periods;
create trigger billing_periods_no_truncate before truncate on public.billing_periods
  for each statement execute function public.billing_periods_no_truncate();

comment on table public.billing_periods is '청구 월 마감 (0014). 행이 있으면 마감한 달이다. 0024 부터 다시 열 수 없고(삭제 거절) 저장본은 바뀌지 않는다';

-- ─────────────────────────────────────────────
-- 5) 조정 항목 넣기 (운영자, 서버만). 실패 code: bad_month · amount · reason · not_found 기관 없음 ·
--    closed 마감한 달 · corrects 바로잡는 달이 적용 월보다 앞선 마감한 달이 아님
-- ─────────────────────────────────────────────
create or replace function public.add_billing_adjustment(p_org uuid, p_month date, p_amount bigint, p_reason text, p_corrects date, p_actor uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_corr date := date_trunc('month', p_corrects)::date;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_name text;
  v_id uuid;
begin
  if v_month is null then return jsonb_build_object('ok', false, 'code', 'bad_month'); end if;
  if p_amount is null or p_amount = 0 then return jsonb_build_object('ok', false, 'code', 'amount'); end if;
  if v_reason = '' or length(v_reason) > 500 then return jsonb_build_object('ok', false, 'code', 'reason'); end if;
  select name into v_name from public.cro_orgs where id = p_org;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;

  perform public.billing_month_lock(v_month);
  if exists (select 1 from public.billing_periods p where p.month = v_month) then
    return jsonb_build_object('ok', false, 'code', 'closed', 'month', v_month);
  end if;
  if v_corr is not null and (v_corr >= v_month or not exists (select 1 from public.billing_periods p where p.month = v_corr)) then
    return jsonb_build_object('ok', false, 'code', 'corrects', 'month', v_month);
  end if;

  insert into public.billing_adjustments (org_id, month, amount, reason, corrects_month, created_by)
  values (p_org, v_month, p_amount, v_reason, v_corr, p_actor)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'month', v_month, 'org_name', v_name);
end;
$$;
revoke execute on function public.add_billing_adjustment(uuid, date, bigint, text, date, uuid) from public, anon, authenticated;

-- 그 기간의 조정 항목 (적용 월 기준)
create or replace function public.billing_adjustment_lines(p_from date, p_to date)
returns table (
  adjustment_id uuid, org_id uuid, org_name text, month date, amount bigint, reason text,
  corrects_month date, created_by uuid, created_at timestamptz
)
language sql stable
security definer set search_path = public
as $$
  select a.id, o.id, o.name, a.month, a.amount, a.reason, a.corrects_month, a.created_by, a.created_at
  from public.billing_adjustments a
  join public.cro_orgs o on o.id = a.org_id
  where a.month >= p_from and a.month < p_to
  order by o.name, a.created_at;
$$;
revoke execute on function public.billing_adjustment_lines(date, date) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 6) 시범 기간 참고 수치 (위 배경 3). 합계에 넣지 않는다
--    per_quote_unit_source·success_rate_source: org 기관 약정 값 · reference 참고 단가(예시, 시장 검증 전)
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
           count(*) filter (where l.tier in ('per_quote', 'per_quote_success'))::int as pq_n
    from public.billing_lines(p_from, p_to) l
    where l.billable and l.join_status in ('pilot', 'legacy')
    group by l.org_id
  ),
  aw as (
    select b.org_id as oid,
           count(*)::int as n,
           coalesce(sum(b.contract_amount), 0)::bigint as amt,
           coalesce(sum(round(b.contract_amount * coalesce(b.fee_rate, public.billing_reference_success_rate()))), 0)::bigint as fee
    from public.billing_awards(p_from, p_to) b
    join public.rfq_awards a on a.id = b.award_id
    left join public.rfq_invites i on i.id = a.invite_id
    where b.kind = 'settlement'
      and (i.join_channel = 'legacy'
           or (i.joined_at is not null and i.join_channel in ('portal', 'token') and coalesce(i.join_terms_version, '') like 'pilot-%'))
    group by b.org_id
  ),
  ids as (
    select oid from ln where ln.sub_n + ln.pq_n > 0 union select oid from aw
  )
  select o.id, o.name,
         coalesce(ln.sub_n, 0), coalesce(ln.pq_n, 0),
         coalesce(o.per_request_fee, public.billing_reference_per_quote_fee()),
         case when o.per_request_fee is null then 'reference' else 'org' end,
         (coalesce(ln.pq_n, 0)::bigint * coalesce(o.per_request_fee, public.billing_reference_per_quote_fee()))::bigint,
         coalesce(aw.n, 0), coalesce(aw.amt, 0)::bigint,
         coalesce(o.fee_rate, public.billing_reference_success_rate()),
         case when o.fee_rate is null then 'reference' else 'org' end,
         coalesce(aw.fee, 0)::bigint
  from ids
  join public.cro_orgs o on o.id = ids.oid
  left join ln on ln.oid = o.id
  left join aw on aw.oid = o.id
  order by o.name;
$$;
revoke execute on function public.billing_reference(date, date) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 7) 월별 기관 명세: 반환 열은 0020·0023 과 같다. total_due 에 그 달 조정 항목 합을 더하고,
--    조정만 있는 기관도 명세에 나온다. 나머지는 0023 과 같다
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
           count(aw.id)::int as selected
    from public.billing_lines(p_from, p_to) l
    left join public.rfq_awards aw on aw.quote_id = l.quote_id
    group by l.org_id
  ),
  ga as (
    select b.org_id as oid,
           count(*) filter (where b.kind = 'guidance' and b.invite_joined)::int as guidance_count,
           sum(b.fee) filter (where b.kind = 'guidance' and b.invite_joined)::bigint as guidance_fee,
           count(*) filter (where b.kind = 'settlement' and b.invite_joined)::int as settled_count,
           coalesce(sum(b.contract_amount) filter (where b.kind = 'settlement' and b.invite_joined), 0)::bigint as settled_contract_amount,
           sum(b.fee) filter (where b.kind = 'settlement' and b.invite_joined)::bigint as settled_fee
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
  adj as (
    select a.org_id as oid, sum(a.amount)::bigint as amount
    from public.billing_adjustments a
    where a.month >= p_from and a.month < p_to
    group by a.org_id
  ),
  ids as (
    select oid from inv union select oid from ln union select oid from ga union select oid from sub union select oid from adj
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
                when o.fee_rate is null then null else ga.settled_fee end as settled_fee,
           coalesce(adj.amount, 0) as adjustment_total
    from ids
    join public.cro_orgs o on o.id = ids.oid
    left join inv on inv.oid = o.id
    left join ln on ln.oid = o.id
    left join ga on ga.oid = o.id
    left join sub on sub.oid = o.id
    left join adj on adj.oid = o.id
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
    (coalesce(f.monthly_fee, 0) + coalesce(f.per_quote_fee, 0) + coalesce(f.settled_fee, 0) + f.adjustment_total)::bigint,
    (f.per_quote_fee is null or f.settled_fee is null)
  from f
  order by 27 desc, f.quoted desc, f.name;
$$;
revoke execute on function public.billing_summary(date, date) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 8) 마감 저장본: 요약·견적·성사수수료에 조정 항목(adjustments)과 참고 수치(reference)를 더한다
-- ─────────────────────────────────────────────
create or replace function public.billing_snapshot(p_from date, p_to date)
returns jsonb
language sql stable
security definer set search_path = public
as $$
  select jsonb_build_object(
    'taken_at',    now(),
    'summary',     coalesce((select jsonb_agg(to_jsonb(s)) from public.billing_summary(p_from, p_to) s), '[]'::jsonb),
    'lines',       coalesce((select jsonb_agg(to_jsonb(l)) from public.billing_lines(p_from, p_to) l), '[]'::jsonb),
    'awards',      coalesce((select jsonb_agg(to_jsonb(b)) from public.billing_awards(p_from, p_to) b), '[]'::jsonb),
    'adjustments', coalesce((select jsonb_agg(to_jsonb(a)) from public.billing_adjustment_lines(p_from, p_to) a), '[]'::jsonb),
    'reference',   coalesce((select jsonb_agg(to_jsonb(x)) from public.billing_reference(p_from, p_to) x), '[]'::jsonb)
  );
$$;
revoke execute on function public.billing_snapshot(date, date) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 9) 월 마감: 한 번만. 이미 마감한 달은 저장본을 다시 찍지 않고 already 로 돌려준다.
--    끝나지 않은 달(서울 기준 다음 달 1일 전)은 not_ended. 같은 달 조정 쓰기와 줄을 세운 뒤 저장본을 찍는다
-- ─────────────────────────────────────────────
create or replace function public.close_billing_month(p_month date, p_actor uuid, p_note text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_prev public.billing_periods%rowtype;
  v_snap jsonb;
begin
  if v_month is null then return jsonb_build_object('ok', false, 'code', 'bad_month'); end if;
  perform public.billing_month_lock(v_month);
  select * into v_prev from public.billing_periods where month = v_month;
  if found then
    return jsonb_build_object('ok', true, 'already', true, 'month', v_month, 'closed_at', v_prev.closed_at);
  end if;
  if (v_month + interval '1 month')::date > (now() at time zone 'Asia/Seoul')::date then
    return jsonb_build_object('ok', false, 'code', 'not_ended', 'month', v_month);
  end if;
  -- 저장본은 삽입 트리거(billing_periods_guard)가 같은 잠금 안에서 찍는다
  insert into public.billing_periods (month, closed_at, closed_by, note)
  values (v_month, now(), p_actor, nullif(p_note, ''))
  returning snapshot into v_snap;
  return jsonb_build_object('ok', true, 'month', v_month, 'orgs', jsonb_array_length(v_snap->'summary'));
end;
$$;
revoke execute on function public.close_billing_month(date, uuid, text) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 10) 스키마 판
-- ─────────────────────────────────────────────
create or replace function public.danchu_schema_version()
returns int
language sql
immutable
as $$ select 24 $$;
comment on function public.danchu_schema_version() is
  '마지막으로 적용한 마이그레이션 번호 (0024). 앱(lib/schema-version.ts REQUIRED_SCHEMA_VERSION)과 npm run check:schema 가 확인한다. 다음 마이그레이션이 새 번호로 바꾼다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 11) 실행 권한: 서버(service role)가 부르는 함수만 연다
-- ─────────────────────────────────────────────
grant execute on function public.add_billing_adjustment(uuid, date, bigint, text, date, uuid) to service_role;
grant execute on function public.billing_adjustment_lines(date, date) to service_role;
grant execute on function public.billing_reference(date, date) to service_role;
grant execute on function public.billing_summary(date, date) to service_role;
grant execute on function public.billing_snapshot(date, date) to service_role;
grant execute on function public.close_billing_month(date, uuid, text) to service_role;
grant execute on function public.billing_month_lock(date) to service_role;
grant execute on function public.billing_reference_per_quote_fee() to service_role;
grant execute on function public.billing_reference_success_rate() to service_role;
grant execute on function public.danchu_schema_version() to service_role;
