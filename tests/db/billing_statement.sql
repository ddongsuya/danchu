-- 월 구독료가 명세에 나오고 합계에 들어간다. 견적이 없어도 구독 기관은 나온다
do $$
declare
  o uuid := pg_temp.t_org('구독기관', 300000, 0.03, 990000);
  idle uuid := pg_temp.t_org('구독만기관', 300000, 0.03, 500000);
  stopped uuid := pg_temp.t_org('중지기관', 300000, 0.03, 500000);
  s record;
begin
  update public.cro_orgs set status = 'suspended' where id = stopped;
  perform pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-ST-1'), o), 3000000);
  perform pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-ST-2'), o), 12000000);

  select * into s from public.billing_summary(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = o;
  perform pg_temp.t_eq(s.monthly_fee, 990000, '월 구독료');
  perform pg_temp.t_eq(s.subscription, 1, '구독 구간 1건');
  perform pg_temp.t_eq(s.total_due, 1290000::bigint, '합계 = 990,000 + 300,000');

  select * into s from public.billing_summary(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = idle;
  perform pg_temp.t_assert(found, '견적이 없어도 구독 기관은 명세에 나온다');
  perform pg_temp.t_eq(s.total_due, 500000::bigint, '구독료만');
  perform pg_temp.t_eq((select count(*) from public.billing_summary(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = stopped)::int, 0, '승인되지 않은 기관의 구독료는 없음');

  perform pg_temp.t_assert(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cro_orgs' and column_name = 'monthly_cap'), 'monthly_cap 열이 없다');
  perform pg_temp.t_assert(not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and pg_get_functiondef(p.oid) ilike '%monthly_cap%'), 'monthly_cap 을 읽는 함수가 없다');
end $$;

-- 월 마감: 저장본으로 고정. 마감 뒤 단가가 바뀌어도 저장본은 그대로, 다시 마감하면 새로 찍힌다
do $$
declare
  o uuid := pg_temp.t_org('마감기관', 300000);
  res jsonb;
  snap jsonb;
begin
  perform pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-CL'), o), 20000000);
  res := public.close_billing_month(pg_temp.t_month(0), null, '시험 마감');
  perform pg_temp.t_eq(res->>'ok', 'true', '마감');
  select snapshot into snap from public.billing_periods where month = pg_temp.t_month(0);
  perform pg_temp.t_eq((select (x->>'per_quote_fee')::bigint from jsonb_array_elements(snap->'summary') x where x->>'org_id' = o::text), 300000::bigint, '저장본 건당 합계');
  perform pg_temp.t_eq((select count(*) from jsonb_array_elements(snap->'lines') x where x->>'org_id' = o::text)::int, 1, '저장본 견적 행');

  update public.cro_orgs set per_request_fee = 400000 where id = o;
  select snapshot into snap from public.billing_periods where month = pg_temp.t_month(0);
  perform pg_temp.t_eq((select (x->>'per_quote_fee')::bigint from jsonb_array_elements(snap->'summary') x where x->>'org_id' = o::text), 300000::bigint, '마감 뒤 단가 변경은 저장본에 반영되지 않는다');

  res := public.close_billing_month(pg_temp.t_month(0) + 10, null, '');
  select snapshot into snap from public.billing_periods where month = pg_temp.t_month(0);
  perform pg_temp.t_eq((select (x->>'per_quote_fee')::bigint from jsonb_array_elements(snap->'summary') x where x->>'org_id' = o::text), 400000::bigint, '다시 마감하면 새로 찍힌다 (달 중간 날짜도 그 달 1일로)');
  perform pg_temp.t_eq((select count(*) from public.billing_periods where month = pg_temp.t_month(0))::int, 1, '같은 달은 1행');
end $$;
