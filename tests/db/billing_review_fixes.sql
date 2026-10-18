-- 청구 리뷰 수정 (2026-10-18): 금액 없이 제출한 견적의 청구 월, 구독 시작 월, 청구 제외 초대의 성사수수료 표시, 예전 수주 금액 채우기 (0020)

-- 1) 금액 없이 제출 → 그 달 마감 → 다음 달 금액 입력: 금액이 들어온 달에 한 번 청구한다 (마감한 달 저장본은 그대로)
do $$
declare
  o uuid := pg_temp.t_org('금액나중기관', 300000);
  i uuid := pg_temp.t_invite(pg_temp.t_rfq('T-RV-1'), o, pg_temp.t_mid(-1));
  q uuid;
  res jsonb;
  s record;
  snap jsonb;
begin
  q := pg_temp.t_quote(i, null, pg_temp.t_mid(-1));
  perform pg_temp.t_assert((select billing_at from public.cro_quotes where id = q) is null, '금액이 없으면 청구 기준 시각 없음');
  perform pg_temp.t_eq((select tier from public.billing_lines(pg_temp.t_month(-1), pg_temp.t_month(0)) where quote_id = q), 'no_amount', '지난달에는 금액 미입력으로 나온다');
  perform public.close_billing_month(pg_temp.t_month(-1), null, '금액 미입력 상태로 마감');

  res := public.save_quote(i, jsonb_build_object('total_amount', 30000000), '[]'::jsonb, true, null, (select token from public.rfq_invites where id = i));
  perform pg_temp.t_eq(res->>'ok', 'true', '금액을 넣어 다시 제출');
  perform pg_temp.t_eq((select first_submitted_at from public.cro_quotes where id = q), pg_temp.t_mid(-1), '처음 제출 시각은 그대로');
  perform pg_temp.t_eq((select billing_at from public.cro_quotes where id = q), now(), '청구 기준 시각 = 금액이 들어온 때');

  select * into s from public.billing_summary(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = o;
  perform pg_temp.t_eq(s.per_quote, 1, '이번 달 건당 1건');
  perform pg_temp.t_eq(s.per_quote_fee, 300000::bigint, '이번 달 건당 이용료');
  perform pg_temp.t_eq((select count(*) from public.billing_lines(pg_temp.t_month(-1), pg_temp.t_month(0)) where quote_id = q)::int, 0, '지난달 집계에서는 빠진다 (두 번 세지 않음)');
  select snapshot into snap from public.billing_periods where month = pg_temp.t_month(-1);
  perform pg_temp.t_eq((select x->>'tier' from jsonb_array_elements(snap->'lines') x where x->>'quote_id' = q::text), 'no_amount', '마감 저장본은 그대로');

  -- 한 번 정해지면 바뀌지 않는다: 금액을 지웠다 다시 넣어도, 직접 바꾸려 해도
  update public.cro_quotes set total_amount = null where id = q;
  update public.cro_quotes set total_amount = 40000000, billing_at = now() - interval '90 days' where id = q;
  perform pg_temp.t_eq((select billing_at from public.cro_quotes where id = q), now(), '청구 기준 시각 고정');
end $$;

-- 2) 처음부터 금액이 있으면 청구 기준 시각 = 처음 제출 시각. 재제출해도 그대로
do $$
declare
  o uuid := pg_temp.t_org('금액처음기관', 300000);
  i uuid := pg_temp.t_invite(pg_temp.t_rfq('T-RV-2'), o, pg_temp.t_mid(-1));
  q uuid := pg_temp.t_quote(i, 20000000, pg_temp.t_mid(-1));
begin
  perform pg_temp.t_eq((select billing_at from public.cro_quotes where id = q), pg_temp.t_mid(-1), '처음 제출에 금액이 있으면 그 시각');
  perform public.save_quote(i, jsonb_build_object('total_amount', 25000000), '[]'::jsonb, true, null, (select token from public.rfq_invites where id = i));
  perform pg_temp.t_eq((select billing_at from public.cro_quotes where id = q), pg_temp.t_mid(-1), '재제출해도 그대로');
  perform pg_temp.t_eq((select count(*) from public.billing_lines(pg_temp.t_month(0), pg_temp.t_month(1)) where quote_id = q)::int, 0, '이번 달에 다시 나오지 않는다');
end $$;

-- 3) 월 구독료는 구독 시작 월부터 이번 달까지만. 지난달·다음 달 명세에 소급·선반영하지 않는다
do $$
declare
  o uuid := pg_temp.t_org('구독시작기관', 300000, 0.03, 500000);
