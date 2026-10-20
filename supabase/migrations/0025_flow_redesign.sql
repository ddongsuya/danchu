-- 단추(Danchu) 25차: 흐름 재설계 (2026-10-20 대표 결정 "1~3 추천대로") · 접수 시작 시점 · 보내기 직전 가입 · 비교표 공개 조건 ·
--                   계약 확인과 7일 자동 확정 · 확인된 계약만 성사수수료 정산 · 불참 되돌리기
-- 0024 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경 (2026-10-20 결정, 이 파일이 기준. 디자인 세션의 0019_flow_redesign 을 참여 선택형(0023)·보안(0021·0022)·청구(0020·0023·0024) 위에 다시 썼다)
-- 0) 안내는 참여 선택형 그대로다(0023): 분야가 맞는 승인 기관 모두와 지명 기관에 참여 안내가 가고, 기관이 참여해야 견적을 쓴다.
--    자동 초대와 "최근 30일 받은 수가 적은 기관부터" 순번은 쓰지 않는다. 접수와 안내는 나눈다:
--    rfq_requests.started_at 은 첨부 업로드가 끝난 뒤 한 번만 채운다(lib/rfq-create.ts startRfq, /api/rfq/[no]/start). 접수 메일과 안내 결과는 한 통으로 보낸다.
--    기존 요청은 이미 시작된 것으로 채운다 (예약 작업이 옛 요청에 다시 안내·접수 메일을 보내지 않게). 이 채우기는 열을 처음 만들 때 한 번만 한다.
-- 1) 비교표 공개 (0019 의 "실시간 비교·기한 전 선택"을 대신한다). rfq_requests.compared_at 은 다시 "비교표 공개 시각"이다.
--    열리기 전 의뢰자는 진행 현황(참여 n곳, 제출 m곳)만 보고 기관 이름·금액·견적은 보지 못한다 (지명 기관만 이름과 참여 상태). 앱이 지킨다.
--    열리는 때: (a) 참여한 기관(철회·취소 제외)이 모두 제출했고, 제출이 1건 이상이고, 더 참여할 수 없을 때(자리가 다 찼거나 참여 결정 기한이 지났다).
--               마지막 제출(save_quote)·철회(withdraw_offer)가 같은 트랜잭션에서 열고 compare_opened 를 돌려준다. 예약 작업은 open_ready_comparisons() 를 부른다.
--               "더 참여할 수 없을 때"를 둔 까닭: 첫 기관이 참여하자마자 제출하면 다른 기관이 참여하기 전에 비교표가 열려 비교가 되지 않는다.
--           (b) 회신 기한 다음 날 예약 작업(제출 0건이면 열지 않는다, 운영자·의뢰자 안내는 지금처럼) (c) 운영자 회신 마감(약관 제4조7항 조건, 앱)
--    선택(select_quote)은 열린 뒤에만 된다 (not_compared). "기한 전 확인 단계" 선택 경로는 없앤다.
--    운영자가 취소한 초대(revoked·expired)·불참·철회 초대의 저장·제출 거절은 0021·0023 의 save_quote 가 이미 한다 (디자인 세션의 save_quote 재정의는 쓰지 않는다).
-- 2) 계약 확인: 기관이 체결(체결일·금액)을 보고하면(report_contract) 의뢰자가 확인(confirm_contract)하거나 이의(dispute_contract)를 낸다.
--    보고(또는 확인 전 정정) 뒤 7일 안에 둘 다 없으면 예약 작업(auto_confirm_contracts)이 보고 내용대로 확정한다.
--    이의가 있으면 운영자가 정리(resolve_contract_dispute: confirm 보고대로 확정 · reject 보고 취소, 기관이 다시 보고)할 때까지 확정·정산하지 않는다. 정리는 admin_audit 에 남긴다.
--    확인·이의 열은 이 함수들만 쓴다 (트리거). 확정한 계약은 확정을 되돌릴 수 없다 (바로잡을 금액은 0024 조정 항목).
--    0025 전 지난 달까지 보고된 계약은 보고 시각에 확인된 것으로 둔다(contract_confirmed_via = legacy). 지난 달 정산과 마감 저장본이 그대로 맞는다.
--    적용한 달(서울)에 보고된 계약은 확정하지 않고 적용 시각부터 7일 확인 기한을 준다 (의뢰자 확인·이의, 없으면 자동 확정).
-- 3) 성사수수료 정산: 확인된 계약만, 확인된 달(contract_confirmed_at, 서울)에, 확인된 계약 금액 × 요율.
--    대상 판정은 여전히 선정 견적 5,000만 원 이상(fee_basis_amount). 구간·참여 기록 조건(0023)·시범 판 미청구·월 마감 고정·조정·참고 수치(0024)는 그대로다.
--    billing_awards 만 다시 만든다 (billing_summary·billing_reference·billing_snapshot 은 billing_awards 를 읽으므로 그대로 따라온다).
--    디자인 세션의 billing_summary 재정의("보고한 달의 계약 금액", contracted 열)는 쓰지 않는다. 같은 뜻은 settled_count·settled_contract_amount 가 낸다.
-- 4) 불참 되돌리기: 참여 전 불참(declined, 참여 기록 없음)은 참여 결정 기한(join_by) 전이고 자리가 남았으면 다시 참여할 수 있다 (join_offer, rejoined).
--    다시 참여한 시각은 rfq_invites.decline_undone_at 에 남고, 앞선 불참 기록(declined_at·decline_reason)은 그대로 둔다. 참여 뒤 철회(withdrawn_at)는 되돌릴 수 없다.
-- 5) 보내기 직전 가입(rfq_pending): 로그인하지 않은 의뢰자가 보내기를 누른 순간의 요청서. 7일 보관, 예약 작업이 정리한다.
--    서비스 키로만 읽고 쓴다 (RLS 켜짐·정책 없음·anon·authenticated 권한 회수). 요청은 이메일이 확인된 계정으로만 만든다 (아래 트리거).
--    임시 첨부(저장소 pending/…)는 정식 요청의 첨부(rfq_files)가 될 수 없다. 접수 때 요청 폴더로 옮긴 뒤에만 rfq_files 에 넣는다 (기관에 보이지 않는다).
--
-- 알려진 한계: 이 파일 뒤에 0023 을 다시 적용하면 billing_awards·save_quote·join_offer·withdraw_offer 가 0023 판으로 돌아간다(정산 월이 보고 달로).
-- 그때는 0024 와 이 파일을 차례로 한 번 더 적용한다. 0022 를 다시 적용하면 select_quote 의 비교표 공개 검사가 빠지므로 이 파일을 한 번 더 적용한다.

