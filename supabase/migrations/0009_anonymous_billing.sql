-- 단추(Danchu) 9차: 선정 전 익명 요청 · 요청 성격 · 전달·선정 기록(과금 기반)
-- 0008 실행 후 Supabase SQL Editor에 그대로 붙여 넣어 실행하세요. 두 번 실행해도 안전합니다.
--
-- 배경
-- 수익 모델을 "기관에 전달된 견적 요청 1건당 이용료 + 선정 견적 금액 기준 성사수수료"로 정하면서,
-- 1) 의뢰자 회사명·연락처는 모든 요청에서 선정(또는 CDA 체결 확인) 전까지 기관에 보이지 않게 하고,
-- 2) 전달 기록(rfq_invites)이 곧 청구 기록이 되도록 출처·청구 가능 여부·제외 사유를 남기며,
-- 3) 선정 시점에 선정 견적 금액을 award 에 고정(수수료 기준)하고,
-- 4) 의뢰자가 선정 없이 요청을 마무리할 때 그 사유(outcome)를 기록한다.
-- 가격·한도 자체는 기관별 약정에서 정하므로 cro_orgs 에 자리만 둔다.

-- ─────────────────────────────────────────────
-- 1) 요청: 요청 성격(발주 예정·비교 견적·예산 검토), 선정 없이 마무리한 결과
-- ─────────────────────────────────────────────
alter table public.rfq_requests add column if not exists intent text;
alter table public.rfq_requests add column if not exists outcome text;        -- 외부 진행 | 보류 | 취소
alter table public.rfq_requests add column if not exists outcome_note text;
alter table public.rfq_requests add column if not exists outcome_at timestamptz;

-- ─────────────────────────────────────────────
-- 2) 전달(초대): 출처와 청구 기록
--    source: matched(분야 자동 매칭) | nominated(의뢰자 지명) | manual(운영자 수동)
--    billable: 청구 대상 여부. 허위·중복·분야 불일치는 운영자가 false 로 돌리고 사유를 적는다
-- ─────────────────────────────────────────────
alter table public.rfq_invites add column if not exists source text not null default 'matched';
alter table public.rfq_invites add column if not exists billable boolean not null default true;
alter table public.rfq_invites add column if not exists bill_excluded_reason text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'rfq_invites_source_chk') then
    alter table public.rfq_invites add constraint rfq_invites_source_chk check (source in ('matched', 'nominated', 'manual'));
  end if;
end $$;
create index if not exists rfq_invites_org_sent_idx on public.rfq_invites (cro_org_id, sent_at);

-- ─────────────────────────────────────────────
-- 3) 기관: 약정 자리 (월 전달 한도, 건당 이용료). null 이면 한도 없음·미정
-- ─────────────────────────────────────────────
alter table public.cro_orgs add column if not exists monthly_cap int;
alter table public.cro_orgs add column if not exists per_request_fee int;

-- ─────────────────────────────────────────────
-- 4) 선정: 선정 견적 금액을 고정한다 (성사수수료 기준). 전달 출처도 함께 남긴다
-- ─────────────────────────────────────────────
alter table public.rfq_awards add column if not exists fee_basis_amount bigint;
alter table public.rfq_awards add column if not exists invite_source text;

create or replace function public.select_quote(p_rfq_id uuid, p_quote_id uuid, p_user uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  r public.rfq_requests%rowtype;
  q public.cro_quotes%rowtype;
  v_source text;
  v_award uuid;
begin
  select * into r from public.rfq_requests where id = p_rfq_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if r.compared_at is null then return jsonb_build_object('ok', false, 'code', 'not_compared'); end if;
  if r.selected_quote_id is not null then return jsonb_build_object('ok', false, 'code', 'already_selected'); end if;

  select * into q from public.cro_quotes where id = p_quote_id and rfq_id = p_rfq_id and status = 'submitted';
  if not found then return jsonb_build_object('ok', false, 'code', 'bad_quote'); end if;

  select source into v_source from public.rfq_invites where id = q.invite_id;

  insert into public.rfq_awards (rfq_id, quote_id, invite_id, cro_org_id, cro_name, selected_by, fee_basis_amount, invite_source)
  values (r.id, q.id, q.invite_id, q.cro_org_id, q.cro_name, p_user, q.total_amount, v_source)
  returning id into v_award;

  update public.rfq_requests set status = 'selected', selected_quote_id = q.id where id = r.id;

  return jsonb_build_object('ok', true, 'award_id', v_award, 'invite_id', q.invite_id, 'cro_org_id', q.cro_org_id, 'cro_name', q.cro_name);
end;
$$;
revoke execute on function public.select_quote(uuid, uuid, uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 5) 월별 기관 명세: 전달·제외·회신·선정 집계 (운영자 화면과 청구 명세의 원천)
--    기간은 [p_from, p_to) 서울 기준 날짜. service role 만 호출한다
-- ─────────────────────────────────────────────
create or replace function public.billing_summary(p_from date, p_to date)
returns table (
  org_id uuid, org_name text, per_request_fee int, monthly_cap int,
  delivered int, billable int, excluded int, matched int, nominated int, manual int,
  replied int, declined int, unanswered int, selected int, selected_amount bigint
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
    select a.invite_id, a.fee_basis_amount
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
    coalesce(sum(aw.fee_basis_amount), 0)::bigint
  from public.cro_orgs o
  join inv on inv.cro_org_id = o.id
  left join aw on aw.invite_id = inv.id
  group by o.id, o.name, o.per_request_fee, o.monthly_cap
  order by count(inv.id) desc, o.name;
$$;
revoke execute on function public.billing_summary(date, date) from public, anon, authenticated;
