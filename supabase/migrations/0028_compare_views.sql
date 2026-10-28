-- 단추(Danchu) 28차: 의뢰자가 비교표를 연 기록 (2026-10-28)
-- 0027 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경
--   rfq_requests.compared_at 은 이름과 달리 "회신 마감(비교표가 열린) 시각"이다 (0025).
--   의뢰자가 실제로 비교표를 열어 봤는지는 지금까지 기록되지 않아, "비교표가 결정에 쓰이는가"를 잴 수 없었다.
--   여기서는 의뢰자 본인이 열린 비교표 화면을 연 처음 시각·마지막 시각·횟수만 남긴다.
--   운영자가 연 것은 세지 않는다 (app/app/r/[no]/compare/page.tsx 가 부르지 않음). 기관에는 보이지 않는다.
--   개인정보를 새로 모으지 않는다 (요청 단위 숫자와 시각뿐).

-- ─────────────────────────────────────────────
-- 1) 열
-- ─────────────────────────────────────────────
alter table public.rfq_requests
  add column if not exists compare_first_viewed_at timestamptz,
  add column if not exists compare_last_viewed_at timestamptz,
  add column if not exists compare_view_count int not null default 0;

comment on column public.rfq_requests.compare_first_viewed_at is '의뢰자가 열린 비교표를 처음 연 시각 (0028). 한 번 채우면 바꾸지 않는다';
comment on column public.rfq_requests.compare_last_viewed_at is '의뢰자가 열린 비교표를 마지막으로 연 시각 (0028)';
comment on column public.rfq_requests.compare_view_count is '의뢰자가 열린 비교표를 연 횟수 (0028). 새로 고침도 1회로 센다';

-- ─────────────────────────────────────────────
-- 2) 기록 함수: 비교표가 열렸거나 선정한 요청에만 남긴다 (lib/reply-window.ts comparisonOpened 와 같은 조건)
-- ─────────────────────────────────────────────
create or replace function public.record_compare_view(p_rfq uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.rfq_requests
     set compare_first_viewed_at = coalesce(compare_first_viewed_at, now()),
         compare_last_viewed_at  = now(),
         compare_view_count      = compare_view_count + 1
   where id = p_rfq
     and (compared_at is not null or selected_quote_id is not null);
$$;
comment on function public.record_compare_view(uuid) is
  '의뢰자가 열린 비교표를 연 기록 (0028). 비교표가 열리지 않은 요청에는 아무것도 하지 않는다. 서버(service role)만 부른다';
revoke execute on function public.record_compare_view(uuid) from public, anon, authenticated;
grant execute on function public.record_compare_view(uuid) to service_role;

-- ─────────────────────────────────────────────
-- 3) 스키마 판
-- ─────────────────────────────────────────────
create or replace function public.danchu_schema_version()
returns int
language sql
immutable
as $$ select 28 $$;
comment on function public.danchu_schema_version() is
  '마지막으로 적용한 마이그레이션 번호 (0028). 앱(lib/schema-version.ts REQUIRED_SCHEMA_VERSION)과 npm run check:schema 가 확인한다. 다음 마이그레이션이 새 번호로 바꾼다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;
grant execute on function public.danchu_schema_version() to service_role;
