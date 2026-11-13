-- 단추(Danchu) 45차: 의뢰자·기관 직접 질의응답 (2026-11-13 대표 결정, 시안 승인 "권장안대로 진행")
-- 0044 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경
-- 지금까지 견적 내용 문의는 의뢰자 → 운영자(/app/support) → 기관으로 전달됐다. 이제 요청 안에서 의뢰자와 기관이 바로 질의하고 답한다.
--
-- 규칙
-- 1) 질의 한 건 = 질의 한 번 + 답변 한 번. 올린 질의와 답변은 고치거나 지울 수 없다 (트리거). 운영자는 읽기만 한다.
-- 2) 기관 → 의뢰자: 참여한(joined_at) 기관만, 비교표가 열리기 전(compared_at 없음)까지. 철회·취소·참여 중지 기관은 못 한다.
--    의뢰자 → 기관: 비교표가 열린 뒤, 1차 견적을 낸 기관에만.
--    둘 다 선정 전, 마무리·취소 전까지만 새로 묻고 답한다.
-- 3) 기관 질의에 대한 의뢰자 답변은 공개 범위를 고른다: private = 질의한 기관만, all = 참여 기관 전체(질의 기관은 밝히지 않는다).
--    의뢰자 질의에 대한 기관 답변은 언제나 private.
-- 4) 글만 받는다 (첨부 없음, CDA 첨부 잠금과 부딪히지 않게). 질의·답변 각 1000자.
-- 5) 연락처 가림은 앱이 보여 줄 때 한다 (lib/contact-guard.ts). 원문은 그대로 저장하고, 글에 연락처가 있었는지(has_contact)는 앱이 적는다.
-- 6) 열람 범위(기관은 자기 질의와 전체 공개 답변만)는 앱(lib/qna-data.ts)이 서비스 키로 읽고 거른다. 표는 anon·authenticated 에 닫는다.

do $$ begin
  if public.danchu_schema_version() < 44 then
    raise exception '0044_cro_plans.sql 을 먼저 적용해 주세요';
  end if;
end $$;

-- ─────────────────────────────────────────────
-- 1) 표
-- ─────────────────────────────────────────────
create table if not exists public.rfq_questions (
  id                 uuid primary key default gen_random_uuid(),
  rfq_id             uuid not null references public.rfq_requests(id) on delete cascade,
  invite_id          uuid not null references public.rfq_invites(id) on delete cascade,
  cro_org_id         uuid references public.cro_orgs(id) on delete set null,
  direction          text not null check (direction in ('cro', 'sponsor')),
  topic              text not null check (topic in ('terms', 'substance', 'schedule', 'quote', 'other')),
  test_seq           int check (test_seq is null or test_seq between 1 and 999),
  body               text not null check (char_length(btrim(body)) between 1 and 1000),
  body_has_contact   boolean not null default false,
  asked_by           uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  answer             text check (answer is null or char_length(btrim(answer)) between 1 and 1000),
  answer_has_contact boolean not null default false,
  answered_by        uuid references auth.users(id) on delete set null,
  answered_at        timestamptz,
  scope              text check (scope is null or scope in ('private', 'all')),
  constraint rfq_questions_answer_chk check (
    (answer is null and answered_at is null and scope is null)
    or (answer is not null and answered_at is not null and scope is not null)
  ),
  constraint rfq_questions_scope_chk check (direction = 'cro' or scope is null or scope = 'private')
);
comment on table public.rfq_questions is '의뢰자·기관 직접 질의응답 (0045). direction cro = 기관이 묻고 의뢰자가 답함, sponsor = 의뢰자가 묻고 기관이 답함. 올린 글은 고치거나 지우지 않는다';
comment on column public.rfq_questions.topic is '관련 항목: terms 요청 조건 · substance 시험물질 · schedule 일정 · quote 견적 · other 기타';
comment on column public.rfq_questions.test_seq is '관련 시험 (요청서 시험 행 seq). 없으면 null';
comment on column public.rfq_questions.scope is '답변 공개 범위: private 질의한 기관만 · all 참여 기관 전체(질의 기관은 밝히지 않음). 의뢰자 질의의 답은 언제나 private';
comment on column public.rfq_questions.body_has_contact is '질의 원문에 연락처가 있어 상대 화면에서 가렸는지 (앱이 적는다)';
create index if not exists rfq_questions_rfq_idx on public.rfq_questions (rfq_id, created_at);
create index if not exists rfq_questions_invite_idx on public.rfq_questions (invite_id, created_at);

alter table public.rfq_questions enable row level security;
-- 서버(service role)만 쓴다. RLS 정책이 없어 막히지만, 권한도 걷어 둔다
revoke all on public.rfq_questions from anon, authenticated;

