-- 단추(Danchu) 19차: 운영자 대행 모드 · 실시간 비교 · 기존 고객 면제 제거
-- 0018 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경
-- 1) 운영자가 아직 가입하지 않은 기관을 직접 등록하고(managed), 그 기관이 보낸 견적서 PDF 를 회신 링크(/q)로 대신 입력한다.
--    운영자 관리 기관은 담당자 계정이 없으므로 메일 링크는 로그인이 필요 없는 /q/{token} 으로 보낸다 (코드에서 처리).
-- 2) cro_quotes.entry_source: 견적을 입력한 주체. 'cro' 기관 / 'operator' 운영자 대리 입력.
--    비교표 표기("단추 정리 · 기관 PDF 기준")와 카탈로그 학습 제외에 쓴다. 기준 문서는 기관 PDF 원본이다.
-- 3) 실시간 비교 (2026-10-17 결정): 비교표 공개 단계를 없앤다. 기관이 견적을 제출하면 바로 의뢰자 비교표에 기관명과 함께 보이고,
--    의뢰자는 견적이 1건 이상이면 기한 전에도 선정할 수 있다 (select_quote 의 not_compared 검사 삭제).
--    rfq_requests.compared_at 은 이제 "회신 마감 시각"이다. 기한 다음 날 cron(제출 1건 이상) 또는 운영자의 '회신 마감'이 채우고,
--    채워지면 모든 기관의 회신이 닫힌다. 운영자가 기한을 늘리면 비워져 다시 열린다. 새 열은 없다.
--    선정·마감된 요청에는 저장·제출이 들어가지 않도록 save_quote 가 요청 행을 먼저 잠그고 확인한다 (선정과 같은 잠금 순서).
-- 4) rfq_awards.contract_status: 선정 뒤 계약 진행 상태.
--    pending 대기 · negotiating 협의 중 · signed 체결 · not_signed 미체결.
--    체결 보고(report_contract)가 signed 로 맞추고, signed 와 체결 보고 기록은 항상 함께 있다 (제약).
-- 5) 기존 고객 면제(0018)를 없앤다. 의뢰자 대부분이 기존 거래처가 있어도 업무 절차상 비교 견적을 받으므로,
--    기관이 "원래 우리 고객"이라고 판정할 근거가 되기 어렵다. 거래 귀속은 선정 시점의 기록(rfq_awards)으로 본다.
--    파일럿 기간이라 cro_org_clients 와 면제 열에는 시험 데이터만 있다. 옮기지 않고 지운다.

-- ─────────────────────────────────────────────
-- 1) 운영자 관리 기관
-- ─────────────────────────────────────────────
alter table public.cro_orgs add column if not exists managed boolean not null default false;

-- ─────────────────────────────────────────────
-- 2) 견적 입력 주체
-- ─────────────────────────────────────────────
alter table public.cro_quotes add column if not exists entry_source text not null default 'cro';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'cro_quotes_entry_source_chk') then
    alter table public.cro_quotes add constraint cro_quotes_entry_source_chk check (entry_source in ('cro', 'operator'));
  end if;
end $$;

-- 0019 전 파일럿에서 운영자가 회신 링크로 대신 제출한 견적: 제출자가 운영자 계정이면 대리 입력으로 본다
update public.cro_quotes set entry_source = 'operator'
 where entry_source = 'cro' and submitted_by in (select id from public.profiles where role = 'admin');

