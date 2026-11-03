-- 0031 요금표와 청구 시작일. 이 파일만 운영 값(2028-01-01)으로 되돌려 시범·유료 경계를 본다
create or replace function public.billing_paid_from() returns date language sql immutable as $$ select date '2028-01-01' $$;

do $$
begin
  -- 송부 비용 경계
  perform pg_temp.t_eq(public.billing_send_fee(null), 0, '금액 없음 0원');
  perform pg_temp.t_eq(public.billing_send_fee(49999999), 0, '49,999,999 는 구독 (0원)');
  perform pg_temp.t_eq(public.billing_send_fee(50000000), 30000, '50,000,000 은 30,000원');
  perform pg_temp.t_eq(public.billing_send_fee(99999999), 30000, '99,999,999 는 30,000원');
  perform pg_temp.t_eq(public.billing_send_fee(100000000), 50000, '100,000,000 은 50,000원');
  perform pg_temp.t_eq(public.billing_send_fee(500000000), 50000, '500,000,000 은 50,000원');
  -- 성사 수수료율 경계
  perform pg_temp.t_eq(public.billing_success_rate(49999999), 0::numeric, '49,999,999 는 0');
  perform pg_temp.t_eq(public.billing_success_rate(50000000), 0.02::numeric, '5천만 원은 2%');
  perform pg_temp.t_eq(public.billing_success_rate(99999999), 0.02::numeric, '99,999,999 는 2%');
  perform pg_temp.t_eq(public.billing_success_rate(100000000), 0.05::numeric, '1억 원은 5%');
  perform pg_temp.t_eq(public.billing_success_rate(499999999), 0.05::numeric, '499,999,999 는 5%');
  perform pg_temp.t_eq(public.billing_success_rate(500000000), 0.07::numeric, '5억 원은 7%');
  perform pg_temp.t_eq(public.billing_subscription_fee(), 1000000, '월 구독료 기준 100만 원');
  perform pg_temp.t_eq(public.billing_pilot_from(), date '2027-06-01', '시범 운영 시작');
  -- 참여 시각: 청구 시작일 전은 시범(무료), 뒤는 청구. 시범 판 이름은 날짜와 상관없이 무료
  perform pg_temp.t_eq(public.billing_join_paid('2027-12-31 14:59:59+00', 'portal', 'paid-2028'), false, '2027-12-31 23:59:59 서울 참여는 무료');
  perform pg_temp.t_eq(public.billing_join_paid('2027-12-31 15:00:00+00', 'portal', 'paid-2028'), true, '2028-01-01 00:00 서울 참여는 청구');
  perform pg_temp.t_eq(public.billing_join_paid('2028-03-01 00:00:00+00', 'token', 'pilot-2026-10-21'), false, '시범 판은 무료');
  perform pg_temp.t_eq(public.billing_join_paid('2028-03-01 00:00:00+00', 'legacy', 'paid-2028'), false, 'legacy 는 청구하지 않음');
  perform pg_temp.t_eq(public.billing_join_pilot('2027-07-01 00:00:00+00', 'portal', 'paid-2028'), true, '시범 기간 참여');
end $$;

-- 지금(청구 시작일 전) 참여한 견적은 시범: 송부 비용·성사 수수료·구독료 모두 0, 참고 수치에만 요금표로 센다
do $$
declare
  o uuid := pg_temp.t_org('시범기관', null, null, 1000000);
  r uuid := pg_temp.t_rfq('T-PILOT');
  s record;
  f record;
begin
  perform pg_temp.t_quote(pg_temp.t_invite(r, o), 150000000);
  perform pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-PILOT-2'), o), 30000000);
  select * into s from public.billing_summary(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = o;
  perform pg_temp.t_eq(s.per_quote, 0, '시범 참여는 송부 비용 대상 아님');
  perform pg_temp.t_eq(s.per_quote_fee, 0::bigint, '송부 비용 0');
  perform pg_temp.t_assert(s.monthly_fee is null, '청구 시작 월 전에는 구독료가 명세에 나오지 않음');
  perform pg_temp.t_eq(s.total_due, 0::bigint, '합계 0');
  select * into f from public.billing_reference(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = o;
  perform pg_temp.t_eq(f.per_quote_count, 1, '참고: 송부 비용 대상 1건');
  perform pg_temp.t_eq(f.per_quote_fee, 50000::bigint, '참고: 요금표 50,000원');
  perform pg_temp.t_eq(f.subscription_count, 1, '참고: 구독 구간 1건');
  perform pg_temp.t_eq(f.per_quote_unit_source, 'schedule', '참고 단가 출처는 요금표');
end $$;
