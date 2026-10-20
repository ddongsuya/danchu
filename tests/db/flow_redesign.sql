-- 흐름 재설계 (0025, 2026-10-20 결정): 접수 시작 시점 채우기, 임시 요청서 권한, 비교표 공개 조건, 계약 확인·이의·자동 확정,
-- 확인된 계약만 확인한 달에 정산, 불참 되돌리기, 철회는 되돌리지 않음, 두 번 적용해도 그대로

-- 이 파일 도우미: 토큰, 참여(join_offer), 정식 견적 제출(save_quote)
create or replace function pg_temp.tok(p_invite uuid) returns text
language sql as $$ select token from public.rfq_invites where id = p_invite $$;
create or replace function pg_temp.j(p_invite uuid) returns jsonb
language sql as $$ select public.join_offer(p_invite, pg_temp.tok(p_invite), null, 'token', 'test-terms', '203.0.113.9', 'test') $$;
create or replace function pg_temp.sub(p_invite uuid) returns jsonb
language sql as $$
  select public.save_quote(p_invite,
    jsonb_build_object('total_amount', 60000000, 'note', 'n', 'pdf_path', 'x/q.pdf', 'start_date', current_date, 'valid_until', current_date + 30),
    '[]'::jsonb, true, null, pg_temp.tok(p_invite))
$$;
-- 요청 1건: 자리 수와 참여 결정 기한을 정한다
create or replace function pg_temp.offer(p_no text, p_count text, p_join_by timestamptz) returns uuid
language plpgsql as $$
declare v uuid := pg_temp.t_rfq(p_no);
begin
  update public.rfq_requests set cro_count = p_count, join_by = p_join_by where id = v;
  return v;
end $$;
-- 확인 기한을 지난 것으로 (테스트 안에서는 now() 가 고정이라 7일을 기다릴 수 없다)
create or replace function pg_temp.due_past(p_award uuid) returns void
language plpgsql as $$
begin
  perform set_config('danchu.contract_confirm_write', 'on', true);
  update public.rfq_awards set contract_confirm_due_at = now() - interval '1 minute' where id = p_award;
  perform set_config('danchu.contract_confirm_write', '', true);
end $$;

-- 1) 임시 요청서(rfq_pending)는 서비스 키로만. 임시 첨부는 정식 첨부가 될 수 없다. 이메일을 확인하지 않은 계정으로는 요청을 만들지 못한다
do $$
declare
  r text;
  ok boolean;
  u_new uuid;
  rq uuid := pg_temp.t_rfq('T-FR-P');
  raised text;