-- ─────────────────────────────────────────────
-- 0) 선행 마이그레이션 확인 (빠졌으면 여기서 멈춘다)
-- ─────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.danchu_schema_version()') is null
     or to_regclass('public.billing_adjustments') is null
     or to_regprocedure('public.billing_month_lock(date)') is null
     or public.danchu_schema_version() < 24 then
    raise exception '0025 를 적용하기 전에 0019 부터 0024 까지 순서대로 적용해 주세요.';
  end if;
end $$;

-- ─────────────────────────────────────────────
-- 1) 접수 시작 시점 (started_at). 열을 처음 만들 때만 기존 요청을 "시작함"으로 채운다
--    (다시 적용할 때 채우면 첨부 업로드 중인 새 요청이 안내 없이 시작한 것으로 바뀐다)
-- ─────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'rfq_requests' and column_name = 'started_at') then
    alter table public.rfq_requests add column started_at timestamptz;
    update public.rfq_requests set started_at = coalesce(distributed_at, created_at) where started_at is null;
  end if;
end $$;
comment on column public.rfq_requests.started_at is
  '참여 안내와 접수 메일을 시작한 시각 (0025). 첨부 업로드가 끝난 뒤 startRfq 가 한 번만 채운다. 비어 있으면 아직 안내하지 않았다. 0025 전 요청은 안내 시각(없으면 접수 시각)';
create index if not exists rfq_requests_unstarted_idx on public.rfq_requests (created_at) where started_at is null;

-- ─────────────────────────────────────────────
-- 2) 보내기 직전 가입용 임시 요청서
-- ─────────────────────────────────────────────
create table if not exists public.rfq_pending (
  token text primary key,
  email text not null,
  payload jsonb not null,
  files jsonb not null default '[]',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  verify_attempts int not null default 0,
  verify_type text,                    -- generateLink 가 돌려준 인증 종류 (signup | magiclink)
  claimed_at timestamptz,
  claimed_rfq_no text,
  claimed_user uuid references auth.users(id) on delete set null,
  ip text
);
create index if not exists rfq_pending_email_idx on public.rfq_pending (lower(email));
create index if not exists rfq_pending_expires_idx on public.rfq_pending (expires_at) where claimed_at is null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'rfq_pending_token_chk') then
    alter table public.rfq_pending add constraint rfq_pending_token_chk check (token ~ '^[A-Za-z0-9_-]{24,64}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rfq_pending_email_chk') then
    alter table public.rfq_pending add constraint rfq_pending_email_chk check (email = lower(btrim(email)) and email like '%_@_%' and length(email) <= 320);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rfq_pending_attempts_chk') then
    alter table public.rfq_pending add constraint rfq_pending_attempts_chk check (verify_attempts >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rfq_pending_files_chk') then
    alter table public.rfq_pending add constraint rfq_pending_files_chk check (jsonb_typeof(files) = 'array' and jsonb_array_length(files) <= 10);
  end if;
  -- 요청 번호가 생겼으면 잡은 시각도 있다
  if not exists (select 1 from pg_constraint where conname = 'rfq_pending_claim_chk') then
    alter table public.rfq_pending add constraint rfq_pending_claim_chk check (claimed_rfq_no is null or claimed_at is not null);
  end if;
end $$;
alter table public.rfq_pending enable row level security;
-- 서비스 키로만 읽고 쓴다 (정책 없음, 공개 역할의 표 권한도 없앤다)
revoke all on table public.rfq_pending from public, anon, authenticated;
grant select, insert, update, delete on table public.rfq_pending to service_role;
comment on table public.rfq_pending is
  '보내기 직전 가입용 임시 요청서 (0025). 이메일 인증이 끝나면 정식 요청(rfq_requests)이 된다. 7일 보관, 예약 작업이 정리. 서비스 키로만 읽고 쓴다';

-- 임시 첨부(저장소 pending/…)는 정식 요청 첨부가 될 수 없다. 접수 때 요청 폴더로 옮긴 경로만 넣는다
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'rfq_files_not_pending_chk') then
    alter table public.rfq_files add constraint rfq_files_not_pending_chk check (storage_path not like 'pending/%');
  end if;
end $$;

