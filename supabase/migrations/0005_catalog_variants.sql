-- 단추(Danchu) 카탈로그 5차: 항목당 여러 "수행 조합"(동물종 × 투여경로 × 시험법) + 패키지 프리셋
-- schema_catalog.sql 실행 후 Supabase SQL Editor에 그대로 붙여 넣어 실행하세요. 기존 행은 그대로 첫 조합이 됩니다.

-- 1) 항목당 한 행 제약을 풀고 조합 축(시험법)·정렬 컬럼 추가
alter table public.cro_catalog drop constraint if exists cro_catalog_org_id_item_key_key;
alter table public.cro_catalog
  add column if not exists method text,                        -- 시험법·가이드라인 (예: OECD TG 423 급성독성등급법)
  add column if not exists sort   smallint not null default 0;  -- 항목 안 조합 순서
create index if not exists cro_catalog_org_item_idx on public.cro_catalog (org_id, item_key);

-- 2) 기관이 제공하는 패키지 (프리셋 키 기준) · 선택적으로 패키지 참고 총액
create table if not exists public.cro_org_presets (
  org_id        uuid not null references public.cro_orgs(id) on delete cascade,
  preset_key    text not null,
  offered       boolean not null default true,
  package_price bigint,                                        -- 패키지 참고 총액 (선택, 비공개)
  note          text,
  updated_at    timestamptz not null default now(),
  primary key (org_id, preset_key)
);
alter table public.cro_org_presets enable row level security;
