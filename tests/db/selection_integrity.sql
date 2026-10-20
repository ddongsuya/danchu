-- 선정 무결성 (0022): 늦게 끝난 배포가 선정을 덮어쓰지 못함, 선정 뒤 수정 거절, 확인한 견적 판만 선정, 수주 기록 1건

-- 정식 견적서 조건(PDF·착수일·유효기간)을 갖춘 제출. 결과 code ('ok' 또는 거절 사유)
create or replace function pg_temp.t_submit(p_invite uuid, p_amount bigint, p_submit boolean default true) returns text
language sql as $$
  select coalesce(case when (r->>'ok')::boolean then 'ok' end, r->>'code')
  from (select public.save_quote(
    p_invite,
    jsonb_build_object('total_amount', p_amount, 'note', 'n', 'pdf_path', 'x/q.pdf', 'start_date', current_date, 'valid_until', current_date + 30),
    '[]'::jsonb, p_submit, null, (select token from public.rfq_invites where id = p_invite)) r) x
$$;

-- 1) 배포가 메일 발송을 기다리는 사이 제출·선정 → 배포 재개
do $$
declare
  o uuid := pg_temp.t_org('배포경합기관');
  rq uuid := pg_temp.t_rfq('T-SI-1');
  inv uuid;
  q uuid;
  rev int;
  res jsonb;
  n int;
  raised text;
begin
  update public.rfq_requests set status = 'received', distributed_at = null where id = rq;
  -- 배포 시작: 요청을 received 로 읽고 초대를 만든 다음 메일 발송을 기다린다
  inv := pg_temp.t_invite(rq, o);

  -- 그 사이 기관이 제출하고 의뢰자가 선정한다
  perform pg_temp.t_eq(pg_temp.t_submit(inv, 20000000), 'ok', '배포 중 제출');
  perform pg_temp.t_eq((select status from public.rfq_requests where id = rq), 'quoted', '제출하면 quoted');
  select id, revision into q, rev from public.cro_quotes where invite_id = inv;
  res := public.select_quote(rq, q, null, rev);
  perform pg_temp.t_eq((res->>'ok')::boolean, true, '배포 중 선정 성공');

  -- 배포 재개: lib/distribute.ts 와 같은 조건부 갱신 (지금도 received 일 때만)
  update public.rfq_requests set status = 'distributed', distributed_at = now() where id = rq and status = 'received';
  get diagnostics n = row_count;
  perform pg_temp.t_eq(n, 0, '조건부 갱신은 아무 행도 바꾸지 않는다');
  update public.rfq_requests set distributed_at = now() where id = rq and distributed_at is null;
  perform pg_temp.t_eq((select status from public.rfq_requests where id = rq), 'selected', '선정 상태 유지');
  perform pg_temp.t_eq((select selected_quote_id from public.rfq_requests where id = rq), q, '선정 견적 유지');
  perform pg_temp.t_assert((select distributed_at from public.rfq_requests where id = rq) is not null, '배포 시각은 채운다');

  -- 옛 코드처럼 조건 없이 덮어쓰면 트리거가 막는다
  begin
    update public.rfq_requests set status = 'distributed' where id = rq;
    raised := 'none';
  exception when others then
    raised := sqlerrm;
  end;
  perform pg_temp.t_assert(raised like 'request_already_selected%', '선정된 요청을 선정 전 단계로 되돌리지 못한다 (' || raised || ')');
  perform pg_temp.t_eq((select status from public.rfq_requests where id = rq), 'selected', '덮어쓰기 실패 뒤에도 selected');

  -- 선정 뒤 수정 거절 (제출·초안 모두)
  perform pg_temp.t_eq(pg_temp.t_submit(inv, 15000000), 'closed', '선정 뒤 재제출 거절');
  perform pg_temp.t_eq(pg_temp.t_submit(inv, 15000000, false), 'closed', '선정 뒤 초안 저장 거절');
  perform pg_temp.t_eq((select total_amount from public.cro_quotes where id = q), 20000000::bigint, '선정 견적 금액 그대로');

  -- 트리거가 없던 때처럼 상태가 이미 되돌아가 있어도 save_quote 는 selected_quote_id 로 거절한다
  alter table public.rfq_requests disable trigger rfq_requests_keep_selected;
  update public.rfq_requests set status = 'distributed' where id = rq;
  alter table public.rfq_requests enable trigger rfq_requests_keep_selected;
  perform pg_temp.t_eq(pg_temp.t_submit(inv, 15000000), 'closed', '상태가 distributed 여도 선정된 요청은 거절');

  -- 선정 뒤 정상 단계(계약·종료·취소)와 selected 로 되돌리기는 막지 않는다
  update public.rfq_requests set status = 'selected' where id = rq;
  update public.rfq_requests set status = 'contracting' where id = rq;
  update public.rfq_requests set status = 'closed' where id = rq;
  perform pg_temp.t_eq((select status from public.rfq_requests where id = rq), 'closed', '선정 뒤 계약·종료 진행');
end $$;

