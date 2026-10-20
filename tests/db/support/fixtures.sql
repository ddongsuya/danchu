-- 단추 DB 테스트 공용 도우미. scripts/db-test.sh 가 테스트 파일마다 같은 트랜잭션 안에서 먼저 적용하고 함께 되돌린다.
-- t_ 로 시작하는 함수는 테스트에서만 쓴다.

create or replace function pg_temp.t_assert(p_cond boolean, p_msg text) returns void
language plpgsql as $$
begin
  if p_cond is distinct from true then raise exception 'ASSERT 실패: %', p_msg; end if;
end $$;

create or replace function pg_temp.t_eq(p_actual anycompatible, p_expected anycompatible, p_msg text) returns void
language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'ASSERT 실패: % (실제 %, 기대 %)', p_msg, coalesce(p_actual::text, 'null'), coalesce(p_expected::text, 'null');
  end if;
end $$;

-- 서울 기준 이번 달·지난달 1일
create or replace function pg_temp.t_month(p_offset int default 0) returns date
language sql as $$ select (date_trunc('month', (now() at time zone 'Asia/Seoul')) + make_interval(months => p_offset))::date $$;
-- 그 달 15일 정오(서울) 시각
create or replace function pg_temp.t_mid(p_offset int default 0) returns timestamptz
language sql as $$ select ((pg_temp.t_month(p_offset) + 14)::timestamp + time '12:00') at time zone 'Asia/Seoul' $$;

create or replace function pg_temp.t_org(p_name text, p_fee int default 300000, p_rate numeric default 0.03, p_monthly int default null, p_managed boolean default false) returns uuid
language sql as $$
  insert into public.cro_orgs (name, status, per_request_fee, fee_rate, monthly_fee, managed, categories)
  values (p_name, 'approved', p_fee, p_rate, p_monthly, p_managed, array['일반독성'])
  returning id
$$;

create or replace function pg_temp.t_rfq(p_no text) returns uuid
language sql as $$
  insert into public.rfq_requests (rfq_no, company, contact_name, email, substance, payload, categories, cro_count, status)
  values (p_no, '테스트 의뢰기관', '담당자', 'sponsor@example.test', '물질-' || p_no, '{}'::jsonb, array['일반독성'], '전체', 'distributed')
  returning id
$$;

-- 초대 1건. 기본은 기관이 참여한 초대다 (0023: 참여 기록이 있어야 견적을 저장하고 청구한다). p_joined = false 면 참여 결정 전.
-- 참여 기록은 join_offer() 로만 쓰게 막혀 있어(0023 트리거), 도우미는 같은 쓰기 표식을 잠시 켜고 넣는다
create or replace function pg_temp.t_invite(p_rfq uuid, p_org uuid, p_sent timestamptz default now(), p_joined boolean default true, p_source text default 'matched') returns uuid
language plpgsql as $$
declare v uuid;
begin
  perform set_config('danchu.opt_in_write', 'on', true);
  insert into public.rfq_invites (rfq_id, rfq_no, cro_name, cro_email, cro_org_id, reply_by, expires_at, sent_at, source,
                                  joined_at, join_channel, join_actor, join_terms_version)
  select r.id, r.rfq_no, o.name, 'cro-' || o.id || '@example.test', o.id, (now() + interval '7 days')::date, now() + interval '14 days', p_sent, p_source,
         case when p_joined then p_sent end, case when p_joined then 'portal' end, case when p_joined then 'member' end, case when p_joined then 'test-terms' end
  from public.rfq_requests r, public.cro_orgs o where r.id = p_rfq and o.id = p_org
  returning id into v;
  perform set_config('danchu.opt_in_write', '', true);
  return v;
end $$;

-- 제출된 견적 1건 (정식 견적서 조건을 갖춘다). p_at 이 처음 제출 시각이 된다
create or replace function pg_temp.t_quote(p_invite uuid, p_amount bigint, p_at timestamptz default now(), p_source text default 'cro') returns uuid
language sql as $$
  with ins as (
    insert into public.cro_quotes (invite_id, rfq_id, rfq_no, cro_name, cro_org_id, total_amount, status, submitted_at, entry_source, pdf_path, start_date, valid_until)
    select i.id, i.rfq_id, i.rfq_no, i.cro_name, i.cro_org_id, p_amount, 'submitted', p_at, p_source, 'x/quote.pdf', current_date, current_date + 30
    from public.rfq_invites i where i.id = p_invite
    returning id
  ), upd as (
    update public.rfq_invites set status = 'submitted' where id = p_invite
  )
  select id from ins
$$;

-- 선정 기록 (선정 견적 금액을 fee_basis_amount 에 고정)
create or replace function pg_temp.t_award(p_quote uuid, p_at timestamptz default now()) returns uuid
language sql as $$
  insert into public.rfq_awards (rfq_id, quote_id, invite_id, cro_org_id, cro_name, fee_basis_amount, awarded_at)
  select q.rfq_id, q.id, q.invite_id, q.cro_org_id, q.cro_name, q.total_amount, p_at
  from public.cro_quotes q where q.id = p_quote
  returning id
$$;

-- 계정 1개 (auth.users → 가입 트리거가 profiles 를 만든다). 기관 담당자면 소속·역할을 함께 채운다
create or replace function pg_temp.t_user(p_email text, p_role text default 'requester', p_org uuid default null, p_org_role text default 'member') returns uuid
language plpgsql as $$
declare v uuid;
begin
  insert into auth.users (email, email_confirmed_at) values (p_email, now()) returning id into v;
  update public.profiles set role = p_role, cro_org_id = p_org, org_role = p_org_role where id = v;
  return v;
end $$;

-- 회신 저장 최소 인자 (항목 없음). 결과 code 를 돌려준다 (성공이면 'ok')
create or replace function pg_temp.t_save(p_invite uuid, p_token text, p_submit boolean default false, p_actor uuid default null) returns text
language sql as $$
  select coalesce(case when (r->>'ok')::boolean then 'ok' end, r->>'code')
  from (select public.save_quote(p_invite, jsonb_build_object('total_amount', 20000000, 'note', 'n'), '[]'::jsonb, p_submit, p_actor, p_token) r) x
$$;
