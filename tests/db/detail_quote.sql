-- 2차 상세 견적 (0042): 비교표가 열린 뒤 의뢰자가 1차를 낸 기관 1~3곳에 상세 조건을 보내고, 그 기관이 한 번 회신한다.
-- 1차 견적은 그대로 고정이고, 선정 견적 금액은 2차를 고쳐 보낸 기관이면 2차 금액이다.

create or replace function pg_temp.tok(p_invite uuid) returns text
language sql as $$ select token from public.rfq_invites where id = p_invite $$;
create or replace function pg_temp.try(p_sql text) returns text
language plpgsql as $$
begin
  execute p_sql;
  return 'none';
exception when others then
  return sqlerrm;
end $$;

do $$
declare
  a uuid := pg_temp.t_org('상세A');
  b uuid := pg_temp.t_org('상세B');
  c uuid := pg_temp.t_org('상세C');
  u uuid := pg_temp.t_user('detail-owner@example.test');
  x uuid := pg_temp.t_user('detail-other@example.test');
  rq uuid := pg_temp.t_rfq('T-DETAIL-1');
  ia uuid; ib uuid; ic uuid;
  qa uuid; qb uuid; qc uuid;
  d date := (now() at time zone 'Asia/Seoul')::date + 5;
  res jsonb;
  rev int;
begin
  update public.rfq_requests set user_id = u where id = rq;
  ia := pg_temp.t_invite(rq, a); ib := pg_temp.t_invite(rq, b); ic := pg_temp.t_invite(rq, c);
  qa := pg_temp.t_quote(ia, 48000000); qb := pg_temp.t_quote(ib, 52000000); qc := pg_temp.t_quote(ic, 61000000);

  -- 비교표가 열리기 전에는 보낼 수 없다
  perform pg_temp.t_eq(public.send_detail_request(rq, u, array[qa], '{}'::jsonb, d, '')->>'code', 'not_compared', '비교표 전 거절');
  update public.rfq_requests set compared_at = now(), status = 'quoted' where id = rq;

  perform pg_temp.t_eq(public.send_detail_request(rq, x, array[qa], '{}'::jsonb, d, '')->>'code', 'not_found', '남의 요청 거절');
  perform pg_temp.t_eq(public.send_detail_request(rq, u, '{}'::uuid[], '{}'::jsonb, d, '')->>'code', 'bad_targets', '받는 곳 0곳 거절');
  perform pg_temp.t_eq(public.send_detail_request(rq, u, array[qa, gen_random_uuid()], '{}'::jsonb, d, '')->>'code', 'bad_targets', '이 요청 견적이 아니면 거절');
  perform pg_temp.t_eq(public.send_detail_request(rq, u, array[qa], '{}'::jsonb, (now() at time zone 'Asia/Seoul')::date, '')->>'code', 'bad_date', '오늘 기한 거절');

  res := public.send_detail_request(rq, u, array[qa, qb], '{"storage":"냉장(2~8℃)","일반독성.recovery":"4주"}'::jsonb, d, '메모');
  perform pg_temp.t_eq((res->>'ok')::boolean, true, '두 곳에 보냄');
  perform pg_temp.t_eq((res->>'targets')::int, 2, '받는 곳 2');
  perform pg_temp.t_eq(public.send_detail_request(rq, u, array[qc], '{}'::jsonb, d, '')->>'code', 'exists', '요청마다 한 번');

  -- 받지 않은 기관은 회신할 수 없다
  perform pg_temp.t_eq(public.save_detail_reply(ic, pg_temp.tok(ic), null, '{"mode":"keep"}'::jsonb)->>'code', 'not_target', '받지 않은 기관 거절');
  perform pg_temp.t_eq(public.save_detail_reply(ia, 'wrong-token', null, '{"mode":"keep"}'::jsonb)->>'code', 'revoked', '토큰 불일치 거절');
  perform pg_temp.t_eq(public.save_detail_reply(ia, pg_temp.tok(ia), null, '{"mode":"revise"}'::jsonb)->>'code', 'bad_body', '금액 없는 고친 견적 거절');

  select revision into rev from public.cro_quotes where id = qa;
  res := public.save_detail_reply(ia, pg_temp.tok(ia), null,
    '{"mode":"revise","total_amount":54000000,"total_weeks":22,"items":[{"seq":1,"amount":54000000,"weeks":22,"mode":"as_requested"}],"note":"회복군 추가"}'::jsonb);
  perform pg_temp.t_eq((res->>'ok')::boolean, true, '고친 견적 보냄');
  perform pg_temp.t_eq((res->>'left')::int, 1, '남은 곳 1');
  perform pg_temp.t_eq((select total_amount from public.cro_quotes where id = qa), 48000000::bigint, '1차 금액 그대로');
  perform pg_temp.t_eq((select revision from public.cro_quotes where id = qa), rev, '1차 판 그대로');
  perform pg_temp.t_eq(public.save_detail_reply(ia, pg_temp.tok(ia), null, '{"mode":"keep"}'::jsonb)->>'code', 'done', '회신은 한 번');
  perform pg_temp.t_assert(pg_temp.try(format('update public.rfq_detail_targets set total_amount = 1 where quote_id = %L', qa)) like 'detail_locked%', '보낸 회신 직접 수정 거절');

  perform pg_temp.t_eq((public.save_detail_reply(ib, pg_temp.tok(ib), null, '{"mode":"keep"}'::jsonb)->>'ok')::boolean, true, '1차 그대로');
  perform pg_temp.t_eq((select status from public.rfq_detail_targets where quote_id = qb), 'kept', '상태 kept');

  -- 선정 견적 금액: 2차를 고쳐 보낸 기관이면 2차 금액
  res := public.select_quote(rq, qa, u, rev);
  perform pg_temp.t_eq((res->>'ok')::boolean, true, '선정');
  perform pg_temp.t_eq((select fee_basis_amount from public.rfq_awards where rfq_id = rq), 54000000::bigint, '선정 견적 금액은 2차');
