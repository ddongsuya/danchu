-- 참여 선택형 요청 (0023): 참여 기록, 자리 계산(먼저 참여한 순서 + 지명 예약), 참여 거절 사유, 철회, 참여 전 견적 저장 차단,
-- 참여 기록 보호, 청구 조건(참여 기록 있는 견적만, legacy 제외), 기존 초대 전환과 재적용.
-- 동시에 누르는 경우(연결 여러 개)는 tests/db/shell/join_race.sh 가 본다.

-- 참여 결과 code (성공이면 'ok')
create or replace function pg_temp.j(p_invite uuid, p_channel text default 'token', p_actor uuid default null, p_terms text default 'v1') returns text
language sql as $$
  select coalesce(case when (r->>'ok')::boolean then 'ok' end, r->>'code')
  from (select public.join_offer(p_invite, (select token from public.rfq_invites where id = p_invite), p_actor, p_channel, p_terms, '203.0.113.7', 'Mozilla/5.0 test') r) x
$$;
create or replace function pg_temp.w(p_invite uuid, p_actor uuid default null) returns text
language sql as $$
  select coalesce(case when (r->>'ok')::boolean then 'ok' end, r->>'code')
  from (select public.withdraw_offer(p_invite, (select token from public.rfq_invites where id = p_invite), p_actor, null) r) x
$$;
create or replace function pg_temp.tok(p_invite uuid) returns text
language sql as $$ select token from public.rfq_invites where id = p_invite $$;
-- 3곳 요청 + 참여 결정 전 초대 n 개 (기관마다 하나)
create or replace function pg_temp.t_offer(p_no text, p_count text default '3곳', p_join_by timestamptz default null) returns uuid
language plpgsql as $$
declare v uuid := pg_temp.t_rfq(p_no);
begin
  update public.rfq_requests set cro_count = p_count, join_by = p_join_by where id = v;
  return v;
end $$;

-- 1) 자리: 먼저 참여한 순서로 3곳까지. 넷째는 full. 다시 눌러도 기록은 그대로. 참여 기록 내용
do $$
declare
  rq uuid := pg_temp.t_offer('T-JOIN-1');
  i1 uuid := pg_temp.t_invite(rq, pg_temp.t_org('참여1'), now(), false);
  i2 uuid := pg_temp.t_invite(rq, pg_temp.t_org('참여2'), now(), false);
  i3 uuid := pg_temp.t_invite(rq, pg_temp.t_org('참여3'), now(), false);
  i4 uuid := pg_temp.t_invite(rq, pg_temp.t_org('참여4'), now(), false);
  inv record;
  s jsonb;
  res jsonb;
begin
  perform pg_temp.t_eq((select count(*)::int from public.rfq_invites where rfq_id = rq), 4, '안내는 자리 수(3곳)보다 많이 보낼 수 있다 (0012 한도 검사 없음)');
  perform pg_temp.t_eq(pg_temp.j(i1), 'ok', '첫째 참여');
  perform pg_temp.t_eq(pg_temp.j(i2), 'ok', '둘째 참여');
  perform pg_temp.t_eq(pg_temp.j(i3), 'ok', '셋째 참여');
  perform pg_temp.t_eq(pg_temp.j(i4), 'full', '넷째는 자리 없음');
  perform pg_temp.t_eq((select joined_at from public.rfq_invites where id = i4), null::timestamptz, '자리 없음이면 기록 없음');
  s := public.offer_seat_state(rq);
  perform pg_temp.t_eq((s->>'cap')::int, 3, '자리 수');
  perform pg_temp.t_eq((s->>'used')::int, 3, '쓴 자리');
  perform pg_temp.t_eq((s->>'open')::int, 0, '남은 자리');

  select * into inv from public.rfq_invites where id = i1;
  perform pg_temp.t_eq(inv.status, 'sent', '참여해도 상태는 sent (작성 전)');
  perform pg_temp.t_eq(inv.join_channel, 'token', '경로');
  perform pg_temp.t_assert(inv.join_actor like 'token:%' and length(inv.join_actor) = 22, '누른 주체는 링크 지문 (토큰 원문 아님): ' || inv.join_actor);
  perform pg_temp.t_assert(position(inv.token in inv.join_actor) = 0, '토큰 원문을 남기지 않는다');
  perform pg_temp.t_eq(inv.join_terms_version, 'v1', '조건 판');
  perform pg_temp.t_eq(inv.join_ip, '203.0.113.7', 'IP');
  perform pg_temp.t_eq(inv.join_ua, 'Mozilla/5.0 test', 'UA');
  perform pg_temp.t_eq(inv.join_user_id, null::uuid, '링크만으로 누르면 계정 없음');

  res := public.join_offer(i1, pg_temp.tok(i1), null, 'token', 'v2', '198.51.100.1', 'other');
  perform pg_temp.t_eq((res->>'already')::boolean, true, '다시 누르면 already');
  perform pg_temp.t_eq((select join_terms_version from public.rfq_invites where id = i1), 'v1', '다시 눌러도 첫 기록 유지');

  -- 5곳 · 전체
  update public.rfq_requests set cro_count = '5곳' where id = rq;
  perform pg_temp.t_eq(pg_temp.j(i4), 'ok', '자리 수를 늘리면 참여 가능');
  update public.rfq_requests set cro_count = '전체' where id = rq;
  perform pg_temp.t_eq((public.offer_seat_state(rq)->>'cap'), null::text, '전체는 자리 수 없음');
end $$;

