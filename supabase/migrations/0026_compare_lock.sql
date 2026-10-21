-- 단추(Danchu) 26차: 열린 비교표 고정 (2026-10-21 대표 결정 "추천대로" 2·3)
-- 0025 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경 (2026-10-21 결정, 이 파일이 기준)
-- 1) 비교표가 여는 때는 0025 그대로다: 참여가 마감된 뒤(자리가 다 찼거나 참여 결정 기한이 지났다) 참여한 기관(철회 제외)이 모두 제출했거나,
--    회신 기한 다음 날 예약 작업(제출 1건 이상). 의뢰자 요청으로 기한 전에 회신을 마감하던 경로(약관 v1.1 제4조 제7항)는 없앴다.
--    그 경로는 앱(운영자 "회신 마감" 라우트)에만 있었으므로 DB 에서 지울 것은 없다. 운영자 "회신 마감"은 이제 회신 기한이 지난 요청에서만 된다 (앱).
--    급한 의뢰자는 접수 때 회신 기한을 짧게 정한다.
-- 2) 한 번 열린 비교표(rfq_requests.compared_at)는 다시 열지 않고 회신 기한도 바꾸지 않는다.
--    - rfq_requests: compared_at 이 채워진 뒤에는 compared_at 을 비우거나 다른 값으로 바꿀 수 없고, reply_by 도 바꿀 수 없다 (트리거 rfq_requests_compare_lock).
--      보류한 요청을 다시 여는 것(/api/rfq/[no]/reopen), 운영자 종료·취소 뒤 다시 열기는 상태만 바꾸고 처음 열린 시각을 그대로 둔다 (같은 값을 다시 쓰는 것은 된다).
--    - cro_quotes: 비교표가 열린 요청에는 견적 행을 새로 넣거나 내용(금액·조건·PDF·상태·제출 시각 등, 0022 판 올림과 같은 열)을 바꿀 수 없다 (트리거 cro_quotes_compare_lock).
--      접속 기록(submitted_ip·ua), 제출한 계정이 지워질 때 submitted_by 가 비는 것처럼 내용이 아닌 갱신은 된다.
--      마지막 제출이 같은 트랜잭션에서 비교표를 여는 경우(0025 save_quote)는 견적을 먼저 쓰고 나서 compared_at 을 채우므로 막히지 않는다.
--    - cro_quote_items·cro_quote_addons: 비교표가 열린 요청의 견적 항목·별도 옵션은 넣거나 바꾸거나 지울 수 없다 (트리거 cro_quote_items_compare_lock, cro_quote_addons_compare_lock).
--      요청·견적을 지울 때의 연쇄 삭제는 막지 않는다. cro_quotes 갱신은 옮기기 전 요청(old.rfq_id)도 본다.
--    save_quote 는 0019 부터 compared_at 이 있으면 초안·제출 모두 code 'closed' 로 거절한다 (0025 판 그대로). 이 트리거는 함수를 거치지 않는 직접 쓰기까지 막는 안전망이다.
--    - rfq_requests: 참여 안내를 보낸 뒤(distributed_at)에는 비교표가 열리기 전이라도 reply_by 를 앞당길 수 없다 (같은 트리거). 앞당기기는 조기 마감과 같다.
-- 3) 참여 결정 기한(join_by)은 이 파일이 막지 않는다. 운영자 연장은 앱이 비교표가 열리기 전에만 한다 (0023, join_by_extended_at).
-- 4) 청구 조정 항목은 돌려드리는 금액(음수)만 넣는다 (2026-10-21 대표 결정). 기관 이용 조건의 "마감한 달은 다시 청구하지 않음"과 맞추려고
--    적게 받은 금액은 다음 달에 더 받지 않는다. 제약 billing_adjustments_credit_only, add_billing_adjustment 실패 code credit_only.
--
-- 알려진 한계: 이 파일은 함수·트리거만 만든다. 0019~0025 를 다시 적용해도 이 트리거는 남지만, danchu_schema_version() 이 그 파일의 번호로 돌아간다.
-- 그때는 이 파일을 한 번 더 적용한다 (앱이 판 26 을 확인한다).

