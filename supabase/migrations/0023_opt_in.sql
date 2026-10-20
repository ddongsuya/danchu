-- 단추(Danchu) 23차: 참여 선택형 요청 (2026-10-20 대표 결정 "추천대로") · 참여 기록 · 자리 계산 · 참여 전 견적 저장 차단 · 청구 조건
-- 0022 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경 (2026-10-20 결정, 이 파일이 기준. 설계: 참여 선택형 요청 배포 추천안 5절 1단계)
-- 1) 초대는 이제 "견적 요청"이 아니라 "참여 안내"다. 기관이 요약을 보고 참여하기를 눌러야 그 초대에서 견적을 쓸 수 있다.
--    초대 상태값(sent·draft·submitted·declined·expired)은 0009~0022 의 집계와 색인에 쓰이므로 바꾸지 않는다.
--    참여는 rfq_invites.joined_at 으로 구분한다. sent + joined_at 없음 = 참여 결정 전, sent + joined_at = 참여(작성 전).
-- 2) 참여 기록: joined_at(시각), join_channel(portal 기관 포털 · token 회신 링크 · legacy 전환 전 견적), join_actor(누른 사람 또는 토큰),
--    join_user_id(로그인한 담당자), join_terms_version(그때 보여 준 이용 조건 판), join_ip, join_ua.
--    참여는 join_offer() 로만 기록한다. 한 번 기록하면 바꾸거나 지울 수 없다 (계정 삭제로 join_user_id 가 비는 것과 90일 뒤 join_ip·join_ua 를 비우는 것만 허용, 아래 9).
--    운영자(profiles.role = admin)는 기관 대신 참여를 누를 수 없다. 관리 기관(계정 없음)은 기관이 회신 링크(token)에서 직접 누른다.
-- 3) 자리: 의뢰자가 고른 3곳·5곳·전체는 "보낼 곳"이 아니라 "참여 자리"다. 자리에 세는 것은 참여·작성 중·제출이다
--    (철회·불참·취소·만료는 세지 않는다). join_offer 가 요청 행을 잠그고 세므로 동시에 눌러도 자리를 넘지 않는다.
--    자리는 먼저 참여한 순서로 준다. 단, 지명 기관(source = nominated)이 아직 결정하지 않았으면 참여 결정 기한(rfq_requests.join_by)까지
--    그 수만큼 자리를 비워 둔다. 기한이 지나면 일반 자리로 푼다.
--    그래서 0012 의 초대 한도 트리거(enforce_invitation_limit)는 마감 검사만 남긴다. 안내는 분야가 맞는 기관 모두에게 갈 수 있다.
-- 4) 늦은 참여: 참여 결정 기한 뒤에도 자리가 남으면 회신 기한 3영업일 전(평일 기준, 공휴일 미반영, lib/dates.ts 와 같다)까지 참여할 수 있다.
--    참여 결정 기한 안이면 회신 기한이 가까워도 참여할 수 있다 (회신 기한이 짧은 요청에서 아무도 참여하지 못하는 일을 막는다).
--    회신 기한이 지나면 참여할 수 없다.
-- 5) 철회: 참여한 기관은 제출 전까지 withdraw_offer() 로 철회할 수 있다. 상태는 declined(불참과 같은 취급), withdrawn_at 으로 구분한다.
--    철회하면 자리가 빈다. 제출한 견적은 철회할 수 없다.
-- 6) 견적 저장: 참여 기록이 없는 초대에는 save_quote 가 not_joined 로 거절한다. 운영자 대리 입력도 같다
--    (운영자는 기관이 참여한 뒤에만 PDF 견적을 옮겨 적는다). cro_quotes 에 직접 넣는 경로도 트리거가 막는다.
-- 7) 청구 원칙 (0020 배경 3 "운영자 관리 기관과 운영자 대리 입력 견적도 같다. 면제는 없다" 를 대신한다):
--    견적은 그 초대에 기관 본인의 참여 기록(join_channel portal·token)이 있을 때만 청구한다. 참여 기록이 있으면
--    입력 방식(기관 직접·운영자 대리 입력)과 기관 종류(일반·관리 기관)에 상관없이 같게 청구한다. 참여 기록이 없는 견적은 청구하지 않는다.
--    이 파일을 적용하기 전에 이미 작성 중·제출이던 초대는 join_channel = legacy 로 참여 처리한다(자리 계산과 저장을 위해).
--    legacy 는 기관이 조건에 동의하고 누른 기록이 아니므로 유료 전환 뒤에도 청구하지 않는다. 열려 있던 sent 초대는 참여를 다시 묻는다.
--    성사수수료도 같은 조건이다: 선정된 견적의 초대에 참여 기록이 없으면 명세 합계에 넣지 않는다 (행은 보여 주고 표시만 한다).
--    운영자 청구 제외(rfq_invites.billable = false)는 지금처럼 따로 적용한다.
--    시범운영 중 참여한 요청은 끝까지 무료라는 원칙(약관)은 join_terms_version 으로 가린다: 판 이름이 pilot- 으로 시작하면
--    (lib/request-policy.ts CRO_TERMS_VERSION) 청구하지 않는다 (join_status = pilot). 유료 조건 판은 pilot- 이 아닌 이름으로 만든다.
-- 8) rfq_requests.join_by: 참여 결정 기한(앱이 접수 때 정한다. 안내 뒤 2영업일, 회신 기한이 5영업일 안이면 1영업일).
--    rfq_requests.nominees_only: 의뢰자가 "지명 기관에만 안내"를 고른 요청. 자동 매칭 안내(source = matched)는 넣지 않는다.
--    rfq_requests.join_by_extended_at: 운영자가 참여 결정 기한을 한 번 늘린 시각 (설계 규칙표 "운영자 권한": 참여 결정 기한 1회 연장).
-- 9) 검토 반영 (2026-10-20 설계·보안 검토):
--    - 참여 기록 보호 예외를 좁힌다: join_user_id 는 계정이 실제로 지워졌을 때만(auth_user_exists), join_ip·join_ua 는 참여 90일 뒤 비우기만
--      (개인정보처리방침 접속 기록 3개월, lib/retention.ts). 나머지 참여 기록은 그대로 영구 보관
--    - 시범 판(join_terms_version 이 pilot- 으로 시작)으로 참여한 요청은 청구하지 않는다 (위 7)
--    - set_seat_count(): 운영자 자리 수 변경을 요청 행 잠금 안에서 (동시 참여와 겹쳐 참여 수 > 자리 수가 되지 않게)
--    - save_quote 결과에 joined_invites(자리를 차지한 참여 기관 수). 의뢰자 알림은 이 수만 쓴다 (안내 수·불참 수 비공개)
--
-- 배포 순서: 이 파일과 2단계 코드(참여 화면·join 라우트)를 함께 배포한다. 이 파일만 먼저 적용하면 열린 sent 초대에서
-- 견적 저장이 not_joined 로 거절된다 (작성 중·제출 초대는 legacy 로 참여 처리되어 그대로 저장된다).