begin
  insert into public.rfq_pending (token, email, payload) values (repeat('a', 32), 'guest@example.test', '{}'::jsonb);
  perform pg_temp.t_assert((select relrowsecurity from pg_class where oid = 'public.rfq_pending'::regclass), 'rfq_pending RLS 켜짐');
  perform pg_temp.t_eq((select count(*)::int from pg_policies where tablename = 'rfq_pending'), 0, 'rfq_pending 정책 없음');
  foreach r in array array['anon', 'authenticated'] loop
    perform pg_temp.t_assert(not has_table_privilege(r, 'public.rfq_pending', 'select'), r || ' 읽기 권한 없음');
    perform pg_temp.t_assert(not has_table_privilege(r, 'public.rfq_pending', 'insert'), r || ' 쓰기 권한 없음');
    perform pg_temp.t_assert(not has_table_privilege(r, 'public.rfq_pending', 'update'), r || ' 고치기 권한 없음');
    perform pg_temp.t_assert(not has_table_privilege(r, 'public.rfq_pending', 'delete'), r || ' 지우기 권한 없음');
    execute format('set local role %I', r);
    begin
      perform count(*) from public.rfq_pending;
      ok := false;
    exception when insufficient_privilege then ok := true;
    end;
    reset role;
    perform pg_temp.t_assert(ok, r || ' 이 임시 요청서를 읽으면 거절');
  end loop;
  set local role service_role;
  perform pg_temp.t_eq((select count(*)::int from public.rfq_pending where token = repeat('a', 32)), 1, 'service_role 은 읽는다');
  reset role;

  -- 형식이 틀린 토큰·대문자 이메일은 넣지 못한다
  begin insert into public.rfq_pending (token, email, payload) values ('short', 'x@example.test', '{}'); raised := 'none';
  exception when check_violation then raised := 'check'; end;
  perform pg_temp.t_eq(raised, 'check', '짧은 토큰 거절');
  begin insert into public.rfq_pending (token, email, payload) values (repeat('b', 32), 'Guest@Example.test', '{}'); raised := 'none';
  exception when check_violation then raised := 'check'; end;
  perform pg_temp.t_eq(raised, 'check', '소문자로 정리하지 않은 이메일 거절');

  -- 임시 첨부 경로는 정식 첨부(기관이 받는 목록)가 될 수 없다
  begin
    insert into public.rfq_files (rfq_id, storage_path, file_name, size_bytes) values (rq, 'pending/' || repeat('a', 32) || '/0-a.pdf', 'a.pdf', 10);
    raised := 'none';
  exception when check_violation then raised := 'check'; end;
  perform pg_temp.t_eq(raised, 'check', '임시 첨부 경로는 rfq_files 에 넣지 못한다');

  -- 이메일을 확인하지 않은 계정으로는 요청을 만들지 못한다 (보내기 직전 가입: 인증이 끝나야 요청이 생긴다)
  insert into auth.users (email, email_confirmed_at) values ('unconfirmed@example.test', null) returning id into u_new;
  begin
    insert into public.rfq_requests (rfq_no, company, contact_name, email, substance, payload, categories, user_id)
    values ('T-FR-UNC', '회사', '담당', 'unconfirmed@example.test', '물질', '{}', array['일반독성'], u_new);
    raised := 'none';
  exception when others then raised := sqlerrm;
  end;
  perform pg_temp.t_assert(raised like 'email_not_confirmed%', '미확인 계정 요청 거절 (' || raised || ')');
  update auth.users set email_confirmed_at = now() where id = u_new;
  insert into public.rfq_requests (rfq_no, company, contact_name, email, substance, payload, categories, user_id)
  values ('T-FR-CNF', '회사', '담당', 'unconfirmed@example.test', '물질', '{}', array['일반독성'], u_new);
  perform pg_temp.t_assert((select started_at is null from public.rfq_requests where rfq_no = 'T-FR-CNF'), '새 요청은 아직 시작 전 (첨부 업로드 뒤 시작)');
end $$;

-- 2) 비교표 공개: 참여한 기관이 모두 제출 + 더 참여할 수 없음 (자리가 참 또는 참여 결정 기한 경과)
do $$
declare
  a uuid := pg_temp.t_org('공개A');
  b uuid := pg_temp.t_org('공개B');
  c uuid := pg_temp.t_org('공개C');
  d uuid := pg_temp.t_org('공개D');
  rq uuid := pg_temp.offer('T-FR-C1', '3곳', now() + interval '2 days');
  ia uuid := pg_temp.t_invite(rq, a);
  ib uuid := pg_temp.t_invite(rq, b);
  ic uuid := pg_temp.t_invite(rq, c, now(), false);
  idd uuid := pg_temp.t_invite(rq, d, now(), false);
  res jsonb;
  q uuid;
