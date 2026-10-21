-- 청구 구간 경계: 9,999,999 / 10,000,000 / 49,999,999 / 50,000,000, 금액 미입력, 미제출 초대
do $$
declare
  o uuid := pg_temp.t_org('구간기관', 300000, 0.03, 500000);
  r uuid := pg_temp.t_rfq('T-TIER');
  s record;
  l record;
begin
  perform pg_temp.t_eq(public.billing_subscription_max_excl(), 10000000::bigint, '구독 구간 상한');
  perform pg_temp.t_eq(public.billing_success_fee_min(), 50000000::bigint, '성사수수료 하한');
  perform pg_temp.t_eq(public.billing_tier(9999999), 'subscription', '9,999,999 는 구독');
  perform pg_temp.t_eq(public.billing_tier(10000000), 'per_quote', '10,000,000 은 건당');
  perform pg_temp.t_eq(public.billing_tier(49999999), 'per_quote', '49,999,999 는 건당');
  perform pg_temp.t_eq(public.billing_tier(50000000), 'per_quote_success', '50,000,000 은 건당 + 성사');
  perform pg_temp.t_eq(public.billing_tier(null), 'no_amount', 'null 은 금액 미입력');
  perform pg_temp.t_eq(public.billing_tier(0), 'no_amount', '0 은 금액 미입력');

  -- 같은 요청에 초대 7건: 견적 6건 + 미제출 1건
  perform pg_temp.t_quote(pg_temp.t_invite(r, o), 9999999);
  perform pg_temp.t_quote(pg_temp.t_invite(r, pg_temp.t_org('구간기관2')), 1);  -- 다른 기관 (섞이지 않는지)
  perform pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-TIER-2'), o), 10000000);
  perform pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-TIER-3'), o), 49999999);
  perform pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-TIER-4'), o), 50000000);
  perform pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-TIER-5'), o), null);
  perform pg_temp.t_invite(pg_temp.t_rfq('T-TIER-6'), o);  -- 견적을 내지 않은 초대

  select * into s from public.billing_summary(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = o;
  perform pg_temp.t_eq(s.delivered, 6, '전달 6건 (운영 지표)');
  perform pg_temp.t_eq(s.quoted, 5, '제출 견적 5건 (미제출 초대는 없음)');
  perform pg_temp.t_eq(s.billable, 4, '청구 대상 4건 (금액 미입력 제외)');
  perform pg_temp.t_eq(s.no_amount, 1, '금액 미입력 1건');
  perform pg_temp.t_eq(s.subscription, 1, '구독 구간 1건');
  perform pg_temp.t_eq(s.per_quote, 3, '건당 이용료 대상 3건');
  perform pg_temp.t_eq(s.success_eligible, 1, '성사수수료 대상 견적 1건');
  perform pg_temp.t_eq(s.per_quote_fee, 900000::bigint, '건당 이용료 합계 3 × 300,000');
  perform pg_temp.t_eq(s.monthly_fee, 500000, '월 구독료');
  perform pg_temp.t_eq(s.total_due, 1400000::bigint, '합계 = 구독 + 건당');
  perform pg_temp.t_eq(s.terms_pending, false, '미정 없음');

  -- 견적 행: 미제출 초대는 행이 없다
  perform pg_temp.t_eq((select count(*) from public.billing_lines(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = o)::int, 5, '견적 행 5개');
  select * into l from public.billing_lines(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = o and total_amount = 9999999;
  perform pg_temp.t_eq(l.fee_due, 0::bigint, '구독 구간 견적은 건당 0원');
  select * into l from public.billing_lines(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = o and total_amount = 10000000;
  perform pg_temp.t_eq(l.fee_due, 300000::bigint, '1,000만 원 견적은 건당 이용료');
  select * into l from public.billing_lines(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = o and total_amount is null;
  perform pg_temp.t_eq(l.tier, 'no_amount', '금액 미입력 구간');
  perform pg_temp.t_eq(l.chargeable, false, '금액 미입력은 청구하지 않음');
end $$;

-- 단가 미정: 건당 이용료 합계는 0 이 아니라 null (미정)
do $$
declare
  o uuid := pg_temp.t_org('단가미정기관', null, null, null);
  s record;
begin
  perform pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-PEND'), o), 20000000);
  perform pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-PEND-2'), o), 5000000);
  select * into s from public.billing_summary(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = o;
  perform pg_temp.t_eq(s.per_quote, 1, '건당 대상 1건');
  perform pg_temp.t_assert(s.per_quote_fee is null, '단가 미정이면 건당 합계는 null');
  perform pg_temp.t_eq(s.terms_pending, true, '미정 표시');
  perform pg_temp.t_eq(s.total_due, 0::bigint, '알 수 있는 합계는 0');
  perform pg_temp.t_assert(s.monthly_fee is null, '구독하지 않음');
end $$;
