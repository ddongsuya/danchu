-- 열린 비교표 고정 (0026, 2026-10-21 결정 2·3): 비교표가 열린 뒤에는 견적 수정·다시 제출·새 견적·항목 변경을 거절하고,
-- compared_at 을 비우거나 바꾸는 것(다시 열기)과 회신 기한(reply_by) 변경을 거절한다. 보류·종료 뒤 다시 열 때는 처음 열린 시각을 그대로 둔다.

create or replace function pg_temp.tok(p_invite uuid) returns text
language sql as $$ select token from public.rfq_invites where id = p_invite $$;
create or replace function pg_temp.sub(p_invite uuid, p_amount bigint, p_submit boolean default true) returns jsonb
language sql as $$
  select public.save_quote(p_invite,
    jsonb_build_object('total_amount', p_amount, 'note', 'n', 'pdf_path', 'x/q.pdf', 'start_date', current_date, 'valid_until', current_date + 30),
    '[]'::jsonb, p_submit, null, pg_temp.tok(p_invite))
$$;
-- 쓰기 하나를 실행하고 오류 문구를 돌려준다 (오류가 없으면 'none')
create or replace function pg_temp.try(p_sql text) returns text
language plpgsql as $$
begin
  execute p_sql;
  return 'none';
exception when others then
  return sqlerrm;
end $$;

-- 1) save_quote 는 비교표가 열린 뒤 수정·다시 제출·초안 저장을 모두 closed 로 거절한다 (0025 판 그대로)
do $$
declare
  a uuid := pg_temp.t_org('고정A');
  b uuid := pg_temp.t_org('고정B');
  rq uuid := pg_temp.t_rfq('T-LOCK-1');
  ia uuid;
  ib uuid;
  res jsonb;
  qa uuid;
  rev int;
begin
  update public.rfq_requests set join_by = now() - interval '1 day', reply_by = (now() at time zone 'Asia/Seoul')::date + 5 where id = rq;
  ia := pg_temp.t_invite(rq, a);
  ib := pg_temp.t_invite(rq, b);
  perform pg_temp.t_eq(pg_temp.sub(ia, 20000000)->>'compare_opened', 'false', '한 곳만 제출: 아직 열리지 않음');
  -- 열리기 전에는 고칠 수 있다
  perform pg_temp.t_eq((pg_temp.sub(ia, 21000000)->>'ok')::boolean, true, '열리기 전 재제출은 된다');
  res := pg_temp.sub(ib, 30000000);
  perform pg_temp.t_eq(res->>'compare_opened', 'true', '참여 기관이 모두 제출: 비교표 열림');
  perform pg_temp.t_assert((select compared_at is not null from public.rfq_requests where id = rq), 'compared_at 채움');

  select id, revision into qa, rev from public.cro_quotes where invite_id = ia;
  perform pg_temp.t_eq(pg_temp.sub(ia, 15000000)->>'code', 'closed', '열린 뒤 재제출 거절');
  perform pg_temp.t_eq(pg_temp.sub(ia, 15000000, false)->>'code', 'closed', '열린 뒤 초안 저장 거절');
  perform pg_temp.t_eq((select total_amount from public.cro_quotes where id = qa), 21000000::bigint, '금액 그대로');
  perform pg_temp.t_eq((select revision from public.cro_quotes where id = qa), rev, '판 그대로');
  perform pg_temp.t_eq(public.open_comparison_if_ready(rq)->>'reason', 'already', '두 번 열리지 않음');
end $$;

-- 2) 함수를 거치지 않는 직접 쓰기도 막는다 (cro_quotes·cro_quote_items 트리거). 내용이 아닌 갱신은 된다
do $$
declare
  a uuid := pg_temp.t_org('직접A');
  c uuid := pg_temp.t_org('직접C');
  rq uuid := pg_temp.t_rfq('T-LOCK-2');
  ia uuid;
  ic uuid;
  qa uuid;
  r text;