-- ─────────────────────────────────────────────
-- 0) 선행 마이그레이션 확인 (빠졌으면 여기서 멈춘다)
-- ─────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.danchu_schema_version()') is null
     or not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cro_quotes' and column_name = 'revision') then
    raise exception '0023 을 적용하기 전에 0019, 0020, 0021, 0022 를 순서대로 적용해 주세요.';
  end if;
end $$;

-- ─────────────────────────────────────────────
-- 1) 열
-- ─────────────────────────────────────────────
alter table public.rfq_invites add column if not exists joined_at timestamptz;
alter table public.rfq_invites add column if not exists join_actor text;
alter table public.rfq_invites add column if not exists join_channel text;
alter table public.rfq_invites add column if not exists join_user_id uuid references auth.users(id) on delete set null;
alter table public.rfq_invites add column if not exists join_terms_version text;
alter table public.rfq_invites add column if not exists join_ip text;
alter table public.rfq_invites add column if not exists join_ua text;
alter table public.rfq_invites add column if not exists withdrawn_at timestamptz;

alter table public.rfq_requests add column if not exists join_by timestamptz;
alter table public.rfq_requests add column if not exists nominees_only boolean not null default false;
alter table public.rfq_requests add column if not exists join_by_extended_at timestamptz;

comment on column public.rfq_invites.joined_at is '기관이 참여하기를 누른 시각 (0023). 비어 있으면 참여 결정 전. join_offer() 로만 채우고 바꿀 수 없다. 견적 저장과 청구의 조건';
comment on column public.rfq_invites.join_channel is '참여 경로 (0023). portal 기관 포털 · token 회신 링크 · legacy 0023 전 작성 중·제출(청구하지 않음)';
comment on column public.rfq_invites.join_actor is '참여를 누른 주체 (0023). member 로그인한 담당자 · token:<링크 지문> 회신 링크 · legacy';
comment on column public.rfq_invites.join_user_id is '참여를 누른 담당자 계정 (0023). 링크만으로 누르면 비어 있다';
comment on column public.rfq_invites.join_terms_version is '참여할 때 보여 준 이용 조건 판 (0023). legacy 는 비어 있다';
comment on column public.rfq_invites.withdrawn_at is '참여 뒤 제출 전에 철회한 시각 (0023). 상태는 declined. 자리를 비운다';
comment on column public.rfq_requests.join_by is '참여 결정 기한 (0023). 이때까지 결정하지 않은 지명 기관 수만큼 자리를 비워 둔다';
comment on column public.rfq_requests.join_by_extended_at is '운영자가 참여 결정 기한을 늘린 시각 (0023). 연장은 요청마다 한 번만 (앱이 이 열이 비어 있을 때만 조건부로 바꾼다)';
comment on column public.rfq_requests.nominees_only is '지명 기관에만 안내 (0023). 켜져 있으면 자동 매칭 안내(source = matched)를 만들지 않는다';

-- ─────────────────────────────────────────────
-- 2) 전환: 0023 전에 작성 중·제출이던 초대는 legacy 로 참여 처리. 열린 sent 초대는 참여를 다시 묻는다(비워 둔다)
--    견적 행이 있는 초대(마감·취소로 expired 가 된 작성 중 초안 등)도 legacy 로 둔다. 견적 행은 참여한 초대에만 있다는 규칙을 맞춘다.
--    아래 참여 기록 보호 트리거가 이미 있으면(두 번째 적용) 같은 문장 안에서 쓰기 표식을 켠다
-- ─────────────────────────────────────────────
do $$
begin
  perform set_config('danchu.opt_in_write', 'on', true);
  update public.rfq_invites i
     set joined_at = coalesce(i.opened_at, i.sent_at, now()),
         join_channel = 'legacy',
         join_actor = 'legacy'
   where i.joined_at is null
     and (i.status in ('draft', 'submitted') or exists (select 1 from public.cro_quotes q where q.invite_id = i.id));
  perform set_config('danchu.opt_in_write', '', true);
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'rfq_invites_join_channel_chk') then
    alter table public.rfq_invites add constraint rfq_invites_join_channel_chk
      check (join_channel is null or join_channel in ('portal', 'token', 'legacy'));
  end if;
  -- 참여 기록은 한 묶음이다: 시각과 경로가 함께 있고, legacy 가 아니면 조건 판이 있다
  if not exists (select 1 from pg_constraint where conname = 'rfq_invites_join_record_chk') then
    alter table public.rfq_invites add constraint rfq_invites_join_record_chk
      check ((joined_at is null and join_channel is null)
          or (joined_at is not null and join_channel is not null and (join_channel = 'legacy' or nullif(join_terms_version, '') is not null)));
  end if;
  -- 철회는 참여한 초대에서만
  if not exists (select 1 from pg_constraint where conname = 'rfq_invites_withdrawn_chk') then
    alter table public.rfq_invites add constraint rfq_invites_withdrawn_chk
      check (withdrawn_at is null or joined_at is not null);
  end if;
end $$;

create index if not exists rfq_invites_joined_idx on public.rfq_invites (rfq_id) where joined_at is not null;

-- ─────────────────────────────────────────────
-- 3) 참여 기록 보호: join_offer()·withdraw_offer() (또는 위 전환)만 쓴다. 한 번 쓴 기록은 바꾸지 않는다
--    쓰기 표식(danchu.opt_in_write)은 두 함수가 같은 트랜잭션 안에서만 켠다
--    예외 두 가지
--    - join_user_id: 계정이 실제로 지워졌을 때(auth.users 에 없음, FK on delete set null)만 비울 수 있다. 앱 코드가 "누른 사람"을 지우지 못한다
--    - join_ip·join_ua: 개인정보처리방침의 접속 기록 보존 기간(3개월)이 지난 참여 기록에서만 비울 수 있다 (lib/retention.ts 가 매일 비운다).
--      시각·경로·누른 사람(또는 링크 지문)·조건 판은 계속 남는다
-- ─────────────────────────────────────────────

-- 계정이 아직 있는지 (트리거가 auth 스키마를 직접 읽지 않도록 정의자 권한으로 둔다)
create or replace function public.auth_user_exists(p_user uuid)
returns boolean
language sql volatile
security definer set search_path = public
as $$ select exists (select 1 from auth.users u where u.id = p_user) $$;
revoke execute on function public.auth_user_exists(uuid) from public, anon, authenticated;

