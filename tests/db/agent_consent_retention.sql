-- 견적 에이전트 동의 기록 보존 (0049). 처리방침 3항: "동의를 철회하거나 탈퇴한 날부터 3년".
-- 1) 계정을 지워도 동의 기록은 남는다 (0046 의 on delete cascade 를 뺐다)
-- 2) 탈퇴 표시(account_deleted_at)와 철회 시각이 함께 남는다
-- 3) 에이전트 삭제 요청 대기열: 같은 계정·사유는 열린 줄 하나만, 직접 접근은 막힌다
do $$
declare
  u uuid := pg_temp.t_user('agent-keep@example.test');
  n int;
  denied boolean := false;
begin
  insert into public.agent_consents (user_id, version) values (u, '2026-11-17');
  update public.agent_consents set revoked_at = now(), account_deleted_at = now() where user_id = u;
  insert into public.agent_purge_requests (user_id, reason) values (u, 'account_deleted');
  delete from auth.users where id = u;

  perform pg_temp.t_eq((select count(*)::int from public.profiles where id = u), 0, '프로필은 지워진다');
  select count(*)::int into n from public.agent_consents where user_id = u and revoked_at is not null and account_deleted_at is not null;
  perform pg_temp.t_eq(n, 1, '탈퇴 뒤에도 동의 기록이 철회·탈퇴 시각과 함께 남는다');
  perform pg_temp.t_eq((select count(*)::int from public.agent_purge_requests where user_id = u and done_at is null), 1, '삭제 요청은 계정이 지워져도 남는다');

  -- 같은 계정·사유의 열린 요청은 하나만
  begin
    insert into public.agent_purge_requests (user_id, reason) values (u, 'account_deleted');
  exception when unique_violation then denied := true;
  end;
  perform pg_temp.t_assert(denied, '열린 삭제 요청 중복 거절');
  update public.agent_purge_requests set done_at = now() where user_id = u;
  insert into public.agent_purge_requests (user_id, reason) values (u, 'account_deleted');
  perform pg_temp.t_eq((select count(*)::int from public.agent_purge_requests where user_id = u), 2, '처리된 뒤에는 새 요청을 받는다');

  -- 사유는 정해진 값만
  denied := false;
  begin
    insert into public.agent_purge_requests (user_id, reason) values (u, 'other');
  exception when check_violation then denied := true;
  end;
  perform pg_temp.t_assert(denied, '사유 값 검사');

  perform pg_temp.t_assert((select relrowsecurity from pg_class where oid = 'public.agent_purge_requests'::regclass), 'RLS 켜짐');
  perform pg_temp.t_assert(public.danchu_schema_version() >= 49, '스키마 판 49 이상');
end $$;
