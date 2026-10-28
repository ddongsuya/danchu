-- 단추(Danchu) 29차: 기관 회신의 예상 일정 (간트차트) (2026-10-28)
-- 0028 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경
--   지금까지 견적의 기간은 항목마다 주수 한 칸이었고, 총 기간(total_weeks)은 그중 가장 긴 값("병렬 수행 기준")이었다.
--   용량결정 → 분석법 검증 → 반복투여처럼 이어서 진행하는 시험과 최종보고서까지의 기간이 빠져 종료일이 짧게 보였다.
--   여기서는 기관이 회신할 때 항목마다 앞 단계·최종보고서까지 주수·번역 주수를, 견적마다 일정에만 넣는 단계(분석법 검증 등)를
--   적을 수 있게 하고, 앱이 계산한 최종보고서 주를 견적에 남긴다 (lib/schedule.ts planSchedule).
--   순서와 기간은 단추가 정하지 않는다. 모든 값은 기관 입력이며, 기관이 제출한 값은 그 기관의 카탈로그에 학습되어 다음 회신 초안에 채워진다.
--   total_weeks 는 그대로 둔다 (예전 견적과 같은 뜻: 항목 주수 최댓값).

-- ─────────────────────────────────────────────
-- 1) 견적 항목: 최종보고서까지 주수 · 번역 주수 · 앞 단계(같은 견적의 행 번호, 일정 단계는 101부터)
-- ─────────────────────────────────────────────
alter table public.cro_quote_items
  add column if not exists report_weeks int,
  add column if not exists translation_weeks int,
  add column if not exists after_seqs int[] not null default '{}';

comment on column public.cro_quote_items.report_weeks is '시험 기간(보고서 초안까지) 뒤 최종보고서까지 주수 (0029). 기관 입력';
comment on column public.cro_quote_items.translation_weeks is '최종보고서 뒤 번역 보고서까지 주수 (0029). 요청서에 번역이 있을 때 기관 입력';
comment on column public.cro_quote_items.after_seqs is '이 시험을 시작하기 전에 끝나야 하는 단계의 행 번호 (0029). 101 이상은 cro_quotes.schedule_steps 의 단계';

-- ─────────────────────────────────────────────
-- 2) 견적: 일정 단계 · 계산한 최종보고서 주
-- ─────────────────────────────────────────────
alter table public.cro_quotes
  add column if not exists schedule_steps jsonb not null default '[]'::jsonb,
  add column if not exists final_report_weeks int,
  add column if not exists final_weeks int;

comment on column public.cro_quotes.schedule_steps is '견적 항목은 아니지만 일정에 넣는 단계 (0029). [{seq(101~), name, weeks, after:[행 번호]}]. 기관 입력';
comment on column public.cro_quotes.final_report_weeks is '착수 주부터 최종보고서(원문)가 끝나는 주 (0029). 앱이 기관 입력으로 계산. 비교표 "최종보고서 빠른 순"';
comment on column public.cro_quotes.final_weeks is '착수 주부터 번역 보고서까지 끝나는 주 (0029). 번역이 없으면 final_report_weeks 와 같다';

-- ─────────────────────────────────────────────
-- 3) 카탈로그 학습: 최근 제출한 최종보고서·번역 주수, 앞 단계(항목 키 또는 step::단계 이름)
-- ─────────────────────────────────────────────
alter table public.cro_catalog
  add column if not exists report_weeks int,
  add column if not exists translation_weeks int,
  add column if not exists after_keys text[] not null default '{}';

comment on column public.cro_catalog.report_weeks is '최근 제출한 최종보고서까지 주수 (0029). 다음 회신 초안에 채운다';
comment on column public.cro_catalog.translation_weeks is '최근 제출한 번역 주수 (0029)';
comment on column public.cro_catalog.after_keys is '최근 제출한 앞 단계 (0029). 항목 키(대분류::시험) 또는 step::단계 이름';

