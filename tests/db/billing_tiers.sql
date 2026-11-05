-- 청구 구간 경계 (0031 요금표): 49,999,999 / 50,000,000, 금액 미입력, 미제출 초대, 기관 특별 조건
do $$
declare
  o uuid := pg_temp.t_org('구간기관', 300000, 0.03, 500000);
  r uuid := pg_temp.t_rfq('T-TIER');
  s record;
  l record;
begin
  perform pg_temp.t_eq(public.billing_subscription_max_excl(), 50000000::bigint, '구독 구간 상한');
  perform pg_temp.t_eq(public.billing_success_fee_min(), 50000000::bigint, '송부 비용·성사 수수료 하한');
  perform pg_temp.t_eq(public.billing_tier(49999999), 'subscription', '49,999,999 는 구독');
  perform pg_temp.t_eq(public.billing_tier(10000000), 'subscription', '10,000,000 도 구독 (0020 의 건당 구간 없음)');
  perform pg_temp.t_eq(public.billing_tier(50000000), 'per_quote_success', '50,000,000 은 송부 비용 + 성사');
  perform pg_temp.t_eq(public.billing_tier(null), 'no_amount', 'null 은 금액 미입력');
  perform pg_temp.t_eq(public.billing_tier(0), 'no_amount', '0 은 금액 미입력');

  -- 같은 요청에 초대 7건: 견적 6건 + 미제출 1건
  perform pg_temp.t_quote(pg_temp.t_invite(r, o), 9999999);
  perform pg_temp.t_quote(pg_temp.t_invite(r, pg_temp.t_org('구간기관2')), 1);  -- 다른 기관 (섞이지 않는지)
  perform pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-TIER-2'), o), 49999999);
  perform pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-TIER-3'), o), 50000000);
  perform pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-TIER-4'), o), 120000000);
  perform pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-TIER-5'), o), null);
  perform pg_temp.t_invite(pg_temp.t_rfq('T-TIER-6'), o);  -- 견적을 내지 않은 초대

  select * into s from public.billing_summary(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = o;
  perform pg_temp.t_eq(s.delivered, 6, '전달 6건 (운영 지표)');
  perform pg_temp.t_eq(s.quoted, 5, '제출 견적 5건 (미제출 초대는 없음)');
  perform pg_temp.t_eq(s.billable, 4, '청구 대상 4건 (금액 미입력 제외)');
  perform pg_temp.t_eq(s.no_amount, 1, '금액 미입력 1건');
  perform pg_temp.t_eq(s.subscription, 2, '구독 구간 2건');
  perform pg_temp.t_eq(s.per_quote, 2, '송부 비용 대상 2건');
  perform pg_temp.t_eq(s.success_eligible, 2, '성사 수수료 대상 견적 2건');
  perform pg_temp.t_eq(s.per_quote_fee, 600000::bigint, '특별 조건 300,000 × 2');
  perform pg_temp.t_eq(s.monthly_fee, 500000, '월 구독료');
  perform pg_temp.t_eq(s.total_due, 1100000::bigint, '합계 = 구독 + 송부 비용');
  perform pg_temp.t_eq(s.terms_pending, false, '미정 없음');

  perform pg_temp.t_eq((select count(*) from public.billing_lines(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = o)::int, 5, '견적 행 5개');
  select * into l from public.billing_lines(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = o and total_amount = 49999999;
  perform pg_temp.t_eq(l.fee_due, 0::bigint, '구독 구간 견적은 0원');
  select * into l from public.billing_lines(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = o and total_amount = 50000000;
  perform pg_temp.t_eq(l.fee_due, 300000::bigint, '특별 조건이 있으면 그 값');
  select * into l from public.billing_lines(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = o and total_amount is null;
  perform pg_temp.t_eq(l.tier, 'no_amount', '금액 미입력 구간');
  perform pg_temp.t_eq(l.chargeable, false, '금액 미입력은 청구하지 않음');
end $$;

-- 특별 조건이 없으면 요금표: 송부 비용 30,000 / 50,000 / 50,000, 미정은 없다
do $$
declare
  o uuid := pg_temp.t_org('요금표기관', null, null, null);
  s record;
begin
  perform pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-SCH-1'), o), 60000000);
  perform pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-SCH-2'), o), 150000000);
  perform pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-SCH-3'), o), 600000000);
  perform pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-SCH-4'), o), 20000000);
  select * into s from public.billing_summary(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = o;
  perform pg_temp.t_eq(s.per_quote, 3, '송부 비용 대상 3건');
  perform pg_temp.t_eq(s.subscription, 1, '구독 구간 1건');
  perform pg_temp.t_eq(s.per_quote_fee, 130000::bigint, '30,000 + 50,000 + 50,000');
  perform pg_temp.t_eq(s.terms_pending, false, '요금표가 있어 미정 없음');
  perform pg_temp.t_eq(s.total_due, 130000::bigint, '구독하지 않은 기관은 송부 비용만');
  perform pg_temp.t_assert(s.monthly_fee is null, '구독하지 않음');
end $$;
