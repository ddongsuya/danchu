-- 0034: 견적·계약 금액 차이 사유, 의뢰자 계약 결과 알림 (우회 계약 방지)

do $$
declare
  o uuid := pg_temp.t_org('차이기관', null, null);
  q uuid := pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-GAP-1'), o), 100000000);
  a uuid := pg_temp.t_award(q);
  today date := (now() at time zone 'Asia/Seoul')::date;
  res jsonb;
begin
  -- 10% 이상 차이는 사유가 있어야 저장된다
  res := public.report_contract(a, today, 80000000, '', false);
  perform pg_temp.t_eq(res->>'code', 'gap_reason', '사유 없이 20% 낮은 금액 거절');
  perform pg_temp.t_eq((res->>'quote_amount')::bigint, 100000000::bigint, '선정 견적 금액을 돌려준다');
  perform pg_temp.t_assert((select contract_reported_at from public.rfq_awards where id = a) is null, '거절되면 보고가 남지 않는다');
  res := public.report_contract(a, today, 80000000, '', false, 'bad');
  perform pg_temp.t_eq(res->>'code', 'gap_reason', '없는 사유 거절');
  res := public.report_contract(a, today, 80000000, '  ', false, 'other');
  perform pg_temp.t_eq(res->>'code', 'gap_note', '기타는 비고 필수');
  res := public.report_contract(a, today, 80000000, '', false, 'scope');
  perform pg_temp.t_eq(res->>'ok', 'true', '사유가 있으면 저장');
  perform pg_temp.t_eq((select contract_gap_reason from public.rfq_awards where id = a), 'scope', '사유 기록');

  -- 운영자 정정으로 차이가 10% 안이 되면 사유를 지운다
  res := public.report_contract(a, today, 95000000, '정정', true, 'scope');
  perform pg_temp.t_eq(res->>'ok', 'true', '정정');
  perform pg_temp.t_assert((select contract_gap_reason from public.rfq_awards where id = a) is null, '10% 안이면 사유 없음');
end $$;

-- 10% 안 차이, 이전 인자(5개) 호출도 그대로 된다
do $$
declare
  o uuid := pg_temp.t_org('작은차이기관', null, null);
  a uuid := pg_temp.t_award(pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-GAP-2'), o), 100000000));
begin
  perform pg_temp.t_eq((public.report_contract(a, (now() at time zone 'Asia/Seoul')::date, 91000000, '', false)->>'ok'), 'true', '9% 차이는 사유 없이');
  perform pg_temp.t_eq((public.report_contract(a, (now() at time zone 'Asia/Seoul')::date, 91000000, '', true)->>'ok'), 'true', '4개 인자 + force');
end $$;

-- 의뢰자 계약 결과 알림
do $$
declare
  o uuid := pg_temp.t_org('의뢰자알림기관', null, null);
  r uuid := pg_temp.t_rfq('T-GAP-S');
  a uuid := pg_temp.t_award(pg_temp.t_quote(pg_temp.t_invite(r, o), 100000000));
  owner uuid := pg_temp.t_user('gap-owner@example.test', 'requester');
  other uuid := pg_temp.t_user('gap-other@example.test', 'requester');
  today date := (now() at time zone 'Asia/Seoul')::date;
  res jsonb;
begin
  update public.rfq_requests set user_id = owner where id = r;
  res := public.sponsor_report_contract(a, other, 'signed', null, null, '');
  perform pg_temp.t_eq(res->>'code', 'forbidden', '요청 주인만');
  res := public.sponsor_report_contract(a, owner, 'maybe', null, null, '');
  perform pg_temp.t_eq(res->>'code', 'status', '없는 상태 거절');
  res := public.sponsor_report_contract(a, owner, 'signed', 0, null, '');
  perform pg_temp.t_eq(res->>'code', 'amount', '0원 거절');
  res := public.sponsor_report_contract(a, owner, 'signed', 120000000, today + 1, '');
  perform pg_temp.t_eq(res->>'code', 'future', '미래 날짜 거절');
  res := public.sponsor_report_contract(a, owner, 'signed', 120000000, today, '계약서 받음');
  perform pg_temp.t_eq(res->>'ok', 'true', '알림 저장');
  perform pg_temp.t_eq(res->>'contract_reported', 'false', '기관 보고 전');
  perform pg_temp.t_eq((select sponsor_contract_amount from public.rfq_awards where id = a), 120000000::bigint, '금액 기록');

  -- 협의 중으로 바꾸면 금액·날짜는 지운다
  res := public.sponsor_report_contract(a, owner, 'negotiating', 5, today, '');
  perform pg_temp.t_eq(res->>'before', 'signed', '이전 상태');
  perform pg_temp.t_assert((select sponsor_contract_amount is null and sponsor_contract_date is null from public.rfq_awards where id = a), '협의 중은 금액 없음');

  -- 직접 쓰기 거절
  begin
    update public.rfq_awards set sponsor_contract_status = 'not_signed' where id = a;
    raise exception 'ASSERT 실패: 의뢰자 알림을 직접 바꿈';
  exception when others then
    if sqlerrm not like '%sponsor_report_protected%' then raise; end if;
  end;

  -- 확정된 계약은 바꾸지 않는다
  perform public.report_contract(a, today, 100000000, '', false);
  perform public.confirm_contract(a, owner);
  res := public.sponsor_report_contract(a, owner, 'not_signed', null, null, '');
  perform pg_temp.t_eq(res->>'code', 'confirmed', '확정 뒤 거절');

  perform pg_temp.t_assert(not has_function_privilege('authenticated', 'public.sponsor_report_contract(uuid, uuid, text, bigint, date, text)', 'execute'), '로그인 사용자는 직접 못 부름');
end $$;
