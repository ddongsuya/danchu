-- 단추(Danchu) 19차: 흐름 재설계 (보내기 직전 가입, 접수 시작 시점, 취소 초대 차단, 계약 완료 확인, 성사수수료 기준)
-- 0018 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 1) rfq_requests.started_at: 기관 전달과 접수 메일을 "첨부 업로드가 끝난 뒤" 한 번만 보내기 위한 표시.
--    기존 요청은 이미 시작된 것으로 채운다 (예약 작업이 옛 요청에 접수 메일을 다시 보내지 않게).
-- 2) rfq_pending: 로그인하지 않은 의뢰자가 보내기를 누른 순간의 요청서. 이메일 인증이 끝나면 정식 요청으로 바뀐다.
-- 3) save_quote: 운영자가 취소했거나(expired) 회신하지 않음(declined)으로 처리된 초대는 저장·제출을 거부한다.
-- 4) rfq_awards: 기관의 계약 보고를 의뢰자가 확인한다. 7일 안에 이의가 없으면 예약 작업이 확정한다.
-- 5) billing_summary: 성사수수료 기준을 "계약 보고 금액, 보고한 달"로 바꾼다. 선정 견적 합계는 참고용으로 남긴다.

-- 1) 접수 시작 시점
alter table public.rfq_requests add column if not exists started_at timestamptz;
update public.rfq_requests set started_at = coalesce(distributed_at, created_at) where started_at is null;

-- 2) 보내기 직전 가입용 임시 요청서
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
alter table public.rfq_pending enable row level security;
-- 서비스 키로만 읽고 쓴다 (정책 없음)

-- 3) 닫힌 초대로는 저장·제출하지 않는다
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
  if inv.status in ('expired', 'declined') then return jsonb_build_object('ok', false, 'code', 'closed'); end if;

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

-- 4) 계약 완료: 기관 보고 → 의뢰자 확인 (7일 안에 이의가 없으면 자동 확정)
alter table public.rfq_awards
  add column if not exists requester_confirmed_at timestamptz,
  add column if not exists confirmed_auto boolean not null default false,
  add column if not exists requester_disputed_at timestamptz,
  add column if not exists requester_dispute_note text;
create index if not exists rfq_awards_unconfirmed_idx on public.rfq_awards (contract_reported_at)
  where contract_reported_at is not null and requester_confirmed_at is null and requester_disputed_at is null;

-- 5) 성사수수료 기준: 계약 보고 금액, 보고한 달 (면제 제외). 전달·회신 집계는 그대로 발송 월 기준
drop function if exists public.billing_summary(date, date);
create or replace function public.billing_summary(p_from date, p_to date)
returns table (
  org_id uuid, org_name text, per_request_fee int, monthly_cap int,
  delivered int, billable int, excluded int, matched int, nominated int, manual int,
  replied int, declined int, unanswered int, selected int, selected_amount bigint, exempt int,
  contracted int, contracted_amount bigint
)
language sql
security definer set search_path = public
as $$
  with inv as (
    select i.*
    from public.rfq_invites i
    where i.cro_org_id is not null
      and (i.sent_at at time zone 'Asia/Seoul')::date >= p_from
      and (i.sent_at at time zone 'Asia/Seoul')::date <  p_to
  ),
  aw as (
    select a.invite_id, a.fee_basis_amount, a.fee_exempt
    from public.rfq_awards a
    where a.invite_id is not null
  ),
  ct as (
    -- 이 기간에 계약을 보고한 수주 (발송 월과 무관)
    select a.cro_org_id,
           count(*) filter (where not a.fee_exempt)::int as contracted,
           coalesce(sum(a.contract_amount) filter (where not a.fee_exempt), 0)::bigint as contracted_amount
    from public.rfq_awards a
    where a.cro_org_id is not null
      and a.contract_reported_at is not null
      and (a.contract_reported_at at time zone 'Asia/Seoul')::date >= p_from
      and (a.contract_reported_at at time zone 'Asia/Seoul')::date <  p_to
    group by a.cro_org_id
  ),
  base as (
    select
      o.id, o.name, o.per_request_fee, o.monthly_cap,
      count(inv.id)::int as delivered,
      count(inv.id) filter (where inv.billable)::int as billable,
      count(inv.id) filter (where not inv.billable)::int as excluded,
      count(inv.id) filter (where inv.source = 'matched')::int as matched,
      count(inv.id) filter (where inv.source = 'nominated')::int as nominated,
      count(inv.id) filter (where inv.source = 'manual')::int as manual,
      count(inv.id) filter (where inv.status = 'submitted')::int as replied,
      count(inv.id) filter (where inv.status = 'declined')::int as declined,
      count(inv.id) filter (where inv.status in ('sent', 'draft', 'expired'))::int as unanswered,
      count(aw.invite_id)::int as selected,
      coalesce(sum(aw.fee_basis_amount) filter (where not aw.fee_exempt), 0)::bigint as selected_amount,
      count(aw.invite_id) filter (where aw.fee_exempt)::int as exempt
    from public.cro_orgs o
    join inv on inv.cro_org_id = o.id
    left join aw on aw.invite_id = inv.id
    group by o.id, o.name, o.per_request_fee, o.monthly_cap
  )
  select
    coalesce(b.id, o.id), coalesce(b.name, o.name), coalesce(b.per_request_fee, o.per_request_fee), coalesce(b.monthly_cap, o.monthly_cap),
    coalesce(b.delivered, 0), coalesce(b.billable, 0), coalesce(b.excluded, 0), coalesce(b.matched, 0), coalesce(b.nominated, 0), coalesce(b.manual, 0),
    coalesce(b.replied, 0), coalesce(b.declined, 0), coalesce(b.unanswered, 0), coalesce(b.selected, 0), coalesce(b.selected_amount, 0), coalesce(b.exempt, 0),
    coalesce(ct.contracted, 0), coalesce(ct.contracted_amount, 0)
  from base b
  full join ct on ct.cro_org_id = b.id
  left join public.cro_orgs o on o.id = ct.cro_org_id
  order by coalesce(b.delivered, 0) desc, coalesce(b.name, o.name);
$$;
revoke execute on function public.billing_summary(date, date) from public, anon, authenticated;
