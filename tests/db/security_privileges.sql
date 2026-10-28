-- 직접 접근 차단 (0023 기준 전체 스키마). 대역(supabase-stubs.sql)이 Supabase 처럼 public 의 새 표·함수를 anon·authenticated·service_role 에
-- 모두 열어 두므로, 여기서 막히는 것은 마이그레이션의 RLS·revoke 덕분이다.
-- 업무 표: RLS 켜짐, 정책 없음 → anon·authenticated 는 읽기 0행, 쓰기 거절. service_role 은 RLS 를 우회해 읽는다
-- 핵심 RPC·security definer 함수: anon·authenticated 실행 불가, service_role 실행 가능

do $$
declare
  o uuid := pg_temp.t_org('권한기관');
  rq uuid := pg_temp.t_rfq('T-PRIV-1');
  inv uuid := pg_temp.t_invite(rq, o);
  q uuid := pg_temp.t_quote(inv, 20000000);
  u uuid := pg_temp.t_user('priv@example.test');
  t record;
  r text;
  n bigint;
  tables text[];
  seen jsonb := '{}'::jsonb;   -- "역할/표" → 읽은 행 수 (-1 은 권한 거절)
  wrote jsonb := '{}'::jsonb;  -- "역할/표/쓰기" → 'denied' 또는 바뀐 행 수
  k text;
begin
  perform pg_temp.t_award(q);
  insert into public.notifications (user_id, kind, title) values (u, '테스트', '권한 확인');
  insert into public.rfq_events (rfq_id, kind, title) values (rq, 'test', '권한 확인');

  select array_agg(c.relname::text order by c.relname) into tables
    from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relkind in ('r', 'p');
  perform pg_temp.t_assert(array_length(tables, 1) >= 18, '업무 표 목록');

  -- 모든 업무 표에 RLS
  for t in select c.relname, c.relrowsecurity from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
            where ns.nspname = 'public' and c.relkind in ('r', 'p') loop
    perform pg_temp.t_assert(t.relrowsecurity, 'RLS 켜짐: ' || t.relname);
  end loop;
  -- 정책이 하나도 없다 (서버만 service role 로 접근하는 설계)
  perform pg_temp.t_eq((select count(*)::int from pg_policies where schemaname = 'public'), 0, 'public 표에 RLS 정책 없음');
  -- 뷰도 없다 (뷰는 RLS 를 우회할 수 있다)
  perform pg_temp.t_eq((select count(*)::int from pg_class c join pg_namespace ns on ns.oid = c.relnamespace where ns.nspname = 'public' and c.relkind in ('v', 'm')), 0, 'public 뷰 없음');

  -- anon·authenticated 로 모든 표 읽기·쓰기 시도. 판정은 역할을 되돌린 뒤에 한다 (pg_temp 도우미는 postgres 소유)
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  foreach r in array array['anon', 'authenticated'] loop
    execute format('set local role %I', r);
    foreach k in array tables loop
      begin
        execute format('select count(*) from public.%I', k) into n;
      exception when insufficient_privilege then n := -1;
      end;
      seen := seen || jsonb_build_object(r || '/' || k, n);
      begin
        execute format('delete from public.%I', k);
        get diagnostics n = row_count;
        wrote := wrote || jsonb_build_object(r || '/' || k || '/delete', n);
      exception when insufficient_privilege then
        wrote := wrote || jsonb_build_object(r || '/' || k || '/delete', 'denied');
      end;
    end loop;
    begin
      insert into public.rfq_requests (rfq_no, company, contact_name, email, substance, payload, categories)
      values ('T-PRIV-X', 'x', 'x', 'x@example.test', 'x', '{}', '{}');
      wrote := wrote || jsonb_build_object(r || '/rfq_requests/insert', 'inserted');
    exception when insufficient_privilege then
      wrote := wrote || jsonb_build_object(r || '/rfq_requests/insert', 'denied');
    end;
    begin
      update public.cro_quotes set total_amount = 1;
      get diagnostics n = row_count;
      wrote := wrote || jsonb_build_object(r || '/cro_quotes/update', n);
    exception when insufficient_privilege then
      wrote := wrote || jsonb_build_object(r || '/cro_quotes/update', 'denied');
    end;
    reset role;
  end loop;

  foreach r in array array['anon', 'authenticated'] loop
    foreach k in array tables loop
      perform pg_temp.t_assert((seen->>(r || '/' || k))::bigint <= 0, r || ' 이 ' || k || ' 를 읽지 못한다 (읽은 행 ' || (seen->>(r || '/' || k)) || ')');
      perform pg_temp.t_assert(wrote->>(r || '/' || k || '/delete') in ('0', 'denied'), r || ' 이 ' || k || ' 를 지우지 못한다 (' || (wrote->>(r || '/' || k || '/delete')) || ')');
    end loop;
    perform pg_temp.t_eq(wrote->>(r || '/rfq_requests/insert'), 'denied', r || ' 이 요청을 직접 만들지 못한다');
    perform pg_temp.t_assert(wrote->>(r || '/cro_quotes/update') in ('0', 'denied'), r || ' 이 견적을 직접 고치지 못한다');
  end loop;
  -- 실제 데이터가 있어 위 0행이 의미가 있다
  perform pg_temp.t_assert((select count(*) from public.rfq_requests where id = rq) = 1, '요청 데이터 있음');
  perform pg_temp.t_assert((select count(*) from public.rfq_awards where rfq_id = rq) = 1, '수주 데이터 있음');
  perform pg_temp.t_eq((select total_amount from public.cro_quotes where id = q), 20000000::bigint, '견적 금액 그대로');

  -- service_role 은 RLS 를 우회해 읽는다 (서버 경로)
  set local role service_role;
  select count(*) into n from public.cro_quotes where id = q;
  reset role;
  perform pg_temp.t_eq(n, 1::bigint, 'service_role 은 견적을 읽는다');