begin
  ia := pg_temp.t_invite(rq, a);
  ic := pg_temp.t_invite(rq, c, now(), false);
  qa := pg_temp.t_quote(ia, 40000000);
  -- 열리기 전에는 직접 고쳐도 된다 (운영 SQL·옮겨 적기 경로를 막지 않는다)
  perform pg_temp.t_eq(pg_temp.try(format('update public.cro_quotes set note = %L where id = %L', '열리기 전 메모', qa)), 'none', '열리기 전 직접 수정 허용');
  update public.rfq_requests set compared_at = now(), status = 'compared' where id = rq;

  r := pg_temp.try(format('update public.cro_quotes set total_amount = 1 where id = %L', qa));
  perform pg_temp.t_assert(r like 'compare_locked:%', '열린 뒤 금액 직접 수정 거절: ' || r);
  r := pg_temp.try(format('update public.cro_quotes set status = %L, submitted_at = null where id = %L', 'draft', qa));
  perform pg_temp.t_assert(r like 'compare_locked:%', '열린 뒤 초안으로 되돌리기 거절: ' || r);
  r := pg_temp.try(format('update public.cro_quotes set submitted_at = now() + interval ''1 minute'' where id = %L', qa));
  perform pg_temp.t_assert(r like 'compare_locked:%', '열린 뒤 다시 제출(제출 시각 변경) 거절: ' || r);
  r := pg_temp.try(format($q$insert into public.cro_quote_items (quote_id, seq, category, name, avail, amount) values (%L, 99, '일반독성', '추가 항목', '가능', 1000)$q$, qa));
  perform pg_temp.t_assert(r like 'compare_locked:%', '열린 뒤 항목 추가 거절: ' || r);
  r := pg_temp.try(format($q$insert into public.cro_quotes (invite_id, rfq_id, rfq_no, cro_name, total_amount, status, submitted_at) select id, rfq_id, rfq_no, cro_name, 1, 'submitted', now() from public.rfq_invites where id = %L$q$, ic));
  perform pg_temp.t_assert(r like 'compare_locked:%', '열린 뒤 새 견적 거절: ' || r);
  perform pg_temp.t_eq((select total_amount from public.cro_quotes where id = qa), 40000000::bigint, '금액 그대로');
  perform pg_temp.t_eq((select status from public.cro_quotes where id = qa), 'submitted', '제출 상태 그대로');

  -- 접속 기록처럼 내용이 아닌 갱신은 된다 (마지막 제출이 비교표를 연 뒤 라우트가 IP·브라우저를 남긴다)
  perform pg_temp.t_eq(pg_temp.try(format('update public.cro_quotes set submitted_ip = %L, submitted_ua = %L where id = %L', '203.0.113.7', 'UA', qa)), 'none', '접속 기록 갱신은 허용');
  perform pg_temp.t_eq((select submitted_ip from public.cro_quotes where id = qa), '203.0.113.7', '접속 기록 저장');
end $$;

-- 3) 요청: 열린 비교표는 다시 열지 않고 회신 기한도 바꾸지 않는다. 보류·종료 뒤 다시 열기는 처음 열린 시각을 둔다
do $$
declare
  rq uuid := pg_temp.t_rfq('T-LOCK-3');
  rq_open uuid := pg_temp.t_rfq('T-LOCK-3B');
  opened timestamptz;
  r text;