create table if not exists public.cro_schedule_steps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.cro_orgs(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  weeks int check (weeks is null or weeks between 1 and 520),
  after_keys text[] not null default '{}',
  updated_at timestamptz not null default now(),
  unique (org_id, name)
);
comment on table public.cro_schedule_steps is '기관이 회신에 넣은 일정 단계(분석법 검증 등)의 최근 값 (0029). 다음 회신 초안에 채운다. 서버(service role)만 읽고 쓴다';
alter table public.cro_schedule_steps enable row level security;

-- ─────────────────────────────────────────────
-- 4) 견적 판·비교표 잠금: 일정도 견적 내용이다 (0022·0026 과 같은 열 목록 + 일정 열)
-- ─────────────────────────────────────────────
create or replace function public.cro_quotes_bump_revision()
returns trigger
language plpgsql
as $$
begin
  if (new.cro_name, new.total_amount, new.total_weeks, new.vat, new.valid_until, new.auto, new.start_date,
      new.pay_terms, new.substance_qty, new.report_lang, new.includes, new.note,
      new.pdf_path, new.pdf_name, new.pdf_size, new.status, new.submitted_at, new.entry_source, new.material_by,
      new.schedule_steps, new.final_report_weeks, new.final_weeks)
     is distinct from
     (old.cro_name, old.total_amount, old.total_weeks, old.vat, old.valid_until, old.auto, old.start_date,
      old.pay_terms, old.substance_qty, old.report_lang, old.includes, old.note,
      old.pdf_path, old.pdf_name, old.pdf_size, old.status, old.submitted_at, old.entry_source, old.material_by,
      old.schedule_steps, old.final_report_weeks, old.final_weeks) then
    new.revision := old.revision + 1;
  else
    new.revision := old.revision;
  end if;
  return new;
end;
$$;

create or replace function public.cro_quotes_compare_lock()
returns trigger
language plpgsql
as $$
begin
  if not exists (select 1 from public.rfq_requests r
                  where r.id in (new.rfq_id, case when tg_op = 'UPDATE' then old.rfq_id end) and r.compared_at is not null) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    raise exception 'compare_locked: 비교표가 열린 요청에는 견적을 새로 낼 수 없습니다';
  end if;
  if (new.cro_name, new.total_amount, new.total_weeks, new.vat, new.valid_until, new.auto, new.start_date,
      new.pay_terms, new.substance_qty, new.report_lang, new.includes, new.note,
      new.pdf_path, new.pdf_name, new.pdf_size, new.status, new.submitted_at, new.entry_source, new.material_by, new.rfq_id, new.invite_id,
      new.schedule_steps, new.final_report_weeks, new.final_weeks)
     is distinct from
     (old.cro_name, old.total_amount, old.total_weeks, old.vat, old.valid_until, old.auto, old.start_date,
      old.pay_terms, old.substance_qty, old.report_lang, old.includes, old.note,
      old.pdf_path, old.pdf_name, old.pdf_size, old.status, old.submitted_at, old.entry_source, old.material_by, old.rfq_id, old.invite_id,
      old.schedule_steps, old.final_report_weeks, old.final_weeks) then
    raise exception 'compare_locked: 비교표가 열린 뒤에는 견적을 고치거나 다시 제출할 수 없습니다';
  end if;
  return new;
