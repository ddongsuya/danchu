-- 단추(Danchu) 22차: 선정 무결성 · 견적 판(revision) 확인 · 선정 뒤 상태 되돌림 차단 · 스키마 판 확인 함수 · 실행 권한 정리
-- 0021 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경 (2026-10-18 보안 검토 #5·#7·#10)
-- 1) 배포 작업이 메일 발송을 기다리는 사이 기관이 제출하고 의뢰자가 선정하면, 배포가 끝나며 오래 읽어 둔 상태(received)를 근거로
--    요청을 distributed 로 되돌렸다. 그러면 save_quote 의 상태 검사를 지나 선정 뒤에도 견적을 고칠 수 있었다.
--    · 앱(lib/distribute.ts)은 지금 상태가 received 일 때만 바꾼다 (조건부 갱신).
--    · save_quote 는 selected_quote_id 가 있으면 상태와 상관없이 closed 로 거절한다.
--    · 선정된 요청(selected_quote_id 있음)의 상태를 선정 전 단계(received·distributed·quoted·compared)로 되돌리는 갱신은 트리거가 막는다.
-- 2) 의뢰자가 선정 확인 화면을 연 뒤 기관이 견적을 고치면, 의뢰자는 옛 내용을 보고 동의했는데 DB 는 새 내용을 선정했다.
--    cro_quotes.revision 을 둔다. 견적 내용(금액·조건·PDF·상태·제출 시각)이 바뀔 때마다 트리거가 1 씩 올린다.
--    항목(cro_quote_items)은 save_quote 로만 바뀌고, 제출할 때마다 submitted_at 이 바뀌므로 함께 올라간다.
--    select_quote 는 확인 화면이 본 판(p_revision)을 받아, 요청 행·견적 행을 잠근 뒤 다르면 quote_changed 로 거절한다.
--    선정한 판은 rfq_awards.quote_revision 에 남긴다. 선정 뒤에는 save_quote 가 막으므로 그 판이 고정된다.
--    인자가 하나 늘어 3개 인자 select_quote 는 지운다 (판 확인 없이 선정되는 옛 경로를 남기지 않는다).
--    동시 선정은 요청 행 잠금으로 한 건만 성공하고, rfq_awards.rfq_id 는 0002 부터 unique 라 수주 기록도 한 건뿐이다.
-- 3) 새 코드를 0019~0021 이 없는 DB 에 배포하면 배포 대상 조회가 실패해도 "대상 기관 없음"처럼 보였다.
--    danchu_schema_version() 이 마지막으로 적용한 마이그레이션 번호를 돌려준다. 앱(lib/schema-version.ts)은 배포 전에 이 값을 보고,
--    모자라면 배포를 멈추고 오류를 낸다. 운영 확인은 npm run check:schema (scripts/check-schema.mjs). 다음 마이그레이션은 이 함수를 새 번호로 바꾼다.
--    이 파일은 처음에 0019·0020·0021 이 적용됐는지 확인하고, 빠졌으면 아무것도 바꾸지 않고 멈춘다.
-- 4) 실행 권한 정리: security definer 트리거 함수 중 anon·authenticated 실행권이 남아 있던 것을 회수한다
--    (트리거 함수는 직접 부를 수 없지만, 모든 security definer 함수의 공개 실행권을 없앤다는 규칙을 맞춘다). 핵심 RPC 는 service_role 에 명시적으로 준다.
--
-- 배포 순서: 쓰기 중지 → 0019 → 0020 → 0021 → 0022 → 검증(npm run check:schema) → 코드 배포 → 검증. README "배포 순서" 참고.
-- 0022 와 새 코드 사이에는 선정만 실패한다 (옛 코드는 3개 인자 select_quote 를 부른다).

-- ─────────────────────────────────────────────
-- 0) 선행 마이그레이션 확인 (빠졌으면 여기서 멈춘다)
-- ─────────────────────────────────────────────
do $$
declare missing text[] := '{}';
begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cro_quotes' and column_name = 'entry_source') then
    missing := array_append(missing, '0019 (cro_quotes.entry_source)');
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'rfq_awards' and column_name = 'contract_status') then
    missing := array_append(missing, '0019 (rfq_awards.contract_status)');
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'cro_quotes' and column_name = 'first_submitted_at') then
    missing := array_append(missing, '0020 (cro_quotes.first_submitted_at)');
  end if;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'rfq_invites' and column_name = 'revoked_at') then
    missing := array_append(missing, '0021 (rfq_invites.revoked_at)');
  end if;
  if array_length(missing, 1) > 0 then
    raise exception '0022 를 적용하기 전에 0019, 0020, 0021 을 순서대로 적용해 주세요. 없는 것: %', array_to_string(missing, ', ');
  end if;
end $$;

-- ─────────────────────────────────────────────
-- 1) 견적 판(revision)
-- ─────────────────────────────────────────────
alter table public.cro_quotes add column if not exists revision int not null default 1;
comment on column public.cro_quotes.revision is
  '견적 판 (0022). 금액·조건·PDF·상태·제출 시각이 바뀔 때마다 1 씩 오른다. 선정 확인 화면이 본 판과 다르면 select_quote 가 거절한다';

create or replace function public.cro_quotes_bump_revision()
returns trigger
language plpgsql
as $$
begin
  if (new.cro_name, new.total_amount, new.total_weeks, new.vat, new.valid_until, new.auto, new.start_date,
      new.pay_terms, new.substance_qty, new.report_lang, new.includes, new.note,
      new.pdf_path, new.pdf_name, new.pdf_size, new.status, new.submitted_at, new.entry_source, new.material_by)
     is distinct from
     (old.cro_name, old.total_amount, old.total_weeks, old.vat, old.valid_until, old.auto, old.start_date,
      old.pay_terms, old.substance_qty, old.report_lang, old.includes, old.note,
      old.pdf_path, old.pdf_name, old.pdf_size, old.status, old.submitted_at, old.entry_source, old.material_by) then
    new.revision := old.revision + 1;
  else
    -- 접속 기록(submitted_ip·ua)처럼 내용이 아닌 갱신은 판을 바꾸지 않는다. 판을 직접 바꾸는 것도 막는다
    new.revision := old.revision;
  end if;
  return new;