begin
  res := pg_temp.sub(ia);
  perform pg_temp.t_eq(res->>'compare_opened', 'false', '한 곳만 제출: 열지 않음');
  res := pg_temp.sub(ib);
  perform pg_temp.t_eq(res->>'compare_opened', 'false', '참여 2곳 모두 제출했지만 자리가 남고 참여 결정 기한 전: 열지 않음');
  perform pg_temp.t_eq((public.compare_readiness(rq)->>'ready')::boolean, false, '준비 안 됨');
  perform pg_temp.t_eq((select status from public.rfq_requests where id = rq), 'quoted', '아직 견적 도착');

  -- 비교표 전에는 선택할 수 없다
  select id into q from public.cro_quotes where invite_id = ia;
  perform pg_temp.t_eq(public.select_quote(rq, q, null, (select revision from public.cro_quotes where id = q))->>'code', 'not_compared', '공개 전 선정 거절');

  -- 세 번째 기관이 참여하면 자리가 차고, 그 기관이 제출하면 열린다
  perform pg_temp.t_eq((pg_temp.j(ic)->>'ok')::boolean, true, '세 번째 참여');
  perform pg_temp.t_eq(pg_temp.j(idd)->>'code', 'full', '네 번째는 자리 없음');
  perform pg_temp.t_eq((public.compare_readiness(rq)->>'pending')::int, 1, '제출 전 1곳');
  res := pg_temp.sub(ic);
  perform pg_temp.t_eq(res->>'compare_opened', 'true', '마지막 참여 기관 제출: 비교표 열림');
  perform pg_temp.t_assert((select compared_at is not null from public.rfq_requests where id = rq), 'compared_at 채움');
  perform pg_temp.t_eq((select status from public.rfq_requests where id = rq), 'compared', '상태 compared');
  perform pg_temp.t_eq(public.open_comparison_if_ready(rq)->>'opened', 'false', '두 번 열리지 않음');
  -- 열리면 회신·참여가 닫힌다
  perform pg_temp.t_eq(pg_temp.sub(ic)->>'code', 'closed', '공개 뒤 재제출 거절');
  perform pg_temp.t_eq(pg_temp.j(idd)->>'code', 'closed', '공개 뒤 참여 거절');
  -- 열린 뒤에는 선택된다
  perform pg_temp.t_eq((public.select_quote(rq, q, null, (select revision from public.cro_quotes where id = q))->>'ok')::boolean, true, '공개 뒤 선정');
end $$;

do $$
declare
  a uuid := pg_temp.t_org('기한A');
  b uuid := pg_temp.t_org('기한B');
  -- 전체(자리 제한 없음), 참여 결정 기한 지남
  rq uuid := pg_temp.offer('T-FR-C2', '전체', now() - interval '1 hour');
  ia uuid := pg_temp.t_invite(rq, a);
  ib uuid := pg_temp.t_invite(rq, b);
  rq3 uuid := pg_temp.offer('T-FR-C3', '전체', now() - interval '1 hour');
  i3 uuid := pg_temp.t_invite(rq3, pg_temp.t_org('철회만'));
  rq4 uuid := pg_temp.offer('T-FR-C4', '3곳', now() + interval '1 day');
  i4a uuid := pg_temp.t_invite(rq4, pg_temp.t_org('예약A'));
  i4b uuid := pg_temp.t_invite(rq4, pg_temp.t_org('예약B'));
  res jsonb;
  n int;
begin
  -- 기한 뒤: A 제출, B 는 참여만(작성 전) → 안 열림. B 가 철회하면 남은 참여 기관이 모두 제출 → 철회가 연다
  perform pg_temp.t_eq(pg_temp.sub(ia)->>'compare_opened', 'false', '참여했지만 제출 안 한 기관이 있으면 열지 않음');
  res := public.withdraw_offer(ib, pg_temp.tok(ib), null, '일정');
  perform pg_temp.t_eq((res->>'ok')::boolean, true, '철회');
  perform pg_temp.t_eq(res->>'compare_opened', 'true', '철회로 남은 기관이 모두 제출: 비교표 열림');

  -- 제출 0건이면 열지 않는다 (참여한 기관이 모두 철회)
  res := public.withdraw_offer(i3, pg_temp.tok(i3), null, null);
  perform pg_temp.t_eq(res->>'compare_opened', 'false', '제출 0건: 열지 않음');
  perform pg_temp.t_assert((select compared_at is null from public.rfq_requests where id = rq3), '제출 0건 요청은 열린 채');

  -- 참여 결정 기한 전에 둘 다 제출(자리 3곳 중 2곳) → 기한이 지나면 예약 작업이 연다
  perform pg_temp.t_eq(pg_temp.sub(i4a)->>'compare_opened', 'false', '기한 전 1');
  perform pg_temp.t_eq(pg_temp.sub(i4b)->>'compare_opened', 'false', '기한 전 2');
  perform pg_temp.t_eq((select count(*)::int from public.open_ready_comparisons() x where x.rfq_id = rq4), 0, '기한 전에는 예약 작업도 열지 않음');
  update public.rfq_requests set join_by = now() - interval '1 minute' where id = rq4;
  select count(*)::int into n from public.open_ready_comparisons() x where x.rfq_id = rq4 and x.submitted = 2;
  perform pg_temp.t_eq(n, 1, '참여 결정 기한이 지나면 예약 작업이 연다');
  perform pg_temp.t_eq((select count(*)::int from public.open_ready_comparisons() x where x.rfq_id = rq4), 0, '한 번만');