begin
  update public.rfq_requests set reply_by = (now() at time zone 'Asia/Seoul')::date + 3 where id in (rq, rq_open);
  -- 열리기 전에는 회신 기한을 늘릴 수 있다 (회신 0건 요청을 살리는 경로)
  perform pg_temp.t_eq(pg_temp.try(format('update public.rfq_requests set reply_by = reply_by + 7 where id = %L', rq_open)), 'none', '열리기 전 기한 연장 허용');

  update public.rfq_requests set compared_at = now() - interval '1 hour', status = 'compared' where id = rq;
  select compared_at into opened from public.rfq_requests where id = rq;

  r := pg_temp.try(format('update public.rfq_requests set compared_at = null, status = %L where id = %L', 'quoted', rq));
  perform pg_temp.t_assert(r like 'compare_locked:%', '다시 열기(compared_at 비우기) 거절: ' || r);
  r := pg_temp.try(format('update public.rfq_requests set compared_at = now() where id = %L', rq));
  perform pg_temp.t_assert(r like 'compare_locked:%', '공개 시각 바꾸기 거절: ' || r);
  r := pg_temp.try(format('update public.rfq_requests set reply_by = reply_by + 7 where id = %L', rq));
  perform pg_temp.t_assert(r like 'compare_locked:%', '열린 뒤 회신 기한 연장 거절: ' || r);
  r := pg_temp.try(format('update public.rfq_requests set reply_by = null where id = %L', rq));
  perform pg_temp.t_assert(r like 'compare_locked:%', '열린 뒤 회신 기한 지우기 거절: ' || r);

  -- 보류(종료) 뒤 다시 열기: 상태만 바꾸고 같은 compared_at 을 다시 써도 된다 (/api/rfq/[no]/reopen 과 같은 갱신)
  perform pg_temp.t_eq(pg_temp.try(format('update public.rfq_requests set status = %L, closed_at = now() where id = %L', 'closed', rq)), 'none', '보류로 종료');
  perform pg_temp.t_eq(pg_temp.try(format('update public.rfq_requests set status = %L, compared_at = compared_at, closed_at = null where id = %L', 'compared', rq)), 'none', '다시 열기는 처음 공개 시각 그대로');
  perform pg_temp.t_eq((select compared_at from public.rfq_requests where id = rq), opened, '처음 열린 시각 유지');
  -- 다른 열(운영 메모·참여 결정 기한)은 바꿀 수 있다
  perform pg_temp.t_eq(pg_temp.try(format('update public.rfq_requests set admin_note = %L where id = %L', '메모', rq)), 'none', '운영 메모는 바꿀 수 있다');
end $$;

-- 3b) 참여 안내를 보낸 뒤에는 비교표가 열리기 전이라도 회신 기한을 앞당길 수 없다 (앞당기기 = 조기 마감). 늘리기와 배포 전 변경은 된다
do $$
declare
  rq uuid := pg_temp.t_rfq('T-LOCK-4');
  rq_new uuid := pg_temp.t_rfq('T-LOCK-4B');
  r text;
begin
  update public.rfq_requests set reply_by = (now() at time zone 'Asia/Seoul')::date + 10, distributed_at = now() where id = rq;
  update public.rfq_requests set reply_by = (now() at time zone 'Asia/Seoul')::date + 10, distributed_at = null, status = 'received' where id = rq_new;
  r := pg_temp.try(format('update public.rfq_requests set reply_by = reply_by - 5 where id = %L', rq));
  perform pg_temp.t_assert(r like 'deadline_shorten:%', '배포 뒤 기한 앞당기기 거절: ' || r);
  perform pg_temp.t_eq(pg_temp.try(format('update public.rfq_requests set reply_by = reply_by + 3 where id = %L', rq)), 'none', '배포 뒤 기한 늘리기 허용');
  perform pg_temp.t_eq(pg_temp.try(format('update public.rfq_requests set reply_by = reply_by - 5 where id = %L', rq_new)), 'none', '배포 전 기한 앞당기기 허용');
end $$;

-- 3c) 안전망 빈틈: 열린 견적을 다른 요청으로 옮기기, 항목 지우기, 별도 옵션 쓰기도 막는다. 견적을 지울 때의 연쇄 삭제는 된다
do $$
declare
  a uuid := pg_temp.t_org('빈틈A');
  rq uuid := pg_temp.t_rfq('T-LOCK-5');
  rq_other uuid := pg_temp.t_rfq('T-LOCK-5B');
  rq_pre uuid := pg_temp.t_rfq('T-LOCK-5C');
  ia uuid;
  ip uuid;
  qa uuid;
  qp uuid;
  r text;
