-- 0038: 기관 CRM 안건. 실패는 사유가 있어야 하고, 끝난 안건만 closed_at 을 갖는다. 단추 요청 하나는 기관마다 안건 하나
do $$
declare
  o uuid := pg_temp.t_org('CRM 기관');
  r uuid := pg_temp.t_rfq('CRM-1');
  inv uuid := pg_temp.t_invite(r, o);
  c uuid;
  d uuid;
begin
  insert into public.cro_crm_companies (org_id, name) values (o, '가람바이오') returning id into c;
  insert into public.cro_crm_deals (org_id, company_id, title, source, invite_id) values (o, c, '13주 반복투여독성', 'danchu', inv) returning id into d;
  perform pg_temp.t_eq((select stage from public.cro_crm_deals where id = d), 'inquiry', '새 안건은 문의 단계');
  perform pg_temp.t_eq((select status from public.cro_crm_deals where id = d), 'open', '새 안건은 진행');

  -- 같은 초대로 두 번째 안건은 안 된다 (같은 기관)
  begin
    insert into public.cro_crm_deals (org_id, title, source, invite_id) values (o, '중복', 'danchu', inv);
    raise exception 'ASSERT 실패: 같은 단추 요청으로 안건 두 개';
  exception when unique_violation then null;
  end;

  -- 실패는 사유가 있어야 한다
  begin
    update public.cro_crm_deals set status = 'lost', closed_at = now() where id = d;
    raise exception 'ASSERT 실패: 사유 없는 실패';
  exception when check_violation then null;
  end;
  -- 끝난 안건은 closed_at 이 있어야 한다
  begin
    update public.cro_crm_deals set status = 'won' where id = d;
    raise exception 'ASSERT 실패: closed_at 없는 수주';
  exception when check_violation then null;
  end;
  update public.cro_crm_deals set status = 'lost', closed_at = now(), lost_reason = '가격' where id = d;
  perform pg_temp.t_eq((select lost_reason from public.cro_crm_deals where id = d), '가격', '사유와 함께 실패');

  -- 단계 이력: 안건을 지우면 같이 지워진다
  insert into public.cro_crm_deal_history (org_id, deal_id, to_stage, to_status, actor) values (o, d, 'inquiry', 'open', 'danchu');
  insert into public.cro_crm_activities (org_id, deal_id, kind, body) values (o, d, 'memo', '고객사 없이 안건에만 붙은 메모');
  delete from public.cro_crm_deals where id = d;
  perform pg_temp.t_eq((select count(*)::int from public.cro_crm_deal_history where deal_id = d), 0, '안건과 이력이 함께 지워짐');
  perform pg_temp.t_eq((select count(*)::int from public.cro_crm_activities where deal_id = d), 0, '안건과 기록이 함께 지워짐');

  perform pg_temp.t_assert(not has_table_privilege('authenticated', 'public.cro_crm_deals', 'select'), 'authenticated 는 안건을 못 읽음');
  perform pg_temp.t_assert(not has_table_privilege('anon', 'public.cro_crm_deal_history', 'insert'), 'anon 은 이력을 못 씀');
  perform pg_temp.t_eq(public.danchu_schema_version(), 44, '판 44');
end $$;