end $$;

-- 3) 계약 확인: 확인 전에는 정산 없음, 의뢰자 확인 → 확인한 달에 확인한 계약 금액으로 정산, 요청 마침
do $$
declare
  o uuid := pg_temp.t_org('확인기관', 300000, 0.03);
  sponsor uuid := pg_temp.t_user('sponsor-fr@example.test');
  other uuid := pg_temp.t_user('other-fr@example.test');
  op uuid := pg_temp.t_user('admin-fr@example.test', 'admin');
  rq uuid := pg_temp.t_rfq('T-FR-K1');
  q uuid := pg_temp.t_quote(pg_temp.t_invite(rq, o), 60000000);
  a uuid := pg_temp.t_award(q, pg_temp.t_mid(-1));
  res jsonb;
  raised text;
begin
  update public.rfq_requests set user_id = sponsor, status = 'selected', selected_quote_id = q where id = rq;
  res := public.report_contract(a, (now() at time zone 'Asia/Seoul')::date, 55000000, '', false);
  perform pg_temp.t_eq((res->>'ok')::boolean, true, '체결 보고');
  perform pg_temp.t_eq((select contract_confirm_due_at from public.rfq_awards where id = a), now() + interval '7 days', '확인 기한 = 보고 + 7일');
  -- 보고한 달이 지난달이어도(아래) 정산은 확인한 달
  update public.rfq_awards set contract_reported_at = pg_temp.t_mid(-1) where id = a;
  perform pg_temp.t_eq((select count(*)::int from public.billing_awards(pg_temp.t_month(-1), pg_temp.t_month(1)) where award_id = a and kind = 'settlement'), 0, '확인 전 정산 없음');
  perform pg_temp.t_eq(coalesce((select settled_count from public.billing_summary(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = o), 0), 0, '확인 전 명세 정산 0');

  -- 확인·이의 기록은 함수로만
  begin
    update public.rfq_awards set contract_confirmed_at = now(), contract_confirmed_via = 'sponsor' where id = a;
    raised := 'none';
  exception when others then raised := sqlerrm;
  end;
  perform pg_temp.t_assert(raised like 'contract_confirm_protected%', '직접 확인 거절 (' || raised || ')');

  perform pg_temp.t_eq(public.confirm_contract(a, other)->>'code', 'forbidden', '다른 의뢰자는 확인할 수 없다');
  perform pg_temp.t_eq(public.confirm_contract(a, null)->>'code', 'forbidden', '행위자 없으면 거절');
  perform pg_temp.t_eq(public.confirm_contract(a, op)->>'code', 'forbidden', '운영자는 대신 확인할 수 없다 (이의 정리만)');
  res := public.confirm_contract(a, sponsor);
  perform pg_temp.t_eq((res->>'ok')::boolean, true, '의뢰자 확인');
  perform pg_temp.t_eq(res->>'via', 'sponsor', '확인 경로 sponsor');
  perform pg_temp.t_eq((select status from public.rfq_requests where id = rq), 'closed', '확인하면 요청을 마침');
  perform pg_temp.t_assert((select requester_confirmed_at is not null and not confirmed_auto from public.rfq_awards where id = a), '의뢰자 확인 기록');
  perform pg_temp.t_eq(public.confirm_contract(a, sponsor)->>'already', 'true', '두 번 확인해도 그대로');

  perform pg_temp.t_eq((select count(*)::int from public.billing_awards(pg_temp.t_month(-1), pg_temp.t_month(0)) where award_id = a and kind = 'settlement'), 0, '보고한 지난달에는 정산 없음');
  perform pg_temp.t_eq((select fee from public.billing_awards(pg_temp.t_month(0), pg_temp.t_month(1)) where award_id = a and kind = 'settlement'), 1650000::bigint, '확인한 이번 달에 계약 금액 5,500만 × 3%');
  perform pg_temp.t_eq((select contract_confirmed_via from public.billing_awards(pg_temp.t_month(0), pg_temp.t_month(1)) where award_id = a and kind = 'settlement'), 'sponsor', '정산 행에 확인 경로');
  perform pg_temp.t_eq((select settled_fee from public.billing_summary(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = o), 1650000::bigint, '명세 정산');
  perform pg_temp.t_eq(public.dispute_contract(a, sponsor, '금액 다름')->>'code', 'confirmed', '확정 뒤 이의 불가');

  -- 확정한 계약은 확정을 되돌릴 수 없다 (쓰기 표식이 있어도)
  perform set_config('danchu.contract_confirm_write', 'on', true);
  begin
    update public.rfq_awards set contract_confirmed_at = null, contract_confirmed_via = null where id = a;
    raised := 'none';
  exception when others then raised := sqlerrm;
  end;
  perform set_config('danchu.contract_confirm_write', '', true);
  perform pg_temp.t_assert(raised like 'contract_confirm_protected%', '확정 취소 거절 (' || raised || ')');

  -- 선정 견적 5,000만 원 미만은 확인해도 정산 대상 아님 (대상 판정은 선정 견적)
  q := pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-FR-K2'), o), 49999999);
  a := pg_temp.t_award(q);
  perform public.report_contract(a, (now() at time zone 'Asia/Seoul')::date, 90000000, '', false);
  perform pg_temp.t_confirm(a);
  perform pg_temp.t_eq((select count(*)::int from public.billing_awards(pg_temp.t_month(0), pg_temp.t_month(1)) where award_id = a), 0, '5,000만 미만 선정 견적은 대상 아님');
end $$;

-- 4) 이의는 정산을 멈춘다. 자동 확정도 하지 않는다. 운영자가 정리(감사 기록)하면 확정 또는 보고 취소
do $$
declare
  o uuid := pg_temp.t_org('이의기관', 300000, 0.03);
  sponsor uuid := pg_temp.t_user('sponsor-dp@example.test');
  admin uuid := pg_temp.t_user('admin-dp@example.test', 'admin');
  rq uuid := pg_temp.t_rfq('T-FR-D1');
  q uuid := pg_temp.t_quote(pg_temp.t_invite(rq, o), 70000000);
  a uuid := pg_temp.t_award(q);
  rq2 uuid := pg_temp.t_rfq('T-FR-D2');
  q2 uuid := pg_temp.t_quote(pg_temp.t_invite(rq2, o), 80000000);
  a2 uuid := pg_temp.t_award(q2);
  res jsonb;
begin
  update public.rfq_requests set user_id = sponsor where id in (rq, rq2);
  perform public.report_contract(a, (now() at time zone 'Asia/Seoul')::date, 65000000, '', false);
  perform pg_temp.t_eq(public.dispute_contract(a, sponsor, '')->>'code', 'note', '사유 없는 이의 거절');
  res := public.dispute_contract(a, sponsor, '계약 금액이 다릅니다');
  perform pg_temp.t_eq((res->>'ok')::boolean, true, '의뢰자 이의');
  perform pg_temp.t_eq(public.dispute_contract(a, sponsor, '다시')->>'already', 'true', '이의는 한 번');
  perform pg_temp.t_eq(public.confirm_contract(a, sponsor)->>'code', 'disputed', '이의 중에는 확인 불가');

  -- 7일이 지나도 이의 중이면 자동 확정하지 않는다
  perform pg_temp.due_past(a);
  perform pg_temp.t_eq((select count(*)::int from public.auto_confirm_contracts() x where x.award_id = a), 0, '이의 중 자동 확정 없음');
  perform pg_temp.t_eq((select count(*)::int from public.billing_awards(pg_temp.t_month(0), pg_temp.t_month(1)) where award_id = a and kind = 'settlement'), 0, '이의 중 정산 없음');

  -- 운영자만 정리한다
  perform pg_temp.t_eq(public.resolve_contract_dispute(a, sponsor, 'confirm', '확인함')->>'code', 'forbidden', '의뢰자는 정리할 수 없다');
  perform pg_temp.t_eq(public.resolve_contract_dispute(a, admin, 'maybe', '확인함')->>'code', 'bad_resolution', '정리 결과 값 검사');
  perform pg_temp.t_eq(public.resolve_contract_dispute(a, admin, 'confirm', ' ')->>'code', 'note', '정리 사유 필수');
  res := public.resolve_contract_dispute(a, admin, 'confirm', '기관 계약서 사본 확인, 보고 금액이 맞음');
  perform pg_temp.t_eq((res->>'ok')::boolean, true, '운영자 확정');
  perform pg_temp.t_eq((select contract_confirmed_via from public.rfq_awards where id = a), 'operator', '확인 경로 operator');
  perform pg_temp.t_eq((select dispute_resolution from public.rfq_awards where id = a), 'confirm', '정리 결과');
  perform pg_temp.t_eq((select fee from public.billing_awards(pg_temp.t_month(0), pg_temp.t_month(1)) where award_id = a and kind = 'settlement'), 1950000::bigint, '정리 뒤 정산 6,500만 × 3%');
  perform pg_temp.t_eq((select count(*)::int from public.admin_audit where action = 'contract.dispute_resolve' and target_id = a and actor_id = admin), 1, '감사 기록');
  perform pg_temp.t_eq(public.resolve_contract_dispute(a, admin, 'confirm', '다시')->>'code', 'no_dispute', '두 번 정리 불가');

  -- 보고 취소(reject): 체결 보고가 지워지고 기관이 다시 보고한다. 새 보고는 새 확인 기한을 받는다
  perform public.report_contract(a2, (now() at time zone 'Asia/Seoul')::date, 75000000, '', false);
  perform public.dispute_contract(a2, sponsor, '아직 계약하지 않았습니다');
  res := public.resolve_contract_dispute(a2, admin, 'reject', '기관 확인 결과 서명 전');
  perform pg_temp.t_eq((res->>'ok')::boolean, true, '보고 취소');
  perform pg_temp.t_assert((select contract_status = 'pending' and contract_reported_at is null and contract_amount is null and contract_confirmed_at is null from public.rfq_awards where id = a2), '보고가 지워짐');
  perform pg_temp.t_eq((select (before->>'contract_amount')::bigint from public.admin_audit where target_id = a2), 75000000::bigint, '감사 기록에 이전 값');
  perform pg_temp.t_eq(public.confirm_contract(a2, sponsor)->>'code', 'not_reported', '보고 없으면 확인 불가');
  perform pg_temp.t_eq((public.report_contract(a2, (now() at time zone 'Asia/Seoul')::date, 78000000, '', false)->>'ok')::boolean, true, '다시 보고');
  perform pg_temp.t_eq((public.confirm_contract(a2, sponsor)->>'ok')::boolean, true, '정리된 이의 뒤에는 확인 가능');
end $$;

-- 5) 자동 확정: 보고 + 7일 안에 확인·이의가 없으면 예약 작업이 확정. 확인 전 정정은 기한을 다시 잡는다
do $$
declare
  o uuid := pg_temp.t_org('자동기관', 300000, 0.03);
  sponsor uuid := pg_temp.t_user('sponsor-ac@example.test');
  rq uuid := pg_temp.t_rfq('T-FR-A1');
  q uuid := pg_temp.t_quote(pg_temp.t_invite(rq, o), 60000000);
  a uuid := pg_temp.t_award(q);
  n int;
  rec record;
