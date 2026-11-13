-- 의뢰자·기관 직접 질의응답 (0045): 기관은 참여 뒤 비교표 전까지, 의뢰자는 비교표 뒤 견적 낸 기관에만 묻는다.
-- 답은 한 번, 올린 글은 고치거나 지울 수 없다. 운영자는 묻지도 답하지도 않는다.

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
  a uuid := pg_temp.t_org('질의A');
  b uuid := pg_temp.t_org('질의B');
  u uuid := pg_temp.t_user('qna-owner@example.test');
  x uuid := pg_temp.t_user('qna-other@example.test');
  op uuid := pg_temp.t_user('qna-op@example.test', 'admin');
  rq uuid := pg_temp.t_rfq('T-QNA-1');
  ia uuid; ib uuid; inot uuid;
  q1 uuid; q2 uuid; q3 uuid;
  res jsonb;
  i int;
begin
  update public.rfq_requests set user_id = u where id = rq;
  ia := pg_temp.t_invite(rq, a);
  ib := pg_temp.t_invite(rq, b);
  inot := pg_temp.t_invite(rq, pg_temp.t_org('질의C'), now(), false);

  -- 기관 → 의뢰자
  perform pg_temp.t_eq(public.ask_question(inot, null, 'cro', 'terms', null, '회복군 포함할까요?', false)->>'code', 'not_joined', '참여 전 기관은 질의 못 함');
  perform pg_temp.t_eq(public.ask_question(ia, op, 'cro', 'terms', null, '운영자 질의', false)->>'code', 'operator_not_allowed', '운영자는 질의 못 함');
  perform pg_temp.t_eq(public.ask_question(ia, null, 'cro', 'price', null, '항목 틀림', false)->>'code', 'bad_body', '관련 항목 목록 밖 거절');
  perform pg_temp.t_eq(public.ask_question(ia, null, 'cro', 'terms', null, '   ', false)->>'code', 'bad_body', '빈 질의 거절');
  perform pg_temp.t_eq(public.ask_question(ia, null, 'cro', 'terms', null, repeat('가', 1001), false)->>'code', 'bad_body', '1000자 넘으면 거절');
  perform pg_temp.t_eq(public.ask_question(ia, null, 'sponsor', 'terms', null, '비교표 전 의뢰자 질의', false)->>'code', 'not_found', '의뢰자 질의는 요청 주인만');
  perform pg_temp.t_eq(public.ask_question(ia, u, 'sponsor', 'terms', null, '비교표 전 의뢰자 질의', false)->>'code', 'not_compared', '의뢰자 질의는 비교표 뒤');

  res := public.ask_question(ia, null, 'cro', 'terms', 1, '반복투여 4주에 회복군 2주를 포함할까요?', false);
  perform pg_temp.t_eq(res->>'ok', 'true', '참여 기관 질의');
  q1 := (res->>'id')::uuid;
  q2 := (public.ask_question(ib, null, 'cro', 'schedule', null, '12월 14일 착수로 견적해도 될까요? 010-1234-5678', true)->>'id')::uuid;
  perform pg_temp.t_eq((select cro_org_id from public.rfq_questions where id = q1), a, '기관 기록');
  perform pg_temp.t_eq((select body_has_contact from public.rfq_questions where id = q2), true, '연락처 표시 기록');

  -- 답변
  perform pg_temp.t_eq(public.answer_question(q1, x, null, '포함해 주세요', false, 'all')->>'code', 'not_found', '남이 답할 수 없음');
  perform pg_temp.t_eq(public.answer_question(q1, op, null, '포함해 주세요', false, 'all')->>'code', 'operator_not_allowed', '운영자는 답하지 않음');
  perform pg_temp.t_eq(public.answer_question(q1, u, ia, '포함해 주세요', false, 'all')->>'code', 'not_found', '기관 질의에 초대 인자를 주면 거절');
  perform pg_temp.t_eq(public.answer_question(q1, u, null, '포함해 주세요', false, 'everyone')->>'code', 'bad_body', '공개 범위 목록 밖 거절');
  res := public.answer_question(q1, u, null, '포함해 주세요. 대조군과 고용량군 암수 각 5마리.', false, 'all');
  perform pg_temp.t_eq(res->>'scope', 'all', '전체 공개 답변');
  perform pg_temp.t_eq(public.answer_question(q1, u, null, '다시', false, 'private')->>'code', 'answered', '답은 한 번');
  perform pg_temp.t_eq(public.answer_question(q2, u, null, '가능합니다', false, 'private')->>'scope', 'private', '질의 기관만 답변');

  -- 고치기·지우기 금지
  perform pg_temp.t_assert(pg_temp.try(format('update public.rfq_questions set answer = %L where id = %L', '고친 답', q1)) like '%고칠 수 없어요%', '답변 고치기 거절');
  perform pg_temp.t_assert(pg_temp.try(format('update public.rfq_questions set scope = %L where id = %L', 'private', q1)) like '%고칠 수 없어요%', '공개 범위 바꾸기 거절');
  q3 := (public.ask_question(ia, null, 'cro', 'substance', null, '시험물질 용해도 자료가 있나요?', false)->>'id')::uuid;
  perform pg_temp.t_assert(pg_temp.try(format('update public.rfq_questions set body = %L where id = %L', '고친 질의', q3)) like '%고칠 수 없어요%', '질의 고치기 거절');
  perform pg_temp.t_assert(pg_temp.try(format('delete from public.rfq_questions where id = %L', q3)) like '%지울 수 없어요%', '질의 지우기 거절');

  -- 답을 기다리는 질의는 한쪽 10건까지
  for i in 1..9 loop
    perform public.ask_question(ia, null, 'cro', 'other', null, '질의 ' || i, false);
  end loop;
  perform pg_temp.t_eq(public.ask_question(ia, null, 'cro', 'other', null, '열한 번째', false)->>'code', 'too_many', '답 대기 10건이면 거절');

  -- 비교표가 열리면 기관 질의는 닫히고 의뢰자 질의가 열린다
  perform pg_temp.t_quote(ib, 52000000);
  update public.rfq_requests set compared_at = now(), status = 'quoted' where id = rq;
  perform pg_temp.t_eq(public.ask_question(ib, null, 'cro', 'terms', null, '비교표 뒤 질의', false)->>'code', 'compared', '비교표 뒤 기관 질의 거절');
  perform pg_temp.t_eq(public.ask_question(inot, u, 'sponsor', 'quote', null, '견적 없는 기관에 질의', false)->>'code', 'no_quote', '견적 없는 기관에는 질의 못 함');
  res := public.ask_question(ib, u, 'sponsor', 'quote', null, '조제물분석을 포함하면 얼마나 달라지나요?', false);
  perform pg_temp.t_eq(res->>'ok', 'true', '견적 낸 기관에 의뢰자 질의');
  q3 := (res->>'id')::uuid;
  perform pg_temp.t_eq(public.answer_question(q3, null, ia, '다른 기관 답', false, null)->>'code', 'not_found', '다른 기관은 답할 수 없음');
  res := public.answer_question(q3, null, ib, '320만 원 늘어납니다.', false, 'all');
  perform pg_temp.t_eq(res->>'scope', 'private', '의뢰자 질의의 답은 언제나 질의 기관만');

  -- 선정 뒤에는 새로 묻지 않는다
  update public.rfq_requests set status = 'selected' where id = rq;
  perform pg_temp.t_eq(public.ask_question(ib, u, 'sponsor', 'quote', null, '선정 뒤 질의', false)->>'code', 'closed', '선정 뒤 질의 거절');

  -- 요청을 지우면 함께 지워진다
  delete from public.rfq_requests where id = rq;
  perform pg_temp.t_eq((select count(*)::int from public.rfq_questions where rfq_id = rq), 0, '요청 삭제 시 함께 삭제');
end $$;
