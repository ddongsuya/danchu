-- 단추(Danchu) 34차: 견적·계약 금액 차이 기록, 의뢰자 쪽 계약 결과 알림 (2026-11-03 대표 요구 3)
-- 0033 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경
-- 1) 성사 수수료는 확정된 계약 금액 × 선정 견적 구간 요율이다. 선정 견적과 계약 금액이 다르면 그 이유가 남아야
--    의뢰자 확인과 운영자 점검이 가능하다. 계약 금액이 선정 견적과 10% 이상 다르면 기관은 차이 사유를 골라야 보고할 수 있다.
--    (scope 시험 범위 변경 · price 단가·할인 조정 · schedule 일정 변경 · other 기타, 기타는 비고 필수)
-- 2) 우회 계약 방지: 계약 결과를 기관만 보고하면, 기관이 "계약 안 함"이라 하고 밖에서 계약하거나 금액을 낮춰 보고해도 알 수 없다.
--    의뢰자도 선정한 기관과의 계약 결과(체결·협의 중·안 함, 체결이면 금액·날짜)를 알릴 수 있게 한다.
--    양쪽이 다르면 운영자 화면 "확인할 신호"에 뜬다. 판단은 운영자가 하고, 이 파일은 기록만 한다.
-- 3) 의뢰자 알림 열(sponsor_*)은 sponsor_report_contract 함수로만 쓴다 (트리거). 요청 주인만 쓸 수 있다.
--    계약이 확정된 뒤에는 바꾸지 않는다 (확정된 계약의 금액은 0024 조정 항목으로 바로잡는다).

do $$ begin
  if to_regclass('public.sms_log') is null or public.danchu_schema_version() < 33 then
    raise exception '0033_sms_notifications.sql 을 먼저 적용해 주세요';
  end if;
end $$;

