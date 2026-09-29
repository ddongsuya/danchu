-- 단추(Danchu) 7차: 다단계 쓰기의 원자화 · 첨부 업로드 완료 표시
-- 0006 실행 후 Supabase SQL Editor에 그대로 붙여 넣어 실행하세요.
--
-- 배경
-- 서버 라우트가 "award 삽입 → 요청 상태 갱신", "견적 헤더 → 항목 → 초대 상태 → 요청 상태"처럼
-- 여러 표를 순서대로 고치다 중간에 실패하면 반쪽 상태가 남았다. 핵심 전이 세 가지를
-- Postgres 함수로 묶어 한 트랜잭션에서 끝낸다. 알림·메일·이력은 함수 밖(TS)에서 보낸다.
-- 모든 함수는 service role 만 호출한다 (anon/authenticated 실행 권한 회수).

-- ─────────────────────────────────────────────
-- 1) 첨부: 브라우저 업로드가 끝났음을 서버가 확인한 시각. null 이면 아직 올라오지 않은 파일
-- ─────────────────────────────────────────────
alter table public.rfq_files add column if not exists uploaded_at timestamptz;
-- 이 마이그레이션 이전의 파일은 확인 절차가 없었으므로 올라온 것으로 본다
update public.rfq_files set uploaded_at = created_at where uploaded_at is null;

-- ─────────────────────────────────────────────
-- 2) 의뢰자 CRO 선택 — rfq_awards 삽입 + 요청 상태 selected (원자)
--    반환: { ok, code?, award_id?, invite_id?, cro_org_id?, cro_name? }
-- ─────────────────────────────────────────────
create or replace function public.select_quote(p_rfq_id uuid, p_quote_id uuid, p_user uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  r public.rfq_requests%rowtype;
  q public.cro_quotes%rowtype;
  v_award uuid;
begin
  select * into r from public.rfq_requests where id = p_rfq_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if r.compared_at is null then return jsonb_build_object('ok', false, 'code', 'not_compared'); end if;
  if r.selected_quote_id is not null then return jsonb_build_object('ok', false, 'code', 'already_selected'); end if;

  select * into q from public.cro_quotes where id = p_quote_id and rfq_id = p_rfq_id and status = 'submitted';
  if not found then return jsonb_build_object('ok', false, 'code', 'bad_quote'); end if;

  insert into public.rfq_awards (rfq_id, quote_id, invite_id, cro_org_id, cro_name, selected_by)
  values (r.id, q.id, q.invite_id, q.cro_org_id, q.cro_name, p_user)
  returning id into v_award;

  update public.rfq_requests set status = 'selected', selected_quote_id = q.id where id = r.id;

  return jsonb_build_object('ok', true, 'award_id', v_award, 'invite_id', q.invite_id, 'cro_org_id', q.cro_org_id, 'cro_name', q.cro_name);
end;
$$;
revoke execute on function public.select_quote(uuid, uuid, uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 3) CRO 회신 저장·제출 — 헤더 + 항목 + 초대 상태 + 요청 상태 (원자)
--    p_header: cro_quotes 컬럼 이름을 키로 한 jsonb (pdf_* 는 주어질 때만 덮는다)
--    p_items : [{seq, category, name, cond, avail, amount, weeks, reason, design, source, unit, unit_price, sample_count}]
--    초안 저장(p_submit=false)은 제출본을 절대 덮지 않는다 → { ok, skipped: true }
--    반환: { ok, quote_id, first (첫 제출인지), total_invites, submitted_invites }
-- ─────────────────────────────────────────────
create or replace function public.save_quote(p_invite_id uuid, p_header jsonb, p_items jsonb, p_submit boolean, p_actor uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  inv public.rfq_invites%rowtype;
  v_quote uuid;
  v_prev_status text;
  v_total int;
  v_done int;
begin
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
      status, submitted_at, submitted_by
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
      case when p_submit then p_actor else null end
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
      submitted_by = case when p_submit then p_actor else null end
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
-- 4) CRO 계약 체결 보고 — award 갱신 + 요청 상태 contracting (원자)
--    반환: { ok, rfq_id, rfq_no, user_id, substance }
-- ─────────────────────────────────────────────
create or replace function public.report_contract(p_award_id uuid, p_date date, p_amount bigint, p_note text)
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

  update public.rfq_awards
     set contract_date = p_date, contract_amount = p_amount, contract_note = nullif(p_note, ''), contract_reported_at = now()
   where id = a.id;
  update public.rfq_requests set status = 'contracting' where id = a.rfq_id and status = 'selected';

  select * into r from public.rfq_requests where id = a.rfq_id;
  return jsonb_build_object('ok', true, 'rfq_id', a.rfq_id, 'rfq_no', r.rfq_no, 'user_id', r.user_id, 'substance', r.substance);
end;
$$;
revoke execute on function public.report_contract(uuid, date, bigint, text) from public, anon, authenticated;
