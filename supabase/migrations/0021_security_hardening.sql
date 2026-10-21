-- 단추(Danchu) 21차: 초대 철회 표식 · 담당자 변경 시 회신 링크 전부 재발급 · 기관 이동 시 대표 권한 초기화 · 저장 RPC 재검사
-- 0020 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경 (2026-10-18 보안 검토)
-- 1) 운영자가 초대를 취소하면 상태만 expired 로 바뀌어 "기한 만료"와 구분되지 않았다. 요청을 다시 열면(재개) 취소한 초대까지
--    sent·draft 로 되살아났고, 회신 링크와 save_quote 는 상태를 다시 보지 않았다.
--    rfq_invites.revoked_at 을 따로 둔다. 한 번 채워지면 지워지지 않고, 그 초대는 expired 에 머문다 (재개해도 그대로).
--    취소는 revoke_invite() 한 트랜잭션에서 요청 행 → 초대 행 순서로 잠그고, 토큰도 새로 바꾼다.
-- 2) 담당자를 내보내도(0013) 열린 초대(sent·draft)의 토큰만 바꿔, 제출한 견적의 옛 링크로 계속 열람할 수 있었다.
--    이제 그 기관의 초대 토큰을 상태와 상관없이 모두 바꾼다 (토큰만. 견적·상태·기한은 그대로).
--    담당자 제외·다른 기관으로 이동·계정 삭제, 기관 중지·반려가 일어나면 같은 트랜잭션에서 트리거가 바꾼다.
--    새 링크는 자동 메일로 보내지 않는다. 계정이 있는 담당자는 포털(/cro)에서 바뀐 링크로 이어 쓰고,
--    계정이 없는 기관은 운영자가 재발송으로 기관 대표 메일(cro_orgs.contact_email)에만 보낸다 (옛 초대의 cro_email 이 아님).
--    떠난 사람의 주소가 기관 대표 메일이면 같은 트랜잭션에서 대표 메일을 비우고 운영자·남은 대표에게 앱 알림을 남긴다.
--    그대로 두면 리마인더·안내 메일이 새 토큰 링크를 떠난 사람에게 보낸다. 앱의 기관 메일은 초대에 저장된 cro_email 이 아니라
--    지금의 대표 메일과 지금 소속 담당자에게만 간다 (lib/distribute.ts orgMailTargets).
-- 3) 담당자를 다른 기관으로 옮기면 이전 기관의 대표 권한(org_role = owner)이 따라갔다.
--    소속이 바뀌면 member 로 되돌린다. 대표 지정은 같은 수정에서 owner 를 명시할 때만 남는다 (기관을 처음 만드는 가입).
-- 4) save_quote 가 잠금을 얻은 뒤 다시 확인한다: 지금 토큰(p_token)과 같은지, 철회·만료·회신하지 않음이 아닌지,
--    기관이 참여 중(approved)인지, 다른 기관 소속으로 로그인한 담당자가 아닌지(소속 없는 계정은 토큰으로 판단). 운영자(대리 입력)는 기한 만료만 면제한다.
--    인자가 하나 늘어 5개 인자 함수는 지운다 (토큰 검사 없이 저장되는 옛 경로를 남기지 않는다).
-- 5) claim_rfqs_by_email: 접수 때 계정이 없던 요청을 같은 이메일로 확인된 계정에 한 번 연결한다. 익명화된 요청은 연결하지 않는다.
--    계정이 지워져 user_id 가 비워진 요청(rfq_requests.orphaned_at, 트리거가 찍음)도 연결하지 않는다.
--    탈퇴 정리(익명화)가 중간에 실패했거나 대시보드에서 사용자를 직접 지운 경우, 같은 주소를 나중에 확인한 다른 사람이
--    탈퇴자의 요청·견적·첨부를 넘겨받지 않게 한다.
--    요청의 소유자는 이제 user_id 로만 판단한다 (앱 코드). 이메일은 이 연결에만 쓴다.
--
-- 토큰 생성: Supabase 의 pgcrypto 는 extensions 스키마에 있다. 토큰을 만드는 함수는 search_path 를 pg_catalog, extensions, public 순서로 둔다
-- (public 에 같은 이름의 함수가 생겨도 extensions 의 gen_random_bytes 를 먼저 찾는다).
-- 배포 순서: 이 파일과 코드를 함께 배포한다. 사이에는 회신 저장·제출만 실패한다 (옛 코드는 5개 인자 save_quote 를 부른다).

-- ─────────────────────────────────────────────
-- 1) 초대 철회 표식
-- ─────────────────────────────────────────────
alter table public.rfq_invites add column if not exists revoked_at timestamptz;
comment on column public.rfq_invites.revoked_at is
  '운영자가 초대를 거둔 시각 (0021). 기한 만료와 다르다. 채워지면 지울 수 없고 상태는 expired 로 고정된다. 회신 화면·저장·첨부·PDF 모두 거절';