-- ─────────────────────────────────────────────
-- 1) 열
-- ─────────────────────────────────────────────
alter table public.rfq_awards add column if not exists contract_gap_reason text;
alter table public.rfq_awards add column if not exists sponsor_contract_status text;
alter table public.rfq_awards add column if not exists sponsor_contract_amount bigint;
alter table public.rfq_awards add column if not exists sponsor_contract_date date;
alter table public.rfq_awards add column if not exists sponsor_contract_note text;
alter table public.rfq_awards add column if not exists sponsor_reported_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'rfq_awards_contract_gap_reason_check') then
    alter table public.rfq_awards add constraint rfq_awards_contract_gap_reason_check
      check (contract_gap_reason is null or contract_gap_reason in ('scope', 'price', 'schedule', 'other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rfq_awards_sponsor_contract_check') then
    alter table public.rfq_awards add constraint rfq_awards_sponsor_contract_check
      check (
        (sponsor_contract_status is null and sponsor_reported_at is null and sponsor_contract_amount is null and sponsor_contract_date is null)
        or (sponsor_contract_status in ('signed', 'negotiating', 'not_signed') and sponsor_reported_at is not null
            and (sponsor_contract_status = 'signed' or (sponsor_contract_amount is null and sponsor_contract_date is null))
            and (sponsor_contract_amount is null or sponsor_contract_amount > 0))
      );
  end if;
end $$;

comment on column public.rfq_awards.contract_gap_reason is '계약 금액이 선정 견적과 10% 이상 다를 때 기관이 고른 사유 (0034): scope·price·schedule·other';
comment on column public.rfq_awards.sponsor_contract_status is '의뢰자가 알린 계약 결과 (0034): signed·negotiating·not_signed. sponsor_report_contract 로만 쓴다';
comment on column public.rfq_awards.sponsor_contract_amount is '의뢰자가 알린 계약 금액 (0034, 체결일 때만, 선택)';

-- ─────────────────────────────────────────────
-- 2) 의뢰자 알림 열 보호 (함수로만)
-- ─────────────────────────────────────────────
create or replace function public.rfq_awards_guard_sponsor()
returns trigger
language plpgsql
as $$
declare
  v_writer boolean := coalesce(current_setting('danchu.sponsor_report_write', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    if (new.sponsor_contract_status is not null or new.sponsor_reported_at is not null or new.sponsor_contract_amount is not null
        or new.sponsor_contract_date is not null or new.sponsor_contract_note is not null) and not v_writer then
      raise exception 'sponsor_report_protected: 의뢰자 계약 알림은 sponsor_report_contract 로만 남길 수 있습니다';
    end if;
    return new;
  end if;
  if (new.sponsor_contract_status, new.sponsor_contract_amount, new.sponsor_contract_date, new.sponsor_contract_note, new.sponsor_reported_at)
     is distinct from
     (old.sponsor_contract_status, old.sponsor_contract_amount, old.sponsor_contract_date, old.sponsor_contract_note, old.sponsor_reported_at)
     and not v_writer then
    raise exception 'sponsor_report_protected: 의뢰자 계약 알림은 sponsor_report_contract 로만 바꿀 수 있습니다';
  end if;
  return new;
end;
$$;
revoke execute on function public.rfq_awards_guard_sponsor() from public, anon, authenticated;
drop trigger if exists rfq_awards_guard_sponsor on public.rfq_awards;
create trigger rfq_awards_guard_sponsor before insert or update on public.rfq_awards
  for each row execute function public.rfq_awards_guard_sponsor();

-- ─────────────────────────────────────────────
-- 3) 선정 견적 금액 (성사 수수료 대상 판정과 같은 값)
-- ─────────────────────────────────────────────
create or replace function public.award_quote_amount(p_award_id uuid)
returns bigint
language sql stable
security definer set search_path = public
as $$
  select coalesce(a.fee_basis_amount, q.total_amount)
  from public.rfq_awards a left join public.cro_quotes q on q.id = a.quote_id
  where a.id = p_award_id
$$;
revoke execute on function public.award_quote_amount(uuid) from public, anon, authenticated;

-- 차이 사유가 필요한 차이 (10%). 앱 lib/contract-gap.ts GAP_REASON_RATIO 와 같다
create or replace function public.contract_gap_needs_reason(p_quote bigint, p_amount bigint)
returns boolean
language sql immutable
as $$ select coalesce(p_quote, 0) > 0 and p_amount is not null and abs(p_amount - p_quote) * 10 >= p_quote $$;
revoke execute on function public.contract_gap_needs_reason(bigint, bigint) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 4) 체결 보고: 0025 와 같고, 10% 이상 차이면 사유를 받는다. 인자가 하나 늘어 지우고 다시 만든다
--    실패 code (0025 에 더해): gap_reason (사유 없음) · gap_note (기타인데 비고 없음)
-- ─────────────────────────────────────────────
drop function if exists public.report_contract(uuid, date, bigint, text, boolean);
create or replace function public.report_contract(p_award_id uuid, p_date date, p_amount bigint, p_note text, p_force boolean default false, p_gap_reason text default null)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  a public.rfq_awards%rowtype;
  r public.rfq_requests%rowtype;
  v_due timestamptz;
  v_quote bigint;
  v_reason text := nullif(btrim(coalesce(p_gap_reason, '')), '');
begin
  select * into a from public.rfq_awards where id = p_award_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if a.contract_reported_at is not null and not p_force then return jsonb_build_object('ok', false, 'code', 'already'); end if;
  if p_amount is null or p_amount <= 0 then return jsonb_build_object('ok', false, 'code', 'amount'); end if;
  if p_date is null or p_date < (a.awarded_at at time zone 'Asia/Seoul')::date then return jsonb_build_object('ok', false, 'code', 'date'); end if;
  if p_date > (now() at time zone 'Asia/Seoul')::date then return jsonb_build_object('ok', false, 'code', 'future'); end if;

  v_quote := public.award_quote_amount(a.id);
  if public.contract_gap_needs_reason(v_quote, p_amount) then
    if v_reason is null or v_reason not in ('scope', 'price', 'schedule', 'other') then
      return jsonb_build_object('ok', false, 'code', 'gap_reason', 'quote_amount', v_quote);
    end if;
    if v_reason = 'other' and nullif(btrim(coalesce(p_note, '')), '') is null then
      return jsonb_build_object('ok', false, 'code', 'gap_note', 'quote_amount', v_quote);
    end if;
  else
    v_reason := null;
  end if;

  v_due := case when a.contract_confirmed_at is null then now() + interval '7 days' else a.contract_confirm_due_at end;
  perform set_config('danchu.contract_confirm_write', 'on', true);
  update public.rfq_awards
     set contract_date = p_date, contract_amount = p_amount, contract_note = nullif(p_note, ''),
         contract_gap_reason = v_reason,
         contract_reported_at = coalesce(a.contract_reported_at, now()),
         contract_status = 'signed',
         contract_confirm_due_at = v_due
   where id = a.id;
  perform set_config('danchu.contract_confirm_write', '', true);
  update public.rfq_requests set status = 'contracting' where id = a.rfq_id and status = 'selected';

  select * into r from public.rfq_requests where id = a.rfq_id;
  return jsonb_build_object('ok', true, 'rfq_id', a.rfq_id, 'rfq_no', r.rfq_no, 'user_id', r.user_id, 'substance', r.substance,
                            'corrected', a.contract_reported_at is not null, 'confirm_due_at', v_due,
                            'confirmed', a.contract_confirmed_at is not null,
                            'quote_amount', v_quote, 'gap_reason', v_reason);