-- 요청은 이메일이 확인된 계정으로만 만든다 (보내기 직전 가입은 인증번호·메일 버튼으로 확인한 뒤에 요청이 생긴다).
-- 계정 없는 요청(운영자 기록 등, user_id 없음)은 그대로 둔다
create or replace function public.auth_user_confirmed(p_user uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$ select exists (select 1 from auth.users u where u.id = p_user and u.email_confirmed_at is not null) $$;
revoke execute on function public.auth_user_confirmed(uuid) from public, anon, authenticated;

create or replace function public.rfq_requests_require_confirmed()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is not null and not public.auth_user_confirmed(new.user_id) then
    raise exception 'email_not_confirmed: 이메일을 확인한 계정으로만 요청을 만들 수 있습니다';
  end if;
  return new;
end;
$$;
revoke execute on function public.rfq_requests_require_confirmed() from public, anon, authenticated;
drop trigger if exists rfq_requests_require_confirmed on public.rfq_requests;
create trigger rfq_requests_require_confirmed before insert on public.rfq_requests
  for each row execute function public.rfq_requests_require_confirmed();

-- ─────────────────────────────────────────────
-- 3) 불참 되돌리기 기록 + 참여 기록 보호 (0023 트리거에 decline_undone_at 을 더한다)
-- ─────────────────────────────────────────────
alter table public.rfq_invites add column if not exists decline_undone_at timestamptz;
comment on column public.rfq_invites.decline_undone_at is
  '참여 전 불참을 되돌려 다시 참여한 시각 (0025). join_offer 만 채우고 바꿀 수 없다. 앞선 불참 기록(declined_at·decline_reason)은 그대로 남는다';

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
        or new.join_terms_version is not null or new.join_ip is not null or new.join_ua is not null or new.withdrawn_at is not null
        or new.decline_undone_at is not null)
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
  -- 접속 기록(IP·브라우저)은 보존 기간(3개월)이 지나면 비울 수만 있다
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
  -- 불참 되돌리기 기록 (0025): join_offer 만 한 번 남기고 지울 수 없다
  if new.decline_undone_at is distinct from old.decline_undone_at then
    if old.decline_undone_at is not null or not v_writer then
      raise exception 'join_record_protected: 불참 되돌리기 기록은 join_offer() 로만 남기고 지울 수 없습니다';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.rfq_invites_guard_join() from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 4) 비교표 공개 조건
--    seated(자리를 차지한 참여 기관): 취소·철회 아님, sent·draft·submitted, 참여 기록 있음(또는 0023 전 작성 중·제출)
--    ready: 열려 있는 요청(선정 전, distributed·quoted, compared_at 없음), 제출 1건 이상, seated 가 모두 제출,
--           더 참여할 수 없음(자리 수가 있고 다 찼거나, 참여 결정 기한이 없거나 지났다)
-- ─────────────────────────────────────────────
create or replace function public.compare_readiness(p_rfq_id uuid)
returns jsonb
language sql stable
security definer set search_path = public
as $$
  with r as (
    select id, status, compared_at, selected_quote_id, join_by,
           case cro_count when '전체' then null when '5곳' then 5 else 3 end as cap
    from public.rfq_requests where id = p_rfq_id
  ), s as (
    select
      count(*) filter (where i.revoked_at is null and i.withdrawn_at is null and i.status in ('sent', 'draft', 'submitted')
                         and (i.joined_at is not null or i.status in ('draft', 'submitted')))::int as joined,
      count(*) filter (where i.revoked_at is null and i.withdrawn_at is null and i.status = 'submitted')::int as submitted
    from public.rfq_invites i where i.rfq_id = p_rfq_id
  ), x as (
    select r.*, s.joined, s.submitted,
           ((r.cap is not null and s.joined >= r.cap) or (r.join_by is not null and now() >= r.join_by)) as joins_closed,
           (r.compared_at is null and r.selected_quote_id is null and r.status in ('distributed', 'quoted')) as is_open
    from r, s
  )
  select jsonb_build_object(
    'joined', x.joined,
    'submitted', x.submitted,
    'pending', x.joined - x.submitted,
    'cap', x.cap,
    'join_by', x.join_by,
    'joins_closed', x.joins_closed,
    'compared', x.compared_at is not null,
    'ready', x.is_open and x.submitted >= 1 and x.joined = x.submitted and x.joins_closed
  )
  from x
$$;
revoke execute on function public.compare_readiness(uuid) from public, anon, authenticated;

-- 조건이 맞으면 비교표를 연다. 요청 행을 잠그고 판정한다 (save_quote·withdraw_offer·select_quote 와 같은 순서, 같은 트랜잭션에서 다시 잠가도 된다).
-- 한 번만 열린다: 동시에 불려도 opened = true 는 한 번
create or replace function public.open_comparison_if_ready(p_rfq_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  r public.rfq_requests%rowtype;
  v jsonb;
begin
  select * into r from public.rfq_requests where id = p_rfq_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found', 'opened', false); end if;
  v := public.compare_readiness(r.id);
  if not coalesce((v->>'ready')::boolean, false) then
    return jsonb_build_object('ok', true, 'opened', false, 'submitted', (v->>'submitted')::int, 'joined', (v->>'joined')::int,
                              'reason', case when r.compared_at is not null then 'already' else 'not_ready' end);
  end if;
  update public.rfq_requests set compared_at = now(), status = 'compared'
   where id = r.id and compared_at is null and selected_quote_id is null and status in ('distributed', 'quoted');
  return jsonb_build_object('ok', true, 'opened', found, 'submitted', (v->>'submitted')::int, 'joined', (v->>'joined')::int, 'reason', 'all');
end;
$$;
revoke execute on function public.open_comparison_if_ready(uuid) from public, anon, authenticated;

-- 예약 작업: 참여 결정 기한이 지나 열 수 있게 된 요청을 모두 연다 (마지막 제출 뒤 기한이 지난 경우)
create or replace function public.open_ready_comparisons()
returns table (rfq_id uuid, rfq_no text, submitted int)
language plpgsql
security definer set search_path = public
as $$
#variable_conflict use_column
declare
  c record;
  v jsonb;
begin
  for c in
    select q.id, q.rfq_no from public.rfq_requests q
     where q.compared_at is null and q.selected_quote_id is null and q.status in ('distributed', 'quoted')
     order by q.created_at
  loop
    v := public.open_comparison_if_ready(c.id);
    if coalesce((v->>'opened')::boolean, false) then
      rfq_id := c.id; rfq_no := c.rfq_no; submitted := (v->>'submitted')::int;
      return next;
    end if;
  end loop;
end;
$$;
revoke execute on function public.open_ready_comparisons() from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 5) 참여: 0023 과 같고, 참여 전 불참은 참여 결정 기한 전·자리가 남았으면 다시 참여할 수 있다 (rejoined)
--    철회(withdrawn)는 되돌리지 않는다. 기한이 없거나 지났으면 지금처럼 declined
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
  v_rejoin boolean := false;
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
  if inv.status = 'declined' then
    -- 참여 전 불참만 되돌릴 수 있다: 참여 기록이 없고 참여 결정 기한 전
    if inv.joined_at is not null or r.join_by is null or v_now > r.join_by then
      return jsonb_build_object('ok', false, 'code', 'declined', 'join_by', r.join_by);
    end if;
    v_rejoin := true;
  elsif inv.status not in ('sent', 'draft', 'submitted') then
    return jsonb_build_object('ok', false, 'code', 'expired');
  end if;

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

  -- 자리: 요청 행을 잡고 있으므로 다른 참여는 여기서 기다렸다가 갱신된 수를 본다. 불참한 이 초대는 아직 자리에 세지 않는다
  v_cap := case r.cro_count when '전체' then null when '5곳' then 5 else 3 end;
  if v_cap is not null then
    select count(*) into v_used from public.rfq_invites i
     where i.rfq_id = r.id and i.revoked_at is null and i.withdrawn_at is null and i.status in ('sent', 'draft', 'submitted')
       and (i.joined_at is not null or i.status in ('draft', 'submitted'));
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
         join_ua = nullif(left(coalesce(p_ua, ''), 300), ''),
         status = case when v_rejoin then 'sent' else status end,
         decline_undone_at = case when v_rejoin then v_now else decline_undone_at end
   where id = inv.id;
  perform set_config('danchu.opt_in_write', '', true);

  return jsonb_build_object('ok', true, 'joined_at', v_now, 'channel', p_channel, 'rejoined', v_rejoin, 'seats', public.offer_seat_state(r.id));
