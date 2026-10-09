-- 단추(Danchu) 16차: 계약 체결 보고 검증
-- 0015 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경
-- report_contract 가 금액 0·선정일 이전 체결일·중복 보고를 그대로 받았다. 성사수수료의 근거가 되는 값이라
-- DB 함수에서 막는다. 재보고(정정)는 운영자만 할 수 있다 (p_force).

drop function if exists public.report_contract(uuid, date, bigint, text);

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
     set contract_date = p_date, contract_amount = p_amount, contract_note = nullif(p_note, ''), contract_reported_at = now()
   where id = a.id;
  update public.rfq_requests set status = 'contracting' where id = a.rfq_id and status = 'selected';

  select * into r from public.rfq_requests where id = a.rfq_id;
  return jsonb_build_object('ok', true, 'rfq_id', a.rfq_id, 'rfq_no', r.rfq_no, 'user_id', r.user_id, 'substance', r.substance, 'corrected', a.contract_reported_at is not null);
end;
$$;
revoke execute on function public.report_contract(uuid, date, bigint, text, boolean) from public, anon, authenticated;

-- 계약 리마인더 조회: 미보고 수주를 선정일 순으로
create index if not exists rfq_awards_unreported_idx on public.rfq_awards (awarded_at) where contract_reported_at is null;
