-- 보안 리뷰 수정 (2026-10-18): 대표 메일 담당자가 떠나면 대표 메일 비움 · 계정 삭제로 비워진 요청은 재연결 안 함 ·
-- 소속 없는 계정의 토큰 회신 · 토큰 함수 search_path (0021, 0022)

-- 1) 대표 메일로 쓰던 담당자가 떠나면 같은 트랜잭션에서 대표 메일을 비우고 운영자·남은 대표에게 알린다
do $$
declare
  a uuid := pg_temp.t_org('대표메일기관');
  i uuid := pg_temp.t_invite(pg_temp.t_rfq('T-SR-1'), a);
  ops uuid := pg_temp.t_user('ops@example.test', 'admin');
  owner2 uuid := pg_temp.t_user('owner2@example.test', 'cro', a, 'owner');
  rep uuid := pg_temp.t_user('Rep@Example.test', 'cro', a, 'owner');
  other uuid := pg_temp.t_user('other@example.test', 'cro', a);
  old_tok text;
begin
  update public.cro_orgs set contact_email = 'rep@example.test' where id = a;

  -- 대표 메일이 아닌 담당자가 떠나면 대표 메일은 그대로
  update public.profiles set cro_org_id = null where id = other;
  perform pg_temp.t_eq((select contact_email from public.cro_orgs where id = a), 'rep@example.test', '다른 담당자가 떠나도 대표 메일 유지');
  perform pg_temp.t_eq((select count(*) from public.notifications where title like '대표메일기관 대표 이메일%')::int, 0, '알림 없음');

  -- 대표 메일 주인이 떠난다 (대소문자 달라도 같은 주소)
  old_tok := (select token from public.rfq_invites where id = i);
  update public.profiles set cro_org_id = null where id = rep;
  perform pg_temp.t_assert((select contact_email from public.cro_orgs where id = a) is null, '대표 메일을 비운다');
  perform pg_temp.t_assert((select token from public.rfq_invites where id = i) <> old_tok, '링크도 재발급');
  perform pg_temp.t_eq((select count(*) from public.notifications where user_id = ops and href = '/admin/cros/' || a::text)::int, 1, '운영자에게 알림');
  perform pg_temp.t_eq((select count(*) from public.notifications where user_id = owner2 and href = '/cro/org')::int, 1, '남은 대표에게 알림');
  perform pg_temp.t_eq((select count(*) from public.notifications where user_id = rep)::int, 0, '떠난 사람에게는 알리지 않는다');
end $$;

-- 계정 삭제로 떠나도 같다
do $$
declare
  a uuid := pg_temp.t_org('삭제대표기관');
  rep uuid := pg_temp.t_user('gone-rep@example.test', 'cro', a, 'owner');
begin
  update public.cro_orgs set contact_email = 'gone-rep@example.test' where id = a;
  delete from auth.users where id = rep;
  perform pg_temp.t_assert((select contact_email from public.cro_orgs where id = a) is null, '계정 삭제 때도 대표 메일을 비운다');
end $$;

-- 2) 계정이 지워져 user_id 가 비워진 요청은 같은 주소로 가입한 다른 사람에게 연결하지 않는다
do $$
declare
  a uuid := pg_temp.t_user('leaver@example.test');
  b uuid;
  r_own uuid := pg_temp.t_rfq('T-SR-2');
  r_legacy uuid := pg_temp.t_rfq('T-SR-3');
begin
  update public.rfq_requests set user_id = a, email = 'leaver@example.test' where id = r_own;
  update public.rfq_requests set email = 'leaver@example.test' where id = r_legacy;
  -- 탈퇴 정리(익명화)가 실패한 채 계정이 지워진 경우 (on delete set null)
  delete from auth.users where id = a;
  perform pg_temp.t_assert((select user_id from public.rfq_requests where id = r_own) is null, 'user_id 는 비워진다');
  perform pg_temp.t_assert((select orphaned_at from public.rfq_requests where id = r_own) is not null, '계정이 지워진 요청 표시');
  perform pg_temp.t_assert((select orphaned_at from public.rfq_requests where id = r_legacy) is null, '처음부터 계정 없던 요청은 표시 없음');

  b := pg_temp.t_user('leaver@example.test');
  perform pg_temp.t_eq(public.claim_rfqs_by_email(b, 'leaver@example.test'), 1, '처음부터 계정 없던 요청만 연결');
  perform pg_temp.t_assert((select user_id from public.rfq_requests where id = r_own) is null, '탈퇴자 요청은 연결하지 않는다');
  update public.rfq_requests set orphaned_at = null where id = r_own;
  perform pg_temp.t_assert((select orphaned_at from public.rfq_requests where id = r_own) is not null, '표시는 지울 수 없다');
end $$;

-- 3) 소속 없는 기관 계정(합류 신청 중)은 토큰으로 판단한다. 다른 기관 소속 계정은 계속 거절
do $$
declare
  a uuid := pg_temp.t_org('토큰기관');
  b uuid := pg_temp.t_org('다른기관');
  i uuid := pg_temp.t_invite(pg_temp.t_rfq('T-SR-4'), a);
  pending uuid := pg_temp.t_user('pending@example.test', 'cro');
  stranger uuid := pg_temp.t_user('stranger2@example.test', 'cro', b);
  tok text := (select token from public.rfq_invites where id = i);
begin
  update public.profiles set pending_org_id = a where id = pending;
  perform pg_temp.t_eq(pg_temp.t_save(i, tok, false, stranger), 'not_member', '다른 기관 담당자는 거절');
  perform pg_temp.t_eq(pg_temp.t_save(i, tok, false, pending), 'ok', '소속 없는 계정은 토큰으로 저장');
  perform pg_temp.t_eq(pg_temp.t_save(i, 'wrong-token', false, pending), 'revoked', '토큰이 틀리면 거절');
end $$;

-- 4) 토큰을 만드는 security definer 함수는 pg_catalog, extensions 를 public 보다 먼저 찾는다
do $$
declare f text;
begin
  foreach f in array array['revoke_invite', 'rotate_org_invite_tokens', 'profiles_org_left', 'cro_orgs_deactivated'] loop
    perform pg_temp.t_eq(
      (select array_to_string(p.proconfig, ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = f),
      'search_path=pg_catalog, extensions, public', f || ' search_path');
  end loop;
end $$;
