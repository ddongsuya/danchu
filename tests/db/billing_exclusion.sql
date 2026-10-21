-- 운영자 청구 제외, 운영자 관리 기관·대리 입력도 청구 대상
do $$
declare
  o uuid := pg_temp.t_org('제외기관', 300000);
  m uuid := pg_temp.t_org('관리기관', 300000, 0.03, null, true);
  i1 uuid := pg_temp.t_invite(pg_temp.t_rfq('T-EX-1'), o);
  i2 uuid := pg_temp.t_invite(pg_temp.t_rfq('T-EX-2'), o);
  s record;
begin
  perform pg_temp.t_quote(i1, 30000000);
  perform pg_temp.t_quote(i2, 30000000);
  update public.rfq_invites set billable = false, bill_excluded_reason = '중복 요청' where id = i2;

  select * into s from public.billing_summary(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = o;
  perform pg_temp.t_eq(s.quoted, 2, '제출 2건');
  perform pg_temp.t_eq(s.excluded, 1, '제외 1건');
  perform pg_temp.t_eq(s.billable, 1, '청구 대상 1건');
  perform pg_temp.t_eq(s.per_quote_fee, 300000::bigint, '제외 건은 건당 이용료 없음');
  perform pg_temp.t_eq((select fee_due from public.billing_lines(pg_temp.t_month(0), pg_temp.t_month(1)) where invite_id = i2), 0::bigint, '제외 행 0원');
  perform pg_temp.t_eq((select bill_excluded_reason from public.billing_lines(pg_temp.t_month(0), pg_temp.t_month(1)) where invite_id = i2), '중복 요청', '제외 사유');

  -- 운영자 관리 기관, 운영자 대리 입력 견적
  perform pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-MG'), m), 15000000, now(), 'operator');
  select * into s from public.billing_summary(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = m;
  perform pg_temp.t_eq(s.managed, true, '관리 기관 표시');
  perform pg_temp.t_eq(s.per_quote, 1, '관리 기관도 건당 대상');
  perform pg_temp.t_eq(s.per_quote_fee, 300000::bigint, '대리 입력 견적도 청구');
  perform pg_temp.t_eq((select entry_source from public.billing_lines(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = m), 'operator', '입력 주체 표시');
end $$;