-- 2) 지명 예약: 참여 결정 기한까지 결정하지 않은 지명 기관 몫을 비워 둔다. 기한이 지나면 푼다
do $$
declare
  rq uuid := pg_temp.t_offer('T-JOIN-NOM', '3곳', now() + interval '1 day');
  n1 uuid := pg_temp.t_invite(rq, pg_temp.t_org('지명1'), now(), false, 'nominated');
  n2 uuid := pg_temp.t_invite(rq, pg_temp.t_org('지명2'), now(), false, 'nominated');
  m1 uuid := pg_temp.t_invite(rq, pg_temp.t_org('매칭1'), now(), false);
  m2 uuid := pg_temp.t_invite(rq, pg_temp.t_org('매칭2'), now(), false);
  m3 uuid := pg_temp.t_invite(rq, pg_temp.t_org('매칭3'), now(), false);
  rq2 uuid := pg_temp.t_offer('T-JOIN-NOM2', '3곳', now() + interval '1 day');
  x1 uuid := pg_temp.t_invite(rq2, pg_temp.t_org('지명3'), now(), false, 'nominated');
  x2 uuid := pg_temp.t_invite(rq2, pg_temp.t_org('지명4'), now(), false, 'nominated');
  y1 uuid := pg_temp.t_invite(rq2, pg_temp.t_org('매칭4'), now(), false);
  y2 uuid := pg_temp.t_invite(rq2, pg_temp.t_org('매칭5'), now(), false);
begin
  perform pg_temp.t_eq((public.offer_seat_state(rq)->>'reserved')::int, 2, '지명 2곳 몫 예약');
  perform pg_temp.t_eq((public.offer_seat_state(rq)->>'open')::int, 1, '일반 자리 1');
  perform pg_temp.t_eq(pg_temp.j(m1), 'ok', '일반 자리 1곳 참여');
  perform pg_temp.t_eq(pg_temp.j(m2), 'reserved', '남은 자리는 지명 기관 몫');
  perform pg_temp.t_eq(pg_temp.j(n1), 'ok', '지명 기관은 자기 몫 자리로 참여');
  perform pg_temp.t_eq(pg_temp.j(m2), 'reserved', '지명 1곳이 아직 결정 전');
  -- 지명 기관이 불참하면 그 몫이 풀린다
  update public.rfq_invites set status = 'declined', declined_at = now() where id = n2;
  perform pg_temp.t_eq(pg_temp.j(m2), 'ok', '불참한 지명 몫은 일반 자리');
  perform pg_temp.t_eq(pg_temp.j(m3), 'full', '자리 3곳이 모두 찼다');
  perform pg_temp.t_eq((select count(*)::int from public.rfq_invites where rfq_id = rq and joined_at is not null), 3, '참여 3곳');

  -- 기한 안: 예약 유지 → 기한이 지나면 일반 자리로
  perform pg_temp.t_eq(pg_temp.j(y1), 'ok', '일반 1곳');
  perform pg_temp.t_eq(pg_temp.j(y2), 'reserved', '기한 안에는 지명 몫 유지');
  update public.rfq_requests set join_by = now() - interval '1 minute' where id = rq2;
  perform pg_temp.t_eq((public.offer_seat_state(rq2)->>'reserved')::int, 0, '기한 뒤 예약 없음');
  perform pg_temp.t_eq(pg_temp.j(y2), 'ok', '기한 뒤 먼저 누른 기관이 자리');
  perform pg_temp.t_eq(pg_temp.j(x1), 'ok', '지명 기관도 늦게 참여 가능 (자리가 남으면)');
  perform pg_temp.t_eq(pg_temp.j(x2), 'full', '지명 기관도 자리가 없으면 full');
end $$;

-- 3) 참여 거절: 취소·불참·만료·기관 중지·마감·회신 기한 직전·운영자·다른 기관·잘못된 인자
do $$
declare
  o uuid := pg_temp.t_org('거절기관');
  other uuid := pg_temp.t_org('다른기관');
  rq uuid := pg_temp.t_offer('T-JOIN-NO', '전체');
  i_rev uuid := pg_temp.t_invite(rq, pg_temp.t_org('취소기관'), now(), false);
  i_dec uuid := pg_temp.t_invite(rq, pg_temp.t_org('불참기관'), now(), false);
  i_exp uuid := pg_temp.t_invite(rq, pg_temp.t_org('만료기관'), now(), false);
  i_exp2 uuid := pg_temp.t_invite(rq, pg_temp.t_org('만료기관2'), now(), false);
  susp uuid := pg_temp.t_org('중지기관');
  i_susp uuid := pg_temp.t_invite(rq, susp, now(), false);
  i_cut uuid := pg_temp.t_invite(rq, pg_temp.t_org('마감직전기관'), now(), false);
  i_late uuid := pg_temp.t_invite(rq, pg_temp.t_org('기한지남기관'), now(), false);
  i uuid := pg_temp.t_invite(rq, o, now(), false);
  op uuid := pg_temp.t_user('join-ops@example.test', 'admin');
  stranger uuid := pg_temp.t_user('join-stranger@example.test', 'cro', other);
  member uuid := pg_temp.t_user('join-member@example.test', 'cro', o);
  old_tok text := pg_temp.tok(i_rev);
  rq_closed uuid := pg_temp.t_offer('T-JOIN-CLOSED', '전체');
  i_closed uuid := pg_temp.t_invite(rq_closed, o, now(), false);
  -- 취소 경로는 따로 (0026 부터 열린 비교표의 compared_at 은 비울 수 없다)
  rq_cancel uuid := pg_temp.t_offer('T-JOIN-CANCEL', '전체');
  i_cancel uuid := pg_temp.t_invite(rq_cancel, o, now(), false);
