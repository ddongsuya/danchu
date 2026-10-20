-- 0024: 마감한 달은 다시 열 수 없다 · 저장본 고정 · 조정 항목은 열린 달에만, 마감하면 고정 · 시범 기간 참고 수치는 합계 밖

-- 실행하면 오류가 나야 하는 SQL. 오류 문구가 p_like 와 맞아야 통과
create or replace function pg_temp.t_raises(p_sql text, p_like text, p_msg text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm like p_like then return; end if;
    raise exception 'ASSERT 실패: % (다른 오류: %)', p_msg, sqlerrm;
  end;
  raise exception 'ASSERT 실패: % (오류 없이 실행됨)', p_msg;
end $$;

-- 참여 조건 판·경로를 정해 초대 1건 (시범 판 pilot-…, legacy). 참여 기록 쓰기 표식을 잠시 켠다
create or replace function pg_temp.t_invite_as(p_rfq uuid, p_org uuid, p_channel text, p_terms text) returns uuid
language plpgsql as $$
declare v uuid;
begin
  perform set_config('danchu.opt_in_write', 'on', true);
  insert into public.rfq_invites (rfq_id, rfq_no, cro_name, cro_email, cro_org_id, reply_by, expires_at, sent_at, source,
                                  joined_at, join_channel, join_actor, join_terms_version)
  select r.id, r.rfq_no, o.name, 'cro-' || o.id || '@example.test', o.id, (now() + interval '7 days')::date, now() + interval '14 days', now(), 'matched',
         now(), p_channel, case when p_channel = 'legacy' then 'legacy' else 'member' end, p_terms
  from public.rfq_requests r, public.cro_orgs o where r.id = p_rfq and o.id = p_org
  returning id into v;
  perform set_config('danchu.opt_in_write', '', true);
  return v;
end $$;

-- 1) 마감한 달은 다시 열 수 없다: 삭제(마감 해제)·저장본·메모·마감 시각 변경·표 비우기 거절. 다시 마감해도 그대로
do $$
declare
  o uuid := pg_temp.t_org('마감고정기관', 300000);
  m date := pg_temp.t_month(-1);
  snap0 jsonb;
  res jsonb;