begin
  update public.rfq_requests set user_id = sponsor, status = 'selected', selected_quote_id = q where id = rq;
  perform public.report_contract(a, (now() at time zone 'Asia/Seoul')::date, 60000000, '', false);
  perform pg_temp.t_eq((select status from public.rfq_requests where id = rq), 'contracting', '보고하면 계약 진행');
  perform pg_temp.t_eq((select count(*)::int from public.auto_confirm_contracts() x where x.award_id = a), 0, '7일 전에는 자동 확정 없음');

  -- 확인 전 정정(운영자)은 기한을 다시 잡는다
  perform pg_temp.due_past(a);
  perform public.report_contract(a, (now() at time zone 'Asia/Seoul')::date, 61000000, '정정', true);
  perform pg_temp.t_eq((select contract_confirm_due_at from public.rfq_awards where id = a), now() + interval '7 days', '정정하면 확인 기한 다시 7일');
  perform pg_temp.t_eq((select count(*)::int from public.auto_confirm_contracts() x where x.award_id = a), 0, '정정 뒤 기한 전');

  perform pg_temp.due_past(a);
  select * into rec from public.auto_confirm_contracts() x where x.award_id = a;
  perform pg_temp.t_eq(rec.rfq_no, 'T-FR-A1', '자동 확정 행');
  perform pg_temp.t_eq(rec.user_id, sponsor, '알림 받을 의뢰자');
  perform pg_temp.t_eq(rec.contract_amount, 61000000::bigint, '정정 금액');
  perform pg_temp.t_assert((select confirmed_auto and contract_confirmed_via = 'auto' and requester_confirmed_at is not null from public.rfq_awards where id = a), '자동 확정 기록');
  perform pg_temp.t_eq((select status from public.rfq_requests where id = rq), 'closed', '자동 확정하면 요청을 마침');
  select count(*)::int into n from public.auto_confirm_contracts() x where x.award_id = a;
  perform pg_temp.t_eq(n, 0, '두 번 확정하지 않음');
  perform pg_temp.t_eq((select fee from public.billing_awards(pg_temp.t_month(0), pg_temp.t_month(1)) where award_id = a and kind = 'settlement'), 1830000::bigint, '자동 확정 달에 정산 6,100만 × 3%');