-- 지난 취소 기록(운영자 초대 취소 이벤트)으로 채운다
update public.rfq_invites i set revoked_at = e.created_at
  from public.rfq_events e
 where i.revoked_at is null and i.status = 'expired'
   and e.kind = 'invite_cancelled' and e.rfq_id = i.rfq_id and e.meta->>'inviteId' = i.id::text;

-- 철회는 되돌리지 않는다: 요청 재개·기한 연장이 상태를 바꿔도 expired 에 머문다
create or replace function public.rfq_invites_keep_revoke()
returns trigger
language plpgsql
as $$
begin
  if old.revoked_at is not null then
    new.revoked_at := old.revoked_at;
    new.status := 'expired';
  end if;
  return new;
end;
$$;
drop trigger if exists rfq_invites_keep_revoke on public.rfq_invites;
create trigger rfq_invites_keep_revoke before update on public.rfq_invites
  for each row execute function public.rfq_invites_keep_revoke();

-- 운영자 초대 취소. 열린 초대(sent·draft)만. 요청 행부터 잠가 save_quote 와 같은 순서로 줄을 세운다
create or replace function public.revoke_invite(p_invite_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer set search_path = pg_catalog, extensions, public
as $$
declare
  inv public.rfq_invites%rowtype;
begin
  perform 1 from public.rfq_requests where id = (select rfq_id from public.rfq_invites where id = p_invite_id) for update;
  select * into inv from public.rfq_invites where id = p_invite_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if inv.revoked_at is not null then return jsonb_build_object('ok', true, 'already', true, 'status', inv.status); end if;
  if inv.status not in ('sent', 'draft') then return jsonb_build_object('ok', false, 'code', 'not_open'); end if;
  update public.rfq_invites
     set status = 'expired', revoked_at = now(), billable = false,
         bill_excluded_reason = coalesce(nullif(p_reason, ''), '운영자 초대 취소'),
         token = encode(gen_random_bytes(18), 'hex')
   where id = inv.id;
  return jsonb_build_object('ok', true, 'status', inv.status);
end;
$$;
revoke execute on function public.revoke_invite(uuid, text) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 2) 기관 회신 링크 전부 재발급 (0013 대체: 제출·마감된 초대 포함, 토큰만)
-- ─────────────────────────────────────────────
create or replace function public.rotate_org_invite_tokens(p_org uuid)
returns int
language plpgsql
security definer set search_path = pg_catalog, extensions, public
as $$
declare n int;
begin
  if p_org is null then return 0; end if;
  update public.rfq_invites set token = encode(gen_random_bytes(18), 'hex')
   where cro_org_id = p_org;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.rotate_org_invite_tokens(uuid) from public, anon, authenticated;

-- 담당자가 기관을 떠나면(제외·이동·역할 변경으로 소속 해제) 이전 기관의 링크를 바꾼다.
-- 떠난 사람의 주소가 그 기관의 대표 메일이면 대표 메일을 비우고 운영자·남은 대표에게 알린다 (새 링크가 떠난 사람에게 가지 않게)
create or replace function public.profiles_org_left()
returns trigger
language plpgsql
security definer set search_path = pg_catalog, extensions, public
as $$
declare
  v_org uuid;
  v_name text;
begin
  if tg_op = 'DELETE' then
    v_org := old.cro_org_id;
  elsif old.cro_org_id is not null and new.cro_org_id is distinct from old.cro_org_id then
    v_org := old.cro_org_id;
  end if;
  if v_org is null then return null; end if;

  perform public.rotate_org_invite_tokens(v_org);

  update public.cro_orgs set contact_email = null
   where id = v_org and contact_email is not null and old.email is not null
     and lower(trim(contact_email)) = lower(trim(old.email))
  returning name into v_name;
  if v_name is not null then
    insert into public.notifications (user_id, kind, title, body, href)
    select p.id, '기관', v_name || ' 대표 이메일을 다시 적어 주세요',
           '대표 이메일로 쓰던 담당자가 기관을 떠나 대표 이메일을 비웠습니다. 새 대표 이메일을 적기 전까지 계정이 없는 기관에는 회신 링크 메일이 가지 않습니다.',
           case when p.role = 'admin' then '/admin/cros/' || v_org::text else '/cro/org' end
      from public.profiles p
     where p.id <> old.id
       and (p.role = 'admin' or (p.cro_org_id = v_org and p.org_role = 'owner'));
  end if;
  return null;
end;
$$;
drop trigger if exists profiles_org_left on public.profiles;
create trigger profiles_org_left after update of cro_org_id or delete on public.profiles
  for each row execute function public.profiles_org_left();