begin
  perform pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-LOCK-1'), o, pg_temp.t_mid(-1)), 20000000, pg_temp.t_mid(-1));
  res := public.close_billing_month(m, null, '지난달 마감');
  perform pg_temp.t_eq(res->>'ok', 'true', '지난달 마감');
  select snapshot into snap0 from public.billing_periods where month = m;
  perform pg_temp.t_assert(snap0 ? 'adjustments' and snap0 ? 'reference', '저장본에 조정 항목·참고 수치 자리가 있다');

  perform pg_temp.t_raises(format('delete from public.billing_periods where month = %L', m), 'billing_month_locked%', '마감 해제(삭제) 거절');
  perform pg_temp.t_raises(format('update public.billing_periods set snapshot = %L::jsonb where month = %L', '{}', m), 'billing_month_locked%', '저장본 변경 거절');
  perform pg_temp.t_raises(format('update public.billing_periods set note = %L where month = %L', '고침', m), 'billing_month_locked%', '메모 변경 거절');
  perform pg_temp.t_raises(format('update public.billing_periods set closed_at = now() - interval %L where month = %L', '1 day', m), 'billing_month_locked%', '마감 시각 변경 거절');
  perform pg_temp.t_raises(format('update public.billing_periods set month = %L where month = %L', pg_temp.t_month(-3), m), 'billing_month_locked%', '월 변경 거절');
  perform pg_temp.t_raises('truncate public.billing_periods cascade', 'billing_month_locked%', '표 비우기 거절');

  res := public.close_billing_month(m, null, '두 번째 마감');
  perform pg_temp.t_eq(res->>'already', 'true', '이미 마감한 달은 already');
  perform pg_temp.t_eq((select snapshot from public.billing_periods where month = m), snap0, '저장본 그대로');
  perform pg_temp.t_eq((select note from public.billing_periods where month = m), '지난달 마감', '메모 그대로');
  perform pg_temp.t_eq((select count(*) from public.billing_periods where month = m)::int, 1, '마감 행 1개');

  -- 끝나지 않은 달은 마감하지 않는다 (되돌릴 수 없으므로)
  res := public.close_billing_month(pg_temp.t_month(0), null, '');
  perform pg_temp.t_eq(res->>'code', 'not_ended', '이번 달은 마감 불가');
  res := public.close_billing_month(pg_temp.t_month(1), null, '');
  perform pg_temp.t_eq(res->>'code', 'not_ended', '다음 달은 마감 불가');
  perform pg_temp.t_eq((select count(*) from public.billing_periods where month >= pg_temp.t_month(0))::int, 0, '이번 달 이후 마감 행 없음');

  -- 직접 넣어 마감해도 저장본이 남는다
  insert into public.billing_periods (month) values (pg_temp.t_month(-5));
  perform pg_temp.t_assert((select snapshot from public.billing_periods where month = pg_temp.t_month(-5)) is not null, '직접 마감해도 저장본을 찍는다');

  -- 직접 넣어도 끝나지 않은 달·1일이 아닌 날은 마감하지 않고, 넣는 쪽이 준 저장본은 쓰지 않는다
  perform pg_temp.t_raises(format('insert into public.billing_periods (month, snapshot) values (%L, %L::jsonb)', pg_temp.t_month(0), '{}'), 'billing_month_not_ended%', '이번 달 직접 마감 거절');
  perform pg_temp.t_raises(format('insert into public.billing_periods (month) values (%L)', pg_temp.t_month(1)), 'billing_month_not_ended%', '다음 달 직접 마감 거절');
  perform pg_temp.t_raises(format('insert into public.billing_periods (month) values (%L)', pg_temp.t_month(-6) + 3), 'billing_month_bad%', '1일이 아닌 날 직접 마감 거절');
  insert into public.billing_periods (month, snapshot) values (pg_temp.t_month(-7), '{"summary": [], "made_up": true}'::jsonb);
  perform pg_temp.t_assert((select not (snapshot ? 'made_up') and snapshot ? 'taken_at' and snapshot ? 'reference' from public.billing_periods where month = pg_temp.t_month(-7)), '넣는 쪽이 준 저장본 대신 실제 명세를 찍는다');
end $$;

-- 2) 마감한 운영자 계정이 실제로 지워지면 closed_by 만 빈다 (나머지는 그대로)
do $$
declare
  u uuid := pg_temp.t_user('closer@example.test', 'admin');
  m date := pg_temp.t_month(-4);
  snap0 jsonb;
begin
  perform public.close_billing_month(m, u, '운영자 마감');
  select snapshot into snap0 from public.billing_periods where month = m;
  perform pg_temp.t_raises(format('update public.billing_periods set closed_by = null where month = %L', m), 'billing_month_locked%', '계정이 있으면 마감한 사람을 비울 수 없다');
  delete from auth.users where id = u;
  perform pg_temp.t_eq((select closed_by from public.billing_periods where month = m), null::uuid, '계정 삭제로 closed_by 비움');
  perform pg_temp.t_eq((select snapshot from public.billing_periods where month = m), snap0, '저장본 그대로');
end $$;

-- 3) 조정 항목: 열린 달에만, 사유 필수, 바로잡는 달은 앞선 마감한 달. 기관 합계와 명세에 들어간다
do $$
declare
  o uuid := pg_temp.t_org('조정기관', 300000);
  only_adj uuid := pg_temp.t_org('조정만기관', 300000);
  closed_m date := pg_temp.t_month(-1);
  open_m date := pg_temp.t_month(0);
  res jsonb;
  s record;