end;
$$;
revoke execute on function public.join_offer(uuid, text, uuid, text, text, text, text) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 6) 철회: 0023 과 같고, 철회로 남은 참여 기관이 모두 제출한 상태가 되면 같은 트랜잭션에서 비교표를 연다 (compare_opened)
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
  v_open jsonb;
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

  v_open := public.open_comparison_if_ready(r.id);
  return jsonb_build_object('ok', true, 'seats', public.offer_seat_state(r.id),
                            'compare_opened', coalesce((v_open->>'opened')::boolean, false));
end;
$$;
revoke execute on function public.withdraw_offer(uuid, text, uuid, text) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 7) 회신 저장·제출: 0023 과 같고, 제출로 참여 기관이 모두 냈고 더 참여할 수 없으면 같은 트랜잭션에서 비교표를 연다 (compare_opened)
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
  v_open jsonb;
begin
  -- 요청 행을 먼저 잠근다. select_quote·revoke_invite·join_offer 도 요청 행부터 잠그므로, 선정·취소·참여하는 순간 들어온 저장은 그 뒤에 처리되어 아래에서 막힌다
  select * into r from public.rfq_requests where id = (select rfq_id from public.rfq_invites where id = p_invite_id) for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  -- 선정 여부는 상태가 아니라 selected_quote_id 로 본다. 비교표가 열리면(compared_at) 초안·제출 모두 닫힌다
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

  -- 마지막 참여 기관의 제출이면 비교표를 연다 (2026-10-20 결정 1). 연 경우 앱이 의뢰자·기관 알림을 한 번 보낸다
  if p_submit then
    v_open := public.open_comparison_if_ready(r.id);
  end if;

  -- total_invites 는 안내한 초대 전부(운영자 알림용). 의뢰자에게는 joined_invites(자리를 차지한 참여 기관 수)만 쓴다
  return jsonb_build_object('ok', true, 'quote_id', v_quote, 'first', coalesce(v_prev_status, '') <> 'submitted',
                            'total_invites', v_total, 'submitted_invites', v_done, 'joined_invites', v_joined,
                            'compare_opened', coalesce((v_open->>'opened')::boolean, false));
end;
$$;
revoke execute on function public.save_quote(uuid, jsonb, jsonb, boolean, uuid, text) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 8) 선정: 0022 와 같고, 비교표가 열린 뒤에만 (not_compared). 기한 전 확인 단계 선택은 없다
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

  insert into public.rfq_awards (rfq_id, quote_id, invite_id, cro_org_id, cro_name, selected_by, fee_basis_amount, invite_source, quote_revision)
  values (r.id, q.id, q.invite_id, q.cro_org_id, q.cro_name, p_user, q.total_amount, v_source, q.revision)
  returning id into v_award;

  update public.rfq_requests set status = 'selected', selected_quote_id = q.id where id = r.id;

  return jsonb_build_object('ok', true, 'award_id', v_award, 'invite_id', q.invite_id, 'cro_org_id', q.cro_org_id, 'cro_name', q.cro_name, 'revision', q.revision);
end;
$$;
revoke execute on function public.select_quote(uuid, uuid, uuid, int) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 9) 계약 확인 열. 처음 적용할 때만 0025 전 보고 계약을 "보고 시각에 확인됨(legacy)"으로 채운다
-- ─────────────────────────────────────────────
do $$
declare
  v_first boolean := not exists (select 1 from information_schema.columns
                                  where table_schema = 'public' and table_name = 'rfq_awards' and column_name = 'contract_confirmed_at');
