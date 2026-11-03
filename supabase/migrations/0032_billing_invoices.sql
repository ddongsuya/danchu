-- 단추(Danchu) 32차: 월 청구서 (2026-11-03 대표 결정 "결제 청구서 발송")
-- 0031 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경
-- 1) 청구서는 마감한 달(billing_periods)의 저장본으로만 만든다. 열린 달은 숫자가 바뀔 수 있어서 발행하지 않는다.
--    기관 1곳·한 달에 청구서 1장. 그 달 합계(summary.total_due)가 0원보다 클 때만 만든다.
-- 2) 금액은 공급가액(합계) + 부가세 10% (원 단위 반올림). 납부 기한은 발행일(서울) + 14일.
--    결제는 계좌 이체 후불이다. 입금 확인은 운영자가 한다 (PG 결제는 사업자 등록 뒤 따로 붙인다).
-- 3) 발행한 청구서의 금액·내역·기관·달·번호·기한은 바꿀 수 없다 (트리거). 잘못 나간 청구서는 사유를 남기고 취소하고,
--    고칠 금액은 다음 열린 달의 조정 항목(0024)으로 넣는다. 취소한 청구서는 같은 달에 다시 발행할 수 있다.
-- 4) 상태: issued(발행, 납부 대기) → paid(입금 확인) 또는 void(취소). "기한 지남"은 저장하지 않고 화면이 계산한다.
-- 5) 기관 화면(/cro/billing)과 운영자 화면은 서버(service_role)로만 읽는다. 표에 직접 접근은 막는다.

do $$ begin
  if to_regprocedure('public.billing_send_fee(bigint)') is null then
    raise exception '0031_fee_schedule.sql 을 먼저 적용해 주세요';
  end if;
end $$;

-- ─────────────────────────────────────────────
-- 1) 청구서 받을 주소 (비우면 기관 대표 이메일)
-- ─────────────────────────────────────────────
alter table public.cro_orgs add column if not exists billing_email text;
comment on column public.cro_orgs.billing_email is '청구서 받을 이메일 (0032). 비어 있으면 대표 이메일(contact_email)';

-- ─────────────────────────────────────────────
-- 2) 청구서 표
-- ─────────────────────────────────────────────
create table if not exists public.billing_invoices (
  id              uuid primary key default gen_random_uuid(),
  invoice_no      text not null unique,
  org_id          uuid not null references public.cro_orgs(id) on delete restrict,
  org_name        text not null,
  month           date not null references public.billing_periods(month) on delete restrict,
  supply_amount   bigint not null check (supply_amount > 0),
  vat             bigint not null check (vat >= 0),
  total           bigint not null,
  detail          jsonb not null default '{}'::jsonb,
  issued_at       timestamptz not null default now(),
  issued_by       uuid references auth.users(id) on delete set null,
  due_date        date not null,
  status          text not null default 'issued' check (status in ('issued', 'paid', 'void')),
  sent_at         timestamptz,
  last_sent_at    timestamptz,
  sent_count      int not null default 0,
  reminder_stage  int not null default 0,
  paid_at         timestamptz,
  paid_on         date,
  paid_by         uuid references auth.users(id) on delete set null,
  paid_note       text,
  voided_at       timestamptz,
  voided_by       uuid references auth.users(id) on delete set null,
  void_reason     text,
  constraint billing_invoices_total_chk check (total = supply_amount + vat),
  constraint billing_invoices_paid_chk check (status <> 'paid' or (paid_at is not null and paid_on is not null)),
  constraint billing_invoices_void_chk check (status <> 'void' or (voided_at is not null and coalesce(btrim(void_reason), '') <> ''))
);
-- 기관·달마다 살아 있는 청구서는 1장
create unique index if not exists billing_invoices_org_month_live on public.billing_invoices (org_id, month) where status <> 'void';
create index if not exists billing_invoices_org on public.billing_invoices (org_id, month desc);
create index if not exists billing_invoices_open_due on public.billing_invoices (due_date) where status = 'issued';
alter table public.billing_invoices enable row level security;
revoke all on public.billing_invoices from anon, authenticated;
comment on table public.billing_invoices is '월 청구서 (0032). 마감 저장본으로 만들고, 금액·내역은 바꿀 수 없다. 서버만 읽고 쓴다';
comment on column public.billing_invoices.detail is '그 기관의 마감 저장본 조각: summary 1행, 청구한 견적(lines), 정산(awards settlement), 조정(adjustments)';

