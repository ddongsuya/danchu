-- 단추(Danchu) 42차: 2차 상세 견적 (2026-11-05 대표 결정, 2026-11-10 "진행" 재확인)
-- 0041 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경
-- 견적 요청은 두 단계다. 1차는 핵심 조건만으로 여러 기관의 빠른 견적을 받아 비교표를 연다 (0025, 0026).
-- 2차는 비교표가 열린 뒤 의뢰자가 1차를 낸 기관 가운데 1~3곳을 골라 상세 조건(시험물질 조건, 바꾼 시험 조건, 예산, 착수 시기, 첨부)을 보내고,
-- 그 기관만 1차 견적을 고친 금액과 기간을 한 번 회신한다.
--
-- 규칙
-- 1) 열린 비교표의 1차 견적(cro_quotes, cro_quote_items)은 그대로 고정이다 (0026 compare_lock). 2차 회신은 따로 둔다 (rfq_detail_targets).
-- 2) 상세 견적 요청은 요청마다 한 번, 받는 곳은 1~3곳. 비교표가 열린 뒤, 선정 전, 마무리·취소 전에만 보낸다.
-- 3) 기관의 2차 회신은 한 번이다: 고쳐 보내기(submitted) · 1차 그대로(kept) · 이번엔 어려움(declined). 보낸 뒤에는 고치지 않는다.
--    회신 기한(rfq_details.reply_by, 서울 날짜)이 지나거나 의뢰자가 기관을 선정하면 닫힌다. 답하지 않아도 1차 견적으로 선정할 수 있다.
-- 4) 상세 견적 첨부(rfq_files.scope = 'detail')는 받는 기관에만 보인다. 1차 첨부(scope = 'request')는 지금과 같다. 열람 규칙은 앱(/api/files, lib/quote-load.ts).
-- 5) 선정 견적 금액(rfq_awards.fee_basis_amount)은 2차를 고쳐 보낸 기관이면 2차 금액, 아니면 1차 금액이다.
--    성사 수수료 정산은 확정 계약 금액 기준(0041)이라 바뀌지 않는다. 2차 회신에는 송부 비용이 없다 (billing 함수는 건드리지 않는다).

do $$ begin
  if public.danchu_schema_version() < 41 then
    raise exception '0041_success_fee_by_contract.sql 을 먼저 적용해 주세요';
  end if;
end $$;

-- ─────────────────────────────────────────────
-- 1) 표
-- ─────────────────────────────────────────────
create table if not exists public.rfq_details (
  rfq_id      uuid primary key references public.rfq_requests(id) on delete cascade,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  reply_by    date not null,
  detail      jsonb not null default '{}'::jsonb,
  note        text not null default ''
);
comment on table public.rfq_details is '2차 상세 견적 요청 (0042). 요청마다 한 번. detail 은 요청서 payload 와 같은 키로, 1차에 더하거나 바꾼 값만 담는다';
comment on column public.rfq_details.reply_by is '2차 회신 기한 (서울 날짜, 그날 끝까지)';

create table if not exists public.rfq_detail_targets (
  id            uuid primary key default gen_random_uuid(),
  rfq_id        uuid not null references public.rfq_details(rfq_id) on delete cascade,
  quote_id      uuid not null unique references public.cro_quotes(id) on delete cascade,
  invite_id     uuid not null references public.rfq_invites(id) on delete cascade,
  cro_org_id    uuid references public.cro_orgs(id) on delete set null,
  status        text not null default 'sent' check (status in ('sent', 'submitted', 'kept', 'declined')),
  total_amount  bigint check (total_amount is null or total_amount > 0),
  total_weeks   int check (total_weeks is null or total_weeks between 1 and 520),
  items         jsonb not null default '[]'::jsonb,
  note          text not null default '',
  responded_at  timestamptz,
  responded_by  uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint rfq_detail_targets_reply_chk check (
    (status = 'sent' and responded_at is null and total_amount is null)
    or (status = 'submitted' and responded_at is not null and total_amount is not null)
    or (status in ('kept', 'declined') and responded_at is not null and total_amount is null)
  )
);
comment on table public.rfq_detail_targets is '2차 상세 견적을 받는 기관과 그 회신 (0042). 1차 견적(quote_id)마다 한 줄. items = [{seq, amount, weeks, mode(as_requested|assumed), reason}] 는 고친 줄만';
create index if not exists rfq_detail_targets_rfq_idx on public.rfq_detail_targets (rfq_id);
create index if not exists rfq_detail_targets_invite_idx on public.rfq_detail_targets (invite_id);
create index if not exists rfq_detail_targets_org_idx on public.rfq_detail_targets (cro_org_id) where cro_org_id is not null;