end $$;

-- 함수 실행 권한
do $$
declare
  core text[] := array[
    'public.save_quote(uuid, jsonb, jsonb, boolean, uuid, text)',
    'public.select_quote(uuid, uuid, uuid, integer)',
    'public.report_contract(uuid, date, bigint, text, boolean)',
    'public.revoke_invite(uuid, text)',
    'public.rotate_org_invite_tokens(uuid)',
    'public.claim_rfqs_by_email(uuid, text)',
    'public.billing_summary(date, date)',
    'public.billing_lines(date, date)',
    'public.billing_awards(date, date)',
    'public.billing_snapshot(date, date)',
    'public.close_billing_month(date, uuid, text)',
    'public.rate_limit_hit(text, integer, integer)',
    'public.rate_limit_cleanup()',
    'public.next_rfq_no(integer)',
    'public.danchu_schema_version()',
    'public.join_offer(uuid, text, uuid, text, text, text, text)',
    'public.withdraw_offer(uuid, text, uuid, text)',
    'public.offer_seat_state(uuid)',
    'public.set_seat_count(uuid, text)',
    'public.add_billing_adjustment(uuid, date, bigint, text, date, uuid)',
    'public.billing_adjustment_lines(date, date)',
    'public.billing_reference(date, date)',
    'public.billing_month_lock(date)',
    'public.billing_reference_per_quote_fee()',
    'public.billing_reference_success_rate()',
    'public.compare_readiness(uuid)',
    'public.open_comparison_if_ready(uuid)',
    'public.open_ready_comparisons()',
    'public.confirm_contract(uuid, uuid)',
    'public.dispute_contract(uuid, uuid, text)',
    'public.resolve_contract_dispute(uuid, uuid, text, text)',
    'public.auto_confirm_contracts()',
    'public.auth_user_confirmed(uuid)'
  ];
  f text;
  p regprocedure;
  fn record;
  r text;
  denied jsonb := '{}'::jsonb;
  res jsonb;
  v int;
begin
  foreach f in array core loop
    p := to_regprocedure(f);
    perform pg_temp.t_assert(p is not null, '함수 있음: ' || f);
    perform pg_temp.t_assert(not has_function_privilege('anon', p, 'execute'), 'anon 실행 불가: ' || f);
    perform pg_temp.t_assert(not has_function_privilege('authenticated', p, 'execute'), 'authenticated 실행 불가: ' || f);
    perform pg_temp.t_assert(has_function_privilege('service_role', p, 'execute'), 'service_role 실행 가능: ' || f);
  end loop;

  -- security definer 함수는 하나도 공개 실행되지 않는다 (트리거 함수 포함)
  for fn in select p2.oid, p2.proname from pg_proc p2 join pg_namespace ns on ns.oid = p2.pronamespace
             where ns.nspname = 'public' and p2.prosecdef loop
    perform pg_temp.t_assert(not has_function_privilege('anon', fn.oid, 'execute'), 'anon 실행 불가(security definer): ' || fn.proname);
    perform pg_temp.t_assert(not has_function_privilege('authenticated', fn.oid, 'execute'), 'authenticated 실행 불가(security definer): ' || fn.proname);
  end loop;

  -- 실제 호출: anon·authenticated 는 거절, service_role 은 실행된다
  foreach r in array array['anon', 'authenticated'] loop
    execute format('set local role %I', r);
    begin
      perform public.select_quote(gen_random_uuid(), gen_random_uuid(), null, 1);
      denied := denied || jsonb_build_object(r || '/select_quote', false);
    exception when insufficient_privilege then
      denied := denied || jsonb_build_object(r || '/select_quote', true);
    end;
    begin
      perform public.save_quote(gen_random_uuid(), '{}'::jsonb, '[]'::jsonb, false, null, 'x');
      denied := denied || jsonb_build_object(r || '/save_quote', false);
    exception when insufficient_privilege then
      denied := denied || jsonb_build_object(r || '/save_quote', true);
    end;
    begin
      perform public.billing_summary(current_date, current_date + 1);
      denied := denied || jsonb_build_object(r || '/billing_summary', false);
    exception when insufficient_privilege then
      denied := denied || jsonb_build_object(r || '/billing_summary', true);
    end;
    reset role;
  end loop;
  foreach r in array array['anon', 'authenticated'] loop
    perform pg_temp.t_eq((denied->>(r || '/select_quote'))::boolean, true, r || ' select_quote 호출 거절');
    perform pg_temp.t_eq((denied->>(r || '/save_quote'))::boolean, true, r || ' save_quote 호출 거절');
    perform pg_temp.t_eq((denied->>(r || '/billing_summary'))::boolean, true, r || ' billing_summary 호출 거절');
  end loop;

  set local role service_role;
  res := public.select_quote(gen_random_uuid(), gen_random_uuid(), null, 1);
  v := public.danchu_schema_version();
  reset role;
  perform pg_temp.t_eq(res->>'code', 'not_found', 'service_role 은 select_quote 를 실행한다');
  perform pg_temp.t_eq(v, 29, 'service_role 은 스키마 판을 읽는다');
end $$;
