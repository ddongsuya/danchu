-- 견적 에이전트 실행 기록 (0050). 액션 등록부(lib/agent-actions.ts)가 쓴다.
-- 1) 되돌리기는 바로 실행(auto)·대상이 있는 줄만, 동작 이름·요청 번호 모양 검사
-- 2) 탈퇴하면 계정과 함께 지워진다 (처리방침 3항 "탈퇴하거나 철회할 때까지")
-- 3) 서버만 읽고 쓴다 (RLS 켜짐, anon·authenticated 권한 없음)
do $$
declare
  u uuid := pg_temp.t_user('agent-log@example.test');
  org uuid := pg_temp.t_org('기록 기관');
  denied boolean;
begin
  insert into public.agent_action_log (user_id, org_id, role, action, level, target_kind, target_id, undo, before, after_updated_at, status)
    values (u, org, 'cro', 'task_update', 'auto', 'tasks', gen_random_uuid(), 'patch', '{"due_on":"2026-11-20"}', now(), 200);
  insert into public.agent_action_log (user_id, role, action, level, rfq_no, status) values (u, 'requester', 'ask', 'confirm', 'DC-2026-0142', 200);
  perform pg_temp.t_eq((select count(*)::int from public.agent_action_log where user_id = u), 2, '바로 실행·확인 후 실행 기록');

  denied := false;
  begin
    insert into public.agent_action_log (user_id, role, action, level, undo, status) values (u, 'cro', 'task_create', 'auto', 'delete', 200);
  exception when check_violation then denied := true;
  end;
  perform pg_temp.t_assert(denied, '대상 없는 되돌리기 거절');

  denied := false;
  begin
    insert into public.agent_action_log (user_id, role, action, level, target_kind, target_id, undo, status) values (u, 'cro', 'ask', 'confirm', 'tasks', gen_random_uuid(), 'delete', 200);
  exception when check_violation then denied := true;
  end;
  perform pg_temp.t_assert(denied, '확인 후 실행은 되돌리지 않는다');

  denied := false;
  begin
    insert into public.agent_action_log (user_id, role, action, level, status) values (u, 'cro', 'Drop Table', 'auto', 200);
  exception when check_violation then denied := true;
  end;
  perform pg_temp.t_assert(denied, '동작 이름 모양 검사');

  denied := false;
  begin
    insert into public.agent_action_log (user_id, role, action, level, rfq_no, status) values (u, 'cro', 'ask', 'confirm', 'R-1', 200);
  exception when check_violation then denied := true;
  end;
  perform pg_temp.t_assert(denied, '요청 번호 모양 검사');

  delete from auth.users where id = u;
  perform pg_temp.t_eq((select count(*)::int from public.agent_action_log where user_id = u), 0, '탈퇴하면 실행 기록도 지워진다');

  perform pg_temp.t_assert((select relrowsecurity from pg_class where oid = 'public.agent_action_log'::regclass), 'RLS 켜짐');
  perform pg_temp.t_assert(not has_table_privilege('anon', 'public.agent_action_log', 'select'), 'anon 읽기 막힘');
  perform pg_temp.t_assert(not has_table_privilege('authenticated', 'public.agent_action_log', 'insert'), 'authenticated 쓰기 막힘');
  perform pg_temp.t_assert(public.danchu_schema_version() >= 50, '스키마 판 50 이상');
end $$;