create or replace function public.rfq_invites_guard_join()
returns trigger
language plpgsql
as $$
declare
  v_writer boolean := coalesce(current_setting('danchu.opt_in_write', true), '') = 'on';
  v_old_ip text;
  v_old_ua text;
begin
  if tg_op = 'INSERT' then
    if (new.joined_at is not null or new.join_channel is not null or new.join_actor is not null or new.join_user_id is not null
        or new.join_terms_version is not null or new.join_ip is not null or new.join_ua is not null or new.withdrawn_at is not null)
       and not v_writer then
      raise exception 'join_record_protected: 참여 기록은 join_offer() 로만 남길 수 있습니다';
    end if;
    return new;
  end if;

  -- 계정 삭제(auth.users on delete set null)로 담당자 계정만 비워지는 것은 허용한다. 계정이 남아 있으면 비울 수 없다
  if old.join_user_id is not null and new.join_user_id is null and not public.auth_user_exists(old.join_user_id) then
    new.join_user_id := null;
  elsif new.join_user_id is distinct from old.join_user_id and not (old.joined_at is null and v_writer) then
    raise exception 'join_record_protected: 참여 기록은 바꿀 수 없습니다';
  end if;
  -- 접속 기록(IP·브라우저)은 보존 기간(3개월)이 지나면 비울 수만 있다 (다른 값으로 바꾸거나 기간 안에 지우지 못한다)
  v_old_ip := old.join_ip;
  v_old_ua := old.join_ua;
  if old.joined_at is not null and old.joined_at < now() - interval '90 days' then
    if new.join_ip is null then v_old_ip := null; end if;
    if new.join_ua is null then v_old_ua := null; end if;
  end if;
  if (new.joined_at, new.join_channel, new.join_actor, new.join_terms_version, new.join_ip, new.join_ua)
     is distinct from (old.joined_at, old.join_channel, old.join_actor, old.join_terms_version, v_old_ip, v_old_ua) then
    if old.joined_at is not null then
      raise exception 'join_record_protected: 참여 기록은 바꿀 수 없습니다';
    end if;
    if not v_writer then
      raise exception 'join_record_protected: 참여 기록은 join_offer() 로만 남길 수 있습니다';
    end if;
  end if;
  if new.withdrawn_at is distinct from old.withdrawn_at then
    if old.withdrawn_at is not null or not v_writer then
      raise exception 'join_record_protected: 철회 기록은 withdraw_offer() 로만 남기고 지울 수 없습니다';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists rfq_invites_guard_join on public.rfq_invites;
create trigger rfq_invites_guard_join before insert or update on public.rfq_invites
  for each row execute function public.rfq_invites_guard_join();

-- 견적 행은 참여한 초대에만 생긴다 (save_quote 밖의 직접 쓰기도 막는다)
create or replace function public.cro_quotes_require_join()
returns trigger
language plpgsql
as $$
begin
  if not exists (select 1 from public.rfq_invites i where i.id = new.invite_id and i.joined_at is not null) then
    raise exception 'not_joined: 기관이 참여하기 전에는 견적을 저장할 수 없습니다';
  end if;
  return new;
end;
$$;
drop trigger if exists cro_quotes_require_join on public.cro_quotes;
create trigger cro_quotes_require_join before insert on public.cro_quotes
  for each row execute function public.cro_quotes_require_join();

-- ─────────────────────────────────────────────
-- 4) 초대(참여 안내) 만들기: 마감 검사만 남긴다. 자리 검사는 join_offer 로 옮겼다 (0012 대체)
--    "지명 기관에만 안내" 요청에는 자동 매칭 안내를 넣지 않는다
-- ─────────────────────────────────────────────
create or replace function public.enforce_invitation_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare r public.rfq_requests%rowtype;
begin
  select * into r from public.rfq_requests where id = new.rfq_id for update;
  if r.selected_quote_id is not null or r.status in ('selected','contracting','closed','cancelled') or r.compared_at is not null then
    raise exception 'request_not_open';
  end if;
  if r.nominees_only and new.source = 'matched' then
    raise exception 'nominees_only';
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_invitation_limit() from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 5) 자리 계산
-- ─────────────────────────────────────────────

-- 평일 기준 n 영업일 전 날짜 (토·일 제외, 공휴일 미반영. lib/dates.ts 와 같은 규칙)
create or replace function public.business_days_before(p_day date, p_n int)
returns date
language plpgsql immutable
as $$
declare d date := p_day; left_n int := greatest(p_n, 0);
begin
  if d is null then return null; end if;
  while left_n > 0 loop
    d := d - 1;
    if extract(isodow from d) < 6 then left_n := left_n - 1; end if;
  end loop;
  return d;
end;
$$;
revoke execute on function public.business_days_before(date, int) from public, anon, authenticated;

-- 요청의 자리 현황. cap: 자리 수(전체면 null) · used: 참여·작성 중·제출 · reserved: 참여 결정 기한 전, 아직 결정하지 않은 지명 기관 수
--   open: 일반 기관이 지금 참여할 수 있는 자리 수(전체면 null)
create or replace function public.offer_seat_state(p_rfq_id uuid)
returns jsonb
language sql stable
security definer set search_path = public
as $$
  with r as (
    select id, case cro_count when '전체' then null when '5곳' then 5 else 3 end as cap, join_by
    from public.rfq_requests where id = p_rfq_id
  ), s as (
    select
      count(*) filter (where i.revoked_at is null and i.withdrawn_at is null and i.status in ('sent', 'draft', 'submitted')
                         and (i.joined_at is not null or i.status in ('draft', 'submitted')))::int as used,
      count(*) filter (where i.source = 'nominated' and i.joined_at is null and i.status = 'sent' and i.revoked_at is null)::int as nominees_pending
    from public.rfq_invites i where i.rfq_id = p_rfq_id
  )
  select jsonb_build_object(
    'cap', r.cap,
    'used', s.used,
    'reserved', case when r.join_by is not null and now() < r.join_by then s.nominees_pending else 0 end,
    'join_by', r.join_by,
    'open', case when r.cap is null then null
                 else greatest(r.cap - s.used - case when r.join_by is not null and now() < r.join_by then s.nominees_pending else 0 end, 0) end
  )
  from r, s
