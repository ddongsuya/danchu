-- 성사수수료: 대상은 선정 견적 5,000만 원 이상. 예상 = 견적 × 요율(선정 달), 정산 = 계약 금액 × 요율(체결 확인 달, signed 만)
do $$
declare
  o uuid := pg_temp.t_org('성사기관', 300000, 0.03);
  q_big uuid; q_small uuid; q_lost uuid;
  a_big uuid; a_small uuid; a_lost uuid;
  res jsonb;
  s record;
  b record;
begin
  q_big := pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-SF-1'), o, pg_temp.t_mid(-2)), 60000000, pg_temp.t_mid(-2));
  q_small := pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-SF-2'), o, pg_temp.t_mid(-2)), 49999999, pg_temp.t_mid(-2));
  q_lost := pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-SF-3'), o, pg_temp.t_mid(-2)), 80000000, pg_temp.t_mid(-2));
  -- 선정은 지난달
  a_big := pg_temp.t_award(q_big, pg_temp.t_mid(-1));
  a_small := pg_temp.t_award(q_small, pg_temp.t_mid(-1));
  a_lost := pg_temp.t_award(q_lost, pg_temp.t_mid(-1));
  update public.rfq_awards set contract_status = 'not_signed' where id = a_lost;

  -- 예상(견적 기준): 지난달, 대상 견적(6,000만)만. 미체결·5,000만 미만은 없음
  select * into s from public.billing_summary(pg_temp.t_month(-1), pg_temp.t_month(0)) where org_id = o;
  perform pg_temp.t_eq(s.guidance_count, 1, '예상 1건');
  perform pg_temp.t_eq(s.guidance_fee, 1800000::bigint, '예상 = 6,000만 × 3%');
  perform pg_temp.t_eq(s.settled_count, 0, '체결 전에는 정산 없음');
  perform pg_temp.t_eq(s.settled_fee, 0::bigint, '정산 0');
  perform pg_temp.t_eq(s.total_due, 0::bigint, '예상은 합계에 넣지 않는다');

  -- 체결 보고(실제 함수): 계약 금액 5,500만. 이번 달에 확인
  res := public.report_contract(a_big, (now() at time zone 'Asia/Seoul')::date, 55000000, '', false);
  perform pg_temp.t_eq(res->>'ok', 'true', '체결 보고');
  res := public.report_contract(a_small, (now() at time zone 'Asia/Seoul')::date, 49999999, '', false);

  select * into s from public.billing_summary(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = o;
  perform pg_temp.t_eq(s.settled_count, 1, '정산 1건 (5,000만 미만 견적은 대상 아님)');
  perform pg_temp.t_eq(s.settled_contract_amount, 55000000::bigint, '계약 금액 기준');
  perform pg_temp.t_eq(s.settled_fee, 1650000::bigint, '정산 = 5,500만 × 3% (견적 금액이 아니라 계약 금액)');
  perform pg_temp.t_eq(s.total_due, 1650000::bigint, '합계에 정산 포함');
  -- 지난달(전달·선정한 달)에는 정산이 잡히지 않는다
  perform pg_temp.t_eq((select settled_count from public.billing_summary(pg_temp.t_month(-1), pg_temp.t_month(0)) where org_id = o), 0, '정산은 선정·전달 달이 아니다');

  select * into b from public.billing_awards(pg_temp.t_month(0), pg_temp.t_month(1)) where award_id = a_big and kind = 'settlement';
  perform pg_temp.t_eq(b.quote_amount, 60000000::bigint, '대상 판정은 견적 금액');
  perform pg_temp.t_eq(b.fee, 1650000::bigint, '정산 행 금액');

  -- 정정(운영자)은 확인 시각을 바꾸지 않는다: 정산 월이 옮겨 가지 않는다
  update public.rfq_awards set contract_reported_at = pg_temp.t_mid(0) where id = a_big;
  res := public.report_contract(a_big, (now() at time zone 'Asia/Seoul')::date, 70000000, '정정', true);
  perform pg_temp.t_eq(res->>'corrected', 'true', '정정');
  perform pg_temp.t_eq((select contract_reported_at from public.rfq_awards where id = a_big), pg_temp.t_mid(0), '처음 확인 시각 유지');
  perform pg_temp.t_eq((select settled_fee from public.billing_summary(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = o), 2100000::bigint, '정정 금액 7,000만 × 3%');
end $$;

-- 정산 월 = 체결 확인 달. 계약 체결일(contract_date)이 지난달이어도 이번 달에 확인되면 이번 달
do $$
declare
  o uuid := pg_temp.t_org('정산월기관', 300000, 0.03);
  q uuid := pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-SM'), o, pg_temp.t_mid(-2)), 50000000, pg_temp.t_mid(-2));
  a uuid := pg_temp.t_award(q, pg_temp.t_mid(-2));
  res jsonb;
begin
  res := public.report_contract(a, pg_temp.t_month(-1) + 3, 50000000, '', false);
  perform pg_temp.t_eq(res->>'ok', 'true', '체결 보고');
  perform pg_temp.t_eq((select settled_fee from public.billing_summary(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = o), 1500000::bigint, '확인한 이번 달에 정산');
  perform pg_temp.t_eq(coalesce((select settled_count from public.billing_summary(pg_temp.t_month(-1), pg_temp.t_month(0)) where org_id = o), 0), 0, '체결일 달에는 없음');
end $$;

-- 요율 미정: 정산 금액은 null (미정), 0 으로 숨기지 않는다
do $$
declare
  o uuid := pg_temp.t_org('요율미정기관', 300000, null);
  q uuid := pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-NR'), o), 90000000);
  a uuid := pg_temp.t_award(q);
  res jsonb;
  s record;
begin
  res := public.report_contract(a, (now() at time zone 'Asia/Seoul')::date, 90000000, '', false);
  select * into s from public.billing_summary(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = o;
  perform pg_temp.t_eq(s.settled_count, 1, '정산 대상 1건');
  perform pg_temp.t_assert(s.settled_fee is null, '요율 미정이면 null');
  perform pg_temp.t_assert(s.guidance_fee is null, '예상도 null');
  perform pg_temp.t_eq(s.terms_pending, true, '미정 표시');
end $$;
