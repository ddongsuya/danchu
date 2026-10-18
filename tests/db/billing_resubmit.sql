-- 재제출은 다시 청구하지 않고, 처음 제출한 달에 청구한다. first_submitted_at 은 한 번만 채워진다
do $$
declare
  o uuid := pg_temp.t_org('재제출기관', 300000);
  r uuid := pg_temp.t_rfq('T-RESUB');
  i uuid := pg_temp.t_invite(r, o, pg_temp.t_mid(-1));
  q uuid;
  first_at timestamptz;
  res jsonb;
  s record;
begin
  -- 지난달에 처음 제출
  q := pg_temp.t_quote(i, 20000000, pg_temp.t_mid(-1));
  select first_submitted_at into first_at from public.cro_quotes where id = q;
  perform pg_temp.t_eq(first_at, pg_temp.t_mid(-1), '처음 제출 시각이 채워진다');

  -- 이번 달에 save_quote 로 금액을 고쳐 다시 제출 (실제 함수)
  res := public.save_quote(i, jsonb_build_object('total_amount', 25000000, 'total_weeks', 4), '[]'::jsonb, true, null, (select token from public.rfq_invites where id = i));
  perform pg_temp.t_eq(res->>'ok', 'true', '재제출 성공');
  perform pg_temp.t_eq(res->>'first', 'false', '처음 제출이 아님');
  perform pg_temp.t_eq((select submitted_at from public.cro_quotes where id = q), now(), 'submitted_at 은 새로 찍힌다');
  perform pg_temp.t_eq((select first_submitted_at from public.cro_quotes where id = q), first_at, 'first_submitted_at 은 그대로');

  -- 직접 바꾸려 해도 바뀌지 않는다
  update public.cro_quotes set first_submitted_at = now() where id = q;
  perform pg_temp.t_eq((select first_submitted_at from public.cro_quotes where id = q), first_at, '한 번 채우면 고정');

  -- 초대 1건 = 견적 1건: 지난달에만 1건, 이번 달에는 없다
  perform pg_temp.t_eq((select count(*) from public.cro_quotes where invite_id = i)::int, 1, '같은 초대의 견적은 1건');
  select * into s from public.billing_summary(pg_temp.t_month(-1), pg_temp.t_month(0)) where org_id = o;
  perform pg_temp.t_eq(s.per_quote, 1, '지난달 건당 1건');
  perform pg_temp.t_eq(s.per_quote_fee, 300000::bigint, '지난달 건당 이용료 1회');
  perform pg_temp.t_eq((select count(*) from public.billing_summary(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = o)::int, 0, '이번 달 명세에는 없다');
end $$;

-- save_quote 로 처음 제출하면 그 시각이 first_submitted_at, 초안 저장은 채우지 않는다
do $$
declare
  o uuid := pg_temp.t_org('신규제출기관');
  i uuid := pg_temp.t_invite(pg_temp.t_rfq('T-FIRST'), o);
  res jsonb;
begin
  res := public.save_quote(i, jsonb_build_object('total_amount', 12000000), '[]'::jsonb, false, null, (select token from public.rfq_invites where id = i));
  perform pg_temp.t_assert((select first_submitted_at from public.cro_quotes where invite_id = i) is null, '초안은 first_submitted_at 없음');
  perform pg_temp.t_eq((select count(*) from public.billing_lines(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = o)::int, 0, '초안은 청구 행 없음');
  res := public.save_quote(i, jsonb_build_object('total_amount', 12000000), '[]'::jsonb, true, null, (select token from public.rfq_invites where id = i));
  perform pg_temp.t_eq((select first_submitted_at from public.cro_quotes where invite_id = i), now(), '제출 시각으로 채운다');
  perform pg_temp.t_eq((select count(*) from public.billing_lines(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = o)::int, 1, '제출하면 청구 행 1개');
end $$;

-- 서울 시간 기준 월: 이번 달 1일 00:30(서울)은 UTC 로는 지난달이지만 이번 달에 청구한다
do $$
declare
  o uuid := pg_temp.t_org('자정기관');
  at timestamptz := (pg_temp.t_month(0)::timestamp + time '00:30') at time zone 'Asia/Seoul';
begin
  perform pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-SEOUL'), o, at), 15000000, at);
  perform pg_temp.t_eq((select count(*) from public.billing_lines(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = o)::int, 1, '서울 기준 이번 달');
  perform pg_temp.t_eq((select count(*) from public.billing_lines(pg_temp.t_month(-1), pg_temp.t_month(0)) where org_id = o)::int, 0, '지난달에는 없음');
end $$;