end $$;

-- 기한이 지나거나 선정한 뒤에는 회신이 닫힌다. 1차 그대로인 기관을 선정하면 1차 금액
do $$
declare
  a uuid := pg_temp.t_org('상세D');
  b uuid := pg_temp.t_org('상세E');
  u uuid := pg_temp.t_user('detail-owner2@example.test');
  rq uuid := pg_temp.t_rfq('T-DETAIL-2');
  ia uuid; ib uuid; qa uuid; qb uuid;
  rev int;
begin
  update public.rfq_requests set user_id = u where id = rq;
  ia := pg_temp.t_invite(rq, a); ib := pg_temp.t_invite(rq, b);
  qa := pg_temp.t_quote(ia, 30000000); qb := pg_temp.t_quote(ib, 40000000);
  update public.rfq_requests set compared_at = now(), status = 'quoted' where id = rq;
  perform pg_temp.t_eq((public.send_detail_request(rq, u, array[qa, qb], '{}'::jsonb, (now() at time zone 'Asia/Seoul')::date + 3, '')->>'ok')::boolean, true, '보냄');

  -- 기한이 지나면 닫힌다
  update public.rfq_details set reply_by = (now() at time zone 'Asia/Seoul')::date - 1 where rfq_id = rq;
  perform pg_temp.t_eq(public.save_detail_reply(ia, pg_temp.tok(ia), null, '{"mode":"revise","total_amount":31000000}'::jsonb)->>'code', 'expired', '기한 뒤 거절');
  update public.rfq_details set reply_by = (now() at time zone 'Asia/Seoul')::date + 3 where rfq_id = rq;

  -- 답하지 않은 기관도 1차 견적으로 선정할 수 있고, 금액은 1차
  select revision into rev from public.cro_quotes where id = qb;
  perform pg_temp.t_eq((public.select_quote(rq, qb, u, rev)->>'ok')::boolean, true, '답 없는 기관 선정');
  perform pg_temp.t_eq((select fee_basis_amount from public.rfq_awards where rfq_id = rq), 40000000::bigint, '선정 견적 금액은 1차');
  perform pg_temp.t_eq(public.save_detail_reply(ia, pg_temp.tok(ia), null, '{"mode":"revise","total_amount":31000000}'::jsonb)->>'code', 'closed', '선정 뒤 거절');
  perform pg_temp.t_eq(public.send_detail_request(rq, u, array[qa], '{}'::jsonb, (now() at time zone 'Asia/Seoul')::date + 3, '')->>'code', 'closed', '선정 뒤 새 요청 거절');
end $$;

-- 권한: 새 표와 함수는 서버(service role)만
do $$
begin
  perform pg_temp.t_assert(not has_table_privilege('authenticated', 'public.rfq_details', 'select'), 'rfq_details: authenticated 읽기 없음');
  perform pg_temp.t_assert(not has_table_privilege('anon', 'public.rfq_detail_targets', 'select'), 'rfq_detail_targets: anon 읽기 없음');
  perform pg_temp.t_assert(not has_function_privilege('authenticated', 'public.send_detail_request(uuid, uuid, uuid[], jsonb, date, text)', 'execute'), 'send_detail_request: authenticated 실행 없음');
  perform pg_temp.t_assert(not has_function_privilege('anon', 'public.save_detail_reply(uuid, text, uuid, jsonb)', 'execute'), 'save_detail_reply: anon 실행 없음');
end $$;
