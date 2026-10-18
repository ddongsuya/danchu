-- 0020 을 데이터가 있는 상태에서 한 번 더 적용해도 값이 바뀌지 않는다 (처음 제출 시각, 마감 저장본, 구독료)
create temp table t_before as select 1;
do $$
declare
  o uuid := pg_temp.t_org('재적용기관', 300000, 0.03, 700000);
  v_q uuid := pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-IDEM'), o, pg_temp.t_mid(-1)), 20000000, pg_temp.t_mid(-1));
begin
  -- 재제출로 submitted_at 만 이번 달로 바뀐 상태
  update public.cro_quotes set submitted_at = now() where id = v_q;
  perform public.close_billing_month(pg_temp.t_month(-1), null, '재적용 전 마감');
  update public.cro_orgs set per_request_fee = 999999 where id = o;  -- 마감 뒤 단가 변경
  drop table t_before;
  create temp table t_before as
    select cq.id, cq.first_submitted_at, p.snapshot, o2.id as org_id, o2.monthly_fee
    from public.cro_quotes cq, public.billing_periods p, public.cro_orgs o2
    where cq.id = v_q and p.month = pg_temp.t_month(-1) and o2.id = o;
end $$;

\set f :migrations_dir '/0020_billing_rules.sql'
\i :f

do $$
declare b record;
begin
  select * into b from t_before;
  perform pg_temp.t_assert(b.first_submitted_at = pg_temp.t_mid(-1), '재적용 전 처음 제출 시각은 지난달');
  perform pg_temp.t_eq((select first_submitted_at from public.cro_quotes where id = b.id), b.first_submitted_at, '처음 제출 시각 유지 (submitted_at 으로 다시 채우지 않음)');
  perform pg_temp.t_eq((select snapshot from public.billing_periods where month = pg_temp.t_month(-1)), b.snapshot, '마감 저장본 유지');
  perform pg_temp.t_eq((select monthly_fee from public.cro_orgs where id = b.org_id), b.monthly_fee, '월 구독료 유지');
  perform pg_temp.t_eq((select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'cro_orgs' and column_name = 'monthly_cap')::int, 0, 'monthly_cap 없음');
end $$;