begin
  alter table public.rfq_awards
    add column if not exists requester_confirmed_at timestamptz,
    add column if not exists confirmed_auto boolean not null default false,
    add column if not exists requester_disputed_at timestamptz,
    add column if not exists requester_dispute_note text,
    add column if not exists contract_confirm_due_at timestamptz,
    add column if not exists contract_confirmed_at timestamptz,
    add column if not exists contract_confirmed_via text,
    add column if not exists dispute_resolved_at timestamptz,
    add column if not exists dispute_resolved_by uuid references auth.users(id) on delete set null,
    add column if not exists dispute_resolution text,
    add column if not exists dispute_resolution_note text;
  if v_first then
    -- 지난 달까지 보고한 계약만 legacy 로 확정한다 (그 달은 이미 정산·마감 저장본이 있을 수 있다).
    -- 이번 달(서울) 보고한 계약은 확정하지 않고 지금부터 7일 확인 기한을 준다: 의뢰자가 확인하거나 이의를 내고, 없으면 예약 작업이 확정한다 (결정 2)
    update public.rfq_awards
       set contract_confirmed_at = contract_reported_at,
           contract_confirmed_via = 'legacy',
           contract_confirm_due_at = contract_reported_at + interval '7 days'
     where contract_reported_at is not null and contract_status = 'signed'
       and contract_reported_at < (date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul');
    update public.rfq_awards
       set contract_confirm_due_at = now() + interval '7 days'
     where contract_reported_at is not null and contract_status = 'signed' and contract_confirmed_at is null;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'rfq_awards_confirm_via_chk') then
    alter table public.rfq_awards add constraint rfq_awards_confirm_via_chk
      check ((contract_confirmed_at is null and contract_confirmed_via is null)
          or (contract_confirmed_at is not null and contract_confirmed_via in ('sponsor', 'auto', 'operator', 'legacy')));
  end if;
  -- 확인된 계약은 체결 보고가 있는 signed 다 (확인 뒤 미체결로 바꾸려면 확인을 지워야 하는데, 그건 아래 트리거가 막는다)
  if not exists (select 1 from pg_constraint where conname = 'rfq_awards_confirmed_signed_chk') then
    alter table public.rfq_awards add constraint rfq_awards_confirmed_signed_chk
      check (contract_confirmed_at is null or (contract_status = 'signed' and contract_reported_at is not null));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rfq_awards_dispute_resolution_chk') then
    alter table public.rfq_awards add constraint rfq_awards_dispute_resolution_chk
      check ((dispute_resolved_at is null and dispute_resolution is null)
          or (dispute_resolved_at is not null and dispute_resolution in ('confirm', 'reject')));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rfq_awards_dispute_note_chk') then
    alter table public.rfq_awards add constraint rfq_awards_dispute_note_chk
      check (requester_disputed_at is null or length(btrim(coalesce(requester_dispute_note, ''))) between 1 and 500);
  end if;
end $$;

comment on column public.rfq_awards.requester_confirmed_at is '의뢰자가 계약 보고를 확인한 시각 (0025). 7일 뒤 자동 확정도 채우고 confirmed_auto 를 켠다';
comment on column public.rfq_awards.requester_disputed_at is '의뢰자가 계약 보고에 이의를 낸 시각 (0025). 운영자가 정리(dispute_resolved_at)할 때까지 확정·정산하지 않는다';
comment on column public.rfq_awards.contract_confirm_due_at is '자동 확정 예정 시각 (0025). 체결 보고(또는 확인 전 정정) + 7일';
comment on column public.rfq_awards.contract_confirmed_at is '계약이 확인된 시각 (0025). 성사수수료 정산 월의 기준(서울). 한 번 채우면 바꾸거나 지울 수 없다';
comment on column public.rfq_awards.contract_confirmed_via is '계약 확인 경로 (0025). sponsor 의뢰자 · auto 7일 뒤 자동 · operator 이의 정리 뒤 운영자 · legacy 0025 전 보고';
comment on column public.rfq_awards.dispute_resolution is '운영자 이의 정리 결과 (0025). confirm 보고대로 확정 · reject 보고 취소(기관이 다시 보고)';

create index if not exists rfq_awards_confirm_due_idx on public.rfq_awards (contract_confirm_due_at)
  where contract_reported_at is not null and contract_confirmed_at is null;
create index if not exists rfq_awards_confirmed_idx on public.rfq_awards (contract_confirmed_at) where contract_confirmed_at is not null;

-- 확인·이의 열은 아래 함수만 쓴다 (쓰기 표식 danchu.contract_confirm_write). 확인 시각은 한 번 채우면 누구도 바꾸거나 지우지 못한다.
-- 예외: 정리한 운영자 계정이 실제로 지워져 dispute_resolved_by 가 비는 것 (auth.users on delete set null)
create or replace function public.rfq_awards_guard_confirm()
returns trigger
language plpgsql
as $$
declare
  v_writer boolean := coalesce(current_setting('danchu.contract_confirm_write', true), '') = 'on';
  v_old_by uuid;
begin
  if tg_op = 'INSERT' then
    if (new.requester_confirmed_at is not null or new.confirmed_auto or new.requester_disputed_at is not null or new.requester_dispute_note is not null
        or new.contract_confirm_due_at is not null or new.contract_confirmed_at is not null or new.contract_confirmed_via is not null
        or new.dispute_resolved_at is not null or new.dispute_resolved_by is not null or new.dispute_resolution is not null
        or new.dispute_resolution_note is not null)
       and not v_writer then
      raise exception 'contract_confirm_protected: 계약 확인 기록은 확인 함수로만 남길 수 있습니다';
    end if;
    return new;
  end if;

  if old.contract_confirmed_at is not null
     and (new.contract_confirmed_at, new.contract_confirmed_via) is distinct from (old.contract_confirmed_at, old.contract_confirmed_via) then
    raise exception 'contract_confirm_protected: 확인된 계약(%)의 확인 기록은 바꿀 수 없습니다. 바로잡을 금액은 조정 항목으로 넣습니다', old.id;
  end if;

  v_old_by := old.dispute_resolved_by;
  if old.dispute_resolved_by is not null and new.dispute_resolved_by is null and not public.auth_user_exists(old.dispute_resolved_by) then
    v_old_by := null;
  end if;
  if (new.requester_confirmed_at, new.confirmed_auto, new.requester_disputed_at, new.requester_dispute_note,
      new.contract_confirm_due_at, new.contract_confirmed_at, new.contract_confirmed_via,
      new.dispute_resolved_at, new.dispute_resolved_by, new.dispute_resolution, new.dispute_resolution_note)
     is distinct from
     (old.requester_confirmed_at, old.confirmed_auto, old.requester_disputed_at, old.requester_dispute_note,
      old.contract_confirm_due_at, old.contract_confirmed_at, old.contract_confirmed_via,
      old.dispute_resolved_at, v_old_by, old.dispute_resolution, old.dispute_resolution_note)
     and not v_writer then
    raise exception 'contract_confirm_protected: 계약 확인 기록은 확인 함수로만 바꿀 수 있습니다';
  end if;
  return new;