begin
  perform public.close_billing_month(closed_m, null, '');
  perform pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-ADJ-1'), o), 20000000);

  res := public.add_billing_adjustment(o, closed_m, 50000, '지난달 중복 청구', null, null);
  perform pg_temp.t_eq(res->>'code', 'closed', '마감한 달에는 조정 항목을 넣을 수 없다');
  perform pg_temp.t_raises(format('insert into public.billing_adjustments (org_id, month, amount, reason) values (%L, %L, 1000, %L)', o, closed_m, '직접'), 'billing_month_closed%', '직접 넣어도 마감한 달은 거절');

  perform pg_temp.t_eq(public.add_billing_adjustment(o, open_m, 0, '사유', null, null)->>'code', 'amount', '0원 거절');
  perform pg_temp.t_eq(public.add_billing_adjustment(o, open_m, 1000, '   ', null, null)->>'code', 'reason', '사유 없으면 거절');
  perform pg_temp.t_eq(public.add_billing_adjustment(gen_random_uuid(), open_m, 1000, '사유', null, null)->>'code', 'not_found', '없는 기관 거절');
  perform pg_temp.t_eq(public.add_billing_adjustment(o, open_m, 1000, '사유', pg_temp.t_month(-2), null)->>'code', 'corrects', '바로잡는 달이 마감되지 않았으면 거절');
  perform pg_temp.t_eq(public.add_billing_adjustment(o, open_m, 1000, '사유', open_m, null)->>'code', 'corrects', '바로잡는 달은 적용 월보다 앞서야 한다');
  perform pg_temp.t_raises(format('insert into public.billing_adjustments (org_id, month, amount, reason) values (%L, %L, 1000, %L)', o, open_m, ''), '%billing_adjustments_reason_chk%', '빈 사유는 제약이 막는다');
  perform pg_temp.t_raises(format('insert into public.billing_adjustments (org_id, month, amount, reason) values (%L, %L, 1000, %L)', o, open_m + 3, '1일 아님'), '%billing_adjustments_month_chk%', '적용 월은 1일');

  res := public.add_billing_adjustment(o, open_m + 9, -120000, '지난달 건당 이용료 중복분 돌려줌', closed_m, null);
  perform pg_temp.t_eq(res->>'ok', 'true', '열린 달에 조정 (달 중간 날짜도 1일로)');
  perform pg_temp.t_eq((select month from public.billing_adjustments where id = (res->>'id')::uuid), open_m, '적용 월은 1일');
  perform pg_temp.t_eq((select corrects_month from public.billing_adjustments where id = (res->>'id')::uuid), closed_m, '바로잡는 마감 월');
  res := public.add_billing_adjustment(only_adj, open_m, 70000, '지난달 누락분', null, null);
  perform pg_temp.t_eq(res->>'ok', 'true', '견적 없는 기관에도 조정');

  select * into s from public.billing_summary(open_m, pg_temp.t_month(1)) where org_id = o;
  perform pg_temp.t_eq(s.per_quote_fee, 300000::bigint, '건당 이용료 그대로');
  perform pg_temp.t_eq(s.total_due, 180000::bigint, '합계 = 300,000 - 120,000');
  select * into s from public.billing_summary(open_m, pg_temp.t_month(1)) where org_id = only_adj;
  perform pg_temp.t_assert(found, '조정만 있는 기관도 명세에 나온다');
  perform pg_temp.t_eq(s.total_due, 70000::bigint, '조정만');
  perform pg_temp.t_eq((select count(*) from public.billing_adjustment_lines(open_m, pg_temp.t_month(1)))::int, 2, '조정 내역 2건');
  perform pg_temp.t_eq((select count(*) from public.billing_adjustment_lines(closed_m, open_m))::int, 0, '지난달에는 조정 없음');
  -- 지난달 마감 저장본은 조정과 상관없이 그대로
  perform pg_temp.t_eq((select jsonb_array_length(snapshot->'adjustments') from public.billing_periods where month = closed_m), 0, '마감한 달 저장본에는 조정 없음');
end $$;