-- 회신 저장·제출: 0007 과 같고, 제출할 때 입력 주체(p_header.entry_source, 없으면 cro)를 같은 트랜잭션에서 남긴다.
-- 따로 갱신하면 그 갱신이 실패했을 때 운영자가 옮겨 적은 견적이 의뢰자에게 기관 제출 견적으로 보인다. 초안 저장은 입력 주체를 바꾸지 않는다
-- 선정됐거나 회신이 마감된 요청(compared_at)에는 초안·제출 모두 code 'closed' 로 거절한다 (위 배경 3)
create or replace function public.save_quote(p_invite_id uuid, p_header jsonb, p_items jsonb, p_submit boolean, p_actor uuid)
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
begin
  -- 요청 행을 먼저 잠근다. select_quote 도 요청 행부터 잠그므로, 의뢰자가 선정하는 순간 들어온 저장은 선정 뒤에 처리되어 아래에서 막힌다
  select * into r from public.rfq_requests where id = (select rfq_id from public.rfq_invites where id = p_invite_id) for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if r.status in ('selected', 'contracting', 'closed', 'cancelled') or r.compared_at is not null then
    return jsonb_build_object('ok', false, 'code', 'closed');
  end if;

  select * into inv from public.rfq_invites where id = p_invite_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;

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
revoke execute on function public.save_quote(uuid, jsonb, jsonb, boolean, uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 3) 실시간 비교: 기한 전 선정 허용, compared_at = 회신 마감 시각
-- ─────────────────────────────────────────────
comment on column public.rfq_requests.compared_at is
  '회신 마감 시각 (0019). 기한 다음 날 cron 또는 운영자 회신 마감이 채운다. 채워지면 모든 기관의 회신이 닫히고, 기한을 늘리면 비운다. 비교표 공개 여부가 아니다';

-- 선정: 0009 와 같고, 비교표 공개(compared_at) 검사만 뺀다. 제출된 견적이 있으면 기한 전에도 선정할 수 있다
create or replace function public.select_quote(p_rfq_id uuid, p_quote_id uuid, p_user uuid)
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

  select * into q from public.cro_quotes where id = p_quote_id and rfq_id = p_rfq_id and status = 'submitted';
  if not found then return jsonb_build_object('ok', false, 'code', 'bad_quote'); end if;

  select source into v_source from public.rfq_invites where id = q.invite_id;

  insert into public.rfq_awards (rfq_id, quote_id, invite_id, cro_org_id, cro_name, selected_by, fee_basis_amount, invite_source)
  values (r.id, q.id, q.invite_id, q.cro_org_id, q.cro_name, p_user, q.total_amount, v_source)
  returning id into v_award;

  update public.rfq_requests set status = 'selected', selected_quote_id = q.id where id = r.id;

  return jsonb_build_object('ok', true, 'award_id', v_award, 'invite_id', q.invite_id, 'cro_org_id', q.cro_org_id, 'cro_name', q.cro_name);
