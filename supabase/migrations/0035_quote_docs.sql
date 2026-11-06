-- 단추(Danchu) 35차: 견적서 생성 툴 (2026-11-06, 기관 이용료 5단계)
-- 0034 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경
-- 1) 기관이 카탈로그에 등록한 시험 조건마다 표준가를 정하고, 시험(항목)마다 추가 비용 단가(동물 수·회복군·투여군·
--    수량 항목·평가항목 추가)를 정한다. 견적서에서 표준가 포함 범위와 달라진 곳만 추가 비용으로 계산한다.
-- 2) 견적서는 표지 · 견적서 · 시험 상세 설명 · 시험 수행 일정표 4부로 만든다. 단추 요청에 회신하거나 단추 밖 의뢰자에게 보낸다.
--    견적서는 만들 때의 표준가·단가를 그대로 담는다 (카탈로그 단가를 바꿔도 이미 만든 견적서 금액은 그대로).
-- 3) 견적서 양식: 기관 로고·브랜드 색·공급자 정보. 양식 제작 요청은 운영자가 받아 처리한다.
-- 모든 표는 서버(service role)만 읽고 쓴다. 기관 확인은 앱이 세션의 기관 id 로 한다.

do $$ begin
  if to_regclass('public.cro_catalog') is null or public.danchu_schema_version() < 34 then
    raise exception '0034_contract_gap_guard.sql 을 먼저 적용해 주세요';
  end if;
end $$;

-- ─────────────────────────────────────────────
-- 1) 카탈로그 조건별 표준가 · 시험별 추가 비용 단가
-- ─────────────────────────────────────────────
alter table public.cro_catalog add column if not exists std_price bigint;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'cro_catalog_std_price_check') then
    alter table public.cro_catalog add constraint cro_catalog_std_price_check check (std_price is null or std_price >= 0);
  end if;
end $$;
comment on column public.cro_catalog.std_price is '견적서 표준가 (0035). 이 조합의 표준 설계(군 구성·마릿수·회복·기본 포함 항목) 금액, 원, VAT 별도';

create table if not exists public.cro_quote_rates (
  org_id     uuid not null references public.cro_orgs(id) on delete cascade,
  item_key   text not null,
  rates      jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (org_id, item_key),
  check (jsonb_typeof(rates) = 'array')
);
comment on table public.cro_quote_rates is '시험(카탈로그 항목)별 추가 비용 단가 (0035). rates = [{id, kind: animal|recovery|group|qty|flat, label, unit, add, deduct, shown}]';
alter table public.cro_quote_rates enable row level security;

-- ─────────────────────────────────────────────
-- 2) 견적서
-- ─────────────────────────────────────────────
create table if not exists public.cro_quote_docs (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.cro_orgs(id) on delete cascade,
  doc_no      text not null check (char_length(doc_no) between 3 and 40),
  title       text not null default '' check (char_length(title) <= 200),
  client      text not null default '' check (char_length(client) <= 200),
  substance   text not null default '' check (char_length(substance) <= 200),
  issued_on   date not null default (now() at time zone 'Asia/Seoul')::date,
  valid_until date,
  invite_id   uuid references public.rfq_invites(id) on delete set null,
  rfq_no      text,
  status      text not null default 'draft' check (status in ('draft', 'sent')),
  data        jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  supply      bigint not null default 0 check (supply >= 0),
  memo        text not null default '' check (char_length(memo) <= 2000),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, doc_no)
);
create index if not exists cro_quote_docs_org_idx on public.cro_quote_docs (org_id, updated_at desc);
create index if not exists cro_quote_docs_invite_idx on public.cro_quote_docs (invite_id) where invite_id is not null;
comment on table public.cro_quote_docs is '기관 견적서 (0035). data = 시험 목록(군 구성·평가항목·단가 사본·일정)·보이는 항목·할인·거래 조건. supply 는 목록 표시용 공급가액';
comment on column public.cro_quote_docs.memo is '내부 메모. 의뢰자에게 보이지 않고 견적서·엑셀에 들어가지 않는다';
alter table public.cro_quote_docs enable row level security;

drop trigger if exists cro_quote_docs_touch on public.cro_quote_docs;
create trigger cro_quote_docs_touch before update on public.cro_quote_docs
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────
-- 3) 견적서 양식 · 양식 제작 요청
-- ─────────────────────────────────────────────
create table if not exists public.cro_quote_style (
  org_id      uuid primary key references public.cro_orgs(id) on delete cascade,
  brand_color text check (brand_color is null or brand_color ~ '^#[0-9a-fA-F]{6}$'),
  logo_data   text check (logo_data is null or (char_length(logo_data) <= 400000 and logo_data ~ '^data:image/(png|jpeg|webp);base64,')),
  logo_pos    text not null default 'left' check (logo_pos in ('left', 'right')),
  supplier    jsonb not null default '{}'::jsonb check (jsonb_typeof(supplier) = 'object'),
  terms       jsonb not null default '{}'::jsonb check (jsonb_typeof(terms) = 'object'),
  updated_at  timestamptz not null default now()
);
comment on table public.cro_quote_style is '기관 견적서 양식 (0035). supplier = {name, address, contact, person, email}, terms = 거래 조건 기본 문구 {pay, extra, note}';
alter table public.cro_quote_style enable row level security;

create table if not exists public.cro_quote_design_requests (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.cro_orgs(id) on delete cascade,
  status     text not null default 'received' check (status in ('received', 'making', 'review', 'applied', 'cancelled')),
  note       text not null default '' check (char_length(note) <= 2000),
  files      jsonb not null default '[]'::jsonb check (jsonb_typeof(files) = 'array'),
  reply      text not null default '' check (char_length(reply) <= 2000),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cro_quote_design_requests_org_idx on public.cro_quote_design_requests (org_id, created_at desc);
comment on table public.cro_quote_design_requests is '견적서 양식 제작 요청 (0035). 접수 received → 제작 중 making → 검토 review → 적용 applied. files = [{path, name, size}] (cro-files 버킷)';
alter table public.cro_quote_design_requests enable row level security;

drop trigger if exists cro_quote_design_requests_touch on public.cro_quote_design_requests;
create trigger cro_quote_design_requests_touch before update on public.cro_quote_design_requests
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────
-- 4) 판 번호
-- ─────────────────────────────────────────────
create or replace function public.danchu_schema_version()
returns int
language sql
immutable
as $$ select 35 $$;
comment on function public.danchu_schema_version() is
  '마지막으로 적용한 마이그레이션 번호 (0035). 앱(lib/schema-version.ts REQUIRED_SCHEMA_VERSION)과 npm run check:schema 가 확인한다. 다음 마이그레이션이 새 번호로 바꾼다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;
grant execute on function public.danchu_schema_version() to service_role;