-- 4) 열린 달의 조정은 고칠 수 있고, 그 달을 마감하면 저장본에 들어가고 바꾸거나 지울 수 없다
do $$
declare
  o uuid := pg_temp.t_org('마감조정기관', 300000);
  m date := pg_temp.t_month(-2);
  a uuid;
  snap jsonb;
begin
  perform pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-ADJ-2'), o, pg_temp.t_mid(-2)), 20000000, pg_temp.t_mid(-2));
  a := (public.add_billing_adjustment(o, m, 10000, '처음 사유', null, null)->>'id')::uuid;
  update public.billing_adjustments set amount = 25000, reason = '고친 사유' where id = a;
  perform pg_temp.t_eq((select amount from public.billing_adjustments where id = a), 25000::bigint, '열린 달 조정은 고칠 수 있다');

  perform public.close_billing_month(m, null, '');
  select snapshot into snap from public.billing_periods where month = m;
  perform pg_temp.t_eq((select (x->>'total_due')::bigint from jsonb_array_elements(snap->'summary') x where x->>'org_id' = o::text), 325000::bigint, '저장본 합계에 조정 포함');
  perform pg_temp.t_eq((select count(*) from jsonb_array_elements(snap->'adjustments') x where x->>'org_id' = o::text and (x->>'amount')::bigint = 25000 and x->>'reason' = '고친 사유')::int, 1, '저장본에 조정 항목');

  perform pg_temp.t_raises(format('update public.billing_adjustments set amount = 1 where id = %L', a), 'billing_month_closed%', '마감한 달 조정 금액 변경 거절');
  perform pg_temp.t_raises(format('update public.billing_adjustments set reason = %L where id = %L', 'x', a), 'billing_month_closed%', '마감한 달 조정 사유 변경 거절');
  perform pg_temp.t_raises(format('update public.billing_adjustments set month = %L where id = %L', pg_temp.t_month(0), a), 'billing_month_closed%', '마감한 달 조정을 다른 달로 옮기기 거절');
  perform pg_temp.t_raises(format('delete from public.billing_adjustments where id = %L', a), 'billing_month_closed%', '마감한 달 조정 삭제 거절');
  perform pg_temp.t_raises('truncate public.billing_adjustments', 'billing_month_closed%', '조정 항목 표 비우기 거절');
  perform pg_temp.t_eq(public.add_billing_adjustment(o, m, 5000, '마감 뒤', null, null)->>'code', 'closed', '마감 뒤 같은 달에 더 넣을 수 없다');
end $$;

-- 5) 참고 수치: 시범 판·legacy 견적과 체결만, 기관 약정 값이 있으면 그 값, 없으면 참고 단가. 합계에는 넣지 않는다
do $$
declare
  ref_org uuid := pg_temp.t_org('참고단가기관', null, null);
  own_org uuid := pg_temp.t_org('약정기관', 300000, 0.05);
  inv uuid;
  q uuid;
  a uuid;
  today date := (now() at time zone 'Asia/Seoul')::date;
  r record;
  s record;
  snap jsonb;