$$;
revoke execute on function public.offer_seat_state(uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 6) 참여: 요청 행 → 초대 행 순서로 잠근다 (save_quote·select_quote·revoke_invite 와 같은 순서)
--    p_channel: portal(기관 포털, 로그인한 그 기관 담당자) · token(회신 링크). p_actor: 로그인한 계정(없으면 null)
--    실패 code: bad_channel · terms_required · not_found · closed 선정·마감 · revoked 취소·토큰 재발급 · withdrawn 철회함 · declined 불참
--              expired 기한 만료 · operator_not_allowed 운영자는 대신 참여 불가 · not_member 다른 기관 담당자 · org_inactive 기관 중지
--              cutoff 참여 마감(회신 기한 3영업일 전) · reserved 남은 자리가 지명 기관 몫 · full 자리 없음
--    이미 참여했으면 기록을 바꾸지 않고 ok, already 로 돌려준다
-- ─────────────────────────────────────────────
create or replace function public.join_offer(p_invite_id uuid, p_token text, p_actor uuid, p_channel text, p_terms_version text, p_ip text, p_ua text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  r public.rfq_requests%rowtype;
  inv public.rfq_invites%rowtype;
  v_role text;
  v_actor_org uuid;
  v_org_status text;
  v_reply date;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_in_window boolean;
  v_cap int;
  v_used int;
  v_reserved int := 0;
  v_now timestamptz := now();
begin
  if p_channel is null or p_channel not in ('portal', 'token') then return jsonb_build_object('ok', false, 'code', 'bad_channel'); end if;
  if nullif(btrim(coalesce(p_terms_version, '')), '') is null then return jsonb_build_object('ok', false, 'code', 'terms_required'); end if;

  select * into r from public.rfq_requests where id = (select rfq_id from public.rfq_invites where id = p_invite_id) for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if r.selected_quote_id is not null
     or r.status in ('selected', 'contracting', 'closed', 'cancelled') or r.compared_at is not null then
    return jsonb_build_object('ok', false, 'code', 'closed');
  end if;

  select * into inv from public.rfq_invites where id = p_invite_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if p_token is null or inv.token is distinct from p_token or inv.revoked_at is not null then
    return jsonb_build_object('ok', false, 'code', 'revoked');
  end if;
  if inv.withdrawn_at is not null then return jsonb_build_object('ok', false, 'code', 'withdrawn'); end if;
  if inv.status = 'declined' then return jsonb_build_object('ok', false, 'code', 'declined'); end if;
  if inv.status not in ('sent', 'draft', 'submitted') then return jsonb_build_object('ok', false, 'code', 'expired'); end if;

  -- 누가 눌렀나: 운영자는 기관 대신 참여할 수 없다. 포털은 그 기관 소속 담당자만. 링크는 다른 기관 소속 담당자만 막는다
  if p_actor is not null then select role, cro_org_id into v_role, v_actor_org from public.profiles where id = p_actor; end if;
  if v_role = 'admin' then return jsonb_build_object('ok', false, 'code', 'operator_not_allowed'); end if;
  if p_channel = 'portal' and (p_actor is null or v_role is distinct from 'cro' or v_actor_org is null or v_actor_org is distinct from inv.cro_org_id) then
    return jsonb_build_object('ok', false, 'code', 'not_member');
  end if;
  if p_channel = 'token' and v_role = 'cro' and v_actor_org is not null and v_actor_org is distinct from inv.cro_org_id then
    return jsonb_build_object('ok', false, 'code', 'not_member');
  end if;

  if inv.joined_at is not null then
    return jsonb_build_object('ok', true, 'already', true, 'joined_at', inv.joined_at, 'channel', inv.join_channel, 'seats', public.offer_seat_state(r.id));
  end if;

  if inv.expires_at < v_now then return jsonb_build_object('ok', false, 'code', 'expired'); end if;
  if inv.cro_org_id is not null then
    select status into v_org_status from public.cro_orgs where id = inv.cro_org_id;
    if v_org_status is distinct from 'approved' then return jsonb_build_object('ok', false, 'code', 'org_inactive'); end if;
  end if;

  -- 참여 마감: 회신 기한이 지났으면 불가. 참여 결정 기한 안이면 가능. 그 뒤에는 회신 기한 3영업일 전까지
  v_reply := coalesce(inv.reply_by, r.reply_by);
  v_in_window := r.join_by is not null and v_now <= r.join_by;
  if v_reply is not null then
    if v_today > v_reply or (not v_in_window and v_today > public.business_days_before(v_reply, 3)) then
      return jsonb_build_object('ok', false, 'code', 'cutoff');
    end if;
  end if;

  -- 자리: 요청 행을 잡고 있으므로 다른 참여는 여기서 기다렸다가 갱신된 수를 본다
  v_cap := case r.cro_count when '전체' then null when '5곳' then 5 else 3 end;
  if v_cap is not null then
    select count(*) into v_used from public.rfq_invites i
     where i.rfq_id = r.id and i.revoked_at is null and i.withdrawn_at is null and i.status in ('sent', 'draft', 'submitted')
       and (i.joined_at is not null or i.status in ('draft', 'submitted'));
    -- 지명 기관 몫: 참여 결정 기한 전, 아직 결정하지 않은 지명 기관(자기 자신은 빼고 센다. 자기 몫 자리를 쓴다)
    if r.join_by is not null and v_now < r.join_by then
      select count(*) into v_reserved from public.rfq_invites i
       where i.rfq_id = r.id and i.id <> inv.id and i.source = 'nominated' and i.joined_at is null and i.status = 'sent' and i.revoked_at is null;
      if inv.source = 'nominated' then v_reserved := 0; end if;
    end if;
    if v_used >= v_cap then return jsonb_build_object('ok', false, 'code', 'full'); end if;
    if v_used + v_reserved >= v_cap then
      return jsonb_build_object('ok', false, 'code', 'reserved', 'join_by', r.join_by);
    end if;
  end if;

  perform set_config('danchu.opt_in_write', 'on', true);
  update public.rfq_invites
     set joined_at = v_now,
         join_channel = p_channel,
         join_actor = case when p_channel = 'portal' then 'member' else 'token:' || left(md5(p_token), 16) end,
         join_user_id = case when v_role is not null then p_actor end,
         join_terms_version = btrim(p_terms_version),
         join_ip = nullif(left(coalesce(p_ip, ''), 100), ''),
         join_ua = nullif(left(coalesce(p_ua, ''), 300), '')
   where id = inv.id;
  perform set_config('danchu.opt_in_write', '', true);

  return jsonb_build_object('ok', true, 'joined_at', v_now, 'channel', p_channel, 'seats', public.offer_seat_state(r.id));
end;
$$;
revoke execute on function public.join_offer(uuid, text, uuid, text, text, text, text) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 7) 철회: 참여한 기관이 제출 전에. 상태는 declined, withdrawn_at 을 남기고 자리를 비운다
--    실패 code: not_found · closed · revoked · not_joined 참여 전(불참으로 처리) · submitted 제출한 견적 · declined · expired
--    이미 철회했으면 ok, already
-- ─────────────────────────────────────────────
create or replace function public.withdraw_offer(p_invite_id uuid, p_token text, p_actor uuid, p_reason text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  r public.rfq_requests%rowtype;
  inv public.rfq_invites%rowtype;
  v_role text;
  v_actor_org uuid;
begin
  select * into r from public.rfq_requests where id = (select rfq_id from public.rfq_invites where id = p_invite_id) for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if r.selected_quote_id is not null
     or r.status in ('selected', 'contracting', 'closed', 'cancelled') or r.compared_at is not null then
    return jsonb_build_object('ok', false, 'code', 'closed');
  end if;

  select * into inv from public.rfq_invites where id = p_invite_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if p_token is null or inv.token is distinct from p_token or inv.revoked_at is not null then
    return jsonb_build_object('ok', false, 'code', 'revoked');
  end if;
  if inv.withdrawn_at is not null then return jsonb_build_object('ok', true, 'already', true); end if;
  if p_actor is not null then select role, cro_org_id into v_role, v_actor_org from public.profiles where id = p_actor; end if;
  if v_role = 'cro' and v_actor_org is not null and v_actor_org is distinct from inv.cro_org_id then
    return jsonb_build_object('ok', false, 'code', 'not_member');
  end if;
  if inv.joined_at is null then return jsonb_build_object('ok', false, 'code', 'not_joined'); end if;
  if inv.status = 'submitted' or exists (select 1 from public.cro_quotes q where q.invite_id = inv.id and q.status = 'submitted') then
    return jsonb_build_object('ok', false, 'code', 'submitted');
  end if;
  if inv.status = 'declined' then return jsonb_build_object('ok', false, 'code', 'declined'); end if;
  if inv.status not in ('sent', 'draft') then return jsonb_build_object('ok', false, 'code', 'expired'); end if;

  perform set_config('danchu.opt_in_write', 'on', true);
  update public.rfq_invites
     set status = 'declined', declined_at = now(), withdrawn_at = now(),
         decline_reason = coalesce(nullif(btrim(coalesce(p_reason, '')), ''), '참여 철회')
   where id = inv.id;
  perform set_config('danchu.opt_in_write', '', true);

  return jsonb_build_object('ok', true, 'seats', public.offer_seat_state(r.id));
end;
$$;
revoke execute on function public.withdraw_offer(uuid, text, uuid, text) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 7-1) 자리 수 바꾸기 (운영자가 의뢰자의 잘못 고른 자리 수를 바로잡을 때).
--      join_offer 와 같이 요청 행을 잠그고 센다. 잠금 밖에서 세면 그 사이 들어온 참여로 참여 수가 자리 수를 넘을 수 있다
--      실패 code: bad_value · not_found · closed 종료·취소 · too_few 이미 참여한 기관 수보다 적게 줄임(used 를 함께 돌려준다)
-- ─────────────────────────────────────────────
create or replace function public.set_seat_count(p_rfq_id uuid, p_cro_count text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  r public.rfq_requests%rowtype;
  v_cap int;
  v_used int;
begin
  if p_cro_count is null or p_cro_count not in ('3곳', '5곳', '전체') then return jsonb_build_object('ok', false, 'code', 'bad_value'); end if;
  select * into r from public.rfq_requests where id = p_rfq_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if r.status in ('closed', 'cancelled') then return jsonb_build_object('ok', false, 'code', 'closed'); end if;
  v_cap := case p_cro_count when '전체' then null when '5곳' then 5 else 3 end;
  select count(*) into v_used from public.rfq_invites i
   where i.rfq_id = r.id and i.revoked_at is null and i.withdrawn_at is null and i.status in ('sent', 'draft', 'submitted')
     and (i.joined_at is not null or i.status in ('draft', 'submitted'));
  if v_cap is not null and v_used > v_cap then return jsonb_build_object('ok', false, 'code', 'too_few', 'used', v_used); end if;
  update public.rfq_requests set cro_count = p_cro_count where id = r.id;
  return jsonb_build_object('ok', true, 'used', v_used, 'before', r.cro_count);
end;
$$;
revoke execute on function public.set_seat_count(uuid, text) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 8) 회신 저장·제출: 참여 기록이 없으면 not_joined (운영자 대리 입력 포함). 철회한 초대는 withdrawn. 나머지는 0022 와 같다
-- ─────────────────────────────────────────────
create or replace function public.save_quote(p_invite_id uuid, p_header jsonb, p_items jsonb, p_submit boolean, p_actor uuid, p_token text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  inv public.rfq_invites%rowtype;
  r public.rfq_requests%rowtype;
  v_quote uuid;
  v_prev_status text;
  v_total int;
  v_done int;
  v_joined int;
  v_source text := case when p_header->>'entry_source' = 'operator' then 'operator' else 'cro' end;
  v_role text;
  v_actor_org uuid;
  v_org_status text;
begin
  -- 요청 행을 먼저 잠근다. select_quote·revoke_invite·join_offer 도 요청 행부터 잠그므로, 선정·취소·참여하는 순간 들어온 저장은 그 뒤에 처리되어 아래에서 막힌다
  select * into r from public.rfq_requests where id = (select rfq_id from public.rfq_invites where id = p_invite_id) for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  -- 선정 여부는 상태가 아니라 selected_quote_id 로 본다 (늦게 끝난 배포가 상태를 덮어써도 선정은 남아 있다)
  if r.selected_quote_id is not null
     or r.status in ('selected', 'contracting', 'closed', 'cancelled') or r.compared_at is not null then
    return jsonb_build_object('ok', false, 'code', 'closed');
  end if;

  select * into inv from public.rfq_invites where id = p_invite_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;

  -- 화면을 열 때 검사한 것과 지금이 다를 수 있다 (그 사이 취소·담당자 제외·기관 중지·철회)
  if p_token is null or inv.token is distinct from p_token or inv.revoked_at is not null then
    return jsonb_build_object('ok', false, 'code', 'revoked');
  end if;
  if inv.withdrawn_at is not null then return jsonb_build_object('ok', false, 'code', 'withdrawn'); end if;
  if inv.status = 'declined' then return jsonb_build_object('ok', false, 'code', 'declined'); end if;
  if inv.status not in ('sent', 'draft', 'submitted') then return jsonb_build_object('ok', false, 'code', 'expired'); end if;
  -- 기관 본인이 참여하기 전에는 누구도(운영자 대리 입력 포함) 견적을 저장하지 못한다 (0023)
  if inv.joined_at is null then return jsonb_build_object('ok', false, 'code', 'not_joined'); end if;
  if p_actor is not null then select role, cro_org_id into v_role, v_actor_org from public.profiles where id = p_actor; end if;
  if coalesce(v_role, '') <> 'admin' and inv.expires_at < now() then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;
  if inv.cro_org_id is not null then
    select status into v_org_status from public.cro_orgs where id = inv.cro_org_id;
    if v_org_status is distinct from 'approved' then return jsonb_build_object('ok', false, 'code', 'org_inactive'); end if;
  end if;
  -- 다른 기관 소속으로 로그인한 담당자는 이 기관 링크로 저장하지 못한다. 소속이 없는 계정(합류 신청 중 등)·운영자·토큰만 가진 사람은 토큰으로 판단
  if v_role = 'cro' and v_actor_org is not null and v_actor_org is distinct from inv.cro_org_id then
    return jsonb_build_object('ok', false, 'code', 'not_member');
  end if;

  select id, status into v_quote, v_prev_status from public.cro_quotes where invite_id = inv.id for update;

  if not p_submit and v_prev_status = 'submitted' then
    return jsonb_build_object('ok', true, 'skipped', true, 'quote_id', v_quote);
  end if;

  if v_quote is null then
    insert into public.cro_quotes (
      invite_id, rfq_id, rfq_no, cro_name, cro_org_id,
      total_amount, total_weeks, vat, valid_until, auto, start_date, pay_terms, substance_qty, report_lang, includes, note,
      pdf_path, pdf_name, pdf_size,
      status, submitted_at, submitted_by, entry_source
    ) values (
      inv.id, inv.rfq_id, inv.rfq_no, inv.cro_name, inv.cro_org_id,
      (p_header->>'total_amount')::bigint, (p_header->>'total_weeks')::int, coalesce(p_header->>'vat', '별도'),
      (p_header->>'valid_until')::date, coalesce((p_header->>'auto')::boolean, false), (p_header->>'start_date')::date,
      p_header->>'pay_terms', p_header->>'substance_qty', p_header->>'report_lang',
      coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_header->'includes', '[]'::jsonb)) x), '{}'::text[]),
      coalesce(p_header->>'note', ''),
      p_header->>'pdf_path', p_header->>'pdf_name', (p_header->>'pdf_size')::bigint,
      case when p_submit then 'submitted' else 'draft' end,
      case when p_submit then now() else null end,
      case when p_submit then p_actor else null end,
      case when p_submit then v_source else 'cro' end
    ) returning id into v_quote;
  else
    update public.cro_quotes set
      cro_name = inv.cro_name, cro_org_id = inv.cro_org_id,
      total_amount = (p_header->>'total_amount')::bigint, total_weeks = (p_header->>'total_weeks')::int,
      vat = coalesce(p_header->>'vat', '별도'), valid_until = (p_header->>'valid_until')::date,
      auto = coalesce((p_header->>'auto')::boolean, false), start_date = (p_header->>'start_date')::date,
      pay_terms = p_header->>'pay_terms', substance_qty = p_header->>'substance_qty', report_lang = p_header->>'report_lang',
      includes = coalesce((select array_agg(x) from jsonb_array_elements_text(coalesce(p_header->'includes', '[]'::jsonb)) x), '{}'::text[]),
      note = coalesce(p_header->>'note', ''),
      pdf_path = coalesce(p_header->>'pdf_path', pdf_path),
      pdf_name = coalesce(p_header->>'pdf_name', pdf_name),
      pdf_size = coalesce((p_header->>'pdf_size')::bigint, pdf_size),
      status = case when p_submit then 'submitted' else 'draft' end,
      submitted_at = case when p_submit then now() else null end,
      submitted_by = case when p_submit then p_actor else null end,
      entry_source = case when p_submit then v_source else entry_source end
    where id = v_quote;
  end if;

  insert into public.cro_quote_items (quote_id, seq, category, name, cond, avail, amount, weeks, reason, design, source, unit, unit_price, sample_count)
  select v_quote, (i->>'seq')::int, i->>'category', i->>'name', i->>'cond', i->>'avail',
         (i->>'amount')::bigint, (i->>'weeks')::int, i->>'reason',
         coalesce(i->'design', '{}'::jsonb), coalesce(i->>'source', 'manual'), coalesce(i->>'unit', 'total'),
         (i->>'unit_price')::bigint, (i->>'sample_count')::int
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i
  on conflict (quote_id, seq) do update set
    category = excluded.category, name = excluded.name, cond = excluded.cond, avail = excluded.avail,
    amount = excluded.amount, weeks = excluded.weeks, reason = excluded.reason, design = excluded.design,
    source = excluded.source, unit = excluded.unit, unit_price = excluded.unit_price, sample_count = excluded.sample_count;

  update public.rfq_invites set status = case when p_submit then 'submitted' else 'draft' end where id = inv.id;

  if p_submit then
    update public.rfq_requests set status = 'quoted' where id = inv.rfq_id and status in ('received', 'distributed');
  end if;

  select count(*), count(*) filter (where status = 'submitted'),
         count(*) filter (where revoked_at is null and withdrawn_at is null and status in ('sent', 'draft', 'submitted')
                            and (joined_at is not null or status in ('draft', 'submitted')))
    into v_total, v_done, v_joined from public.rfq_invites where rfq_id = inv.rfq_id;

  -- total_invites 는 안내한 초대 전부(운영자 알림용). 의뢰자에게는 joined_invites(자리를 차지한 참여 기관 수)만 쓴다.
  -- 안내 수·불참 수는 의뢰자에게 알리지 않는다 (설계 규칙표 "불참")
  return jsonb_build_object('ok', true, 'quote_id', v_quote, 'first', coalesce(v_prev_status, '') <> 'submitted',
                            'total_invites', v_total, 'submitted_invites', v_done, 'joined_invites', v_joined);