-- 발행한 값은 고정. 지우지 않는다 (취소는 status = void)
create or replace function public.billing_invoices_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception '청구서는 지울 수 없습니다. 취소(void)로 남기세요' using errcode = 'P0001';
  end if;
  if (new.invoice_no, new.org_id, new.org_name, new.month, new.supply_amount, new.vat, new.total, new.detail, new.issued_at, new.issued_by, new.due_date)
     is distinct from
     (old.invoice_no, old.org_id, old.org_name, old.month, old.supply_amount, old.vat, old.total, old.detail, old.issued_at, old.issued_by, old.due_date) then
    raise exception '발행한 청구서의 금액·내역은 바꿀 수 없습니다' using errcode = 'P0001';
  end if;
  if old.status in ('paid', 'void') and new.status is distinct from old.status then
    raise exception '입금 확인했거나 취소한 청구서의 상태는 바꿀 수 없습니다' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists billing_invoices_guard on public.billing_invoices;
create trigger billing_invoices_guard before update or delete on public.billing_invoices
for each row execute function public.billing_invoices_guard();

-- ─────────────────────────────────────────────
-- 3) 부가세·번호
-- ─────────────────────────────────────────────
create or replace function public.billing_vat(p_supply bigint) returns bigint
language sql immutable as $$ select round(p_supply * 0.1)::bigint $$;
create or replace function public.billing_invoice_due_days() returns int
language sql immutable as $$ select 14 $$;