begin
  -- 참고 단가 기관: 시범 판 견적 3건(구독 1, 건당 1, 건당+성사 1) + legacy 견적 1건(건당) + 운영자 제외 시범 견적 1건(세지 않음)
  perform pg_temp.t_quote(pg_temp.t_invite_as(pg_temp.t_rfq('T-REF-1'), ref_org, 'portal', 'pilot-2026-10-20b'), 3000000);
  perform pg_temp.t_quote(pg_temp.t_invite_as(pg_temp.t_rfq('T-REF-2'), ref_org, 'token', 'pilot-2026-10-20b'), 20000000);
  q := pg_temp.t_quote(pg_temp.t_invite_as(pg_temp.t_rfq('T-REF-3'), ref_org, 'portal', 'pilot-2026-10-20b'), 60000000);
  a := pg_temp.t_award(q);
  perform public.report_contract(a, today, 55000000, '');
  perform pg_temp.t_confirm(a);
  perform pg_temp.t_quote(pg_temp.t_invite_as(pg_temp.t_rfq('T-REF-4'), ref_org, 'legacy', null), 15000000);
  inv := pg_temp.t_invite_as(pg_temp.t_rfq('T-REF-5'), ref_org, 'portal', 'pilot-2026-10-20b');
  perform pg_temp.t_quote(inv, 30000000);
  update public.rfq_invites set billable = false, bill_excluded_reason = '동일 요청 중복' where id = inv;

  -- 약정 기관: 시범 판 건당 1건 + legacy 수주 체결 1건 + 유료 조건 참여 견적 1건(실제 청구, 참고에는 없음)
  perform pg_temp.t_quote(pg_temp.t_invite_as(pg_temp.t_rfq('T-REF-6'), own_org, 'portal', 'pilot-2026-10-20b'), 12000000);
  q := pg_temp.t_quote(pg_temp.t_invite_as(pg_temp.t_rfq('T-REF-7'), own_org, 'legacy', null), 80000000);
  a := pg_temp.t_award(q);
  perform public.report_contract(a, today, 70000000, '');
  perform pg_temp.t_confirm(a);
  perform pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-REF-8'), own_org), 20000000);

  select * into r from public.billing_reference(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = ref_org;
  perform pg_temp.t_eq(r.subscription_count, 1, '참고: 구독 구간 1건');
  perform pg_temp.t_eq(r.per_quote_count, 3, '참고: 건당 대상 3건 (시범 2 + legacy 1, 운영자 제외는 빼고)');
  perform pg_temp.t_eq(r.per_quote_unit, 30000, '약정 없으면 참고 단가 30,000원');
  perform pg_temp.t_eq(r.per_quote_unit_source, 'reference', '단가 출처: 참고 단가');
  perform pg_temp.t_eq(r.per_quote_fee, 90000::bigint, '참고 건당 이용료 = 3 × 30,000');
  perform pg_temp.t_eq(r.success_count, 1, '참고: 체결 1건');
  perform pg_temp.t_eq(r.success_contract_amount, 55000000::bigint, '계약 금액');
  perform pg_temp.t_eq(r.success_rate, 0.03::numeric, '약정 없으면 참고 요율 3%');
  perform pg_temp.t_eq(r.success_rate_source, 'reference', '요율 출처: 참고 단가');
  perform pg_temp.t_eq(r.success_fee, 1650000::bigint, '참고 성사수수료 = 55,000,000 × 3%');

  select * into r from public.billing_reference(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = own_org;
  perform pg_temp.t_eq(r.per_quote_count, 2, '약정 기관: 시범 1건 + legacy 1건 (유료 조건 견적은 참고에 없음)');
  perform pg_temp.t_eq(r.per_quote_unit, 300000, '약정 단가를 쓴다');
  perform pg_temp.t_eq(r.per_quote_unit_source, 'org', '단가 출처: 기관 약정');
  perform pg_temp.t_eq(r.per_quote_fee, 600000::bigint, '참고 건당 = 2 × 300,000');
  perform pg_temp.t_eq(r.success_rate, 0.05::numeric, '약정 요율을 쓴다');
  perform pg_temp.t_eq(r.success_rate_source, 'org', '요율 출처: 기관 약정');
  perform pg_temp.t_eq(r.success_fee, 3500000::bigint, '참고 성사수수료 = 70,000,000 × 5%');

  -- 합계에는 넣지 않는다
  select * into s from public.billing_summary(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = ref_org;
  perform pg_temp.t_eq(s.billable, 0, '시범·legacy 견적은 청구 대상 0');
  perform pg_temp.t_eq(s.per_quote_fee, 0::bigint, '건당 이용료 0');
  perform pg_temp.t_eq(s.settled_count, 0, '정산 0건');
  perform pg_temp.t_eq(s.total_due, 0::bigint, '합계 0 (참고 수치 미포함)');
  select * into s from public.billing_summary(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = own_org;
  perform pg_temp.t_eq(s.per_quote, 1, '유료 조건 견적 1건만 청구');
  perform pg_temp.t_eq(s.total_due, 300000::bigint, '합계 = 유료 조건 견적 1건 (참고 600,000 + 3,500,000 은 미포함)');

  -- 저장본에 참고 수치가 따로 들어가고 합계와 섞이지 않는다
  snap := public.billing_snapshot(pg_temp.t_month(0), pg_temp.t_month(1));
  perform pg_temp.t_eq((select (x->>'per_quote_fee')::bigint from jsonb_array_elements(snap->'reference') x where x->>'org_id' = ref_org::text), 90000::bigint, '저장본 참고 건당');
  perform pg_temp.t_eq((select (x->>'success_fee')::bigint from jsonb_array_elements(snap->'reference') x where x->>'org_id' = own_org::text), 3500000::bigint, '저장본 참고 성사수수료');
  perform pg_temp.t_eq((select (x->>'total_due')::bigint from jsonb_array_elements(snap->'summary') x where x->>'org_id' = ref_org::text), 0::bigint, '저장본 합계 0');

  -- 참고 단가 함수 값 (lib/billing.ts 와 같다)
  perform pg_temp.t_eq(public.billing_reference_per_quote_fee(), 30000, '참고 건당 단가');
  perform pg_temp.t_eq(public.billing_reference_success_rate(), 0.03::numeric, '참고 요율');
end $$;

-- 6) 0024 를 데이터가 있는 상태에서 한 번 더 적용해도 마감·저장본·조정이 그대로이고 보호가 남는다
create temp table t_lock_before as select 1;
do $$
declare
  o uuid := pg_temp.t_org('재적용조정기관', 300000);
  m date := pg_temp.t_month(-1);
begin
  perform pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-LOCK-RE'), o, pg_temp.t_mid(-1)), 20000000, pg_temp.t_mid(-1));
  perform public.close_billing_month(m, null, '재적용 전');
  perform public.add_billing_adjustment(o, pg_temp.t_month(0), -5000, '재적용 전 조정', m, null);
  drop table t_lock_before;
  create temp table t_lock_before as
    select p.month, p.snapshot, p.closed_at, (select count(*) from public.billing_adjustments) as adj_n,
           (select sum(amount) from public.billing_adjustments) as adj_sum
    from public.billing_periods p where p.month = m;
end $$;

\set f :migrations_dir '/0024_billing_close_lock.sql'
\i :f

do $$
declare b record;
begin
  select * into b from t_lock_before;
  perform pg_temp.t_eq((select snapshot from public.billing_periods where month = b.month), b.snapshot, '재적용 뒤 저장본 그대로');
  perform pg_temp.t_eq((select closed_at from public.billing_periods where month = b.month), b.closed_at, '재적용 뒤 마감 시각 그대로');
  perform pg_temp.t_eq((select count(*) from public.billing_adjustments), b.adj_n, '재적용 뒤 조정 항목 수 그대로');
  perform pg_temp.t_eq((select sum(amount) from public.billing_adjustments), b.adj_sum, '재적용 뒤 조정 금액 그대로');
  perform pg_temp.t_raises(format('delete from public.billing_periods where month = %L', b.month), 'billing_month_locked%', '재적용 뒤에도 마감 해제 거절');
  perform pg_temp.t_eq(public.add_billing_adjustment((select org_id from public.billing_adjustments limit 1), b.month, 1000, '마감한 달', null, null)->>'code', 'closed', '재적용 뒤에도 마감한 달 조정 거절');
  perform pg_temp.t_eq(public.danchu_schema_version(), 24, '스키마 판 24');
  perform pg_temp.t_eq((select count(*) from pg_trigger where tgname in ('billing_periods_guard', 'billing_periods_no_truncate', 'billing_adjustments_guard', 'billing_adjustments_no_truncate') and not tgisinternal)::int, 4, '보호 트리거 4개 (중복 없음)');
end $$;