end $$;

-- 6) 불참 되돌리기: 참여 결정 기한 전·자리가 있으면 다시 참여. 기한 뒤·자리 없음은 거절. 철회는 되돌리지 않는다
do $$
declare
  rq uuid := pg_temp.offer('T-FR-R1', '3곳', now() + interval '1 day');
  dec uuid := pg_temp.t_invite(rq, pg_temp.t_org('불참후참여'), now(), false);
  rq2 uuid := pg_temp.offer('T-FR-R2', '3곳', now() + interval '1 day');
  dec2 uuid := pg_temp.t_invite(rq2, pg_temp.t_org('자리없음'), now(), false);
  rq3 uuid := pg_temp.offer('T-FR-R3', '3곳', now() - interval '1 minute');
  dec3 uuid := pg_temp.t_invite(rq3, pg_temp.t_org('기한지남'), now(), false);
  wd uuid := pg_temp.t_invite(rq, pg_temp.t_org('철회기관'));
  res jsonb;
  l record;
  raised text;
begin
  -- 앱의 불참 처리와 같다 (참여 전, sent 일 때만)
  update public.rfq_invites set status = 'declined', declined_at = now() - interval '1 hour', decline_reason = '일정' where id in (dec, dec2, dec3) and status = 'sent' and joined_at is null;

  res := pg_temp.j(dec);
  perform pg_temp.t_eq((res->>'ok')::boolean, true, '기한 전 불참 되돌리기');
  perform pg_temp.t_eq(res->>'rejoined', 'true', 'rejoined 표시');
  select * into l from public.rfq_invites where id = dec;
  perform pg_temp.t_eq(l.status, 'sent', '상태는 참여(작성 전)');
  perform pg_temp.t_assert(l.joined_at is not null and l.join_channel = 'token', '참여 기록');
  perform pg_temp.t_eq(l.decline_undone_at, now(), '되돌린 시각 기록');
  perform pg_temp.t_eq(l.decline_reason, '일정', '앞선 불참 사유는 남는다');
  perform pg_temp.t_assert(l.declined_at is not null, '앞선 불참 시각은 남는다');
  perform pg_temp.t_eq(pg_temp.t_save(dec, pg_temp.tok(dec)), 'ok', '다시 참여한 뒤 견적 저장');

  -- 되돌리기 기록은 바꾸거나 지울 수 없다
  begin
    update public.rfq_invites set decline_undone_at = null where id = dec;
    raised := 'none';
  exception when others then raised := sqlerrm;
  end;
  perform pg_temp.t_assert(raised like 'join_record_protected%', '되돌리기 기록 보호 (' || raised || ')');

  -- 자리가 다 찼으면 되돌릴 수 없다
  perform pg_temp.t_invite(rq2, pg_temp.t_org('자리1'));
  perform pg_temp.t_invite(rq2, pg_temp.t_org('자리2'));
  perform pg_temp.t_invite(rq2, pg_temp.t_org('자리3'));
  perform pg_temp.t_eq(pg_temp.j(dec2)->>'code', 'full', '자리 없으면 거절');
  perform pg_temp.t_eq((select status from public.rfq_invites where id = dec2), 'declined', '불참 그대로');

  -- 참여 결정 기한이 지나면 되돌릴 수 없다
  perform pg_temp.t_eq(pg_temp.j(dec3)->>'code', 'declined', '기한 뒤 불참은 그대로');

  -- 참여 뒤 철회는 되돌릴 수 없다
  perform pg_temp.t_eq((public.withdraw_offer(wd, pg_temp.tok(wd), null, null)->>'ok')::boolean, true, '철회');
  perform pg_temp.t_eq(pg_temp.j(wd)->>'code', 'withdrawn', '철회 뒤 다시 참여 거절');
  perform pg_temp.t_eq(pg_temp.t_save(wd, pg_temp.tok(wd)), 'withdrawn', '철회 뒤 저장 거절');