-- 고치기·지우기 금지: 바꿀 수 있는 것은 답이 없는 질의에 답을 한 번 다는 것뿐이다
create or replace function public.rfq_questions_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    -- 요청·초대가 지워질 때(on delete cascade)만 함께 지운다
    if exists (select 1 from public.rfq_requests where id = old.rfq_id)
       and exists (select 1 from public.rfq_invites where id = old.invite_id) then
      raise exception '질의응답은 지울 수 없어요' using errcode = 'P0001';
    end if;
    return old;
  end if;
  if old.answer is not null then
    -- 답이 달린 뒤에는 아무것도 바꾸지 않는다. 계정이 지워져 작성자 열이 비워지는 것(on delete set null)만 받는다
    if (new.id, new.rfq_id, new.invite_id, new.direction, new.topic, new.test_seq, new.body, new.body_has_contact, new.created_at,
        new.answer, new.answer_has_contact, new.answered_at, new.scope)
       is distinct from
       (old.id, old.rfq_id, old.invite_id, old.direction, old.topic, old.test_seq, old.body, old.body_has_contact, old.created_at,
        old.answer, old.answer_has_contact, old.answered_at, old.scope) then
      raise exception '답변한 질의는 고칠 수 없어요' using errcode = 'P0001';
    end if;
    return new;
  end if;
  if (new.id, new.rfq_id, new.invite_id, new.direction, new.topic, new.test_seq, new.body, new.body_has_contact, new.created_at)
     is distinct from
     (old.id, old.rfq_id, old.invite_id, old.direction, old.topic, old.test_seq, old.body, old.body_has_contact, old.created_at) then
    raise exception '질의는 고칠 수 없어요' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists rfq_questions_guard_upd on public.rfq_questions;
create trigger rfq_questions_guard_upd before update on public.rfq_questions
  for each row execute function public.rfq_questions_guard();
drop trigger if exists rfq_questions_guard_del on public.rfq_questions;
create trigger rfq_questions_guard_del before delete on public.rfq_questions
  for each row execute function public.rfq_questions_guard();

-- ─────────────────────────────────────────────
-- 2) 질의 보내기
--    p_direction cro: 기관 → 의뢰자. p_user 는 기관 담당자(로그인 없는 회신 링크면 null)
--    p_direction sponsor: 의뢰자 → 기관. p_user 는 요청 주인
--    운영자 계정은 묻지도 답하지도 않는다 (중립)
-- ─────────────────────────────────────────────
create or replace function public.ask_question(p_invite_id uuid, p_user uuid, p_direction text, p_topic text, p_test_seq int, p_body text, p_has_contact boolean)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  inv public.rfq_invites%rowtype;
  r public.rfq_requests%rowtype;
  v_role text;
  v_org_status text;
  v_open int;
  v_id uuid;
  v_body text := btrim(coalesce(p_body, ''));
begin
  select * into inv from public.rfq_invites where id = p_invite_id;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  select * into r from public.rfq_requests where id = inv.rfq_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if p_user is not null then
    select role into v_role from public.profiles where id = p_user;
    if v_role = 'admin' then return jsonb_build_object('ok', false, 'code', 'operator_not_allowed'); end if;
  end if;
  if p_direction not in ('cro', 'sponsor') then return jsonb_build_object('ok', false, 'code', 'bad_body'); end if;
  if p_topic is null or p_topic not in ('terms', 'substance', 'schedule', 'quote', 'other') then
    return jsonb_build_object('ok', false, 'code', 'bad_body');
  end if;
  if char_length(v_body) < 1 or char_length(v_body) > 1000 then return jsonb_build_object('ok', false, 'code', 'bad_body'); end if;
  if p_test_seq is not null and (p_test_seq < 1 or p_test_seq > 999) then return jsonb_build_object('ok', false, 'code', 'bad_body'); end if;

  if r.selected_quote_id is not null or r.status in ('selected', 'contracting', 'closed', 'cancelled') then
    return jsonb_build_object('ok', false, 'code', 'closed');
  end if;
  if inv.revoked_at is not null then return jsonb_build_object('ok', false, 'code', 'closed'); end if;
  if inv.cro_org_id is not null then
    select status into v_org_status from public.cro_orgs where id = inv.cro_org_id;
    if v_org_status is distinct from 'approved' then return jsonb_build_object('ok', false, 'code', 'org_inactive'); end if;
  end if;

  if p_direction = 'cro' then
    if inv.joined_at is null or inv.withdrawn_at is not null or inv.status = 'declined' then
      return jsonb_build_object('ok', false, 'code', 'not_joined');
    end if;
    if r.compared_at is not null then return jsonb_build_object('ok', false, 'code', 'compared'); end if;
  else
    if p_user is null or r.user_id is distinct from p_user then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
    if r.compared_at is null then return jsonb_build_object('ok', false, 'code', 'not_compared'); end if;
    if not exists (select 1 from public.cro_quotes q where q.invite_id = inv.id and q.status = 'submitted') then
      return jsonb_build_object('ok', false, 'code', 'no_quote');
    end if;
  end if;

  -- 답을 기다리는 질의가 한쪽에 10건 쌓이면 더 받지 않는다 (같은 초대, 같은 방향)
  select count(*) into v_open from public.rfq_questions
   where invite_id = inv.id and direction = p_direction and answer is null;
  if v_open >= 10 then return jsonb_build_object('ok', false, 'code', 'too_many'); end if;

  insert into public.rfq_questions (rfq_id, invite_id, cro_org_id, direction, topic, test_seq, body, body_has_contact, asked_by)
  values (r.id, inv.id, inv.cro_org_id, p_direction, p_topic, p_test_seq, v_body, coalesce(p_has_contact, false), p_user)
  returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;