begin
  ia := pg_temp.t_invite(rq, a);
  qa := pg_temp.t_quote(ia, 50000000);
  insert into public.cro_quote_items (quote_id, seq, category, name, avail, amount) values (qa, 1, '일반독성', '항목', '가능', 1000);
  insert into public.cro_quote_addons (quote_id, seq, name, amount) values (qa, 1, '옵션', 500);
  ip := pg_temp.t_invite(rq_pre, a);
  qp := pg_temp.t_quote(ip, 60000000);
  insert into public.cro_quote_items (quote_id, seq, category, name, avail, amount) values (qp, 1, '일반독성', '항목', '가능', 1000);
  update public.rfq_requests set compared_at = now(), status = 'compared' where id = rq;

  r := pg_temp.try(format('update public.cro_quotes set rfq_id = %L where id = %L', rq_other, qa));
  perform pg_temp.t_assert(r like 'compare_locked:%', '열린 견적을 다른 요청으로 옮기기 거절: ' || r);
  r := pg_temp.try(format('delete from public.cro_quote_items where quote_id = %L', qa));
  perform pg_temp.t_assert(r like 'compare_locked:%', '열린 뒤 항목 지우기 거절: ' || r);
  r := pg_temp.try(format('update public.cro_quote_addons set amount = 1 where quote_id = %L', qa));
  perform pg_temp.t_assert(r like 'compare_locked:%', '열린 뒤 별도 옵션 바꾸기 거절: ' || r);
  r := pg_temp.try(format($q$insert into public.cro_quote_addons (quote_id, seq, name, amount) values (%L, 2, '추가', 1)$q$, qa));
  perform pg_temp.t_assert(r like 'compare_locked:%', '열린 뒤 별도 옵션 넣기 거절: ' || r);
  perform pg_temp.t_eq((select count(*)::int from public.cro_quote_items where quote_id = qa), 1, '항목 그대로');

  -- 열리기 전 견적은 항목을 지울 수 있고, 견적을 지우면 항목도 연쇄로 지워진다
  perform pg_temp.t_eq(pg_temp.try(format('delete from public.cro_quote_items where quote_id = %L', qp)), 'none', '열리기 전 항목 지우기 허용');
  insert into public.cro_quote_items (quote_id, seq, category, name, avail, amount) values (qp, 2, '일반독성', '항목', '가능', 1000);
  perform pg_temp.t_eq(pg_temp.try(format('delete from public.cro_quotes where id = %L', qp)), 'none', '열리기 전 견적 삭제(연쇄) 허용');
  perform pg_temp.t_eq((select count(*)::int from public.cro_quote_items where quote_id = qp), 0, '연쇄 삭제됨');
end $$;

-- 조정 항목은 돌려드리는 금액만 (2026-10-21 결정, 0026 배경 4)
do $$
declare
  o uuid := pg_temp.t_org('조정부호기관', 300000);
  r text;
begin
  perform pg_temp.t_eq(public.add_billing_adjustment(o, pg_temp.t_month(0), 5000, '더 받기', null, null)->>'code', 'credit_only', '더 받는 조정은 거절');
  perform pg_temp.t_eq(public.add_billing_adjustment(o, pg_temp.t_month(0), 0, '0원', null, null)->>'code', 'amount', '0원은 그대로 amount');
  perform pg_temp.t_eq(public.add_billing_adjustment(o, pg_temp.t_month(0), -5000, '중복분 돌려드림', null, null)->>'ok', 'true', '돌려드리는 조정은 된다');
  r := pg_temp.try(format('insert into public.billing_adjustments (org_id, month, amount, reason) values (%L, %L, 5000, %L)', o, pg_temp.t_month(0), '직접'));
  perform pg_temp.t_assert(r like '%billing_adjustments_credit_only%', '직접 넣어도 양수는 제약이 막는다: ' || r);
  perform pg_temp.t_eq((select count(*)::int from pg_constraint where conname = 'billing_adjustments_credit_only'), 1, '제약 하나');
end $$;

-- 4) 두 번 적용해도 트리거가 하나씩이고 판은 26
do $$
begin
  perform pg_temp.t_eq((select count(*)::int from pg_trigger where tgname = 'rfq_requests_compare_lock' and not tgisinternal), 1, '요청 트리거 하나');
  perform pg_temp.t_eq((select count(*)::int from pg_trigger where tgname = 'cro_quotes_compare_lock' and not tgisinternal), 1, '견적 트리거 하나');
  perform pg_temp.t_eq((select count(*)::int from pg_trigger where tgname = 'cro_quote_items_compare_lock' and not tgisinternal), 1, '항목 트리거 하나');
  perform pg_temp.t_eq((select count(*)::int from pg_trigger where tgname = 'cro_quote_addons_compare_lock' and not tgisinternal), 1, '별도 옵션 트리거 하나');
  perform pg_temp.t_eq(public.danchu_schema_version(), 29, '판 29 (0029 까지)');
  perform pg_temp.t_assert(not has_function_privilege('authenticated', 'public.rfq_requests_compare_lock()', 'execute'), '트리거 함수는 로그인 사용자가 부르지 못한다');
end $$;