begin
  perform public.revoke_invite(i_rev, '잘못 보낸 기관');
  perform pg_temp.t_eq(public.join_offer(i_rev, old_tok, null, 'token', 'v1', null, null)->>'code', 'revoked', '취소한 초대: 옛 링크');
  perform pg_temp.t_eq(pg_temp.j(i_rev), 'revoked', '취소한 초대: 새 토큰이어도 거절');

  update public.rfq_invites set status = 'declined', declined_at = now() where id = i_dec;
  perform pg_temp.t_eq(pg_temp.j(i_dec), 'declined', '불참한 초대');

  update public.rfq_invites set expires_at = now() - interval '1 minute' where id = i_exp;
  perform pg_temp.t_eq(pg_temp.j(i_exp), 'expired', '링크 만료');
  update public.rfq_invites set status = 'expired' where id = i_exp2;
  perform pg_temp.t_eq(pg_temp.j(i_exp2), 'expired', '만료 상태');

  update public.cro_orgs set status = 'suspended' where id = susp;  -- 링크가 재발급된다 (0021). 새 토큰으로 눌러도 거절
  perform pg_temp.t_eq(pg_temp.j(i_susp), 'org_inactive', '승인되지 않은 기관');
  update public.cro_orgs set status = 'pending' where id = susp;
  perform pg_temp.t_eq(pg_temp.j(i_susp), 'org_inactive', '승인 대기 기관');

  -- 회신 기한 3영업일 전이 지났으면 늦은 참여 불가. 참여 결정 기한 안이면 가능. 회신 기한이 지나면 불가
  update public.rfq_invites set reply_by = (now() at time zone 'Asia/Seoul')::date + 1 where id in (i_cut, i_late);
  perform pg_temp.t_eq(pg_temp.j(i_cut), 'cutoff', '회신 기한 3영업일 전이 지나면 참여 마감');
  update public.rfq_requests set join_by = now() + interval '1 hour' where id = rq;
  perform pg_temp.t_eq(pg_temp.j(i_cut), 'ok', '참여 결정 기한 안이면 회신 기한이 가까워도 참여');
  update public.rfq_invites set reply_by = (now() at time zone 'Asia/Seoul')::date - 1 where id = i_late;
  perform pg_temp.t_eq(pg_temp.j(i_late), 'cutoff', '회신 기한이 지나면 참여 결정 기한 안이어도 불가');
  perform pg_temp.t_eq(public.business_days_before(date '2026-10-26', 3), date '2026-10-21', '월요일의 3영업일 전은 수요일');
  perform pg_temp.t_eq(public.business_days_before(date '2026-10-23', 3), date '2026-10-20', '금요일의 3영업일 전은 화요일');

  -- 운영자는 기관 대신 참여하지 못한다 (어느 경로든)
  perform pg_temp.t_eq(pg_temp.j(i, 'token', op), 'operator_not_allowed', '운영자: 링크');
  perform pg_temp.t_eq(pg_temp.j(i, 'portal', op), 'operator_not_allowed', '운영자: 포털');
  perform pg_temp.t_eq(pg_temp.j(i, 'token', stranger), 'not_member', '다른 기관 담당자: 링크');
  perform pg_temp.t_eq(pg_temp.j(i, 'portal', stranger), 'not_member', '다른 기관 담당자: 포털');
  perform pg_temp.t_eq(pg_temp.j(i, 'portal', null), 'not_member', '포털은 로그인한 담당자만');
  perform pg_temp.t_eq(pg_temp.j(i, 'legacy', member), 'bad_channel', 'legacy 는 함수로 남길 수 없다');
  perform pg_temp.t_eq(pg_temp.j(i, 'portal', member, '  '), 'terms_required', '조건 판 필수');
  perform pg_temp.t_eq(public.join_offer(i, 'wrong-token', member, 'portal', 'v1', null, null)->>'code', 'revoked', '토큰이 다르면 거절');
  perform pg_temp.t_eq((select joined_at from public.rfq_invites where id = i), null::timestamptz, '거절 뒤 기록 없음');
  perform pg_temp.t_eq(pg_temp.j(i, 'portal', member), 'ok', '그 기관 담당자는 포털에서 참여');
  perform pg_temp.t_eq((select join_user_id from public.rfq_invites where id = i), member, '누른 담당자 계정');
  perform pg_temp.t_eq((select join_actor from public.rfq_invites where id = i), 'member', '포털 주체');

  -- 마감·선정된 요청
  update public.rfq_requests set compared_at = now() where id = rq_closed;
  perform pg_temp.t_eq(pg_temp.j(i_closed), 'closed', '회신 마감 뒤 참여 불가');
  update public.rfq_requests set status = 'cancelled' where id = rq_cancel;
  perform pg_temp.t_eq(pg_temp.j(i_cancel), 'closed', '취소된 요청');
end $$;

-- 4) 참여 전 견적 저장 차단 (기관·운영자 대리 입력 모두), 참여 뒤 운영자 대리 입력은 가능
do $$
declare
  o uuid := pg_temp.t_org('저장기관', 300000, 0.03, null, true);
  rq uuid := pg_temp.t_offer('T-JOIN-SAVE', '3곳');
  i uuid := pg_temp.t_invite(rq, o, now(), false);
  op uuid := pg_temp.t_user('save-ops@example.test', 'admin');
  res jsonb;
  blocked boolean := false;
begin
  perform pg_temp.t_eq(pg_temp.t_save(i, pg_temp.tok(i)), 'not_joined', '기관: 참여 전 초안 저장 거절');
  perform pg_temp.t_eq(pg_temp.t_save(i, pg_temp.tok(i), true), 'not_joined', '기관: 참여 전 제출 거절');
  res := public.save_quote(i, jsonb_build_object('total_amount', 20000000, 'entry_source', 'operator', 'pdf_path', 'x/q.pdf'), '[]'::jsonb, true, op, pg_temp.tok(i));
  perform pg_temp.t_eq(res->>'code', 'not_joined', '운영자 대리 입력도 참여 전 거절');
  perform pg_temp.t_eq((select count(*)::int from public.cro_quotes where invite_id = i), 0, '견적 행 없음');
  perform pg_temp.t_eq((select status from public.rfq_invites where id = i), 'sent', '상태 그대로');
  begin
    insert into public.cro_quotes (invite_id, rfq_id, rfq_no, cro_name, status) select id, rfq_id, rfq_no, cro_name, 'draft' from public.rfq_invites where id = i;
  exception when others then
    blocked := sqlerrm like 'not_joined%';
  end;
  perform pg_temp.t_assert(blocked, '견적 표에 직접 넣는 것도 참여 전에는 막힌다');

  perform pg_temp.t_eq(pg_temp.j(i), 'ok', '관리 기관이 회신 링크에서 참여');
  res := public.save_quote(i, jsonb_build_object('total_amount', 20000000, 'entry_source', 'operator', 'pdf_path', 'x/q.pdf'), '[]'::jsonb, true, op, pg_temp.tok(i));
  perform pg_temp.t_eq((res->>'ok')::boolean, true, '참여 뒤 운영자 대리 입력 제출');
  perform pg_temp.t_eq((select entry_source from public.cro_quotes where invite_id = i), 'operator', '입력 주체 운영자');
