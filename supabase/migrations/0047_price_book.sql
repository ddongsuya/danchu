-- 단추(Danchu) 47차: 효력시험 기관 단가표 (2026-11-18, 효력시험 견적 툴 구현 계획 1단계)
-- 0046 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경
-- 1) 효력시험 금액을 "기관 단가표 단가 × 설계에서 나온 사용량 + 관리비·이익 %"로 계산한다.
--    단가표는 기관 전체에 한 벌. 항목마다 분류(동물·사육·모델 유발·투여·관찰·측정·분자 분석·조직병리·영상·행동·보고서·기타),
--    분류별 칸(attrs, 예: 종·계통·성별·주령), 단위, 단가.
-- 2) 관리비·이익 %는 기관만 본다. 의뢰자 화면·견적서·엑셀·회신에는 이 값이 더해진 금액만 나간다.
-- 3) 단가를 바꾸면 한 줄씩 기록한다 (단가표 화면의 "단가 바꾼 기록").
-- 4) 모델 표준(cro_catalog.extra.kd.pd)과 견적서 사본(cro_quote_docs.data)은 jsonb 라 표를 바꾸지 않는다.
-- 모든 표는 서버(service role)만 읽고 쓴다. 기관 확인은 앱이 세션의 기관 id 로 한다.

do $$ begin
  if public.danchu_schema_version() < 46 then
    raise exception '0046_agent_link.sql 을 먼저 적용해 주세요';
  end if;
end $$;

-- ─────────────────────────────────────────────
-- 1) 단가 항목
-- ─────────────────────────────────────────────
create table if not exists public.cro_price_items (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references public.cro_orgs(id) on delete cascade,
  category   text not null check (category in ('animal', 'housing', 'model', 'dosing', 'observe', 'molecular', 'pathology', 'imaging', 'report')),
  name       text not null check (char_length(name) between 1 and 120),
  attrs      jsonb not null default '{}'::jsonb check (jsonb_typeof(attrs) = 'object'),
  unit       text not null check (unit in ('head', 'head_day', 'cage_day', 'head_time', 'head_hour', 'sample_item', 'sample_panel', 'slide', 'lot', 'each')),
  price      bigint not null check (price >= 0 and price <= 100000000000),
  memo       text not null default '' check (char_length(memo) <= 200),
  sort       int not null default 0,
  archived   boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cro_price_items_org_idx on public.cro_price_items (org_id, category, sort) where not archived;
comment on table public.cro_price_items is '기관 단가표 항목 (0047). 효력시험 금액 = 단가 × 설계 사용량. archived 는 목록에서 숨기되 옛 견적서·모델 표준 참조는 남긴다';
comment on column public.cro_price_items.attrs is '분류별 칸. animal{species,strain,sex,weeks} dosing{route,size} molecular{method,matrix} 등 (lib/price-book.ts)';
comment on column public.cro_price_items.unit is 'head 마리당 · head_day 마리·일 · cage_day 케이지·일 · head_time 마리·회 · head_hour 마리·시간 · sample_item 검체·항목 · sample_panel 검체·패널 · slide 장 · lot 1식 · each 개';
alter table public.cro_price_items enable row level security;
revoke all on public.cro_price_items from anon, authenticated;

drop trigger if exists cro_price_items_touch on public.cro_price_items;
create trigger cro_price_items_touch before update on public.cro_price_items
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────
-- 2) 단가표 설정 (관리비·이익 %)
-- ─────────────────────────────────────────────
create table if not exists public.cro_price_settings (
  org_id     uuid primary key references public.cro_orgs(id) on delete cascade,
  margin_pct numeric(5,2) not null default 0 check (margin_pct >= 0 and margin_pct <= 300),
  updated_at timestamptz not null default now()
);
comment on table public.cro_price_settings is '기관 단가표 설정 (0047). margin_pct = 관리비·이익 %, 단가 합계에 더한다. 의뢰자에게 보이지 않는다';
alter table public.cro_price_settings enable row level security;
revoke all on public.cro_price_settings from anon, authenticated;

-- ─────────────────────────────────────────────
-- 3) 단가 바꾼 기록
-- ─────────────────────────────────────────────
create table if not exists public.cro_price_log (
  id         bigserial primary key,
  org_id     uuid not null references public.cro_orgs(id) on delete cascade,
  item_id    uuid references public.cro_price_items(id) on delete set null,
  item_name  text not null default '' check (char_length(item_name) <= 120),
  before     bigint,
  after      bigint,
  via        text not null default 'web' check (via in ('web', 'agent')),
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);
create index if not exists cro_price_log_org_idx on public.cro_price_log (org_id, changed_at desc);
comment on table public.cro_price_log is '단가 바꾼 기록 (0047). 추가는 before null, 숨김은 after null. via=agent 는 에이전트 가져오기를 기관 담당자가 승인한 것';
alter table public.cro_price_log enable row level security;
revoke all on public.cro_price_log from anon, authenticated;

-- ─────────────────────────────────────────────
-- 4) 스키마 판
-- ─────────────────────────────────────────────
create or replace function public.danchu_schema_version()
returns int
language sql
immutable
as $$ select 47 $$;
comment on function public.danchu_schema_version() is
  '마지막으로 적용한 마이그레이션 번호 (0047). 앱(lib/schema-version.ts REQUIRED_SCHEMA_VERSION)과 npm run check:schema 가 확인한다. 다음 마이그레이션이 새 번호로 바꾼다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;
grant execute on function public.danchu_schema_version() to service_role;