end;
$$;
revoke execute on function public.report_contract(uuid, date, bigint, text, boolean, text) from public, anon, authenticated;
grant execute on function public.report_contract(uuid, date, bigint, text, boolean, text) to service_role;

-- ─────────────────────────────────────────────
-- 5) 의뢰자 계약 결과 알림. 요청 주인만. 계약이 확정되면 더 바꾸지 않는다
--    실패 code: not_found · forbidden · confirmed · status · amount · date · future · note
-- ─────────────────────────────────────────────
create or replace function public.sponsor_report_contract(p_award_id uuid, p_actor uuid, p_status text, p_amount bigint, p_date date, p_note text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  a public.rfq_awards%rowtype;
  r public.rfq_requests%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select * into a from public.rfq_awards where id = p_award_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  select * into r from public.rfq_requests where id = a.rfq_id;
  if p_actor is null or r.user_id is distinct from p_actor then return jsonb_build_object('ok', false, 'code', 'forbidden'); end if;
  if a.contract_confirmed_at is not null then return jsonb_build_object('ok', false, 'code', 'confirmed'); end if;
  if p_status is null or p_status not in ('signed', 'negotiating', 'not_signed') then return jsonb_build_object('ok', false, 'code', 'status'); end if;
  if v_note is not null and length(v_note) > 500 then return jsonb_build_object('ok', false, 'code', 'note'); end if;
  if p_status = 'signed' then
    if p_amount is not null and p_amount <= 0 then return jsonb_build_object('ok', false, 'code', 'amount'); end if;
    if p_date is not null and p_date < (a.awarded_at at time zone 'Asia/Seoul')::date then return jsonb_build_object('ok', false, 'code', 'date'); end if;
    if p_date is not null and p_date > (now() at time zone 'Asia/Seoul')::date then return jsonb_build_object('ok', false, 'code', 'future'); end if;
  end if;

  perform set_config('danchu.sponsor_report_write', 'on', true);
  update public.rfq_awards
     set sponsor_contract_status = p_status,
         sponsor_contract_amount = case when p_status = 'signed' then p_amount end,
         sponsor_contract_date = case when p_status = 'signed' then p_date end,
         sponsor_contract_note = v_note,
         sponsor_reported_at = now()
   where id = a.id;
  perform set_config('danchu.sponsor_report_write', '', true);

  return jsonb_build_object('ok', true, 'rfq_id', a.rfq_id, 'rfq_no', r.rfq_no, 'cro_org_id', a.cro_org_id, 'cro_name', a.cro_name,
                            'before', a.sponsor_contract_status, 'contract_reported', a.contract_reported_at is not null,
                            'contract_amount', a.contract_amount, 'quote_amount', public.award_quote_amount(a.id));
end;
$$;
revoke execute on function public.sponsor_report_contract(uuid, uuid, text, bigint, date, text) from public, anon, authenticated;
grant execute on function public.sponsor_report_contract(uuid, uuid, text, bigint, date, text) to service_role;

-- ─────────────────────────────────────────────
-- 6) 판 번호
-- ─────────────────────────────────────────────
create or replace function public.danchu_schema_version()
returns int
language sql
immutable
as $$ select 34 $$;
comment on function public.danchu_schema_version() is
  '마지막으로 적용한 마이그레이션 번호 (0034). 앱(lib/schema-version.ts REQUIRED_SCHEMA_VERSION)과 npm run check:schema 가 확인한다. 다음 마이그레이션이 새 번호로 바꾼다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;
grant execute on function public.danchu_schema_version() to service_role;