-- ─────────────────────────────────────────────
-- 4) 발행: 마감한 달의 저장본에서 합계가 0원보다 큰 기관마다 1장. 이미 살아 있는 청구서가 있으면 건너뛴다
-- ─────────────────────────────────────────────
create or replace function public.issue_billing_invoices(p_month date, p_actor uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_month date := date_trunc('month', p_month)::date;
  v_snap jsonb;
  s jsonb;
  v_org uuid;
  v_supply bigint;
  v_issued int := 0;
  v_skipped int := 0;
  v_seq int;
  v_today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if v_month is null then return jsonb_build_object('ok', false, 'code', 'bad_month'); end if;
  -- 같은 달 발행이 겹치지 않게 (마감·조정과 같은 잠금)
  perform public.billing_month_lock(v_month);
  select snapshot into v_snap from public.billing_periods where month = v_month;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_closed', 'month', v_month); end if;

  for s in select * from jsonb_array_elements(coalesce(v_snap->'summary', '[]'::jsonb)) loop
    v_org := (s->>'org_id')::uuid;
    v_supply := coalesce((s->>'total_due')::bigint, 0);
    if v_supply <= 0 then continue; end if;
    if exists (select 1 from public.billing_invoices where org_id = v_org and month = v_month and status <> 'void') then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    select count(*) + 1 into v_seq from public.billing_invoices where month = v_month;
    insert into public.billing_invoices (invoice_no, org_id, org_name, month, supply_amount, vat, total, detail, issued_by, due_date)
    values (
      'DC-' || to_char(v_month, 'YYYYMM') || '-' || lpad(v_seq::text, 3, '0'),
      v_org,
      coalesce(s->>'org_name', ''),
      v_month,
      v_supply,
      public.billing_vat(v_supply),
      v_supply + public.billing_vat(v_supply),
      jsonb_build_object(
        'summary', s,
        'lines', coalesce((select jsonb_agg(l) from jsonb_array_elements(coalesce(v_snap->'lines', '[]'::jsonb)) l
                           where l->>'org_id' = v_org::text and coalesce((l->>'fee_due')::bigint, 0) > 0), '[]'::jsonb),
        'awards', coalesce((select jsonb_agg(a) from jsonb_array_elements(coalesce(v_snap->'awards', '[]'::jsonb)) a
                            where a->>'org_id' = v_org::text and a->>'kind' = 'settlement'
                              and coalesce((a->>'invite_joined')::boolean, true) and coalesce((a->>'fee')::bigint, 0) > 0), '[]'::jsonb),
        'adjustments', coalesce((select jsonb_agg(j) from jsonb_array_elements(coalesce(v_snap->'adjustments', '[]'::jsonb)) j
                                 where j->>'org_id' = v_org::text), '[]'::jsonb)
      ),
      p_actor,
      v_today + public.billing_invoice_due_days()
    );
    v_issued := v_issued + 1;
  end loop;
  return jsonb_build_object('ok', true, 'month', v_month, 'issued', v_issued, 'skipped', v_skipped);
end;
$$;
revoke execute on function public.issue_billing_invoices(date, uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 5) 상태 바꾸기: 보냄 기록 · 입금 확인 · 취소 · 독촉 단계
-- ─────────────────────────────────────────────
create or replace function public.mark_invoice_sent(p_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare v public.billing_invoices%rowtype;
begin
  update public.billing_invoices
     set sent_at = coalesce(sent_at, now()), last_sent_at = now(), sent_count = sent_count + 1
   where id = p_id and status <> 'void'
  returning * into v;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  return jsonb_build_object('ok', true, 'sent_count', v.sent_count);
end;
$$;

create or replace function public.mark_invoice_paid(p_id uuid, p_actor uuid, p_paid_on date, p_note text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare v public.billing_invoices%rowtype;
begin
  select * into v from public.billing_invoices where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if v.status = 'paid' then return jsonb_build_object('ok', true, 'already', true); end if;
  if v.status = 'void' then return jsonb_build_object('ok', false, 'code', 'void'); end if;
  if p_paid_on is null or p_paid_on > (now() at time zone 'Asia/Seoul')::date then
    return jsonb_build_object('ok', false, 'code', 'paid_on');
  end if;
  update public.billing_invoices
     set status = 'paid', paid_at = now(), paid_on = p_paid_on, paid_by = p_actor, paid_note = nullif(btrim(coalesce(p_note, '')), '')
   where id = p_id;
  return jsonb_build_object('ok', true, 'invoice_no', v.invoice_no, 'org_id', v.org_id);
end;
$$;

create or replace function public.void_invoice(p_id uuid, p_actor uuid, p_reason text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare v public.billing_invoices%rowtype;
begin
  if coalesce(btrim(p_reason), '') = '' then return jsonb_build_object('ok', false, 'code', 'reason'); end if;
  select * into v from public.billing_invoices where id = p_id for update;
  if not found then return jsonb_build_object('ok', false, 'code', 'not_found'); end if;
  if v.status = 'void' then return jsonb_build_object('ok', true, 'already', true); end if;
  if v.status = 'paid' then return jsonb_build_object('ok', false, 'code', 'paid'); end if;
  update public.billing_invoices
     set status = 'void', voided_at = now(), voided_by = p_actor, void_reason = btrim(p_reason)
   where id = p_id;
  return jsonb_build_object('ok', true, 'invoice_no', v.invoice_no, 'org_id', v.org_id);
end;
$$;

-- 독촉 단계: 1 = 기한 3일 전 안내, 2 = 기한 다음 날, 3 = 기한 7일 뒤, 4 = 기한 30일 뒤. 단계는 올라가기만 한다
create or replace function public.mark_invoice_reminded(p_id uuid, p_stage int)
returns boolean
language sql
security definer set search_path = public
as $$
  with u as (
    update public.billing_invoices set reminder_stage = p_stage
     where id = p_id and status = 'issued' and reminder_stage < p_stage
    returning 1
  ) select exists (select 1 from u)
$$;

-- ─────────────────────────────────────────────
-- 6) 스키마 판과 실행 권한
-- ─────────────────────────────────────────────
create or replace function public.danchu_schema_version()
returns int
language sql
immutable
as $$ select 32 $$;
comment on function public.danchu_schema_version() is
  '마지막으로 적용한 마이그레이션 번호 (0032). 앱(lib/schema-version.ts REQUIRED_SCHEMA_VERSION)과 npm run check:schema 가 확인한다. 다음 마이그레이션이 새 번호로 바꾼다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'billing_vat(bigint)', 'billing_invoice_due_days()', 'issue_billing_invoices(date, uuid)',
    'mark_invoice_sent(uuid)', 'mark_invoice_paid(uuid, uuid, date, text)', 'void_invoice(uuid, uuid, text)',
    'mark_invoice_reminded(uuid, int)', 'billing_invoices_guard()'
  ] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;
grant select, insert, update on public.billing_invoices to service_role;
grant execute on function public.danchu_schema_version() to service_role;
