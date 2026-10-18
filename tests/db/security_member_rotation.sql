-- 담당자 제외·이동·삭제, 기관 중지 때 그 기관의 회신 링크를 모두 재발급 (제출 건 포함, 토큰만) · 이동 시 대표 권한 초기화 (0021)
create temp table t_tok on commit drop as select id, token from public.rfq_invites where false;

do $$
declare
  a uuid := pg_temp.t_org('기관A');
  b uuid := pg_temp.t_org('기관B');
  i_sent uuid := pg_temp.t_invite(pg_temp.t_rfq('T-MR-1'), a);
  i_draft uuid := pg_temp.t_invite(pg_temp.t_rfq('T-MR-2'), a);
  i_sub uuid := pg_temp.t_invite(pg_temp.t_rfq('T-MR-3'), a);
  i_b uuid := pg_temp.t_invite(pg_temp.t_rfq('T-MR-4'), b);
  q_sub uuid;
  owner_a uuid := pg_temp.t_user('owner-a@example.test', 'cro', a, 'owner');
  owner_b uuid := pg_temp.t_user('owner-b@example.test', 'cro', b, 'owner');
  leaver uuid := pg_temp.t_user('leaver@example.test', 'cro', a);
  mover uuid := pg_temp.t_user('mover@example.test', 'cro', a);
  gone uuid := pg_temp.t_user('gone@example.test', 'cro', a);
  old_tok text;
  before_reply date;
  before_exp timestamptz;
begin
  perform pg_temp.t_eq(pg_temp.t_save(i_draft, (select token from public.rfq_invites where id = i_draft)), 'ok', '초안');
  q_sub := pg_temp.t_quote(i_sub, 60000000);
  select reply_by, expires_at into before_reply, before_exp from public.rfq_invites where id = i_sub;
  insert into t_tok select id, token from public.rfq_invites;

  -- 1) 담당자 제외 (owner 의 담당자 관리: 소속만 비운다)
  update public.profiles set cro_org_id = null, pending_org_id = null where id = leaver;
  perform pg_temp.t_eq((select count(*) from public.rfq_invites i join t_tok t using (id) where i.cro_org_id = a and i.token = t.token), 0::bigint, '제외 후 A 의 링크 전부 바뀜 (제출 건 포함)');
  perform pg_temp.t_eq((select token from public.rfq_invites where id = i_b), (select token from t_tok where id = i_b), '다른 기관 링크는 그대로');
  old_tok := (select token from t_tok where id = i_sub);
  perform pg_temp.t_eq(pg_temp.t_save(i_sub, old_tok, true), 'revoked', '옛 링크로 제출 수정 거절');
  perform pg_temp.t_eq((select count(*) from public.rfq_invites where token = old_tok), 0::bigint, '옛 토큰으로는 초대를 찾을 수 없다 (회신 화면·업로드·첨부·PDF 모두 토큰 조회)');
  -- 새 링크: 견적·상태·기한 유지
  perform pg_temp.t_eq((select status from public.rfq_invites where id = i_sub), 'submitted', '제출 상태 유지');
  perform pg_temp.t_eq((select reply_by from public.rfq_invites where id = i_sub), before_reply, '회신 기한 유지');
  perform pg_temp.t_eq((select expires_at from public.rfq_invites where id = i_sub), before_exp, '링크 기한 유지');
  perform pg_temp.t_eq((select total_amount from public.cro_quotes where id = q_sub), 60000000::bigint, '견적 금액 유지');
  perform pg_temp.t_eq((select status from public.cro_quotes where invite_id = i_draft), 'draft', '초안 유지');
  perform pg_temp.t_eq(pg_temp.t_save(i_draft, (select token from public.rfq_invites where id = i_draft)), 'ok', '새 링크로 이어서 저장');
  perform pg_temp.t_eq((select status from public.cro_quotes where invite_id = i_draft), 'draft', '새 링크 저장 뒤에도 같은 견적');
  perform pg_temp.t_eq((select count(*) from public.cro_quotes where invite_id = i_draft), 1::bigint, '견적이 새로 생기지 않는다');

  -- 2) 다른 기관으로 이동: 떠난 기관(A)만 재발급, 옮겨 간 기관(B)은 그대로
  delete from t_tok; insert into t_tok select id, token from public.rfq_invites;
  update public.profiles set cro_org_id = b where id = mover;
  perform pg_temp.t_eq((select count(*) from public.rfq_invites i join t_tok t using (id) where i.cro_org_id = a and i.token = t.token), 0::bigint, '이동 후 A 링크 재발급');
  perform pg_temp.t_eq((select token from public.rfq_invites where id = i_b), (select token from t_tok where id = i_b), '이동해 간 B 링크는 그대로');
  perform pg_temp.t_eq(pg_temp.t_save(i_draft, (select token from t_tok where id = i_draft)), 'revoked', '이동 전 링크 거절');
  perform pg_temp.t_eq(pg_temp.t_save(i_b, (select token from public.rfq_invites where id = i_b), false, mover), 'ok', '이동한 담당자는 B 초대를 저장');
  perform pg_temp.t_eq(pg_temp.t_save(i_draft, (select token from public.rfq_invites where id = i_draft), false, mover), 'not_member', '이동한 담당자는 A 의 새 링크를 알아도 거절');

  -- 3) 계정 삭제 (auth.users 삭제 → profiles cascade)
  delete from t_tok; insert into t_tok select id, token from public.rfq_invites;
  delete from auth.users where id = gone;
  perform pg_temp.t_eq((select count(*) from public.rfq_invites i join t_tok t using (id) where i.cro_org_id = a and i.token = t.token), 0::bigint, '담당자 삭제 후 A 링크 재발급');
  perform pg_temp.t_eq((select token from public.rfq_invites where id = i_b), (select token from t_tok where id = i_b), '삭제와 무관한 B 링크는 그대로');

  -- 4) 소속 변화 없는 수정은 재발급하지 않는다
  delete from t_tok; insert into t_tok select id, token from public.rfq_invites;
  update public.profiles set name = '새 이름' where id = owner_a;
  perform pg_temp.t_eq((select count(*) from public.rfq_invites i join t_tok t using (id) where i.token = t.token), (select count(*) from t_tok), '이름만 바꾸면 링크 그대로');