end;
$$;
revoke execute on function public.rfq_awards_guard_confirm() from public, anon, authenticated;
drop trigger if exists rfq_awards_guard_confirm on public.rfq_awards;
create trigger rfq_awards_guard_confirm before insert or update on public.rfq_awards
  for each row execute function public.rfq_awards_guard_confirm();

-- ─────────────────────────────────────────────
-- 10) 체결 보고: 0020 과 같고, 확인 기한(+7일)을 잡는다. 확인 전 정정이면 기한을 다시 잡는다 (의뢰자가 바뀐 내용을 확인할 시간).
--     확인 뒤 정정(운영자 p_force)은 확인 기록과 정산 월을 바꾸지 않는다
-- ─────────────────────────────────────────────
create or replace function public.report_contract(p_award_id uuid, p_date date, p_amount bigint, p_note text, p_force boolean default false)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  a public.rfq_awards%rowtype;
  r public.rfq_requests%rowtype;
  v_due timestamptz;
begin
  select * into a from public.rfq_awards where id = p_award_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if a.contract_reported_at is not null and not p_force then return jsonb_build_object('ok', false, 'code', 'already'); end if;
  if p_amount is null or p_amount <= 0 then return jsonb_build_object('ok', false, 'code', 'amount'); end if;
  if p_date is null or p_date < (a.awarded_at at time zone 'Asia/Seoul')::date then return jsonb_build_object('ok', false, 'code', 'date'); end if;
  if p_date > (now() at time zone 'Asia/Seoul')::date then return jsonb_build_object('ok', false, 'code', 'future'); end if;

  v_due := case when a.contract_confirmed_at is null then now() + interval '7 days' else a.contract_confirm_due_at end;
  perform set_config('danchu.contract_confirm_write', 'on', true);
  update public.rfq_awards
     set contract_date = p_date, contract_amount = p_amount, contract_note = nullif(p_note, ''),
         contract_reported_at = coalesce(a.contract_reported_at, now()),
         contract_status = 'signed',
         contract_confirm_due_at = v_due
   where id = a.id;
  perform set_config('danchu.contract_confirm_write', '', true);
  update public.rfq_requests set status = 'contracting' where id = a.rfq_id and status = 'selected';

  select * into r from public.rfq_requests where id = a.rfq_id;
  return jsonb_build_object('ok', true, 'rfq_id', a.rfq_id, 'rfq_no', r.rfq_no, 'user_id', r.user_id, 'substance', r.substance,
                            'corrected', a.contract_reported_at is not null, 'confirm_due_at', v_due,
                            'confirmed', a.contract_confirmed_at is not null);
end;
$$;
revoke execute on function public.report_contract(uuid, date, bigint, text, boolean) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 11) 의뢰자 확인·이의, 운영자 정리, 자동 확정
--     실패 code: not_found · forbidden(요청 주인·운영자 아님) · not_reported(체결 보고 전·signed 아님) · disputed(이의 정리 전)
--               confirmed(이미 확정) · note(사유 1~500자) · no_dispute · bad_resolution
-- ─────────────────────────────────────────────

