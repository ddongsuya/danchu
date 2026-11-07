-- 단추(Danchu) 37차: 시험 목록에서 시험 하나에 가능한 투여 경로 여러 개 · 동물종·경로별 표준가 (2026-11-06)
-- 0036_quote_docs.sql 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경
-- 같은 시험인데 동물종·투여 경로마다 줄이 늘어나 불편하다는 의견. 동물종(species)은 이미 여러 개를 담는다.
-- 투여 경로도 routes 에 여러 개를 담고, 첫 번째 값을 표준가 기준(대표) 경로로 route 에 함께 둔다 (이전 코드 호환).

do $$ begin
  if to_regclass('public.cro_catalog') is null or public.danchu_schema_version() < 36 then
    raise exception '0036_quote_docs.sql 을 먼저 적용해 주세요';
  end if;
end $$;

alter table public.cro_catalog add column if not exists routes text[] not null default '{}';
update public.cro_catalog set routes = array[route] where route is not null and route <> '' and routes = '{}';
comment on column public.cro_catalog.routes is '가능한 투여 경로. 첫 번째가 표준가 기준 경로이며 route 와 같다';

-- 기준이 아닌 동물종·경로일 때 표준가. [{"species":"비글","price":180000000}, {"route":"정맥(IV)","price":70000000}]
-- 동물종 금액은 기준 경로일 때, 경로 금액은 기준 동물종일 때 금액이다
alter table public.cro_catalog add column if not exists cond_prices jsonb not null default '[]'::jsonb;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'cro_catalog_cond_prices_check') then
    alter table public.cro_catalog add constraint cro_catalog_cond_prices_check check (jsonb_typeof(cond_prices) = 'array');
  end if;
end $$;
comment on column public.cro_catalog.cond_prices is '기준이 아닌 동물종·투여 경로일 때 표준가 목록 (동물종은 기준 경로, 경로는 기준 동물종 기준)';

create or replace function public.danchu_schema_version()
returns int
language sql
immutable
as $$ select 37 $$;
comment on function public.danchu_schema_version() is
  '마지막으로 적용한 마이그레이션 번호 (0037). 앱(lib/schema-version.ts REQUIRED_SCHEMA_VERSION)과 npm run check:schema 가 확인한다. 다음 마이그레이션이 새 번호로 바꾼다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;
grant execute on function public.danchu_schema_version() to service_role;