-- ─────────────────────────────────────────────
-- 0) 선행 마이그레이션 확인 (빠졌으면 여기서 멈춘다)
-- ─────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.danchu_schema_version()') is null
     or to_regprocedure('public.compare_readiness(uuid)') is null
     or to_regprocedure('public.open_comparison_if_ready(uuid)') is null
     or to_regclass('public.rfq_pending') is null
     or public.danchu_schema_version() < 25 then
    raise exception '0026 을 적용하기 전에 0019 부터 0025 까지 순서대로 적용해 주세요.';
  end if;
end $$;

-- ─────────────────────────────────────────────
-- 1) 요청: 열린 비교표는 다시 열지 않고 회신 기한도 바꾸지 않는다
-- ─────────────────────────────────────────────
create or replace function public.rfq_requests_compare_lock()
returns trigger
language plpgsql
as $$
begin
  if old.compared_at is not null then
    if new.compared_at is distinct from old.compared_at then
      raise exception 'compare_locked: 비교표가 열린 요청은 다시 열 수 없습니다 (compared_at 고정)';
    end if;
    if new.reply_by is distinct from old.reply_by then
      raise exception 'compare_locked: 비교표가 열린 요청은 회신 기한을 바꿀 수 없습니다';
    end if;
  end if;
  -- 참여 안내를 보낸 뒤에는 회신 기한을 앞당기지 않는다 (앞당기기 = 의뢰자 요청 조기 마감, 결정 2). 늘리기만 된다
  if old.distributed_at is not null and old.reply_by is not null and new.reply_by is not null and new.reply_by < old.reply_by then
    raise exception 'deadline_shorten: 참여 안내를 보낸 뒤에는 회신 기한을 앞당길 수 없습니다';
  end if;
  return new;
end;
$$;
revoke execute on function public.rfq_requests_compare_lock() from public, anon, authenticated;
drop trigger if exists rfq_requests_compare_lock on public.rfq_requests;
create trigger rfq_requests_compare_lock before update on public.rfq_requests
  for each row execute function public.rfq_requests_compare_lock();

-- ─────────────────────────────────────────────
-- 2) 견적: 비교표가 열린 요청에는 견적을 새로 넣거나 내용을 바꾸지 못한다 (수정·다시 제출 없음)
--    내용 열은 0022 cro_quotes_bump_revision 이 판을 올리는 열과 같다
-- ─────────────────────────────────────────────
create or replace function public.cro_quotes_compare_lock()
returns trigger
language plpgsql
as $$
begin
  -- 갱신이면 옮기기 전 요청(old.rfq_id)도 본다: 열린 요청의 견적을 열리지 않은 요청으로 옮기는 갱신도 막는다
  if not exists (select 1 from public.rfq_requests r
                  where r.id in (new.rfq_id, case when tg_op = 'UPDATE' then old.rfq_id end) and r.compared_at is not null) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    raise exception 'compare_locked: 비교표가 열린 요청에는 견적을 새로 낼 수 없습니다';
  end if;
  if (new.cro_name, new.total_amount, new.total_weeks, new.vat, new.valid_until, new.auto, new.start_date,
      new.pay_terms, new.substance_qty, new.report_lang, new.includes, new.note,
      new.pdf_path, new.pdf_name, new.pdf_size, new.status, new.submitted_at, new.entry_source, new.material_by, new.rfq_id, new.invite_id)
     is distinct from
     (old.cro_name, old.total_amount, old.total_weeks, old.vat, old.valid_until, old.auto, old.start_date,
      old.pay_terms, old.substance_qty, old.report_lang, old.includes, old.note,
      old.pdf_path, old.pdf_name, old.pdf_size, old.status, old.submitted_at, old.entry_source, old.material_by, old.rfq_id, old.invite_id) then
    raise exception 'compare_locked: 비교표가 열린 뒤에는 견적을 고치거나 다시 제출할 수 없습니다';
  end if;
  return new;