-- 의뢰자 확인. 요청 주인(user_id)이면 sponsor, 운영자가 대신 누르면 operator 로 남긴다. 확인하면 요청을 마친다(closed)
create or replace function public.confirm_contract(p_award_id uuid, p_actor uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  a public.rfq_awards%rowtype;
  r public.rfq_requests%rowtype;
  v_owner boolean;
begin
  select * into a from public.rfq_awards where id = p_award_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  select * into r from public.rfq_requests where id = a.rfq_id;
  -- 확인은 의뢰자 본인만 한다 (2026-10-20 결정 2). 운영자는 이의를 정리할 때만 확정한다 (resolve_contract_dispute).
  -- 운영자가 대신 확인하면 의뢰자의 7일 이의 기간을 건너뛴다
  v_owner := p_actor is not null and r.user_id is not distinct from p_actor;
  if not v_owner then return jsonb_build_object('ok', false, 'code', 'forbidden'); end if;
  if a.contract_reported_at is null or a.contract_status <> 'signed' then return jsonb_build_object('ok', false, 'code', 'not_reported'); end if;
  if a.contract_confirmed_at is not null then
    return jsonb_build_object('ok', true, 'already', true, 'rfq_id', a.rfq_id, 'rfq_no', r.rfq_no, 'via', a.contract_confirmed_via);
  end if;
  if a.requester_disputed_at is not null and a.dispute_resolved_at is null then return jsonb_build_object('ok', false, 'code', 'disputed'); end if;

  perform set_config('danchu.contract_confirm_write', 'on', true);
  update public.rfq_awards
     set requester_confirmed_at = case when v_owner then now() else requester_confirmed_at end,
         confirmed_auto = false,
         contract_confirmed_at = now(),
         contract_confirmed_via = case when v_owner then 'sponsor' else 'operator' end
   where id = a.id;
  perform set_config('danchu.contract_confirm_write', '', true);
  update public.rfq_requests set status = 'closed', closed_at = coalesce(closed_at, now())
   where id = a.rfq_id and status in ('selected', 'contracting');

  return jsonb_build_object('ok', true, 'rfq_id', a.rfq_id, 'rfq_no', r.rfq_no, 'cro_org_id', a.cro_org_id, 'cro_name', a.cro_name,
                            'contract_amount', a.contract_amount, 'contract_date', a.contract_date,
                            'via', case when v_owner then 'sponsor' else 'operator' end);
end;
$$;
revoke execute on function public.confirm_contract(uuid, uuid) from public, anon, authenticated;

-- 의뢰자 이의. 정산을 멈춘다. 운영자가 정리한 뒤 다시 낼 수 있다 (정리 기록은 감사 기록에 남아 있다)
create or replace function public.dispute_contract(p_award_id uuid, p_actor uuid, p_note text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  a public.rfq_awards%rowtype;
  r public.rfq_requests%rowtype;
  v_role text;
  v_note text := btrim(coalesce(p_note, ''));
begin
  if v_note = '' or length(v_note) > 500 then return jsonb_build_object('ok', false, 'code', 'note'); end if;
  select * into a from public.rfq_awards where id = p_award_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  select * into r from public.rfq_requests where id = a.rfq_id;
  if p_actor is not null then select role into v_role from public.profiles where id = p_actor; end if;
  if not (p_actor is not null and r.user_id is not distinct from p_actor) and v_role is distinct from 'admin' then
    return jsonb_build_object('ok', false, 'code', 'forbidden');
  end if;
  if a.contract_reported_at is null or a.contract_status <> 'signed' then return jsonb_build_object('ok', false, 'code', 'not_reported'); end if;
  if a.contract_confirmed_at is not null then return jsonb_build_object('ok', false, 'code', 'confirmed'); end if;
  if a.requester_disputed_at is not null and a.dispute_resolved_at is null then
    return jsonb_build_object('ok', true, 'already', true, 'rfq_id', a.rfq_id, 'rfq_no', r.rfq_no);
  end if;

  perform set_config('danchu.contract_confirm_write', 'on', true);
  update public.rfq_awards
     set requester_disputed_at = now(), requester_dispute_note = v_note,
         dispute_resolved_at = null, dispute_resolved_by = null, dispute_resolution = null, dispute_resolution_note = null
   where id = a.id;
  perform set_config('danchu.contract_confirm_write', '', true);

  return jsonb_build_object('ok', true, 'rfq_id', a.rfq_id, 'rfq_no', r.rfq_no, 'cro_org_id', a.cro_org_id, 'cro_name', a.cro_name,
                            'contract_amount', a.contract_amount, 'contract_date', a.contract_date);
end;
$$;
revoke execute on function public.dispute_contract(uuid, uuid, text) from public, anon, authenticated;

-- 운영자 이의 정리. confirm: 보고대로 확정(바로잡을 금액이 있으면 먼저 report_contract 정정) · reject: 보고를 취소하고 기관이 다시 보고한다.
-- 어느 쪽이든 admin_audit 에 이전·이후 값과 사유를 남긴다
create or replace function public.resolve_contract_dispute(p_award_id uuid, p_actor uuid, p_resolution text, p_note text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  a public.rfq_awards%rowtype;
  b public.rfq_awards%rowtype;
  r public.rfq_requests%rowtype;
  v_role text;
  v_email text;
  v_note text := btrim(coalesce(p_note, ''));
begin
  if p_resolution is null or p_resolution not in ('confirm', 'reject') then return jsonb_build_object('ok', false, 'code', 'bad_resolution'); end if;
  if v_note = '' or length(v_note) > 500 then return jsonb_build_object('ok', false, 'code', 'note'); end if;
  if p_actor is not null then select role, email into v_role, v_email from public.profiles where id = p_actor; end if;
  if v_role is distinct from 'admin' then return jsonb_build_object('ok', false, 'code', 'forbidden'); end if;

  select * into a from public.rfq_awards where id = p_award_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if a.requester_disputed_at is null or a.dispute_resolved_at is not null then return jsonb_build_object('ok', false, 'code', 'no_dispute'); end if;
  if a.contract_confirmed_at is not null then return jsonb_build_object('ok', false, 'code', 'confirmed'); end if;
  select * into r from public.rfq_requests where id = a.rfq_id;

  perform set_config('danchu.contract_confirm_write', 'on', true);
  if p_resolution = 'confirm' then
    if a.contract_reported_at is null or a.contract_status <> 'signed' then
      perform set_config('danchu.contract_confirm_write', '', true);
      return jsonb_build_object('ok', false, 'code', 'not_reported');
    end if;
    update public.rfq_awards
       set contract_confirmed_at = now(), contract_confirmed_via = 'operator',
           dispute_resolved_at = now(), dispute_resolved_by = p_actor, dispute_resolution = 'confirm', dispute_resolution_note = v_note
     where id = a.id;
    update public.rfq_requests set status = 'closed', closed_at = coalesce(closed_at, now())
     where id = a.rfq_id and status in ('selected', 'contracting');
  else
    update public.rfq_awards
       set contract_status = 'pending', contract_date = null, contract_amount = null, contract_note = null,
           contract_reported_at = null, contract_confirm_due_at = null,
           dispute_resolved_at = now(), dispute_resolved_by = p_actor, dispute_resolution = 'reject', dispute_resolution_note = v_note
     where id = a.id;
    update public.rfq_requests set status = 'selected' where id = a.rfq_id and status = 'contracting';
  end if;
  perform set_config('danchu.contract_confirm_write', '', true);

  select * into b from public.rfq_awards where id = a.id;
  insert into public.admin_audit (actor_id, actor_email, action, target_type, target_id, target_label, before, after, note)
  values (p_actor, v_email, 'contract.dispute_resolve', 'rfq_award', a.id, r.rfq_no || ' · ' || a.cro_name,
          jsonb_build_object('contract_status', a.contract_status, 'contract_date', a.contract_date, 'contract_amount', a.contract_amount,
                             'contract_reported_at', a.contract_reported_at, 'requester_disputed_at', a.requester_disputed_at,
                             'requester_dispute_note', a.requester_dispute_note),
          jsonb_build_object('resolution', p_resolution, 'contract_status', b.contract_status, 'contract_amount', b.contract_amount,
                             'contract_confirmed_at', b.contract_confirmed_at, 'contract_confirmed_via', b.contract_confirmed_via),
          v_note);

  return jsonb_build_object('ok', true, 'resolution', p_resolution, 'rfq_id', a.rfq_id, 'rfq_no', r.rfq_no, 'user_id', r.user_id,
                            'cro_org_id', a.cro_org_id, 'cro_name', a.cro_name, 'contract_amount', b.contract_amount);
end;
$$;
revoke execute on function public.resolve_contract_dispute(uuid, uuid, text, text) from public, anon, authenticated;

-- 예약 작업: 확인 기한(보고 + 7일)이 지났고 이의가 없는(또는 정리된) 미확인 계약을 확정한다. 확정한 행을 돌려준다 (알림은 앱)
create or replace function public.auto_confirm_contracts()
returns table (award_id uuid, rfq_id uuid, rfq_no text, user_id uuid, cro_org_id uuid, cro_name text, contract_amount bigint, contract_date date)
language plpgsql
security definer set search_path = public
as $$
#variable_conflict use_column
begin
  perform set_config('danchu.contract_confirm_write', 'on', true);
  return query
  with upd as (
    update public.rfq_awards a
       set requester_confirmed_at = now(), confirmed_auto = true,
           contract_confirmed_at = now(), contract_confirmed_via = 'auto'
     where a.contract_reported_at is not null
       and a.contract_status = 'signed'
       and a.contract_confirmed_at is null
       and a.contract_confirm_due_at is not null
       and a.contract_confirm_due_at <= now()
       and (a.requester_disputed_at is null or a.dispute_resolved_at is not null)
    returning a.id, a.rfq_id, a.cro_org_id, a.cro_name, a.contract_amount, a.contract_date
  ), cl as (
    update public.rfq_requests q set status = 'closed', closed_at = coalesce(q.closed_at, now())
      from upd where q.id = upd.rfq_id and q.status in ('selected', 'contracting')
    returning q.id
  )
  select upd.id, upd.rfq_id, q.rfq_no, q.user_id, upd.cro_org_id, upd.cro_name, upd.contract_amount, upd.contract_date
  from upd join public.rfq_requests q on q.id = upd.rfq_id;
  perform set_config('danchu.contract_confirm_write', '', true);
end;
$$;
revoke execute on function public.auto_confirm_contracts() from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 12) 성사수수료: 정산은 확인된 계약만, 확인된 달(contract_confirmed_at, 서울)에. 반환 열이 늘어 지우고 다시 만든다.
--     예상(guidance)은 0023 과 같다 (선정한 달, 미체결 아님). 나머지 열과 참여 기록 조건은 0023 과 같다
-- ─────────────────────────────────────────────
drop function if exists public.billing_awards(date, date);
create or replace function public.billing_awards(p_from date, p_to date)
returns table (
  kind text, award_id uuid, rfq_id uuid, rfq_no text, org_id uuid, org_name text,
  quote_amount bigint, contract_amount bigint, contract_status text,
  awarded_at timestamptz, contract_date date, contract_reported_at timestamptz,
  fee_rate numeric, fee bigint, invite_billable boolean, invite_joined boolean,
  contract_confirmed_at timestamptz, contract_confirmed_via text
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
         a.awarded_at, a.contract_date, a.contract_reported_at, a.rate, round(a.basis * a.rate)::bigint, a.ibill, a.ijoined,
         a.contract_confirmed_at, a.contract_confirmed_via
  from a
  where a.contract_status <> 'not_signed'
    and (a.awarded_at at time zone 'Asia/Seoul')::date >= p_from
    and (a.awarded_at at time zone 'Asia/Seoul')::date <  p_to
  union all
  select 'settlement', a.id, a.rfq_id, a.no, a.oid, a.oname, a.basis, a.contract_amount, a.contract_status,
         a.awarded_at, a.contract_date, a.contract_reported_at, a.rate, round(a.contract_amount * a.rate)::bigint, a.ibill, a.ijoined,
         a.contract_confirmed_at, a.contract_confirmed_via
  from a
  where a.contract_status = 'signed'
    and a.contract_confirmed_at is not null
    and a.contract_amount is not null
    and (a.contract_confirmed_at at time zone 'Asia/Seoul')::date >= p_from
    and (a.contract_confirmed_at at time zone 'Asia/Seoul')::date <  p_to
  order by 1, 6, 10;
$$;
revoke execute on function public.billing_awards(date, date) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 13) 스키마 판
-- ─────────────────────────────────────────────
create or replace function public.danchu_schema_version()
returns int
language sql
immutable
as $$ select 25 $$;
comment on function public.danchu_schema_version() is
  '마지막으로 적용한 마이그레이션 번호 (0025). 앱(lib/schema-version.ts REQUIRED_SCHEMA_VERSION)과 npm run check:schema 가 확인한다. 다음 마이그레이션이 새 번호로 바꾼다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 14) 실행 권한: 서버(service role)가 부르는 함수만 연다 (billing_awards 는 지우고 다시 만들어 grant 가 사라졌다)
-- ─────────────────────────────────────────────
grant execute on function public.compare_readiness(uuid) to service_role;
grant execute on function public.open_comparison_if_ready(uuid) to service_role;
grant execute on function public.open_ready_comparisons() to service_role;
grant execute on function public.join_offer(uuid, text, uuid, text, text, text, text) to service_role;
grant execute on function public.withdraw_offer(uuid, text, uuid, text) to service_role;
grant execute on function public.save_quote(uuid, jsonb, jsonb, boolean, uuid, text) to service_role;
grant execute on function public.select_quote(uuid, uuid, uuid, int) to service_role;
grant execute on function public.report_contract(uuid, date, bigint, text, boolean) to service_role;
grant execute on function public.confirm_contract(uuid, uuid) to service_role;
grant execute on function public.dispute_contract(uuid, uuid, text) to service_role;
grant execute on function public.resolve_contract_dispute(uuid, uuid, text, text) to service_role;
grant execute on function public.auto_confirm_contracts() to service_role;
grant execute on function public.billing_awards(date, date) to service_role;
grant execute on function public.auth_user_confirmed(uuid) to service_role;
grant execute on function public.danchu_schema_version() to service_role;
