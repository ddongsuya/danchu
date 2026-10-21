-- 초대 철회(revoked_at)와 save_quote 잠금 뒤 재검사 (0021)
do $$
declare
  o uuid := pg_temp.t_org('철회기관');
  other uuid := pg_temp.t_org('다른기관');
  rq uuid := pg_temp.t_rfq('T-RV-1');
  inv uuid := pg_temp.t_invite(rq, o);
  inv2 uuid := pg_temp.t_invite(rq, other);
  t_before text;
  t_after text;
  res jsonb;
  op uuid := pg_temp.t_user('ops@example.test', 'admin');
  stranger uuid := pg_temp.t_user('stranger@example.test', 'cro', other);
  member uuid := pg_temp.t_user('member@example.test', 'cro', o);
begin
  -- 정상: 지금 토큰이면 초안 저장
  select token into t_before from public.rfq_invites where id = inv;
  perform pg_temp.t_eq(pg_temp.t_save(inv, t_before), 'ok', '지금 토큰으로 초안 저장');
  perform pg_temp.t_eq(pg_temp.t_save(inv, 'wrong-token-000'), 'revoked', '다른 토큰은 거절');
  perform pg_temp.t_eq(pg_temp.t_save(inv, null), 'revoked', '토큰 없이 저장 불가');
  perform pg_temp.t_eq(pg_temp.t_save(inv, t_before, false, member), 'ok', '소속 담당자 저장');
  perform pg_temp.t_eq(pg_temp.t_save(inv, t_before, false, stranger), 'not_member', '다른 기관 담당자는 토큰이 있어도 거절');

  -- 경합: 라우트가 화면 검사를 마친 직후(t_before 를 쥔 채) 운영자가 취소한다 → 저장은 잠금 뒤 재검사로 거절
  res := public.revoke_invite(inv, '잘못 보낸 기관');
  perform pg_temp.t_eq((res->>'ok')::boolean, true, '취소 성공');
  perform pg_temp.t_eq(pg_temp.t_save(inv, t_before, true), 'revoked', '검사 직후 철회돼도 제출 거절');
  perform pg_temp.t_eq(pg_temp.t_save(inv, t_before, false), 'revoked', '검사 직후 철회돼도 초안 거절');
  select token into t_after from public.rfq_invites where id = inv;
  perform pg_temp.t_assert(t_after <> t_before, '취소하면 토큰도 바뀐다');
  perform pg_temp.t_eq(pg_temp.t_save(inv, t_after), 'revoked', '새 토큰이어도 철회된 초대는 거절');
  perform pg_temp.t_eq(pg_temp.t_save(inv, t_after, false, op), 'revoked', '운영자 대리 입력도 철회된 초대는 거절');
  perform pg_temp.t_eq((select status from public.rfq_invites where id = inv), 'expired', '상태 expired');
  perform pg_temp.t_eq((select billable from public.rfq_invites where id = inv), false, '청구 제외');
  perform pg_temp.t_eq((select bill_excluded_reason from public.rfq_invites where id = inv), '잘못 보낸 기관', '사유');
  perform pg_temp.t_eq((public.revoke_invite(inv, 'x')->>'already')::boolean, true, '다시 취소해도 그대로');

  -- 요청 재개(취소 → 다시 열기)가 만료 초대를 되살려도 개별 철회는 남는다
  update public.rfq_requests set status = 'cancelled' where id = rq;
  update public.rfq_invites set status = 'expired' where rfq_id = rq and status in ('sent', 'draft');
  update public.rfq_requests set status = 'distributed' where id = rq;
  update public.rfq_invites set status = 'sent' where rfq_id = rq and status = 'expired';
  perform pg_temp.t_eq((select status from public.rfq_invites where id = inv), 'expired', '재개해도 철회 초대는 expired');
  perform pg_temp.t_assert((select revoked_at from public.rfq_invites where id = inv) is not null, '철회 시각 유지');
  update public.rfq_invites set revoked_at = null where id = inv;
  perform pg_temp.t_assert((select revoked_at from public.rfq_invites where id = inv) is not null, '철회 시각은 지울 수 없다');
  perform pg_temp.t_eq((select status from public.rfq_invites where id = inv2), 'sent', '취소하지 않은 초대는 되살아난다');
  perform pg_temp.t_eq(pg_temp.t_save(inv2, (select token from public.rfq_invites where id = inv2)), 'ok', '다른 기관 초대는 그대로 저장');

  -- 제출된 초대는 거둘 수 없다
  perform pg_temp.t_save(inv2, (select token from public.rfq_invites where id = inv2), true);
  perform pg_temp.t_eq(public.revoke_invite(inv2, null)->>'code', 'not_open', '제출된 초대는 취소 불가');
end $$;

-- 만료·회신하지 않음·기관 중지
do $$
declare
  o uuid := pg_temp.t_org('기한기관');
  rq uuid := pg_temp.t_rfq('T-RV-2');
  inv uuid := pg_temp.t_invite(rq, o);
  inv_d uuid := pg_temp.t_invite(pg_temp.t_rfq('T-RV-3'), o);
  op uuid := pg_temp.t_user('ops2@example.test', 'admin');
  t text;
begin
  update public.rfq_invites set expires_at = now() - interval '1 hour' where id = inv;
  select token into t from public.rfq_invites where id = inv;
  perform pg_temp.t_eq(pg_temp.t_save(inv, t), 'expired', '링크 기한이 지나면 거절');
  perform pg_temp.t_eq(pg_temp.t_save(inv, t, false, op), 'ok', '운영자 대리 입력은 기한 만료만 면제');

  update public.rfq_invites set status = 'declined', declined_at = now() where id = inv_d;
  perform pg_temp.t_eq(pg_temp.t_save(inv_d, (select token from public.rfq_invites where id = inv_d)), 'declined', '회신하지 않음 처리된 초대는 거절');

  update public.rfq_invites set expires_at = now() + interval '7 days' where id = inv;
  update public.cro_orgs set status = 'suspended' where id = o;
  perform pg_temp.t_assert((select token from public.rfq_invites where id = inv) <> t, '기관 중지 때 토큰 재발급');
  perform pg_temp.t_eq(pg_temp.t_save(inv, (select token from public.rfq_invites where id = inv)), 'org_inactive', '중지된 기관은 새 토큰이어도 거절');
end $$;