end;
$$;
revoke execute on function public.cro_quotes_compare_lock() from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 5) 저장: 0025 save_quote 와 같고, 일정 열(헤더 3개, 항목 3개)을 함께 쓴다
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
  v_steps jsonb := case when jsonb_typeof(p_header->'schedule_steps') = 'array' then p_header->'schedule_steps' else '[]'::jsonb end;
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
  if inv.withdrawn_at is not null then return jsonb_build_object('ok', false, 'code', 'withdrawn'); end if;
  if inv.status = 'declined' then return jsonb_build_object('ok', false, 'code', 'declined'); end if;
  if inv.status not in ('sent', 'draft', 'submitted') then return jsonb_build_object('ok', false, 'code', 'expired'); end if;
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
      status, submitted_at, submitted_by, entry_source,
      schedule_steps, final_report_weeks, final_weeks
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
      case when p_submit then v_source else 'cro' end,
      v_steps, (p_header->>'final_report_weeks')::int, (p_header->>'final_weeks')::int
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
      entry_source = case when p_submit then v_source else entry_source end,
      schedule_steps = v_steps,
      final_report_weeks = (p_header->>'final_report_weeks')::int,
      final_weeks = (p_header->>'final_weeks')::int
    where id = v_quote;
  end if;

  insert into public.cro_quote_items (quote_id, seq, category, name, cond, avail, amount, weeks, reason, design, source, unit, unit_price, sample_count,
                                      report_weeks, translation_weeks, after_seqs)
  select v_quote, (i->>'seq')::int, i->>'category', i->>'name', i->>'cond', i->>'avail',
         (i->>'amount')::bigint, (i->>'weeks')::int, i->>'reason',
         coalesce(i->'design', '{}'::jsonb), coalesce(i->>'source', 'manual'), coalesce(i->>'unit', 'total'),
         (i->>'unit_price')::bigint, (i->>'sample_count')::int,
         (i->>'report_weeks')::int, (i->>'translation_weeks')::int,
         coalesce((select array_agg(x::int) from jsonb_array_elements_text(case when jsonb_typeof(i->'after_seqs') = 'array' then i->'after_seqs' else '[]'::jsonb end) x), '{}'::int[])
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i
  on conflict (quote_id, seq) do update set
    category = excluded.category, name = excluded.name, cond = excluded.cond, avail = excluded.avail,
    amount = excluded.amount, weeks = excluded.weeks, reason = excluded.reason, design = excluded.design,
    source = excluded.source, unit = excluded.unit, unit_price = excluded.unit_price, sample_count = excluded.sample_count,
    report_weeks = excluded.report_weeks, translation_weeks = excluded.translation_weeks, after_seqs = excluded.after_seqs;

  update public.rfq_invites set status = case when p_submit then 'submitted' else 'draft' end where id = inv.id;

  if p_submit then
    update public.rfq_requests set status = 'quoted' where id = inv.rfq_id and status in ('received', 'distributed');
  end if;

  select count(*), count(*) filter (where status = 'submitted'),
         count(*) filter (where revoked_at is null and withdrawn_at is null and status in ('sent', 'draft', 'submitted')
                            and (joined_at is not null or status in ('draft', 'submitted')))
    into v_total, v_done, v_joined from public.rfq_invites where rfq_id = inv.rfq_id;

  if p_submit then
    v_open := public.open_comparison_if_ready(r.id);
  end if;

  return jsonb_build_object('ok', true, 'quote_id', v_quote, 'first', coalesce(v_prev_status, '') <> 'submitted',
                            'total_invites', v_total, 'submitted_invites', v_done, 'joined_invites', v_joined,
                            'compare_opened', coalesce((v_open->>'opened')::boolean, false));
end;
$$;
revoke execute on function public.save_quote(uuid, jsonb, jsonb, boolean, uuid, text) from public, anon, authenticated;
grant execute on function public.save_quote(uuid, jsonb, jsonb, boolean, uuid, text) to service_role;

-- ─────────────────────────────────────────────
-- 6) 스키마 판
-- ─────────────────────────────────────────────
create or replace function public.danchu_schema_version()
returns int
language sql
immutable
as $$ select 29 $$;
comment on function public.danchu_schema_version() is
  '마지막으로 적용한 마이그레이션 번호 (0029). 앱(lib/schema-version.ts REQUIRED_SCHEMA_VERSION)과 npm run check:schema 가 확인한다. 다음 마이그레이션이 새 번호로 바꾼다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;
grant execute on function public.danchu_schema_version() to service_role;