alter table public.rfq_details enable row level security;
alter table public.rfq_detail_targets enable row level security;
-- 서버(service role)만 쓴다. RLS 정책이 없어 막히지만, 권한도 걷어 둔다
revoke all on public.rfq_details, public.rfq_detail_targets from anon, authenticated;

alter table public.rfq_files add column if not exists scope text not null default 'request';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'rfq_files_scope_chk') then
    alter table public.rfq_files add constraint rfq_files_scope_chk check (scope in ('request', 'detail'));
  end if;
end $$;
comment on column public.rfq_files.scope is '첨부가 보이는 범위 (0042). request = 참여한 기관 모두, detail = 2차 상세 견적을 받는 기관만';

-- ─────────────────────────────────────────────
-- 2) 의뢰자: 상세 견적 요청 보내기
-- ─────────────────────────────────────────────
create or replace function public.send_detail_request(p_rfq_id uuid, p_user uuid, p_quote_ids uuid[], p_detail jsonb, p_reply_by date, p_note text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  r public.rfq_requests%rowtype;
  v_role text;
  v_ids uuid[];
  v_n int;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  select * into r from public.rfq_requests where id = p_rfq_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  select role into v_role from public.profiles where id = p_user;
  if coalesce(v_role, '') <> 'admin' and r.user_id is distinct from p_user then
    return jsonb_build_object('ok', false, 'code', 'not_found');
  end if;
  if r.compared_at is null then return jsonb_build_object('ok', false, 'code', 'not_compared'); end if;
  if r.selected_quote_id is not null or r.status in ('selected', 'contracting', 'closed', 'cancelled') then
    return jsonb_build_object('ok', false, 'code', 'closed');
  end if;
  if exists (select 1 from public.rfq_details where rfq_id = r.id) then
    return jsonb_build_object('ok', false, 'code', 'exists');
  end if;
  if p_reply_by is null or p_reply_by <= v_today or p_reply_by > v_today + 60 then
    return jsonb_build_object('ok', false, 'code', 'bad_date');
  end if;
  if jsonb_typeof(coalesce(p_detail, '{}'::jsonb)) <> 'object' then
    return jsonb_build_object('ok', false, 'code', 'bad_detail');
  end if;

  select array_agg(distinct x) into v_ids from unnest(coalesce(p_quote_ids, '{}'::uuid[])) x;
  v_n := coalesce(array_length(v_ids, 1), 0);
  if v_n < 1 or v_n > 3 then return jsonb_build_object('ok', false, 'code', 'bad_targets'); end if;
  -- 받는 곳은 이 요청에 1차 견적을 낸 기관만. 참여가 중지된 기관은 뺀다
  if (select count(*) from public.cro_quotes q
        left join public.cro_orgs o on o.id = q.cro_org_id
       where q.id = any(v_ids) and q.rfq_id = r.id and q.status = 'submitted'
         and (q.cro_org_id is null or o.status = 'approved')) <> v_n then
    return jsonb_build_object('ok', false, 'code', 'bad_targets');
  end if;

  insert into public.rfq_details (rfq_id, created_by, reply_by, detail, note)
  values (r.id, p_user, p_reply_by, coalesce(p_detail, '{}'::jsonb), left(coalesce(p_note, ''), 2000));
  insert into public.rfq_detail_targets (rfq_id, quote_id, invite_id, cro_org_id)
  select r.id, q.id, q.invite_id, q.cro_org_id from public.cro_quotes q where q.id = any(v_ids);

  return jsonb_build_object('ok', true, 'targets', v_n);
end;
$$;
revoke execute on function public.send_detail_request(uuid, uuid, uuid[], jsonb, date, text) from public, anon, authenticated;
grant execute on function public.send_detail_request(uuid, uuid, uuid[], jsonb, date, text) to service_role;

-- ─────────────────────────────────────────────
-- 3) 기관: 2차 회신 (한 번)
--    p_body = { mode: revise|keep|decline, total_amount, total_weeks, items: [{seq, amount, weeks, mode, reason}], note }
-- ─────────────────────────────────────────────
create or replace function public.save_detail_reply(p_invite_id uuid, p_token text, p_actor uuid, p_body jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  inv public.rfq_invites%rowtype;
  r public.rfq_requests%rowtype;
  d public.rfq_details%rowtype;
  t public.rfq_detail_targets%rowtype;
  v_role text;
  v_actor_org uuid;
  v_org_status text;
  v_mode text := coalesce(p_body->>'mode', '');
  v_amount bigint;
  v_weeks int;
  v_items jsonb := case when jsonb_typeof(p_body->'items') = 'array' then p_body->'items' else '[]'::jsonb end;
begin
  select * into r from public.rfq_requests where id = (select rfq_id from public.rfq_invites where id = p_invite_id) for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  select * into inv from public.rfq_invites where id = p_invite_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if p_token is null or inv.token is distinct from p_token or inv.revoked_at is not null then
    return jsonb_build_object('ok', false, 'code', 'revoked');
  end if;
  select * into t from public.rfq_detail_targets where invite_id = inv.id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_target'); end if;
  select * into d from public.rfq_details where rfq_id = r.id;

  if r.selected_quote_id is not null or r.status in ('selected', 'contracting', 'closed', 'cancelled') then
    return jsonb_build_object('ok', false, 'code', 'closed');
  end if;
  if t.status <> 'sent' then return jsonb_build_object('ok', false, 'code', 'done'); end if;

  if p_actor is not null then select role, cro_org_id into v_role, v_actor_org from public.profiles where id = p_actor; end if;
  if coalesce(v_role, '') <> 'admin' and (now() at time zone 'Asia/Seoul')::date > d.reply_by then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;
  if inv.cro_org_id is not null then
    select status into v_org_status from public.cro_orgs where id = inv.cro_org_id;
    if v_org_status is distinct from 'approved' then return jsonb_build_object('ok', false, 'code', 'org_inactive'); end if;
  end if;
  if v_role = 'cro' and v_actor_org is not null and v_actor_org is distinct from inv.cro_org_id then
    return jsonb_build_object('ok', false, 'code', 'not_member');
  end if;

  if v_mode = 'revise' then
    v_amount := (p_body->>'total_amount')::bigint;
    v_weeks := (p_body->>'total_weeks')::int;
    if v_amount is null or v_amount <= 0 or (v_weeks is not null and (v_weeks < 1 or v_weeks > 520)) or jsonb_array_length(v_items) > 200 then
      return jsonb_build_object('ok', false, 'code', 'bad_body');
    end if;
    update public.rfq_detail_targets
       set status = 'submitted', total_amount = v_amount, total_weeks = v_weeks, items = v_items,
           note = left(coalesce(p_body->>'note', ''), 2000), responded_at = now(), responded_by = p_actor
     where id = t.id;
  elsif v_mode in ('keep', 'decline') then
    update public.rfq_detail_targets
       set status = case when v_mode = 'keep' then 'kept' else 'declined' end,
           note = left(coalesce(p_body->>'note', ''), 2000), responded_at = now(), responded_by = p_actor
     where id = t.id;
  else
    return jsonb_build_object('ok', false, 'code', 'bad_body');
  end if;

  return jsonb_build_object('ok', true, 'target_id', t.id, 'rfq_id', r.id,
    'left', (select count(*) from public.rfq_detail_targets where rfq_id = r.id and status = 'sent'));
end;
$$;
revoke execute on function public.save_detail_reply(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.save_detail_reply(uuid, text, uuid, jsonb) to service_role;

-- 보낸 2차 회신은 고치지 않는다 (함수를 거치지 않는 직접 쓰기까지 막는 안전망)
create or replace function public.rfq_detail_targets_lock()
returns trigger
language plpgsql
as $$
begin
  if old.status <> 'sent'
     and (new.status, new.total_amount, new.total_weeks, new.items, new.note, new.responded_at, new.quote_id, new.invite_id, new.rfq_id)
         is distinct from
         (old.status, old.total_amount, old.total_weeks, old.items, old.note, old.responded_at, old.quote_id, old.invite_id, old.rfq_id) then
    raise exception 'detail_locked: 보낸 2차 회신은 고칠 수 없습니다';
  end if;
  return new;
end;
$$;
revoke execute on function public.rfq_detail_targets_lock() from public, anon, authenticated;
drop trigger if exists rfq_detail_targets_lock on public.rfq_detail_targets;
create trigger rfq_detail_targets_lock before update on public.rfq_detail_targets
  for each row execute function public.rfq_detail_targets_lock();

-- ─────────────────────────────────────────────
-- 4) 선정: 0025 와 같고, 선정 견적 금액은 2차를 고쳐 보낸 기관이면 2차 금액
-- ─────────────────────────────────────────────
create or replace function public.select_quote(p_rfq_id uuid, p_quote_id uuid, p_user uuid, p_revision int)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  r public.rfq_requests%rowtype;
  q public.cro_quotes%rowtype;
  v_source text;
  v_award uuid;
  v_detail bigint;
begin
  select * into r from public.rfq_requests where id = p_rfq_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if r.selected_quote_id is not null then return jsonb_build_object('ok', false, 'code', 'already_selected'); end if;
  if r.status in ('closed', 'cancelled') then return jsonb_build_object('ok', false, 'code', 'not_open'); end if;
  -- 비교표가 열리기 전에는 기관 이름·금액이 보이지 않으므로 선택할 수 없다 (2026-10-20 결정 1)
  if r.compared_at is null then return jsonb_build_object('ok', false, 'code', 'not_compared'); end if;

  select * into q from public.cro_quotes where id = p_quote_id and rfq_id = p_rfq_id and status = 'submitted' for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'bad_quote'); end if;

  if p_revision is null or q.revision is distinct from p_revision then
    return jsonb_build_object('ok', false, 'code', 'quote_changed', 'revision', q.revision);
  end if;

  select source into v_source from public.rfq_invites where id = q.invite_id;
  select total_amount into v_detail from public.rfq_detail_targets where quote_id = q.id and status = 'submitted';

  insert into public.rfq_awards (rfq_id, quote_id, invite_id, cro_org_id, cro_name, selected_by, fee_basis_amount, invite_source, quote_revision)
  values (r.id, q.id, q.invite_id, q.cro_org_id, q.cro_name, p_user, coalesce(v_detail, q.total_amount), v_source, q.revision)
  returning id into v_award;

  update public.rfq_requests set status = 'selected', selected_quote_id = q.id where id = r.id;

  return jsonb_build_object('ok', true, 'award_id', v_award, 'invite_id', q.invite_id, 'cro_org_id', q.cro_org_id, 'cro_name', q.cro_name,
                            'revision', q.revision, 'amount', coalesce(v_detail, q.total_amount));
end;
$$;
revoke execute on function public.select_quote(uuid, uuid, uuid, int) from public, anon, authenticated;
grant execute on function public.select_quote(uuid, uuid, uuid, int) to service_role;

-- ─────────────────────────────────────────────
-- 5) 스키마 판
-- ─────────────────────────────────────────────
create or replace function public.danchu_schema_version()
returns int
language sql
immutable
as $$ select 42 $$;
comment on function public.danchu_schema_version() is
  '마지막으로 적용한 마이그레이션 번호 (0042). 앱(lib/schema-version.ts REQUIRED_SCHEMA_VERSION)과 npm run check:schema 가 확인한다. 다음 마이그레이션이 새 번호로 바꾼다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;
grant execute on function public.danchu_schema_version() to service_role;