end;
$$;
revoke execute on function public.save_quote(uuid, jsonb, jsonb, boolean, uuid, text) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 9) 청구: 참여 기록(portal·token)이 있는 초대의 견적만. 반환 열이 늘어 지우고 다시 만든다
--    join_status: joined 참여 기록 있음 · legacy 0023 전 견적(청구하지 않음) · not_joined 참여 기록 없음(청구하지 않음)
--                 pilot 시범운영 조건 판(pilot-…)으로 참여(청구하지 않음. 약관 제5조 "시범운영 기간에 참여한 요청은 그 뒤에도 무료")
--    시범 판으로 참여한 요청은 유료 전환 뒤에 제출하거나 수주해도 건당 이용료·성사수수료를 매기지 않는다 (아래 j.ok, billing_awards ijoined)
--    billable 은 지금처럼 운영자 청구 제외 여부(rfq_invites.billable)다. 청구 여부는 chargeable·fee_due 와 billing_summary 가 둘을 함께 본다
-- ─────────────────────────────────────────────
drop function if exists public.billing_lines(date, date);
create or replace function public.billing_lines(p_from date, p_to date)
returns table (
  quote_id uuid, invite_id uuid, rfq_id uuid, rfq_no text, org_id uuid, org_name text, managed boolean,
  first_submitted_at timestamptz, billing_at timestamptz, total_amount bigint, entry_source text, auto boolean, invite_source text,
  billable boolean, bill_excluded_reason text, tier text, chargeable boolean, per_request_fee int, fee_due bigint,
  join_status text, joined_at timestamptz
)
language sql stable
security definer set search_path = public
as $$
  select
    q.id, q.invite_id, q.rfq_id, q.rfq_no, o.id, o.name, o.managed,
    q.first_submitted_at, q.billing_at, q.total_amount, q.entry_source, q.auto, i.source,
    i.billable, i.bill_excluded_reason,
    public.billing_tier(q.total_amount),
    (i.billable and j.ok and public.billing_tier(q.total_amount) in ('per_quote', 'per_quote_success')),
    o.per_request_fee,
    case when i.billable and j.ok and public.billing_tier(q.total_amount) in ('per_quote', 'per_quote_success')
         then o.per_request_fee::bigint else 0 end,
    j.status, i.joined_at
  from public.cro_quotes q
  join public.rfq_invites i on i.id = q.invite_id
  join public.cro_orgs o on o.id = coalesce(q.cro_org_id, i.cro_org_id)
  cross join lateral (
    select case when i.joined_at is null then 'not_joined' when i.join_channel = 'legacy' then 'legacy'
                when coalesce(i.join_terms_version, '') like 'pilot-%' then 'pilot' else 'joined' end as status,
           (i.joined_at is not null and i.join_channel in ('portal', 'token') and coalesce(i.join_terms_version, '') not like 'pilot-%') as ok
  ) j
  where q.status = 'submitted'
    and q.first_submitted_at is not null
    and (coalesce(q.billing_at, q.first_submitted_at) at time zone 'Asia/Seoul')::date >= p_from
    and (coalesce(q.billing_at, q.first_submitted_at) at time zone 'Asia/Seoul')::date <  p_to
  order by o.name, coalesce(q.billing_at, q.first_submitted_at);