end $$;

-- 5) 철회: 제출 전만. 자리가 빈다. 철회한 초대는 저장·재참여 불가. 참여 전에는 철회가 아니라 불참
do $$
declare
  rq uuid := pg_temp.t_offer('T-JOIN-WD', '3곳');
  a uuid := pg_temp.t_invite(rq, pg_temp.t_org('철회A'), now(), false);
  b uuid := pg_temp.t_invite(rq, pg_temp.t_org('철회B'), now(), false);
  c uuid := pg_temp.t_invite(rq, pg_temp.t_org('철회C'), now(), false);
  d uuid := pg_temp.t_invite(rq, pg_temp.t_org('철회D'), now(), false);
  e uuid := pg_temp.t_invite(rq, pg_temp.t_org('철회E'), now(), false);
  inv record;
begin
  perform pg_temp.t_eq(pg_temp.j(a), 'ok', 'A 참여');
  perform pg_temp.t_eq(pg_temp.j(b), 'ok', 'B 참여');
  perform pg_temp.t_eq(pg_temp.j(c), 'ok', 'C 참여');
  perform pg_temp.t_eq(pg_temp.j(d), 'full', 'D 자리 없음');
  perform pg_temp.t_eq(pg_temp.t_save(a, pg_temp.tok(a)), 'ok', 'A 초안 저장');
  perform pg_temp.t_eq(pg_temp.t_save(b, pg_temp.tok(b), true), 'ok', 'B 제출');

  perform pg_temp.t_eq(pg_temp.w(b), 'submitted', '제출한 견적은 철회 불가');
  perform pg_temp.t_eq(pg_temp.w(e), 'not_joined', '참여 전에는 철회가 아니라 불참');
  perform pg_temp.t_eq(pg_temp.w(a), 'ok', '작성 중 철회');
  select * into inv from public.rfq_invites where id = a;
  perform pg_temp.t_eq(inv.status, 'declined', '철회하면 declined');
  perform pg_temp.t_assert(inv.withdrawn_at is not null and inv.declined_at is not null, '철회 시각');
  perform pg_temp.t_eq(inv.decline_reason, '참여 철회', '기본 사유');
  perform pg_temp.t_assert(inv.joined_at is not null, '참여 기록은 남는다');
  perform pg_temp.t_eq(pg_temp.w(a), 'ok', '다시 철회해도 그대로 (already)');
  perform pg_temp.t_eq((public.offer_seat_state(rq)->>'used')::int, 2, '철회한 자리는 비었다');
  perform pg_temp.t_eq(pg_temp.j(d), 'ok', '빈 자리에 D 참여');
  perform pg_temp.t_eq(pg_temp.j(a), 'withdrawn', '철회한 초대는 다시 참여 불가');
  perform pg_temp.t_eq(pg_temp.t_save(a, pg_temp.tok(a)), 'withdrawn', '철회한 초대는 저장 불가');
  perform pg_temp.t_eq(pg_temp.w(c), 'ok', '작성 전 철회');
  perform pg_temp.t_eq(pg_temp.j(e), 'ok', '또 빈 자리에 E 참여');
end $$;

-- 6) 참여 기록 보호: join_offer·withdraw_offer 밖에서 쓰거나 바꾸지 못한다. 계정 삭제로 계정만 비워지는 것은 허용
do $$
declare
  o uuid := pg_temp.t_org('보호기관');
  rq uuid := pg_temp.t_offer('T-JOIN-GUARD', '전체');
  i uuid := pg_temp.t_invite(rq, o, now(), false);
  k uuid := pg_temp.t_invite(rq, pg_temp.t_org('보호기관2'), now(), false);
  member uuid := pg_temp.t_user('guard-member@example.test', 'cro', o);
  msg text;
  n int := 0;
begin
  begin update public.rfq_invites set joined_at = now(), join_channel = 'portal', join_terms_version = 'v1' where id = i;
  exception when others then if sqlerrm like 'join_record_protected%' then n := n + 1; end if; end;
  begin
    insert into public.rfq_invites (rfq_id, rfq_no, cro_name, cro_email, reply_by, expires_at, joined_at, join_channel, join_terms_version)
    select id, rfq_no, '직접', 'x@example.test', current_date + 7, now() + interval '14 days', now(), 'token', 'v1' from public.rfq_requests where id = rq;
  exception when others then if sqlerrm like 'join_record_protected%' then n := n + 1; end if; end;
  perform pg_temp.t_eq(n, 2, '참여 기록을 직접 쓰는 갱신·삽입 거절');

  perform pg_temp.t_eq(pg_temp.j(i, 'portal', member), 'ok', '참여');
  n := 0;
  begin update public.rfq_invites set join_terms_version = 'v9' where id = i;
  exception when others then if sqlerrm like 'join_record_protected%' then n := n + 1; end if; end;
  begin update public.rfq_invites set joined_at = null, join_channel = null where id = i;
  exception when others then if sqlerrm like 'join_record_protected%' then n := n + 1; end if; end;
  begin update public.rfq_invites set withdrawn_at = now() where id = i;
  exception when others then if sqlerrm like 'join_record_protected%' then n := n + 1; end if; end;
  perform pg_temp.t_eq(n, 3, '참여 기록은 바꾸거나 지우지 못하고, 철회 기록도 직접 쓰지 못한다');

  perform pg_temp.t_eq(pg_temp.j(k), 'ok', 'K 참여');
  perform pg_temp.t_eq(pg_temp.w(k), 'ok', 'K 철회');
  n := 0;
  begin update public.rfq_invites set withdrawn_at = null where id = k;
  exception when others then if sqlerrm like 'join_record_protected%' then n := n + 1; end if; end;
  perform pg_temp.t_eq(n, 1, '철회 기록은 지우지 못한다');

  -- 다른 열 갱신(토큰 재발급·상태)은 그대로 된다
  perform public.rotate_org_invite_tokens(o);
  update public.rfq_invites set status = 'expired' where id = i;
  update public.rfq_invites set status = 'sent' where id = i;
  delete from auth.users where id = member;
  perform pg_temp.t_eq((select join_user_id from public.rfq_invites where id = i), null::uuid, '계정이 지워지면 계정만 비운다');
  perform pg_temp.t_assert((select joined_at is not null and join_channel = 'portal' and join_terms_version = 'v1' from public.rfq_invites where id = i), '나머지 참여 기록은 남는다');
