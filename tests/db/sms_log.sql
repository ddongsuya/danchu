-- 0033: 문자 알림 설정·기록. 직접 접근 차단, 같은 알림 중복 발송 막음
do $$
declare u uuid := pg_temp.t_user('sms-user@example.test', 'requester');
begin
  perform pg_temp.t_eq((select sms_notifications from public.profiles where id = u), true, '문자 알림 기본은 켜짐');
  insert into public.sms_log (user_id, phone_masked, kind, dedupe_key, status) values (u, '010-****-0000', 'compare', 'compare:DC-1', 'sent');
  begin
    insert into public.sms_log (user_id, phone_masked, kind, dedupe_key, status) values (u, '010-****-0000', 'compare', 'compare:DC-1', 'sent');
    raise exception 'ASSERT 실패: 같은 알림 두 번 기록됨';
  exception when unique_violation then null;
  end;
  -- 실패 기록은 여러 번 남을 수 있다
  insert into public.sms_log (user_id, phone_masked, kind, dedupe_key, status) values (u, '010-****-0000', 'invite', 'invite:1', 'failed');
  insert into public.sms_log (user_id, phone_masked, kind, dedupe_key, status) values (u, '010-****-0000', 'invite', 'invite:1', 'failed');
  perform pg_temp.t_assert(not has_table_privilege('authenticated', 'public.sms_log', 'select'), 'authenticated 는 기록을 못 읽음');
  perform pg_temp.t_assert(not has_table_privilege('anon', 'public.sms_log', 'insert'), 'anon 은 못 씀');
end $$;