end;
$$;
revoke execute on function public.select_quote(uuid, uuid, uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 4) 계약 진행 상태
-- ─────────────────────────────────────────────
alter table public.rfq_awards add column if not exists contract_status text not null default 'pending';
-- 이미 체결 보고된 수주는 signed. 보고가 없는데 signed 인 행은 없어야 하지만 재실행 안전을 위해 되돌린다
update public.rfq_awards set contract_status = 'signed' where contract_reported_at is not null and contract_status <> 'signed';
update public.rfq_awards set contract_status = 'pending' where contract_reported_at is null and contract_status = 'signed';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'rfq_awards_contract_status_chk') then
    alter table public.rfq_awards add constraint rfq_awards_contract_status_chk
      check (contract_status in ('pending', 'negotiating', 'signed', 'not_signed'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'rfq_awards_contract_signed_chk') then
    alter table public.rfq_awards add constraint rfq_awards_contract_signed_chk
      check ((contract_status = 'signed') = (contract_reported_at is not null));
  end if;
end $$;

-- 체결 보고: 0016 과 같은 검증에 contract_status = 'signed' 만 더한다
create or replace function public.report_contract(p_award_id uuid, p_date date, p_amount bigint, p_note text, p_force boolean default false)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  a public.rfq_awards%rowtype;
  r public.rfq_requests%rowtype;
begin
  select * into a from public.rfq_awards where id = p_award_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if a.contract_reported_at is not null and not p_force then return jsonb_build_object('ok', false, 'code', 'already'); end if;
  if p_amount is null or p_amount <= 0 then return jsonb_build_object('ok', false, 'code', 'amount'); end if;
  if p_date is null or p_date < (a.awarded_at at time zone 'Asia/Seoul')::date then return jsonb_build_object('ok', false, 'code', 'date'); end if;
  if p_date > (now() at time zone 'Asia/Seoul')::date then return jsonb_build_object('ok', false, 'code', 'future'); end if;

  update public.rfq_awards
     set contract_date = p_date, contract_amount = p_amount, contract_note = nullif(p_note, ''), contract_reported_at = now(),
         contract_status = 'signed'
   where id = a.id;
  update public.rfq_requests set status = 'contracting' where id = a.rfq_id and status = 'selected';

  select * into r from public.rfq_requests where id = a.rfq_id;
  return jsonb_build_object('ok', true, 'rfq_id', a.rfq_id, 'rfq_no', r.rfq_no, 'user_id', r.user_id, 'substance', r.substance, 'corrected', a.contract_reported_at is not null);
end;
$$;
revoke execute on function public.report_contract(uuid, date, bigint, text, boolean) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 5) 기존 고객 면제 제거
--    집계 함수를 먼저 면제 없이 다시 만든 뒤 열과 표를 지운다 (반환 열이 바뀌므로 지우고 다시 만든다).
--    운영자 관리 기관을 명세에서 구분할 수 있게 managed 를 함께 돌려준다.
-- ─────────────────────────────────────────────
drop function if exists public.billing_summary(date, date);
create or replace function public.billing_summary(p_from date, p_to date)
returns table (
  org_id uuid, org_name text, per_request_fee int, monthly_cap int, managed boolean,
  delivered int, billable int, excluded int, matched int, nominated int, manual int,
  replied int, declined int, unanswered int, selected int, selected_amount bigint
)
language sql
security definer set search_path = public
as $$
  with inv as (
    select i.*, (i.sent_at at time zone 'Asia/Seoul')::date as sent_day
    from public.rfq_invites i
    where i.cro_org_id is not null
      and (i.sent_at at time zone 'Asia/Seoul')::date >= p_from
      and (i.sent_at at time zone 'Asia/Seoul')::date <  p_to
  ),
  aw as (
    select a.invite_id, a.fee_basis_amount
    from public.rfq_awards a
    where a.invite_id is not null
  )
  select
    o.id, o.name, o.per_request_fee, o.monthly_cap, o.managed,
    count(inv.id)::int,
    count(inv.id) filter (where inv.billable)::int,
    count(inv.id) filter (where not inv.billable)::int,
    count(inv.id) filter (where inv.source = 'matched')::int,
    count(inv.id) filter (where inv.source = 'nominated')::int,
    count(inv.id) filter (where inv.source = 'manual')::int,
    count(inv.id) filter (where inv.status = 'submitted')::int,
    count(inv.id) filter (where inv.status = 'declined')::int,
    count(inv.id) filter (where inv.status in ('sent', 'draft', 'expired'))::int,
    count(aw.invite_id)::int,
    coalesce(sum(aw.fee_basis_amount), 0)::bigint
  from public.cro_orgs o
  join inv on inv.cro_org_id = o.id
  left join aw on aw.invite_id = inv.id
  group by o.id, o.name, o.per_request_fee, o.monthly_cap, o.managed
  order by count(inv.id) desc, o.name;
$$;
revoke execute on function public.billing_summary(date, date) from public, anon, authenticated;

-- 파일럿 시험 데이터만 있어 옮기지 않는다 (위 배경 5)
alter table public.rfq_awards
  drop column if exists existing_client_claim,
  drop column if exists existing_client_claimed_at,
  drop column if exists fee_exempt,
  drop column if exists fee_exempt_reason,
  drop column if exists fee_exempt_at,
  drop column if exists fee_exempt_by;
drop table if exists public.cro_org_clients;