end $$;

-- 7) "지명 기관에만 안내" 요청에는 자동 매칭 안내를 넣지 않는다 (지명·운영자 수동 안내는 가능). 마감 뒤에는 안내 불가
do $$
declare
  rq uuid := pg_temp.t_offer('T-JOIN-NOMONLY', '3곳');
  n int := 0;
begin
  update public.rfq_requests set nominees_only = true where id = rq;
  begin perform pg_temp.t_invite(rq, pg_temp.t_org('매칭거절'), now(), false, 'matched');
  exception when others then if sqlerrm = 'nominees_only' then n := n + 1; end if; end;
  perform pg_temp.t_eq(n, 1, '자동 매칭 안내 거절');
  perform pg_temp.t_assert(pg_temp.t_invite(rq, pg_temp.t_org('지명허용'), now(), false, 'nominated') is not null, '지명 안내 가능');
  perform pg_temp.t_assert(pg_temp.t_invite(rq, pg_temp.t_org('수동허용'), now(), false, 'manual') is not null, '운영자 수동 안내 가능');
  update public.rfq_requests set compared_at = now() where id = rq;
  n := 0;
  begin perform pg_temp.t_invite(rq, pg_temp.t_org('마감뒤'), now(), false, 'manual');
  exception when others then if sqlerrm = 'request_not_open' then n := n + 1; end if; end;
  perform pg_temp.t_eq(n, 1, '회신 마감 뒤 안내 거절');
end $$;

-- 8) 청구: 참여 기록(portal·token)이 있는 견적만. 운영자 대리 입력도 기관이 참여했으면 청구. 참여 기록 없는 견적·legacy 는 청구하지 않음
--    전환 대상 데이터(0023 전 모양)를 만들고 0023 을 다시 적용한다
create temp table t_ids (k text primary key, v uuid);
do $$
declare
  o uuid := pg_temp.t_org('청구참여기관', 300000, 0.03);
  rq uuid := pg_temp.t_offer('T-JOIN-BILL', '전체');
  j_cro uuid := pg_temp.t_invite(rq, o, now(), false);
  op uuid := pg_temp.t_user('bill-ops@example.test', 'admin');
  m uuid := pg_temp.t_org('청구관리기관', 300000, 0.03, null, true);
  j_op uuid := pg_temp.t_invite(pg_temp.t_offer('T-JOIN-BILL2', '전체'), m, now(), false);
  -- 0023 전 모양: 참여 기록 없이 제출·작성 중·열린 초대
  lg uuid := pg_temp.t_org('전환기관', 300000, 0.03);
  rq_old uuid := pg_temp.t_offer('T-JOIN-OLD', '3곳');
  old_sub uuid := pg_temp.t_invite(rq_old, lg, now(), false);
  old_draft uuid := pg_temp.t_invite(rq_old, pg_temp.t_org('전환작성중'), now(), false);
  old_open uuid := pg_temp.t_invite(rq_old, pg_temp.t_org('전환열림'), now(), false);
  nj uuid := pg_temp.t_invite(pg_temp.t_offer('T-JOIN-NJ', '전체'), pg_temp.t_org('미참여기관', 300000, 0.03), now(), false);
  q_old uuid;
begin
  perform pg_temp.t_eq(pg_temp.j(j_cro), 'ok', '기관 참여');
  perform pg_temp.t_eq(pg_temp.t_save(j_cro, pg_temp.tok(j_cro), true), 'ok', '기관 제출');
  update public.cro_quotes set total_amount = 30000000 where invite_id = j_cro;
  perform pg_temp.t_eq(pg_temp.j(j_op), 'ok', '관리 기관이 링크에서 참여');
  perform pg_temp.t_eq((public.save_quote(j_op, jsonb_build_object('total_amount', 60000000, 'entry_source', 'operator', 'pdf_path', 'x/q.pdf', 'start_date', current_date, 'valid_until', current_date + 30), '[]'::jsonb, true, op, pg_temp.tok(j_op))->>'ok')::boolean, true, '참여 뒤 운영자 대리 입력');

  -- 0023 전 데이터 흉내: 견적 행 제한 트리거를 잠시 끄고 넣는다
  alter table public.cro_quotes disable trigger cro_quotes_require_join;
  q_old := pg_temp.t_quote(old_sub, 60000000);
  update public.rfq_invites set status = 'draft' where id = old_draft;
  alter table public.cro_quotes enable trigger cro_quotes_require_join;
  -- 전환 전 선정·체결된 legacy 수주 (성사수수료 대상 금액)
  perform public.report_contract(pg_temp.t_award(q_old), (now() at time zone 'Asia/Seoul')::date, 70000000, '');
  perform public.report_contract(pg_temp.t_award((select id from public.cro_quotes where invite_id = j_op)), (now() at time zone 'Asia/Seoul')::date, 80000000, '');
  -- 0025: 체결 보고 뒤 확인해야 정산된다
  perform pg_temp.t_confirm(a.id) from public.rfq_awards a where a.contract_reported_at is not null and a.contract_confirmed_at is null;

  insert into t_ids values ('o', o), ('m', m), ('lg', lg), ('j_cro', j_cro), ('j_op', j_op),
    ('old_sub', old_sub), ('old_draft', old_draft), ('old_open', old_open), ('nj', nj),
    ('nj_org', (select cro_org_id from public.rfq_invites where id = nj));
