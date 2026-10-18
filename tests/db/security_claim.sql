-- 이메일은 미귀속 요청의 일회성 연결에만 쓴다 (0021 claim_rfqs_by_email)
do $$
declare
  a uuid := pg_temp.t_user('old@example.test');
  b uuid;
  r_closed uuid := pg_temp.t_rfq('T-CL-1');
  r_open uuid := pg_temp.t_rfq('T-CL-2');
  r_legacy uuid := pg_temp.t_rfq('T-CL-3');
  r_anon uuid := pg_temp.t_rfq('T-CL-4');
  n int;
begin
  update public.rfq_requests set user_id = a, email = 'old@example.test' where id in (r_closed, r_open);
  update public.rfq_requests set status = 'closed' where id = r_closed;
  -- 접수 때 계정이 없던 요청 1건, 익명화된 미귀속 요청 1건
  update public.rfq_requests set user_id = null, email = 'old@example.test' where id = r_legacy;
  update public.rfq_requests set user_id = null, email = 'old@example.test', anonymized_at = now() where id = r_anon;

  -- A 가 이메일을 바꾼다: 진행 중 요청만 새 주소, 종료 요청은 옛 주소로 남는다 (app/api/profile/email/confirm)
  update auth.users set email = 'new@example.test' where id = a;
  update public.profiles set email = 'new@example.test' where id = a;
  update public.rfq_requests set email = 'new@example.test' where user_id = a and status not in ('closed', 'cancelled');

  -- B 가 A 의 옛 주소로 가입하고 확인 링크를 누른다 (app/api/auth/confirm 이 claim 을 부른다)
  b := pg_temp.t_user('old@example.test');
  n := public.claim_rfqs_by_email(b, 'OLD@example.test');
  perform pg_temp.t_eq(n, 1, '미귀속 요청 1건만 연결');
  perform pg_temp.t_eq((select user_id from public.rfq_requests where id = r_closed), a, 'A 의 종료 요청은 옛 주소가 같아도 A 소유');
  perform pg_temp.t_eq((select user_id from public.rfq_requests where id = r_open), a, 'A 의 진행 요청은 A 소유');
  perform pg_temp.t_eq((select user_id from public.rfq_requests where id = r_legacy), b, '미귀속 요청은 확인된 같은 주소 계정에 연결');
  perform pg_temp.t_assert((select user_id from public.rfq_requests where id = r_anon) is null, '익명화된 요청은 연결하지 않는다');
  perform pg_temp.t_eq(public.claim_rfqs_by_email(b, 'old@example.test'), 0, '두 번째 연결은 없다 (일회성)');

  -- B 탈퇴: 계정 삭제가 A 의 요청을 건드리지 않는다
  delete from auth.users where id = b;
  perform pg_temp.t_eq((select user_id from public.rfq_requests where id = r_closed), a, 'B 삭제 뒤에도 A 소유');
end $$;
