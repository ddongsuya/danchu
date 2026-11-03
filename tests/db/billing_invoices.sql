-- 0032: 월 청구서. 마감한 달만, 기관·달마다 1장, 공급가 + 부가세 10%, 발행 값 고정, 입금 확인·취소·독촉 단계

create or replace function pg_temp.t_raises(p_sql text, p_like text, p_msg text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm like p_like then return; end if;
    raise exception 'ASSERT 실패: % (다른 오류: %)', p_msg, sqlerrm;
  end;
  raise exception 'ASSERT 실패: % (오류 없이 실행됨)', p_msg;
end $$;

do $$
declare
  o uuid := pg_temp.t_org('청구서기관', null, null);
  o0 uuid := pg_temp.t_org('청구0원기관', null, null);
  m date := pg_temp.t_month(-1);
  res jsonb;
  inv public.billing_invoices%rowtype;
  q_open uuid;
begin
  -- 지난달: 1억 2천만 원 견적 1건(송부 50,000) + 6천만 원 1건(30,000). 0원 기관은 금액 미입력 견적만
  perform pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-INV-1'), o, pg_temp.t_mid(-1)), 120000000, pg_temp.t_mid(-1));
  perform pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-INV-2'), o, pg_temp.t_mid(-1)), 60000000, pg_temp.t_mid(-1));
  perform pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-INV-3'), o0, pg_temp.t_mid(-1)), 0, pg_temp.t_mid(-1));

  -- 마감 전에는 발행하지 않는다
  res := public.issue_billing_invoices(m, null);
  perform pg_temp.t_eq(res->>'code', 'not_closed', '열린 달은 발행 거절');

  res := public.close_billing_month(m, null, '');
  perform pg_temp.t_eq(res->>'ok', 'true', '마감');
  res := public.issue_billing_invoices(m, null);
  perform pg_temp.t_eq((res->>'issued')::int, 1, '합계가 있는 기관만 1장');

  select * into inv from public.billing_invoices where org_id = o;
  perform pg_temp.t_eq(inv.supply_amount, 80000::bigint, '공급가 = 50,000 + 30,000');
  perform pg_temp.t_eq(inv.vat, 8000::bigint, '부가세 10%');
  perform pg_temp.t_eq(inv.total, 88000::bigint, '합계');
  perform pg_temp.t_eq(inv.due_date, (now() at time zone 'Asia/Seoul')::date + 14, '납부 기한 14일');
  perform pg_temp.t_eq(inv.status, 'issued', '발행 상태');
  perform pg_temp.t_eq(jsonb_array_length(inv.detail->'lines'), 2, '청구한 견적 2건이 내역에');
  perform pg_temp.t_assert(inv.invoice_no like 'DC-' || to_char(m, 'YYYYMM') || '-%', '번호 형식');
  perform pg_temp.t_assert(not exists (select 1 from public.billing_invoices where org_id = o0), '0원 기관은 없음');

  -- 다시 발행해도 한 장
  res := public.issue_billing_invoices(m, null);
  perform pg_temp.t_eq((res->>'issued')::int, 0, '두 번째 발행은 새로 만들지 않음');
  perform pg_temp.t_eq((res->>'skipped')::int, 1, '이미 있는 1장은 건너뜀');

  -- 발행 값 고정, 지우기 거절
  perform pg_temp.t_raises(format('update public.billing_invoices set supply_amount = 1 where id = %L', inv.id), '%바꿀 수 없습니다%', '금액 변경 거절');
  perform pg_temp.t_raises(format('update public.billing_invoices set due_date = due_date + 30 where id = %L', inv.id), '%바꿀 수 없습니다%', '기한 변경 거절');
  perform pg_temp.t_raises(format('delete from public.billing_invoices where id = %L', inv.id), '%지울 수 없습니다%', '삭제 거절');

  -- 보냄 기록
  res := public.mark_invoice_sent(inv.id);
  res := public.mark_invoice_sent(inv.id);
  perform pg_temp.t_eq((select sent_count from public.billing_invoices where id = inv.id), 2, '보낸 횟수');

  -- 독촉 단계는 올라가기만
  perform pg_temp.t_eq(public.mark_invoice_reminded(inv.id, 2), true, '단계 2');
  perform pg_temp.t_eq(public.mark_invoice_reminded(inv.id, 1), false, '낮은 단계는 무시');

  -- 입금 확인: 미래 날짜 거절, 확인 뒤 취소 거절
  res := public.mark_invoice_paid(inv.id, null, (now() at time zone 'Asia/Seoul')::date + 1, '');
  perform pg_temp.t_eq(res->>'code', 'paid_on', '미래 입금일 거절');
  res := public.mark_invoice_paid(inv.id, null, (now() at time zone 'Asia/Seoul')::date, '국민은행 이체');
  perform pg_temp.t_eq(res->>'ok', 'true', '입금 확인');
  perform pg_temp.t_eq((select status from public.billing_invoices where id = inv.id), 'paid', 'paid');
  res := public.void_invoice(inv.id, null, '잘못 발행');
  perform pg_temp.t_eq(res->>'code', 'paid', '입금 확인한 청구서는 취소 거절');
  perform pg_temp.t_eq(public.mark_invoice_reminded(inv.id, 3), false, '입금 뒤 독촉 없음');
end $$;

-- 취소 뒤 같은 달 다시 발행, 사유 필수 (달마다 마감은 한 번이라 다른 달을 쓴다)
do $$
declare
  o uuid := pg_temp.t_org('취소기관', null, null);
  m date := pg_temp.t_month(-2);
  res jsonb;
  v1 uuid;
begin
  perform pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-INV-V'), o, pg_temp.t_mid(-2)), 600000000, pg_temp.t_mid(-2));
  perform public.close_billing_month(m, null, '');
  perform public.issue_billing_invoices(m, null);
  select id into v1 from public.billing_invoices where org_id = o;
  perform pg_temp.t_eq((select supply_amount from public.billing_invoices where id = v1), 50000::bigint, '5억 이상 송부 비용');
  res := public.void_invoice(v1, null, '  ');
  perform pg_temp.t_eq(res->>'code', 'reason', '사유 없으면 거절');
  res := public.void_invoice(v1, null, '기관명 오기');
  perform pg_temp.t_eq(res->>'ok', 'true', '취소');
  perform pg_temp.t_raises(format('update public.billing_invoices set status = ''issued'' where id = %L', v1), '%상태는 바꿀 수 없습니다%', '취소를 되돌릴 수 없음');
  res := public.issue_billing_invoices(m, null);
  perform pg_temp.t_eq((res->>'issued')::int, 1, '취소 뒤 다시 발행');
  perform pg_temp.t_eq((select count(*) from public.billing_invoices where org_id = o)::int, 2, '취소본은 남는다');
  perform pg_temp.t_eq((select count(*) from public.billing_invoices where org_id = o and status = 'issued')::int, 1, '살아 있는 청구서 1장');
end $$;

-- 시범 기간 참여는 청구서가 없다 (운영 청구 시작일로 되돌림)
do $$
declare
  o uuid := pg_temp.t_org('시범청구서기관', null, null);
  m date := pg_temp.t_month(-3);
begin
  create or replace function public.billing_paid_from() returns date language sql immutable as $f$ select date '2028-01-01' $f$;
  perform pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-INV-P'), o, pg_temp.t_mid(-3)), 120000000, pg_temp.t_mid(-3));
  perform public.close_billing_month(m, null, '');
  perform public.issue_billing_invoices(m, null);
  perform pg_temp.t_assert(not exists (select 1 from public.billing_invoices where org_id = o), '시범 참여는 청구서 없음');
end $$;

-- 직접 접근 차단
do $$
begin
  perform pg_temp.t_assert(not has_table_privilege('authenticated', 'public.billing_invoices', 'select'), 'authenticated 는 읽지 못함');
  perform pg_temp.t_assert(not has_table_privilege('anon', 'public.billing_invoices', 'select'), 'anon 은 읽지 못함');
  perform pg_temp.t_assert(not has_function_privilege('authenticated', 'public.issue_billing_invoices(date, uuid)', 'execute'), '발행 함수 막음');
  perform pg_temp.t_assert(has_function_privilege('service_role', 'public.mark_invoice_paid(uuid, uuid, date, text)', 'execute'), '서버는 실행');
end $$;