$$;
revoke execute on function public.billing_lines(date, date) from public, anon, authenticated;

-- 성사수수료: invite_joined 를 더한다. 참여 기록이 없는 초대(legacy 포함)의 수주는 행은 보이지만 명세 합계에 넣지 않는다
drop function if exists public.billing_awards(date, date);
create or replace function public.billing_awards(p_from date, p_to date)
returns table (
  kind text, award_id uuid, rfq_id uuid, rfq_no text, org_id uuid, org_name text,
  quote_amount bigint, contract_amount bigint, contract_status text,
  awarded_at timestamptz, contract_date date, contract_reported_at timestamptz,
  fee_rate numeric, fee bigint, invite_billable boolean, invite_joined boolean
)
language sql stable
security definer set search_path = public
as $$
  with a as (
    select a.*, coalesce(a.fee_basis_amount, q.total_amount) as basis, r.rfq_no as no,
           o.id as oid, o.name as oname, o.fee_rate as rate, coalesce(i.billable, true) as ibill,
           coalesce(i.joined_at is not null and i.join_channel in ('portal', 'token') and coalesce(i.join_terms_version, '') not like 'pilot-%', false) as ijoined
    from public.rfq_awards a
    join public.rfq_requests r on r.id = a.rfq_id
    left join public.cro_quotes q on q.id = a.quote_id
    left join public.rfq_invites i on i.id = a.invite_id
    join public.cro_orgs o on o.id = coalesce(a.cro_org_id, q.cro_org_id)
    where coalesce(a.fee_basis_amount, q.total_amount) >= public.billing_success_fee_min()
  )
  select 'guidance', a.id, a.rfq_id, a.no, a.oid, a.oname, a.basis, a.contract_amount, a.contract_status,
         a.awarded_at, a.contract_date, a.contract_reported_at, a.rate, round(a.basis * a.rate)::bigint, a.ibill, a.ijoined
  from a
  where a.contract_status <> 'not_signed'
    and (a.awarded_at at time zone 'Asia/Seoul')::date >= p_from
    and (a.awarded_at at time zone 'Asia/Seoul')::date <  p_to
  union all
  select 'settlement', a.id, a.rfq_id, a.no, a.oid, a.oname, a.basis, a.contract_amount, a.contract_status,
         a.awarded_at, a.contract_date, a.contract_reported_at, a.rate, round(a.contract_amount * a.rate)::bigint, a.ibill, a.ijoined
  from a
  where a.contract_status = 'signed'
    and a.contract_reported_at is not null
    and a.contract_amount is not null
    and (a.contract_reported_at at time zone 'Asia/Seoul')::date >= p_from
    and (a.contract_reported_at at time zone 'Asia/Seoul')::date <  p_to
  order by 1, 6, 10;
