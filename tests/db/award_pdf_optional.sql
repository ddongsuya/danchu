-- 선정 트리거 (0051): 견적서 PDF는 선택 첨부다. PDF 없는 정식 견적도 선정되고,
-- 예비 견적·착수일 없음·유효기간 지남은 그대로 막는다 (lib/quote-policy.ts quoteSelectable 과 같은 조건).

create or replace function pg_temp.try(p_sql text) returns text
language plpgsql as $$
begin
  execute p_sql;
  return 'none';
exception when others then
  return sqlerrm;
end $$;

do $$
declare
  a uuid := pg_temp.t_org('PDF없음A');
  b uuid := pg_temp.t_org('PDF없음B');
  u uuid := pg_temp.t_user('pdf-optional-owner@example.test');
  rq uuid := pg_temp.t_rfq('T-PDF-OPT-1');
  ia uuid; ib uuid; qa uuid; qb uuid;
  res jsonb;
  rev int;
begin
  update public.rfq_requests set user_id = u where id = rq;
  ia := pg_temp.t_invite(rq, a); ib := pg_temp.t_invite(rq, b);
  qa := pg_temp.t_quote(ia, 19500000); qb := pg_temp.t_quote(ib, 25900000);
  update public.cro_quotes set pdf_path = null, pdf_name = null, pdf_size = null where id in (qa, qb);

  -- 트리거가 막는 조건은 그대로 (PDF 없는 견적 b 로 확인. 비교표가 열리면 견적을 고칠 수 없어 열기 전에 본다)
  update public.cro_quotes set auto = true where id = qb;
  perform pg_temp.t_assert(pg_temp.try(format('insert into public.rfq_awards (rfq_id, quote_id, invite_id, cro_org_id, cro_name, fee_basis_amount) values (%L, %L, %L, %L, %L, 1)', rq, qb, ib, b, 'PDF없음B')) like '정식 견적서%', '예비 견적 거절');
  update public.cro_quotes set auto = false, start_date = null where id = qb;
  perform pg_temp.t_assert(pg_temp.try(format('insert into public.rfq_awards (rfq_id, quote_id, invite_id, cro_org_id, cro_name, fee_basis_amount) values (%L, %L, %L, %L, %L, 1)', rq, qb, ib, b, 'PDF없음B')) like '정식 견적서%', '착수일 없음 거절');
  update public.cro_quotes set start_date = current_date, valid_until = (now() at time zone 'Asia/Seoul')::date - 1 where id = qb;
  perform pg_temp.t_assert(pg_temp.try(format('insert into public.rfq_awards (rfq_id, quote_id, invite_id, cro_org_id, cro_name, fee_basis_amount) values (%L, %L, %L, %L, %L, 1)', rq, qb, ib, b, 'PDF없음B')) like '정식 견적서%', '유효기간 지남 거절');
  update public.cro_quotes set valid_until = null where id = qb;
  perform pg_temp.t_assert(not exists (select 1 from public.rfq_awards where rfq_id = rq), '거절 뒤 선정 기록 없음');
  update public.rfq_requests set compared_at = now(), status = 'quoted' where id = rq;

  -- PDF 없는 정식 견적을 select_quote 로 선정 (웹·에이전트 선정 경로가 부르는 함수)
  select revision into rev from public.cro_quotes where id = qa;
  res := public.select_quote(rq, qa, u, rev);
  perform pg_temp.t_eq((res->>'ok')::boolean, true, 'PDF 없는 견적 선정');
  perform pg_temp.t_eq((select quote_id from public.rfq_awards where rfq_id = rq), qa, '선정 기록');
  perform pg_temp.t_eq((select status from public.rfq_requests where id = rq), 'selected', '요청 상태 selected');
  perform pg_temp.t_eq(public.danchu_schema_version(), 51, '스키마 판 51');
end $$;