begin
  perform pg_temp.t_eq((select monthly_fee_from from public.cro_orgs where id = o), pg_temp.t_month(0), '시작 월을 비우면 구독료를 적은 달');
  perform pg_temp.t_eq((select monthly_fee from public.billing_summary(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = o), 500000, '이번 달은 나온다');
  perform pg_temp.t_eq((select count(*) from public.billing_summary(pg_temp.t_month(-1), pg_temp.t_month(0)) where org_id = o)::int, 0, '시작 월 전 달에는 없다');
  perform pg_temp.t_eq((select count(*) from public.billing_summary(pg_temp.t_month(1), pg_temp.t_month(2)) where org_id = o)::int, 0, '아직 오지 않은 달에는 없다');
  perform pg_temp.t_eq((select count(*) from public.billing_summary(pg_temp.t_month(-24), pg_temp.t_month(-23)) where org_id = o)::int, 0, '오래전 달에도 없다');

  -- 운영자가 시작 월을 지난달로 적으면 (달 중간 날짜도 1일로)
  update public.cro_orgs set monthly_fee_from = pg_temp.t_month(-1) + 9 where id = o;
  perform pg_temp.t_eq((select monthly_fee_from from public.cro_orgs where id = o), pg_temp.t_month(-1), '시작 월은 그 달 1일');
  perform pg_temp.t_eq((select monthly_fee from public.billing_summary(pg_temp.t_month(-1), pg_temp.t_month(0)) where org_id = o), 500000, '지난달부터 나온다');
  perform pg_temp.t_eq((select total_due from public.billing_summary(pg_temp.t_month(-1), pg_temp.t_month(0)) where org_id = o), 500000::bigint, '합계에 들어간다');

  -- 구독료를 지우면 시작 월도 지운다
  update public.cro_orgs set monthly_fee = null where id = o;
  perform pg_temp.t_assert((select monthly_fee_from from public.cro_orgs where id = o) is null, '구독 해지 시 시작 월 없음');
end $$;

-- 4) 청구 제외한 초대에서 체결된 성사수수료: 정산은 그대로 잡고 표시만 한다 (대표 결정 전 현행 유지)
do $$
declare
  o uuid := pg_temp.t_org('제외초대기관', 300000, 0.03);
  r uuid := pg_temp.t_rfq('T-RV-4');
  i uuid := pg_temp.t_invite(r, o);
  q uuid := pg_temp.t_quote(i, 60000000);
  a uuid;
begin
  update public.rfq_invites set billable = false, bill_excluded_reason = '중복 요청' where id = i;
  a := pg_temp.t_award(q);
  perform public.report_contract(a, (now() at time zone 'Asia/Seoul')::date, 55000000, null);
  perform pg_temp.t_eq((select invite_billable from public.billing_awards(pg_temp.t_month(0), pg_temp.t_month(1)) where award_id = a and kind = 'settlement'), false, '정산 행에 청구 제외 초대 표시');
  perform pg_temp.t_eq((select fee from public.billing_awards(pg_temp.t_month(0), pg_temp.t_month(1)) where award_id = a and kind = 'settlement'), 1650000::bigint, '정산 금액은 그대로');
  perform pg_temp.t_eq((select count(*) from public.billing_lines(pg_temp.t_month(0), pg_temp.t_month(1)) where quote_id = q and chargeable)::int, 0, '건당 이용료는 제외');
end $$;

-- 5) 0009 전 수주(선정 견적 금액·기관 없음)는 0020 이 견적에서 채운다. 수주 화면과 집계가 같은 판정을 한다
create temp table t_rv5 (award_id uuid);
do $$
declare
  o uuid := pg_temp.t_org('예전수주기관', 300000, 0.03);
  q uuid := pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-RV-5'), o), 60000000);
  a uuid := pg_temp.t_award(q);
begin
  update public.rfq_awards set fee_basis_amount = null, cro_org_id = null where id = a;
  insert into t_rv5 values (a);
end $$;

\set f :migrations_dir '/0020_billing_rules.sql'
\i :f

do $$
declare a uuid := (select award_id from t_rv5);
begin
  perform pg_temp.t_eq((select fee_basis_amount from public.rfq_awards where id = a), 60000000::bigint, '선정 견적 금액을 견적에서 채움');
  perform pg_temp.t_assert((select cro_org_id from public.rfq_awards where id = a) is not null, '기관을 견적에서 채움');
end $$;