end $$;

\set f :migrations_dir '/0023_opt_in.sql'
\i :f

do $$
declare
  id_of jsonb := (select jsonb_object_agg(k, v) from t_ids);
  l record;
  s record;
begin
  -- 참여 기록 없이 제출된 견적 (전환 뒤에 흉내 낸다. 0023 은 이런 행을 막는다)
  alter table public.cro_quotes disable trigger cro_quotes_require_join;
  perform pg_temp.t_quote((id_of->>'nj')::uuid, 30000000);
  alter table public.cro_quotes enable trigger cro_quotes_require_join;

  -- 전환: 작성 중·제출은 legacy 참여, 열린 sent 는 그대로(참여를 다시 묻는다), 이미 참여한 초대는 그대로
  select * into l from public.rfq_invites where id = (id_of->>'old_sub')::uuid;
  perform pg_temp.t_eq(l.join_channel, 'legacy', '제출 초대는 legacy');
  perform pg_temp.t_eq(l.join_actor, 'legacy', 'legacy 주체');
  perform pg_temp.t_eq(l.join_terms_version, null::text, 'legacy 는 조건 판 없음');
  perform pg_temp.t_assert(l.joined_at is not null, 'legacy 참여 시각');
  perform pg_temp.t_eq((select join_channel from public.rfq_invites where id = (id_of->>'old_draft')::uuid), 'legacy', '작성 중 초대는 legacy');
  perform pg_temp.t_eq((select joined_at from public.rfq_invites where id = (id_of->>'old_open')::uuid), null::timestamptz, '열린 sent 초대는 참여 전');
  perform pg_temp.t_eq((select join_channel from public.rfq_invites where id = (id_of->>'j_cro')::uuid), 'token', '이미 참여한 초대는 그대로');
  perform pg_temp.t_eq((public.offer_seat_state((select rfq_id from public.rfq_invites where id = (id_of->>'old_sub')::uuid))->>'used')::int, 2, 'legacy 작성 중·제출은 자리에 센다');

  -- 견적 행
  select * into l from public.billing_lines(pg_temp.t_month(0), pg_temp.t_month(1)) where invite_id = (id_of->>'j_cro')::uuid;
  perform pg_temp.t_eq(l.join_status, 'joined', '참여 견적');
  perform pg_temp.t_eq(l.chargeable, true, '참여 견적 청구');
  perform pg_temp.t_eq(l.fee_due, 300000::bigint, '참여 견적 건당 이용료');
  select * into l from public.billing_lines(pg_temp.t_month(0), pg_temp.t_month(1)) where invite_id = (id_of->>'j_op')::uuid;
  perform pg_temp.t_eq(l.entry_source, 'operator', '운영자 대리 입력');
  perform pg_temp.t_eq(l.chargeable, true, '기관이 참여한 뒤 대리 입력한 견적은 청구');
  perform pg_temp.t_eq(l.fee_due, 300000::bigint, '대리 입력 건당 이용료');
  select * into l from public.billing_lines(pg_temp.t_month(0), pg_temp.t_month(1)) where invite_id = (id_of->>'old_sub')::uuid;
  perform pg_temp.t_eq(l.join_status, 'legacy', 'legacy 견적 표시');
  perform pg_temp.t_eq(l.billable, true, '운영자 제외는 아님');
  perform pg_temp.t_eq(l.chargeable, false, 'legacy 견적은 청구하지 않음');
  perform pg_temp.t_eq(l.fee_due, 0::bigint, 'legacy 0원');
  select * into l from public.billing_lines(pg_temp.t_month(0), pg_temp.t_month(1)) where invite_id = (id_of->>'nj')::uuid;
  perform pg_temp.t_eq(l.join_status, 'not_joined', '참여 기록 없는 견적 표시');
  perform pg_temp.t_eq(l.chargeable, false, '참여 기록 없는 견적은 청구하지 않음');
  perform pg_temp.t_eq(l.fee_due, 0::bigint, '참여 기록 없음 0원');

  -- 기관 명세
  select * into s from public.billing_summary(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = (id_of->>'o')::uuid;
  perform pg_temp.t_eq(s.per_quote, 1, '참여 기관 건당 1');
  perform pg_temp.t_eq(s.per_quote_fee, 300000::bigint, '참여 기관 건당 이용료');
  select * into s from public.billing_summary(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = (id_of->>'m')::uuid;
  perform pg_temp.t_eq(s.per_quote, 1, '관리 기관(대리 입력) 건당 1');
  perform pg_temp.t_eq(s.success_eligible, 1, '관리 기관 성사수수료 대상');
  perform pg_temp.t_eq(s.settled_count, 1, '참여한 초대의 체결은 정산');
  perform pg_temp.t_eq(s.settled_fee, 2400000::bigint, '정산 8,000만 원 × 3%');
  perform pg_temp.t_eq(s.total_due, 2700000::bigint, '관리 기관 합계 (건당 + 정산)');
  select * into s from public.billing_summary(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = (id_of->>'lg')::uuid;
  perform pg_temp.t_eq(s.quoted, 1, 'legacy 제출 1');
  perform pg_temp.t_eq(s.billable, 0, 'legacy 청구 대상 0');
  perform pg_temp.t_eq(s.excluded, 1, 'legacy 는 청구하지 않는 견적');
  perform pg_temp.t_eq(s.per_quote, 0, 'legacy 건당 0');
  perform pg_temp.t_eq(s.success_eligible, 0, 'legacy 성사수수료 대상 아님');
  perform pg_temp.t_eq(s.settled_count, 0, 'legacy 체결 정산 없음');
  perform pg_temp.t_eq(s.total_due, 0::bigint, 'legacy 합계 0');
  perform pg_temp.t_eq((select invite_joined from public.billing_awards(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = (id_of->>'lg')::uuid and kind = 'settlement'), false, 'legacy 수주 행은 보이고 참여 기록 없음 표시');
  select * into s from public.billing_summary(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = (id_of->>'nj_org')::uuid;
  perform pg_temp.t_eq(s.per_quote, 0, '참여 기록 없음 건당 0');
  perform pg_temp.t_eq(s.excluded, 1, '참여 기록 없음은 청구하지 않는 견적');
  perform pg_temp.t_eq(s.total_due, 0::bigint, '참여 기록 없음 합계 0');

  -- 참여 기록 없는 견적은 0023 이후에는 생기지 않는다(트리거). 재적용 검사 전에 흉내 낸 행을 지운다 (남겨 두면 재적용이 legacy 로 전환한다)
  delete from public.cro_quotes where invite_id = (id_of->>'nj')::uuid;
  update public.rfq_invites set status = 'sent' where id = (id_of->>'nj')::uuid;
  drop table t_ids;
  create temp table t_ids as
    select i.id, i.joined_at, i.join_channel, i.join_actor, i.join_terms_version from public.rfq_invites i where i.joined_at is not null;
end $$;

-- 8-1) 참여 결정 기한 연장 기록 열 (운영자 연장은 요청마다 한 번, 앱이 이 열이 빌 때만 조건부로 바꾼다)
do $$
declare rq uuid := pg_temp.t_offer('T-JOIN-EXT', '3곳', now() + interval '1 day');
begin
  perform pg_temp.t_assert((select join_by_extended_at is null from public.rfq_requests where id = rq), '새 요청은 연장 기록 없음');
  update public.rfq_requests set join_by = join_by + interval '2 days', join_by_extended_at = now() where id = rq and join_by_extended_at is null;
  perform pg_temp.t_assert((select join_by_extended_at is not null from public.rfq_requests where id = rq), '첫 연장 기록');
  update public.rfq_requests set join_by = join_by + interval '2 days' where id = rq and join_by_extended_at is null;
  perform pg_temp.t_assert((select join_by < now() + interval '4 days' from public.rfq_requests where id = rq), '두 번째 조건부 연장은 바뀌지 않음');
end $$;

-- 9) 데이터가 있는 상태에서 0023 을 다시 적용해도 참여 기록·청구가 그대로다
\i :f

do $$
begin
  perform pg_temp.t_eq((select count(*)::int from t_ids t join public.rfq_invites i on i.id = t.id
                         where (i.joined_at, i.join_channel, i.join_actor, i.join_terms_version) is not distinct from (t.joined_at, t.join_channel, t.join_actor, t.join_terms_version)),
                       (select count(*)::int from t_ids), '재적용해도 참여 기록 유지');
  perform pg_temp.t_eq((select count(*)::int from public.rfq_invites where joined_at is not null), (select count(*)::int from t_ids), '재적용해도 새로 참여 처리되는 초대 없음');
  perform pg_temp.t_eq(public.danchu_schema_version(), 23, '스키마 판 23');
  perform pg_temp.t_assert(to_regprocedure('public.join_offer(uuid, text, uuid, text, text, text, text)') is not null, 'join_offer 있음');
end $$;

-- 10) 검토 반영 (2026-10-20)
--  a) 참여한 담당자 계정은 계정이 실제로 지워졌을 때만 비울 수 있다 (앱 코드가 "누른 사람"을 지우지 못한다)
--  b) 참여 기록의 IP·브라우저는 보존 기간(90일)이 지난 뒤에만 비울 수 있고, 다른 값으로는 바꿀 수 없다
--  c) 시범 판(pilot-…)으로 참여한 요청은 청구하지 않는다 (건당 이용료·성사수수료 모두)
--  d) 자리 수 바꾸기는 요청 행을 잠그고 참여 수를 센다 (set_seat_count)
--  e) save_quote 는 의뢰자 알림용 참여 기관 수(joined_invites)를 따로 돌려준다
do $$
declare
  o uuid := pg_temp.t_org('검토기관');
  rq uuid := pg_temp.t_offer('T-JOIN-REVIEW', '전체');
  i uuid := pg_temp.t_invite(rq, o, now(), false);
  k uuid := pg_temp.t_invite(rq, pg_temp.t_org('검토기관2'), now(), false);
  member uuid := pg_temp.t_user('review-member@example.test', 'cro', o);
  n int := 0;