end $$;

-- 7) 접수 시작 시점 채우기와 두 번 적용: 열을 처음 만들 때만 기존 요청을 시작함으로 채우고, 다시 적용해도 새 요청·확인 기록은 그대로
create temp table t_fr (k text primary key, id uuid);
do $$
declare
  rq_d uuid := pg_temp.t_rfq('T-FR-S1');
  rq_r uuid := pg_temp.t_rfq('T-FR-S2');
  o uuid := pg_temp.t_org('재적용기관', 300000, 0.03);
  q uuid := pg_temp.t_quote(pg_temp.t_invite(pg_temp.t_rfq('T-FR-S3'), o), 60000000);
  a uuid := pg_temp.t_award(q);
begin
  update public.rfq_requests set distributed_at = now() - interval '3 days', created_at = now() - interval '4 days' where id = rq_d;
  update public.rfq_requests set status = 'received', distributed_at = null, created_at = now() - interval '2 days' where id = rq_r;
  perform public.report_contract(a, (now() at time zone 'Asia/Seoul')::date, 60000000, '', false);
  perform pg_temp.t_confirm(a);
  insert into t_fr values ('d', rq_d), ('r', rq_r), ('a', a);
  -- 0025 전 상태 흉내: 열이 없던 DB
  alter table public.rfq_requests drop column started_at;
