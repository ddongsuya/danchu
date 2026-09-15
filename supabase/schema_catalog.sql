-- 단추(Danchu) 역량 카탈로그·자동화 스키마 (4차)
-- schema_accounts.sql 실행 후 Supabase SQL Editor에 그대로 붙여 넣어 실행하세요.
--
-- 기관이 시험 항목별 표준 설계·리드타임·참고 단가를 자기 계정에 등록한다.
-- 회신 초안은 이 표에서 채워지고, 제출값은 last_* 로 되돌아와 다음 초안의 기본값이 된다.

create table if not exists public.cro_catalog (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references public.cro_orgs(id) on delete cascade,
  item_key        text not null,                    -- "대분류::항목명" (lib/catalog.ts 와 동일)
  category        text not null,
  item            text not null,

  available       boolean not null default true,    -- 끄면 배포 제외, 초안에서 "불가"
  glp             text not null default 'both',     -- GLP | Non-GLP | both

  -- 표준 설계
  species         text[] not null default '{}',     -- 동물종·계통 (예: SD 랫드)
  groups_ctrl     smallint,                         -- 대조군 수
  groups_test     smallint,                         -- 시험군 수
  per_sex         smallint,                         -- 군당 마릿수 (암/수 각)
  recovery_weeks  smallint,                         -- 회복 기간(주). 대조군·최고용량군에 추가 개체
  recovery_per_sex smallint,                        -- 회복 추가 마릿수 (암/수 각)
  route           text,                             -- 투여 경로
  dosing          text,                             -- 투여 기간·횟수 (예: 28일 · 1일 1회)
  weeks           smallint,                         -- 리드타임: 동물 입고일 ~ 최종보고서(안) 발행일

  includes        text[] not null default '{}',     -- 기본 포함 (임상병리 / 조직병리(검경 포함) / TK 분석 / …)
  options         jsonb not null default '[]',      -- 별도 옵션 [{name, amount}]
  unit            text not null default 'total',    -- total | per_sample (검체 분석은 검체당 원)
  price_min       bigint,                           -- 참고 단가 하한 (선택)
  price_max       bigint,
  extra           jsonb not null default '{}',      -- 대분류별 추가 칸 (균주·S9·분석법 수준 등)
  note            text,

  -- 학습: 최근 제출값
  last_amount     bigint,
  last_weeks      smallint,
  last_quoted_at  timestamptz,
  source          text not null default 'empty',    -- manual | learned | empty

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (org_id, item_key)
);
create index if not exists cro_catalog_org_idx on public.cro_catalog (org_id);

drop trigger if exists cro_catalog_touch on public.cro_catalog;
create trigger cro_catalog_touch before update on public.cro_catalog
  for each row execute function public.touch_updated_at();

-- 기관 설정: 기한까지 손대지 않은 초안을 예비 견적으로 자동 제출할지 (기본 꺼짐)
alter table public.cro_orgs
  add column if not exists auto_reply boolean not null default false;

-- 회신 항목: 설계 요약·출처·검체당 단가
alter table public.cro_quote_items
  add column if not exists design       jsonb not null default '{}',   -- {species, groups_ctrl, groups_test, per_sex, recovery_weeks, recovery_per_sex, route, dosing, extra}
  add column if not exists source       text,                          -- catalog | learned | manual
  add column if not exists unit         text not null default 'total', -- total | per_sample
  add column if not exists unit_price   bigint,                        -- 검체당 원
  add column if not exists sample_count int;

-- 회신 헤더: 자동(예비) 제출 여부, 시험물질·표준품 제공 원칙
alter table public.cro_quotes
  add column if not exists auto         boolean not null default false,
  add column if not exists material_by  text not null default '의뢰자 제공';

-- 알림 발송 기록 (리마인더 중복 방지)
create table if not exists public.invite_reminders (
  invite_id  uuid not null references public.rfq_invites(id) on delete cascade,
  kind       text not null,             -- d2 | d0
  sent_at    timestamptz not null default now(),
  primary key (invite_id, kind)
);

alter table public.cro_catalog     enable row level security;
alter table public.invite_reminders enable row level security;