$$;
revoke execute on function public.billing_awards(date, date) from public, anon, authenticated;

-- 월별 기관 명세: 반환 열은 0020 과 같다. 견적 수 중 billable·subscription·per_quote 등은 참여 기록이 있는 견적만 센다.
--   excluded 는 청구하지 않는 견적 전부(운영자 제외 + 참여 기록 없음 + legacy). 성사수수료 합계도 참여 기록이 있는 수주만
create or replace function public.billing_summary(p_from date, p_to date)
returns table (
  org_id uuid, org_name text, managed boolean, per_request_fee int, fee_rate numeric, monthly_fee int,
  delivered int, matched int, nominated int, manual int, declined int, unanswered int,
  quoted int, billable int, excluded int, no_amount int, subscription int, per_quote int, success_eligible int,
  per_quote_fee bigint, selected int,
  guidance_count int, guidance_fee bigint,
  settled_count int, settled_contract_amount bigint, settled_fee bigint,
  total_due bigint, terms_pending boolean
)
language sql stable
security definer set search_path = public
as $$
  with inv as (
    select i.cro_org_id as oid,
           count(*)::int as delivered,
           count(*) filter (where i.source = 'matched')::int as matched,
           count(*) filter (where i.source = 'nominated')::int as nominated,
           count(*) filter (where i.source = 'manual')::int as manual,
           count(*) filter (where i.status = 'declined')::int as declined,
           count(*) filter (where i.status in ('sent', 'draft', 'expired'))::int as unanswered
    from public.rfq_invites i
    where i.cro_org_id is not null
      and (i.sent_at at time zone 'Asia/Seoul')::date >= p_from
      and (i.sent_at at time zone 'Asia/Seoul')::date <  p_to
    group by i.cro_org_id
  ),
  ln as (
    select l.org_id as oid,
           count(*)::int as quoted,
           count(*) filter (where l.billable and l.join_status = 'joined' and l.tier <> 'no_amount')::int as billable,
           count(*) filter (where not (l.billable and l.join_status = 'joined'))::int as excluded,
           count(*) filter (where l.billable and l.join_status = 'joined' and l.tier = 'no_amount')::int as no_amount,
           count(*) filter (where l.billable and l.join_status = 'joined' and l.tier = 'subscription')::int as subscription,
           count(*) filter (where l.chargeable)::int as per_quote,
           count(*) filter (where l.billable and l.join_status = 'joined' and l.tier = 'per_quote_success')::int as success_eligible,
           count(aw.id)::int as selected
    from public.billing_lines(p_from, p_to) l
    left join public.rfq_awards aw on aw.quote_id = l.quote_id
    group by l.org_id
  ),
  ga as (
    select b.org_id as oid,
           count(*) filter (where b.kind = 'guidance' and b.invite_joined)::int as guidance_count,
           sum(b.fee) filter (where b.kind = 'guidance' and b.invite_joined)::bigint as guidance_fee,
           count(*) filter (where b.kind = 'settlement' and b.invite_joined)::int as settled_count,
           coalesce(sum(b.contract_amount) filter (where b.kind = 'settlement' and b.invite_joined), 0)::bigint as settled_contract_amount,
           sum(b.fee) filter (where b.kind = 'settlement' and b.invite_joined)::bigint as settled_fee
    from public.billing_awards(p_from, p_to) b
    group by b.org_id
  ),
  sub as (
    select o.id as oid, o.monthly_fee
    from public.cro_orgs o
    where o.monthly_fee is not null and o.status = 'approved'
      and o.monthly_fee_from is not null and o.monthly_fee_from < p_to
      and p_from <= (now() at time zone 'Asia/Seoul')::date
  ),
  ids as (
    select oid from inv union select oid from ln union select oid from ga union select oid from sub
  ),
  t as (
    select o.id, o.name, o.managed, o.per_request_fee, o.fee_rate,
           sub.monthly_fee,
           coalesce(inv.delivered, 0) as delivered, coalesce(inv.matched, 0) as matched,
           coalesce(inv.nominated, 0) as nominated, coalesce(inv.manual, 0) as manual,
           coalesce(inv.declined, 0) as declined, coalesce(inv.unanswered, 0) as unanswered,
           coalesce(ln.quoted, 0) as quoted, coalesce(ln.billable, 0) as billable,
           coalesce(ln.excluded, 0) as excluded, coalesce(ln.no_amount, 0) as no_amount,
           coalesce(ln.subscription, 0) as subscription, coalesce(ln.per_quote, 0) as per_quote,
           coalesce(ln.success_eligible, 0) as success_eligible, coalesce(ln.selected, 0) as selected,
           coalesce(ga.guidance_count, 0) as guidance_count,
           case when coalesce(ga.guidance_count, 0) = 0 then 0
                when o.fee_rate is null then null else ga.guidance_fee end as guidance_fee,
           coalesce(ga.settled_count, 0) as settled_count,
           coalesce(ga.settled_contract_amount, 0) as settled_contract_amount,
           case when coalesce(ga.settled_count, 0) = 0 then 0
                when o.fee_rate is null then null else ga.settled_fee end as settled_fee
    from ids
    join public.cro_orgs o on o.id = ids.oid
    left join inv on inv.oid = o.id
    left join ln on ln.oid = o.id
    left join ga on ga.oid = o.id
    left join sub on sub.oid = o.id
  ),
  f as (
    select t.*,
           case when t.per_quote = 0 then 0
                when t.per_request_fee is null then null
                else t.per_quote::bigint * t.per_request_fee end as per_quote_fee
    from t
  )
  select
    f.id, f.name, f.managed, f.per_request_fee, f.fee_rate, f.monthly_fee,
    f.delivered, f.matched, f.nominated, f.manual, f.declined, f.unanswered,
    f.quoted, f.billable, f.excluded, f.no_amount, f.subscription, f.per_quote, f.success_eligible,
    f.per_quote_fee, f.selected,
    f.guidance_count, f.guidance_fee,
    f.settled_count, f.settled_contract_amount, f.settled_fee,
    (coalesce(f.monthly_fee, 0) + coalesce(f.per_quote_fee, 0) + coalesce(f.settled_fee, 0))::bigint,
    (f.per_quote_fee is null or f.settled_fee is null)
  from f
  order by 27 desc, f.quoted desc, f.name;