begin
  perform pg_temp.t_eq(pg_temp.j(i, 'portal', member), 'ok', '포털 참여');
  begin update public.rfq_invites set join_user_id = null where id = i;
  exception when others then if sqlerrm like 'join_record_protected%' then n := n + 1; end if; end;
  perform pg_temp.t_eq(n, 1, 'a) 계정이 남아 있으면 누른 담당자를 비울 수 없다');
  perform pg_temp.t_eq((select join_user_id from public.rfq_invites where id = i), member, 'a) 누른 담당자 그대로');

  n := 0;
  begin update public.rfq_invites set join_ip = null, join_ua = null where id = i;
  exception when others then if sqlerrm like 'join_record_protected%' then n := n + 1; end if; end;
  perform pg_temp.t_eq(n, 1, 'b) 보존 기간 안에는 IP·브라우저를 지울 수 없다');
  -- 90일 지난 참여로 만든다 (참여 시각은 트리거가 막으므로 잠시 끈다)
  alter table public.rfq_invites disable trigger rfq_invites_guard_join;
  update public.rfq_invites set joined_at = now() - interval '91 days' where id = i;
  alter table public.rfq_invites enable trigger rfq_invites_guard_join;
  n := 0;
  begin update public.rfq_invites set join_ip = '198.51.100.1' where id = i;
  exception when others then if sqlerrm like 'join_record_protected%' then n := n + 1; end if; end;
  perform pg_temp.t_eq(n, 1, 'b) 보존 기간이 지나도 다른 값으로는 못 바꾼다');
  update public.rfq_invites set join_ip = null, join_ua = null where id = i;
  perform pg_temp.t_assert((select join_ip is null and join_ua is null and join_channel = 'portal' and join_terms_version = 'v1' and join_user_id = member from public.rfq_invites where id = i),
    'b) 보존 기간이 지나면 IP·브라우저만 비우고 나머지 참여 기록은 남는다');

  -- e) 참여 2곳 중 1곳 제출: 참여 기관 수와 안내 수를 따로 돌려준다
  perform pg_temp.t_eq(pg_temp.j(k), 'ok', 'K 참여');
  perform pg_temp.t_invite(rq, pg_temp.t_org('검토미결정'), now(), false);
  declare r jsonb := public.save_quote(k, jsonb_build_object('total_amount', 20000000), '[]'::jsonb, true, null, pg_temp.tok(k));
  begin
    perform pg_temp.t_eq((r->>'total_invites')::int, 3, 'e) 안내 전체 3');
    perform pg_temp.t_eq((r->>'joined_invites')::int, 2, 'e) 참여 기관 2');
    perform pg_temp.t_eq((r->>'submitted_invites')::int, 1, 'e) 제출 1');
  end;