end $$;

\set f :migrations_dir '/0025_flow_redesign.sql'
\i :f

do $$
begin
  perform pg_temp.t_eq((select started_at from public.rfq_requests where id = (select id from t_fr where k = 'd')), now() - interval '3 days', '안내한 요청은 안내 시각');
  perform pg_temp.t_eq((select started_at from public.rfq_requests where id = (select id from t_fr where k = 'r')), now() - interval '2 days', '안내 전 요청은 접수 시각');
  -- 새 요청(첨부 업로드 중)은 비어 있다
  insert into t_fr values ('n', pg_temp.t_rfq('T-FR-S4'));
  update public.rfq_requests set started_at = null where id = (select id from t_fr where k = 'n');
end $$;

\i :f

do $$
begin
  perform pg_temp.t_assert((select started_at is null from public.rfq_requests where id = (select id from t_fr where k = 'n')), '다시 적용해도 새 요청을 시작함으로 채우지 않는다');
  perform pg_temp.t_eq((select contract_confirmed_via from public.rfq_awards where id = (select id from t_fr where k = 'a')), 'sponsor', '다시 적용해도 확인 기록 그대로 (legacy 로 덮지 않음)');
  perform pg_temp.t_eq(public.danchu_schema_version(), 25, '판 25');
  perform pg_temp.t_assert(to_regprocedure('public.select_quote(uuid, uuid, uuid, integer)') is not null, '선정 함수 그대로');
  perform pg_temp.t_assert((select count(*) from pg_trigger where tgname = 'rfq_awards_guard_confirm' and not tgisinternal) = 1, '확인 보호 트리거 하나');
  perform pg_temp.t_assert(not has_table_privilege('anon', 'public.rfq_pending', 'select'), '다시 적용해도 rfq_pending 권한 회수 유지');
end $$;