end;
$$;
drop trigger if exists cro_quotes_bump_revision on public.cro_quotes;
create trigger cro_quotes_bump_revision before update on public.cro_quotes
  for each row execute function public.cro_quotes_bump_revision();

alter table public.rfq_awards add column if not exists quote_revision int;
comment on column public.rfq_awards.quote_revision is '선정할 때 의뢰자가 확인한 견적 판 (0022). 0022 전 선정은 비어 있다';

-- ─────────────────────────────────────────────
-- 2) 선정된 요청은 선정 전 단계로 되돌리지 않는다
-- ─────────────────────────────────────────────
create or replace function public.rfq_requests_keep_selected()
returns trigger
language plpgsql
as $$
begin
  if old.selected_quote_id is not null and new.selected_quote_id is not null
     and new.status in ('received', 'distributed', 'quoted', 'compared') then
    raise exception 'request_already_selected: 선정된 요청(%)은 선정 전 단계(%)로 되돌릴 수 없습니다', old.rfq_no, new.status;
  end if;
  return new;
end;
$$;
drop trigger if exists rfq_requests_keep_selected on public.rfq_requests;
create trigger rfq_requests_keep_selected before update of status on public.rfq_requests
  for each row execute function public.rfq_requests_keep_selected();

-- ─────────────────────────────────────────────
-- 3) 회신 저장·제출: 선정된 요청이면 상태와 상관없이 거절 (0021 과 나머지는 같다)
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
  v_source text := case when p_header->>'entry_source' = 'operator' then 'operator' else 'cro' end;
  v_role text;
  v_actor_org uuid;
  v_org_status text;
begin
  -- 요청 행을 먼저 잠근다. select_quote·revoke_invite 도 요청 행부터 잠그므로, 선정·취소하는 순간 들어온 저장은 그 뒤에 처리되어 아래에서 막힌다
  select * into r from public.rfq_requests where id = (select rfq_id from public.rfq_invites where id = p_invite_id) for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  -- 선정 여부는 상태가 아니라 selected_quote_id 로 본다 (늦게 끝난 배포가 상태를 덮어써도 선정은 남아 있다)
  if r.selected_quote_id is not null
     or r.status in ('selected', 'contracting', 'closed', 'cancelled') or r.compared_at is not null then
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
-- 4) 선정: 확인 화면이 본 견적 판(p_revision)과 지금 판이 같을 때만 (0019 와 나머지는 같다)
-- ─────────────────────────────────────────────
drop function if exists public.select_quote(uuid, uuid, uuid);
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
  -- 요청 행을 먼저 잠근다 (save_quote·revoke_invite 와 같은 순서). 동시에 들어온 두 번째 선정은 여기서 기다렸다가 already_selected 로 끝난다
  select * into r from public.rfq_requests where id = p_rfq_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if r.selected_quote_id is not null then return jsonb_build_object('ok', false, 'code', 'already_selected'); end if;
  if r.status in ('closed', 'cancelled') then return jsonb_build_object('ok', false, 'code', 'not_open'); end if;

  select * into q from public.cro_quotes where id = p_quote_id and rfq_id = p_rfq_id and status = 'submitted' for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'bad_quote'); end if;

  -- 의뢰자가 확인한 판이 아니면 선정하지 않는다 (확인 화면을 연 뒤 기관이 금액·조건·PDF 를 고친 경우)
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
-- 5) 스키마 판 확인
-- ─────────────────────────────────────────────
create or replace function public.danchu_schema_version()
returns int
language sql
immutable
as $$ select 22 $$;
comment on function public.danchu_schema_version() is
  '마지막으로 적용한 마이그레이션 번호 (0022). 앱(lib/schema-version.ts REQUIRED_SCHEMA_VERSION)과 npm run check:schema 가 확인한다. 다음 마이그레이션이 새 번호로 바꾼다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 6) 실행 권한 정리
-- ─────────────────────────────────────────────
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.profiles_org_left() from public, anon, authenticated;
revoke execute on function public.cro_orgs_deactivated() from public, anon, authenticated;

-- 서버(service role)가 부르는 함수. Supabase 기본 권한으로도 열려 있지만 명시해 둔다
grant execute on function public.save_quote(uuid, jsonb, jsonb, boolean, uuid, text) to service_role;
grant execute on function public.select_quote(uuid, uuid, uuid, int) to service_role;
grant execute on function public.report_contract(uuid, date, bigint, text, boolean) to service_role;
grant execute on function public.revoke_invite(uuid, text) to service_role;
grant execute on function public.rotate_org_invite_tokens(uuid) to service_role;
grant execute on function public.claim_rfqs_by_email(uuid, text) to service_role;
grant execute on function public.billing_summary(date, date) to service_role;
grant execute on function public.billing_lines(date, date) to service_role;
grant execute on function public.billing_awards(date, date) to service_role;
grant execute on function public.billing_snapshot(date, date) to service_role;
grant execute on function public.close_billing_month(date, uuid, text) to service_role;
grant execute on function public.rate_limit_hit(text, int, int) to service_role;
grant execute on function public.rate_limit_cleanup() to service_role;
grant execute on function public.next_rfq_no(int) to service_role;
grant execute on function public.danchu_schema_version() to service_role;
