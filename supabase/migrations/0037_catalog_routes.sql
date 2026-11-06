-- 단추(Danchu) 37차: 시험 목록에서 시험 하나에 가능한 투여 경로를 여러 개 (2026-11-06)
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

create or replace function public.danchu_schema_version()
returns int
language sql
immutable
as $$ select 37 $$;
comment on function public.danchu_schema_version() is
  '마지막으로 적용한 마이그레이션 번호 (0037). 앱(lib/schema-version.ts REQUIRED_SCHEMA_VERSION)과 npm run check:schema 가 확인한다. 다음 마이그레이션이 새 번호로 바꾼다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;
grant execute on function public.danchu_schema_version() to service_role;