end;
$$;
revoke execute on function public.cro_quotes_compare_lock() from public, anon, authenticated;
drop trigger if exists cro_quotes_compare_lock on public.cro_quotes;
create trigger cro_quotes_compare_lock before insert or update on public.cro_quotes
  for each row execute function public.cro_quotes_compare_lock();

-- 견적 항목(cro_quote_items)과 별도 옵션(cro_quote_addons)에 같이 쓴다. 넣기·바꾸기·지우기 모두, 갱신·삭제는 바뀌기 전 견적(old.quote_id)도 본다.
-- 견적이나 요청을 지울 때의 연쇄 삭제는 막지 않는다: 연쇄 삭제가 이 트리거에 닿을 때 부모 견적은 이미 지워져 보이지 않아 조건이 거짓이다
create or replace function public.cro_quote_items_compare_lock()
returns trigger
language plpgsql
as $$
declare
  v_new uuid := case when tg_op in ('INSERT', 'UPDATE') then new.quote_id end;
  v_old uuid := case when tg_op in ('UPDATE', 'DELETE') then old.quote_id end;
begin
  if exists (select 1 from public.cro_quotes q join public.rfq_requests r on r.id = q.rfq_id
              where q.id in (v_new, v_old) and r.compared_at is not null) then
    raise exception 'compare_locked: 비교표가 열린 뒤에는 견적 항목을 고칠 수 없습니다';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
revoke execute on function public.cro_quote_items_compare_lock() from public, anon, authenticated;
drop trigger if exists cro_quote_items_compare_lock on public.cro_quote_items;
create trigger cro_quote_items_compare_lock before insert or update or delete on public.cro_quote_items
  for each row execute function public.cro_quote_items_compare_lock();
-- 별도 옵션은 앱이 지금 쓰지 않지만 비교표 내용이 될 수 있어 같은 규칙으로 막는다
drop trigger if exists cro_quote_addons_compare_lock on public.cro_quote_addons;
create trigger cro_quote_addons_compare_lock before insert or update or delete on public.cro_quote_addons
  for each row execute function public.cro_quote_items_compare_lock();

comment on column public.rfq_requests.compared_at is
  '비교표가 열린 시각 (0025). 한 번 채우면 비우거나 바꿀 수 없고, 그 뒤에는 reply_by 도 바꿀 수 없다 (0026 rfq_requests_compare_lock). 견적 쓰기도 막힌다 (cro_quotes_compare_lock)';

-- ─────────────────────────────────────────────
-- 3) 청구 조정 항목은 돌려드리는 금액만 (위 배경 4)
-- ─────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'billing_adjustments_credit_only') then
    alter table public.billing_adjustments add constraint billing_adjustments_credit_only check (amount < 0);
  end if;
end $$;
comment on column public.billing_adjustments.amount is
  '조정 금액 (원). 0026 부터 돌려드리는 금액(음수)만 넣는다 (billing_adjustments_credit_only). 적게 받은 금액은 다시 청구하지 않는다';

-- 0024 판에 credit_only 검사만 더한다. 실패 code: bad_month · amount · credit_only · reason · not_found · closed · corrects
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
  if p_amount > 0 then return jsonb_build_object('ok', false, 'code', 'credit_only'); end if;
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
grant execute on function public.add_billing_adjustment(uuid, date, bigint, text, date, uuid) to service_role;

-- ─────────────────────────────────────────────
-- 4) 스키마 판
-- ─────────────────────────────────────────────
create or replace function public.danchu_schema_version()
returns int
language sql
immutable
as $$ select 26 $$;
comment on function public.danchu_schema_version() is
  '마지막으로 적용한 마이그레이션 번호 (0026). 앱(lib/schema-version.ts REQUIRED_SCHEMA_VERSION)과 npm run check:schema 가 확인한다. 다음 마이그레이션이 새 번호로 바꾼다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;
grant execute on function public.danchu_schema_version() to service_role;