-- 기관이 참여 중(approved)에서 벗어나면(중지·수신 거부·반려) 링크를 바꾼다. 다시 승인돼도 옛 링크는 살아나지 않는다
create or replace function public.cro_orgs_deactivated()
returns trigger
language plpgsql
security definer set search_path = pg_catalog, extensions, public
as $$
begin
  if old.status = 'approved' and new.status is distinct from 'approved' then
    perform public.rotate_org_invite_tokens(new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists cro_orgs_deactivated on public.cro_orgs;
create trigger cro_orgs_deactivated after update of status on public.cro_orgs
  for each row execute function public.cro_orgs_deactivated();

-- ─────────────────────────────────────────────
-- 3) 소속이 바뀌면 대표 권한을 내려놓는다
-- ─────────────────────────────────────────────
create or replace function public.profiles_org_role_reset()
returns trigger
language plpgsql
as $$
begin
  if new.cro_org_id is distinct from old.cro_org_id
     and not (new.org_role = 'owner' and old.org_role is distinct from 'owner') then
    new.org_role := 'member';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_org_role_reset on public.profiles;
create trigger profiles_org_role_reset before update of cro_org_id on public.profiles
  for each row execute function public.profiles_org_role_reset();

-- 이미 소속 없이 owner 로 남은 계정 (0013 의 담당자 제외는 org_role 을 그대로 두었다)
update public.profiles set org_role = 'member' where cro_org_id is null and org_role = 'owner';

-- ─────────────────────────────────────────────
-- 4) 회신 저장·제출: 잠금 뒤 토큰·철회·만료·기관·소속 재검사 (0019 와 나머지는 같다)
-- ─────────────────────────────────────────────
drop function if exists public.save_quote(uuid, jsonb, jsonb, boolean, uuid);
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
  v_source text := case when p_header->>'entry_source' = 'operator' then 'operator' else 'cro' end;
  v_role text;
  v_actor_org uuid;
  v_org_status text;
begin
  -- 요청 행을 먼저 잠근다. select_quote·revoke_invite 도 요청 행부터 잠그므로, 선정·취소하는 순간 들어온 저장은 그 뒤에 처리되어 아래에서 막힌다
  select * into r from public.rfq_requests where id = (select rfq_id from public.rfq_invites where id = p_invite_id) for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if r.status in ('selected', 'contracting', 'closed', 'cancelled') or r.compared_at is not null then
    return jsonb_build_object('ok', false, 'code', 'closed');
  end if;

  select * into inv from public.rfq_invites where id = p_invite_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;

  -- 화면을 열 때 검사한 것과 지금이 다를 수 있다 (그 사이 취소·담당자 제외·기관 중지)
  if p_token is null or inv.token is distinct from p_token or inv.revoked_at is not null then
    return jsonb_build_object('ok', false, 'code', 'revoked');
  end if;
  if inv.status = 'declined' then return jsonb_build_object('ok', false, 'code', 'declined'); end if;
  if inv.status not in ('sent', 'draft', 'submitted') then return jsonb_build_object('ok', false, 'code', 'expired'); end if;
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

  select count(*), count(*) filter (where status = 'submitted') into v_total, v_done from public.rfq_invites where rfq_id = inv.rfq_id;

  return jsonb_build_object('ok', true, 'quote_id', v_quote, 'first', coalesce(v_prev_status, '') <> 'submitted',
                            'total_invites', v_total, 'submitted_invites', v_done);
end;
$$;
revoke execute on function public.save_quote(uuid, jsonb, jsonb, boolean, uuid, text) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 5) 미귀속 요청 연결 (0003 과 같고, 익명화된 요청과 계정이 지워진 요청은 제외)
-- ─────────────────────────────────────────────
alter table public.rfq_requests add column if not exists orphaned_at timestamptz;
comment on column public.rfq_requests.orphaned_at is
  '계정이 지워져 user_id 가 비워진 시각 (0021). 채워진 요청은 같은 이메일 계정에 다시 연결하지 않는다 (claim_rfqs_by_email)';

-- user_id 가 값에서 null 로 바뀌면(계정 삭제의 on delete set null 포함) 표시한다. 한 번 찍히면 지우지 않는다
create or replace function public.rfq_requests_orphaned()
returns trigger
language plpgsql
as $$
begin
  if old.orphaned_at is not null then
    new.orphaned_at := old.orphaned_at;
  elsif old.user_id is not null and new.user_id is null then
    new.orphaned_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists rfq_requests_orphaned on public.rfq_requests;
create trigger rfq_requests_orphaned before update on public.rfq_requests
  for each row execute function public.rfq_requests_orphaned();

create or replace function public.claim_rfqs_by_email(p_user uuid, p_email text)
returns int
language plpgsql
security definer set search_path = public
as $$
declare n int;
begin
  update public.rfq_requests set user_id = p_user
   where user_id is null and anonymized_at is null and orphaned_at is null and lower(email) = lower(p_email);
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.claim_rfqs_by_email(uuid, text) from public, anon, authenticated;