end $$;

-- 기관 이동 시 대표 권한
do $$
declare
  a uuid := pg_temp.t_org('대표A');
  b uuid := pg_temp.t_org('대표B');
  c uuid := pg_temp.t_org('대표C');
  owner_a uuid := pg_temp.t_user('oa@example.test', 'cro', a, 'owner');
  owner_b uuid := pg_temp.t_user('ob@example.test', 'cro', b, 'owner');
  owner_c uuid := pg_temp.t_user('oc@example.test', 'cro', c, 'owner');
  fresh uuid := pg_temp.t_user('fresh@example.test');
begin
  perform pg_temp.t_eq((select org_role from public.profiles where id = owner_a), 'owner', '가입 때 owner 지정 유지 (기관을 처음 만든 계정)');
  -- 운영자 화면에서 A 의 owner 를 B 담당자로 연결
  update public.profiles set role = 'cro', cro_org_id = b, pending_org_id = null where id = owner_a;
  perform pg_temp.t_eq((select org_role from public.profiles where id = owner_a), 'member', 'A 의 owner 가 B 로 옮기면 member');
  perform pg_temp.t_eq((select org_role from public.profiles where id = owner_b), 'owner', 'B 의 기존 owner 유지');
  -- 소속 해제를 거쳐 다른 기관으로 (A → 없음 → B)
  update public.profiles set cro_org_id = null where id = owner_c;
  perform pg_temp.t_eq((select org_role from public.profiles where id = owner_c), 'member', '소속을 비우면 member');
  update public.profiles set cro_org_id = b where id = owner_c;
  perform pg_temp.t_eq((select org_role from public.profiles where id = owner_c), 'member', '나중에 다른 기관에 연결돼도 member');
  -- 기관을 새로 만드는 가입(signup-cro)은 같은 수정에서 owner 를 명시한다
  update public.profiles set role = 'cro', cro_org_id = c, org_role = 'owner' where id = fresh;
  perform pg_temp.t_eq((select org_role from public.profiles where id = fresh), 'owner', '명시한 owner 지정은 남는다');
  -- 이미 owner 인 계정을 옮기면서 owner 를 다시 적어도 따라가지 않는다
  update public.profiles set cro_org_id = a, org_role = 'owner' where id = owner_b;
  perform pg_temp.t_eq((select org_role from public.profiles where id = owner_b), 'member', '옮기면서 owner 를 다시 적어도 member');
end $$;
