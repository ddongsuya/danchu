-- 단추(Danchu) CRO 견적 회신 스키마 (2차)
-- schema.sql 실행 후, Supabase SQL Editor에 그대로 붙여 넣어 실행하세요.
-- 근거: 표준견적회신양식_초안_v0.1.md §2~§6, §9

-- ─────────────────────────────────────────────
-- 1) 배포 — RFQ 하나를 CRO 한 곳에 보낸 기록. 토큰이 곧 회신 링크(/quote/{token})
-- ─────────────────────────────────────────────
create table if not exists public.rfq_invites (
  id           uuid primary key default gen_random_uuid(),
  rfq_id       uuid not null references public.rfq_requests(id) on delete cascade,
  rfq_no       text not null,
  cro_name     text not null,
  cro_email    text not null,
  token        text unique not null default encode(gen_random_bytes(18), 'base64url'),
  reply_by     date not null,                        -- 회신 기한 (의뢰자 희망일 또는 접수+7영업일)
  expires_at   timestamptz not null,                 -- reply_by + 7일. 이후 링크 만료
  status       text not null default 'sent',         -- sent | draft | submitted | declined | expired
  sent_at      timestamptz not null default now(),
  opened_at    timestamptz,
  created_at   timestamptz not null default now(),
  unique (rfq_id, cro_email)
);
create index if not exists rfq_invites_rfq_idx on public.rfq_invites (rfq_id);

-- ─────────────────────────────────────────────
-- 2) 견적 회신 헤더 — 초안 저장(draft)과 제출(submitted) 모두 여기
-- ─────────────────────────────────────────────
create table if not exists public.cro_quotes (
  id             uuid primary key default gen_random_uuid(),
  invite_id      uuid not null unique references public.rfq_invites(id) on delete cascade,
  rfq_id         uuid not null references public.rfq_requests(id) on delete cascade,
  rfq_no         text not null,
  cro_name       text not null,

  -- §2 CRO 식별
  contact_name   text,
  contact_email  text,
  contact_phone  text,
  cro_quote_no   text,                               -- 자사 견적번호
  quote_date     date,
  valid_until    date,
  glp_certs      text[] not null default '{}',       -- 식약처(KGLP) / OECD GLP / US FDA GLP / ...
  aaalac         boolean,
  other_certs    text,

  -- §5 공통 조건
  total_amount   bigint,                             -- VAT 별도. 항목 합계 자동, 수정 가능
  discount       bigint,
  discount_reason text,
  vat            text,                               -- 별도 | 포함 | 면세
  pay_terms      text,                               -- "30 · 40 · 30"
  start_date     date,
  total_weeks    int,                                -- 병렬 수행 반영
  schedule       text,                               -- 즉시 가능 | 4주 내 | 8주 내 | 협의 필요
  report_draft   text,
  report_lang    text,
  translation    text,
  substance_qty  text,
  substance_when text,
  retention      text,
  leftover       text,
  send_conv      text,
  multisite      text,
  audit          text,
  note           text,                               -- 제외 항목 · 의뢰자 전달 사항

  -- §6 첨부 (Storage 버킷 cro-files)
  pdf_path       text,
  pdf_name       text,
  pdf_size       bigint,

  status         text not null default 'draft',      -- draft | submitted
  submitted_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists cro_quotes_rfq_idx on public.cro_quotes (rfq_id);

-- ─────────────────────────────────────────────
-- 3) 항목별 견적 — 행은 RFQ의 시험 항목에서 자동 생성 (CRO가 항목을 정의하지 않는다)
-- ─────────────────────────────────────────────
create table if not exists public.cro_quote_items (
  id           uuid primary key default gen_random_uuid(),
  quote_id     uuid not null references public.cro_quotes(id) on delete cascade,
  seq          int not null,
  category     text not null,                        -- RFQ 대분류 (일반독성 등)
  name         text not null,                        -- 표시명 (반복투여독성 4주 (랫드))
  cond         text,                                 -- RFQ 세부 조건 요약

  -- §3-1 필수 3칸
  avail        text,                                 -- 가능 | 조건부 가능 | 불가
  amount       bigint,                               -- VAT 별도
  weeks        int,                                  -- 투여 개시~최종보고서

  -- §3-2 선택
  reason       text,                                 -- 조건부·불가 사유
  start_date   date,
  glp          text,                                 -- GLP | Non-GLP
  species      text,
  groups       int,
  per_group    text,                                 -- "10/10"
  dosing       text,
  route        text,
  includes     text[] not null default '{}',         -- 임상병리 / 조직병리 / TK / 조제물분석 / QA 점검 / 영문 보고서 ...
  options      jsonb not null default '[]',          -- [{name, amount}] 별도 옵션
  excluded     text,
  note         text,
  unique (quote_id, seq)
);

-- ─────────────────────────────────────────────
-- 4) 추가 제안 — CRO 주도 항목 (0개 가능)
-- ─────────────────────────────────────────────
create table if not exists public.cro_quote_addons (
  id         uuid primary key default gen_random_uuid(),
  quote_id   uuid not null references public.cro_quotes(id) on delete cascade,
  seq        int not null,
  name       text not null,
  reason     text,
  amount     bigint,
  weeks      int,
  level      text,                                   -- 규제상 필수 | 권장 | 선택
  unique (quote_id, seq)
);

-- ─────────────────────────────────────────────
-- 5) 수주 결과 — 의뢰자가 CRO를 선택하면 기록
-- ─────────────────────────────────────────────
create table if not exists public.rfq_awards (
  id           uuid primary key default gen_random_uuid(),
  rfq_id       uuid not null unique references public.rfq_requests(id) on delete cascade,
  quote_id     uuid not null references public.cro_quotes(id),
  cro_name     text not null,
  awarded_at   timestamptz not null default now(),
  contract_date date,                                -- CRO가 보고 (수수료 정산 기준)
  contract_amount bigint
);

-- updated_at 자동 갱신
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists cro_quotes_touch on public.cro_quotes;
create trigger cro_quotes_touch before update on public.cro_quotes
  for each row execute function public.touch_updated_at();

-- RLS: 서버(service role)만 접근
alter table public.rfq_invites      enable row level security;
alter table public.cro_quotes       enable row level security;
alter table public.cro_quote_items  enable row level security;
alter table public.cro_quote_addons enable row level security;
alter table public.rfq_awards       enable row level security;

-- Storage 버킷 (private) — 정식 견적서 PDF
insert into storage.buckets (id, name, public)
values ('cro-files', 'cro-files', false)
on conflict (id) do nothing;

-- rfq_requests.status 확장 안내
-- received → distributed → quoted → compared → selected → contracting → closed