revoke execute on function public.ask_question(uuid, uuid, text, text, int, text, boolean) from public, anon, authenticated;
grant execute on function public.ask_question(uuid, uuid, text, text, int, text, boolean) to service_role;

-- ─────────────────────────────────────────────
-- 3) 답변 (한 번)
--    기관 질의(direction cro)는 요청 주인이 답하고 p_scope 를 고른다. p_invite_id 는 null.
--    의뢰자 질의(direction sponsor)는 그 초대의 기관이 답한다. p_invite_id 로 확인하고, 공개 범위는 private.
-- ─────────────────────────────────────────────
create or replace function public.answer_question(p_question_id uuid, p_user uuid, p_invite_id uuid, p_answer text, p_has_contact boolean, p_scope text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  q public.rfq_questions%rowtype;
  inv public.rfq_invites%rowtype;
  r public.rfq_requests%rowtype;
  v_role text;
  v_org_status text;
  v_scope text;
  v_answer text := btrim(coalesce(p_answer, ''));
begin
  select * into q from public.rfq_questions where id = p_question_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  select * into r from public.rfq_requests where id = q.rfq_id;
  select * into inv from public.rfq_invites where id = q.invite_id;
  if p_user is not null then
    select role into v_role from public.profiles where id = p_user;
    if v_role = 'admin' then return jsonb_build_object('ok', false, 'code', 'operator_not_allowed'); end if;
  end if;
  if q.answer is not null then return jsonb_build_object('ok', false, 'code', 'answered'); end if;
  if char_length(v_answer) < 1 or char_length(v_answer) > 1000 then return jsonb_build_object('ok', false, 'code', 'bad_body'); end if;
  if r.selected_quote_id is not null or r.status in ('selected', 'contracting', 'closed', 'cancelled') then
    return jsonb_build_object('ok', false, 'code', 'closed');
  end if;

  if q.direction = 'cro' then
    if p_user is null or r.user_id is distinct from p_user or p_invite_id is not null then
      return jsonb_build_object('ok', false, 'code', 'not_found');
    end if;
    if p_scope is null or p_scope not in ('private', 'all') then return jsonb_build_object('ok', false, 'code', 'bad_body'); end if;
    v_scope := p_scope;
  else
    if p_invite_id is null or p_invite_id is distinct from q.invite_id then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
    if inv.revoked_at is not null then return jsonb_build_object('ok', false, 'code', 'closed'); end if;
    if inv.cro_org_id is not null then
      select status into v_org_status from public.cro_orgs where id = inv.cro_org_id;
      if v_org_status is distinct from 'approved' then return jsonb_build_object('ok', false, 'code', 'org_inactive'); end if;
    end if;
    v_scope := 'private';
  end if;

  update public.rfq_questions
     set answer = v_answer, answer_has_contact = coalesce(p_has_contact, false), answered_by = p_user, answered_at = now(), scope = v_scope
   where id = q.id;
  return jsonb_build_object('ok', true, 'scope', v_scope, 'direction', q.direction, 'invite_id', q.invite_id);
end;
$$;
revoke execute on function public.answer_question(uuid, uuid, uuid, text, boolean, text) from public, anon, authenticated;
grant execute on function public.answer_question(uuid, uuid, uuid, text, boolean, text) to service_role;

-- ─────────────────────────────────────────────
-- 4) 스키마 판
-- ─────────────────────────────────────────────
create or replace function public.danchu_schema_version()
returns int
language sql
immutable
as $$ select 45 $$;
comment on function public.danchu_schema_version() is
  '마지막으로 적용한 마이그레이션 번호 (0045). 앱(lib/schema-version.ts REQUIRED_SCHEMA_VERSION)과 npm run check:schema 가 확인한다. 다음 마이그레이션이 새 번호로 바꾼다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;
grant execute on function public.danchu_schema_version() to service_role;