end $$;

do $$
declare
  o uuid := pg_temp.t_org('시범참여기관', 300000, 0.03);
  rq uuid := pg_temp.t_offer('T-JOIN-PILOT', '전체');
  p uuid := pg_temp.t_invite(rq, o, now(), false);
  paid uuid := pg_temp.t_invite(rq, pg_temp.t_org('유료판기관', 300000, 0.03), now(), false);
  l record;
  s record;
begin
  perform pg_temp.t_eq(pg_temp.j(p, 'token', null, 'pilot-2026-10-20b'), 'ok', '시범 판으로 참여');
  perform pg_temp.t_eq(pg_temp.j(paid, 'token', null, 'paid-2027-01'), 'ok', '유료 판으로 참여');
  perform pg_temp.t_eq(pg_temp.t_save(p, pg_temp.tok(p), true), 'ok', '시범 참여 제출');
  perform pg_temp.t_eq(pg_temp.t_save(paid, pg_temp.tok(paid), true), 'ok', '유료 참여 제출');
  update public.cro_quotes set total_amount = 60000000, pdf_path = 'x/q.pdf', start_date = current_date, valid_until = current_date + 30 where invite_id in (p, paid);
  perform public.report_contract(pg_temp.t_award((select id from public.cro_quotes where invite_id = p)), (now() at time zone 'Asia/Seoul')::date, 70000000, '');
  perform pg_temp.t_confirm(a.id) from public.rfq_awards a where a.contract_reported_at is not null and a.contract_confirmed_at is null;

  select * into l from public.billing_lines(pg_temp.t_month(0), pg_temp.t_month(1)) where invite_id = p;
  perform pg_temp.t_eq(l.join_status, 'pilot', 'c) 시범 참여 표시');
  perform pg_temp.t_eq(l.chargeable, false, 'c) 시범 참여 견적은 청구하지 않음');
  perform pg_temp.t_eq(l.fee_due, 0::bigint, 'c) 시범 참여 0원');
  select * into l from public.billing_lines(pg_temp.t_month(0), pg_temp.t_month(1)) where invite_id = paid;
  perform pg_temp.t_eq(l.join_status, 'joined', 'c) 유료 판 참여');
  perform pg_temp.t_eq(l.chargeable, true, 'c) 유료 판 참여 견적은 청구');
  perform pg_temp.t_eq((select invite_joined from public.billing_awards(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = o and kind = 'settlement'), false, 'c) 시범 참여 수주는 합계에 넣지 않음');
  select * into s from public.billing_summary(pg_temp.t_month(0), pg_temp.t_month(1)) where org_id = o;
  perform pg_temp.t_eq(s.per_quote, 0, 'c) 시범 참여 건당 0');
  perform pg_temp.t_eq(s.settled_count, 0, 'c) 시범 참여 정산 0');
  perform pg_temp.t_eq(s.total_due, 0::bigint, 'c) 시범 참여 합계 0');
end $$;

do $$
declare
  rq uuid := pg_temp.t_offer('T-JOIN-SEATCNT', '5곳');
  a uuid := pg_temp.t_invite(rq, pg_temp.t_org('자리A'), now(), false);
  b uuid := pg_temp.t_invite(rq, pg_temp.t_org('자리B'), now(), false);
  c uuid := pg_temp.t_invite(rq, pg_temp.t_org('자리C'), now(), false);
  d uuid := pg_temp.t_invite(rq, pg_temp.t_org('자리D'), now(), false);
  r jsonb;
begin
  perform pg_temp.t_eq(pg_temp.j(a), 'ok', 'A 참여');
  perform pg_temp.t_eq(pg_temp.j(b), 'ok', 'B 참여');
  perform pg_temp.t_eq(pg_temp.j(c), 'ok', 'C 참여');
  perform pg_temp.t_eq(pg_temp.j(d), 'ok', 'D 참여');
  r := public.set_seat_count(rq, '3곳');
  perform pg_temp.t_eq(r->>'code', 'too_few', 'd) 참여 4곳인데 3곳으로 줄이기 거절');
  perform pg_temp.t_eq((r->>'used')::int, 4, 'd) 잠금 안에서 센 참여 수');
  perform pg_temp.t_eq((select cro_count from public.rfq_requests where id = rq), '5곳', 'd) 자리 수 그대로');
  perform pg_temp.t_eq(public.set_seat_count(rq, '10곳')->>'code', 'bad_value', 'd) 잘못된 값');
  perform pg_temp.t_eq(pg_temp.w(d), 'ok', 'D 철회');
  perform pg_temp.t_eq(pg_temp.w(c), 'ok', 'C 철회');
  r := public.set_seat_count(rq, '3곳');
  perform pg_temp.t_eq((r->>'ok')::boolean, true, 'd) 참여 2곳이면 3곳으로 줄일 수 있다');
  perform pg_temp.t_eq(r->>'before', '5곳', 'd) 전 값');
  perform pg_temp.t_eq((select cro_count from public.rfq_requests where id = rq), '3곳', 'd) 자리 수 바뀜');
  update public.rfq_requests set status = 'cancelled' where id = rq;
  perform pg_temp.t_eq(public.set_seat_count(rq, '전체')->>'code', 'closed', 'd) 취소된 요청은 바꾸지 않음');
end $$;