$$;
revoke execute on function public.billing_summary(date, date) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 10) 스키마 판
-- ─────────────────────────────────────────────
create or replace function public.danchu_schema_version()
returns int
language sql
immutable
as $$ select 23 $$;
comment on function public.danchu_schema_version() is
  '마지막으로 적용한 마이그레이션 번호 (0023). 앱(lib/schema-version.ts REQUIRED_SCHEMA_VERSION)과 npm run check:schema 가 확인한다. 다음 마이그레이션이 새 번호로 바꾼다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 11) 실행 권한: 트리거 함수는 공개 실행권을 없애고, 서버(service role)가 부르는 함수는 명시해 둔다
--     (billing_lines·billing_awards 는 지우고 다시 만들어 0022 의 grant 가 사라졌다)
-- ─────────────────────────────────────────────
revoke execute on function public.rfq_invites_guard_join() from public, anon, authenticated;
revoke execute on function public.cro_quotes_require_join() from public, anon, authenticated;
revoke execute on function public.auth_user_exists(uuid) from public, anon, authenticated;
grant execute on function public.join_offer(uuid, text, uuid, text, text, text, text) to service_role;
grant execute on function public.withdraw_offer(uuid, text, uuid, text) to service_role;
grant execute on function public.offer_seat_state(uuid) to service_role;
grant execute on function public.auth_user_exists(uuid) to service_role;
grant execute on function public.set_seat_count(uuid, text) to service_role;
grant execute on function public.business_days_before(date, int) to service_role;
grant execute on function public.save_quote(uuid, jsonb, jsonb, boolean, uuid, text) to service_role;
grant execute on function public.billing_summary(date, date) to service_role;
grant execute on function public.billing_lines(date, date) to service_role;
grant execute on function public.billing_awards(date, date) to service_role;
grant execute on function public.danchu_schema_version() to service_role;
