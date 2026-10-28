-- 견적 일정 (0029): save_quote 가 일정 단계·최종보고서 주·항목별 보고서 주수·앞 단계를 저장하고,
-- 일정만 바꿔 다시 제출해도 판이 오르며, 비교표가 열린 뒤에는 일정도 직접 고칠 수 없다. 숫자는 임의 값
create or replace function pg_temp.tok(p_invite uuid) returns text
language sql as $$ select token from public.rfq_invites where id = p_invite $$;
create or replace function pg_temp.sched(p_invite uuid, p_final int, p_after int[]) returns jsonb
language sql as $$
  select public.save_quote(p_invite,
    jsonb_build_object('total_amount', 1000, 'note', 'n', 'pdf_path', 'x/q.pdf', 'start_date', current_date, 'valid_until', current_date + 30,
      'schedule_steps', jsonb_build_array(jsonb_build_object('seq', 101, 'name', '단계 A', 'weeks', 3, 'after', '[]'::jsonb)),
      'final_report_weeks', p_final - 2, 'final_weeks', p_final),
    jsonb_build_array(jsonb_build_object('seq', 1, 'category', '일반독성', 'name', '시험 가', 'avail', '가능', 'amount', 1000, 'weeks', 6,
      'report_weeks', 2, 'translation_weeks', 2, 'after_seqs', to_jsonb(p_after))),
    true, null, pg_temp.tok(p_invite))
$$;
create or replace function pg_temp.try(p_sql text) returns text
language plpgsql as $$
begin
  execute p_sql;
  return 'none';
exception when others then
  return sqlerrm;
end $$;

do $$
declare
  a uuid := pg_temp.t_org('일정A');
  b uuid := pg_temp.t_org('일정B');
  rq uuid := pg_temp.t_rfq('T-SCHED-1');
  ia uuid;
  ib uuid;
  qa uuid;
  rev int;
  r text;
begin
  update public.rfq_requests set join_by = now() - interval '1 day', reply_by = (now() at time zone 'Asia/Seoul')::date + 5 where id = rq;
  ia := pg_temp.t_invite(rq, a);
  ib := pg_temp.t_invite(rq, b);
  perform pg_temp.t_eq((pg_temp.sched(ia, 13, array[101])->>'ok')::boolean, true, '일정 포함 제출');
  select id, revision into qa, rev from public.cro_quotes where invite_id = ia;
  perform pg_temp.t_eq((select final_weeks from public.cro_quotes where id = qa), 13, '최종 주 저장');
  perform pg_temp.t_eq((select final_report_weeks from public.cro_quotes where id = qa), 11, '국문 최종보고서 주 저장');
  perform pg_temp.t_eq((select schedule_steps->0->>'name' from public.cro_quotes where id = qa), '단계 A', '일정 단계 저장');
  perform pg_temp.t_eq((select report_weeks from public.cro_quote_items where quote_id = qa and seq = 1), 2, '보고서 주수 저장');
  perform pg_temp.t_eq((select after_seqs from public.cro_quote_items where quote_id = qa and seq = 1), array[101], '앞 단계 저장');

  -- 일정만 바꿔 다시 제출: 판이 오른다 (의뢰자가 본 판과 다른 견적이 선정되지 않게)
  perform pg_temp.sched(ia, 15, array[]::int[]);
  perform pg_temp.t_assert((select revision from public.cro_quotes where id = qa) > rev, '일정 변경도 판을 올린다');
  perform pg_temp.t_eq((select after_seqs from public.cro_quote_items where quote_id = qa and seq = 1), array[]::int[], '앞 단계 비움 반영');

  -- 비교표가 열린 뒤에는 일정도 직접 고칠 수 없다
  perform pg_temp.sched(ib, 12, array[101]);
  perform pg_temp.t_assert((select compared_at is not null from public.rfq_requests where id = rq), '모두 제출: 비교표 열림');
  r := pg_temp.try(format('update public.cro_quotes set final_weeks = 1 where id = %L', qa));
  perform pg_temp.t_assert(r like 'compare_locked:%', '열린 뒤 최종 주 직접 수정 거절: ' || r);
  r := pg_temp.try(format('update public.cro_quote_items set report_weeks = 9 where quote_id = %L', qa));
  perform pg_temp.t_assert(r like 'compare_locked:%', '열린 뒤 보고서 주수 직접 수정 거절: ' || r);
end $$;

-- 학습 표: 기관당 단계 이름 하나, 주수 범위, 공개 역할은 읽지 못한다
do $$
declare
  a uuid := pg_temp.t_org('일정학습');
  r text;
begin
  insert into public.cro_schedule_steps (org_id, name, weeks) values (a, '단계 A', 3);
  r := pg_temp.try(format($q$insert into public.cro_schedule_steps (org_id, name, weeks) values (%L, '단계 A', 4)$q$, a));
  perform pg_temp.t_assert(r <> 'none', '같은 기관 같은 이름 중복 거절');
  r := pg_temp.try(format($q$insert into public.cro_schedule_steps (org_id, name, weeks) values (%L, '단계 B', 0)$q$, a));
  perform pg_temp.t_assert(r <> 'none', '0주 거절');
  perform pg_temp.t_assert(not has_table_privilege('anon', 'public.cro_schedule_steps', 'select') or (select relrowsecurity from pg_class where oid = 'public.cro_schedule_steps'::regclass), '공개 역할은 RLS 로 막힘');
end $$;