-- 2) 확인 화면을 연 뒤 견적이 바뀌면 옛 판으로는 선정하지 못한다
do $$
declare
  o uuid := pg_temp.t_org('판확인기관');
  rq uuid := pg_temp.t_rfq('T-SI-2');
  inv uuid := pg_temp.t_invite(rq, o);
  q uuid;
  seen int;
  now_rev int;
  res jsonb;
begin
  perform pg_temp.t_eq(pg_temp.t_submit(inv, 30000000), 'ok', '첫 제출');
  select id, revision into q, seen from public.cro_quotes where invite_id = inv;

  -- 내용이 아닌 갱신(접속 기록)과 제출 뒤 초안 저장(건너뜀)은 판을 바꾸지 않는다
  update public.cro_quotes set submitted_ip = '203.0.113.1', submitted_ua = 'test' where id = q;
  perform pg_temp.t_eq(pg_temp.t_submit(inv, 1, false), 'ok', '제출 뒤 초안 저장은 건너뜀');
  perform pg_temp.t_eq((select revision from public.cro_quotes where id = q), seen, '접속 기록·건너뛴 저장은 판 유지');
  -- 판을 직접 바꾸는 갱신은 무시된다
  update public.cro_quotes set revision = 999 where id = q;
  perform pg_temp.t_eq((select revision from public.cro_quotes where id = q), seen, '판은 직접 바꿀 수 없다');

  -- 의뢰자가 확인 화면을 연 뒤(seen) 기관이 금액을 고쳐 다시 제출한다
  perform pg_temp.t_eq(pg_temp.t_submit(inv, 25000000), 'ok', '확인 화면 뒤 재제출');
  select revision into now_rev from public.cro_quotes where id = q;
  perform pg_temp.t_assert(now_rev > seen, '재제출하면 판이 오른다');

  res := public.select_quote(rq, q, null, seen);
  perform pg_temp.t_eq(res->>'code', 'quote_changed', '옛 판으로 선정 거절');
  perform pg_temp.t_eq((res->>'revision')::int, now_rev, '지금 판을 알려 준다');
  perform pg_temp.t_eq((select count(*)::int from public.rfq_awards where rfq_id = rq), 0, '수주 기록 없음');
  perform pg_temp.t_assert((select selected_quote_id from public.rfq_requests where id = rq) is null, '선정 안 됨');
  perform pg_temp.t_eq((select status from public.rfq_requests where id = rq), 'quoted', '상태 그대로');
  perform pg_temp.t_eq(public.select_quote(rq, q, null, null)->>'code', 'quote_changed', '판 없이 선정 불가');

  -- 다시 확인한 판으로는 선정되고, 그 판과 금액이 수주 기록에 남는다
  res := public.select_quote(rq, q, null, now_rev);
  perform pg_temp.t_eq((res->>'ok')::boolean, true, '지금 판으로 선정');
  perform pg_temp.t_eq((select quote_revision from public.rfq_awards where rfq_id = rq), now_rev, '선정한 판 기록');
  perform pg_temp.t_eq((select fee_basis_amount from public.rfq_awards where rfq_id = rq), 25000000::bigint, '확인한 금액으로 기록');
end $$;

-- 3) 두 번 선정: 한 건만 성공, 수주 기록 1건 (동시 실행은 tests/db/shell/select_race.sh)
do $$
declare
  a uuid := pg_temp.t_org('선정A');
  b uuid := pg_temp.t_org('선정B');
  rq uuid := pg_temp.t_rfq('T-SI-3');
  ia uuid := pg_temp.t_invite(rq, a);
  ib uuid := pg_temp.t_invite(rq, b);
  qa uuid;
  qb uuid;
  raised boolean := false;
begin
  perform pg_temp.t_submit(ia, 20000000);
  perform pg_temp.t_submit(ib, 21000000);
  select id into qa from public.cro_quotes where invite_id = ia;
  select id into qb from public.cro_quotes where invite_id = ib;
  perform pg_temp.t_eq((public.select_quote(rq, qa, null, (select revision from public.cro_quotes where id = qa))->>'ok')::boolean, true, '첫 선정');
  perform pg_temp.t_eq(public.select_quote(rq, qb, null, (select revision from public.cro_quotes where id = qb))->>'code', 'already_selected', '두 번째 선정 거절');
  perform pg_temp.t_eq((select count(*)::int from public.rfq_awards where rfq_id = rq), 1, '수주 기록 1건');
  -- 함수를 거치지 않고 두 번째 수주 기록을 넣어도 rfq_id unique 로 막힌다
  begin
    insert into public.rfq_awards (rfq_id, quote_id, invite_id, cro_org_id, cro_name) values (rq, qb, ib, b, '선정B');
  exception when unique_violation then raised := true;
  end;
  perform pg_temp.t_assert(raised, '요청당 수주 기록은 하나');
  -- 3개 인자 select_quote 는 없다 (판 확인 없는 옛 경로)
  perform pg_temp.t_assert(to_regprocedure('public.select_quote(uuid, uuid, uuid)') is null, '옛 select_quote 삭제');
end $$;

-- 4) 스키마 판
do $$
begin
  perform pg_temp.t_assert(public.danchu_schema_version() >= 22, '스키마 판 22 이상 (0023 부터 23)');
end $$;
