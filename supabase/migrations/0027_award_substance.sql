-- 단추(Danchu) 27차: 선정 뒤 시험물질 필요량 (2026-10-27 대표 결정)
-- 0026 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경
-- 시험물질 필요량은 기관이 시험물질 정보(물질 특성, 조제 방법 등)를 받아야 정할 수 있다. 회신 단계(선정 전)에는 정확히 답하기 어렵다.
-- 그래서 선정된 기관이 수주 화면에서 필요량과 보낼 시점을 적고, 의뢰자가 요청 화면에서 본다.
-- 회신(cro_quotes.substance_qty)은 지우지 않는다. 예전 회신에 적힌 값은 그대로 남고, 새 회신 양식은 이 칸을 묻지 않는다.

-- ─────────────────────────────────────────────
-- 0) 선행 마이그레이션 확인 (빠졌으면 여기서 멈춘다)
-- ─────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.danchu_schema_version()') is null
     or to_regprocedure('public.rfq_requests_compare_lock()') is null
     or public.danchu_schema_version() < 26 then
    raise exception '0027 을 적용하기 전에 0019 부터 0026 까지 순서대로 적용해 주세요.';
  end if;
end $$;

-- ─────────────────────────────────────────────
-- 1) 선정 기록에 시험물질 필요량
-- ─────────────────────────────────────────────
alter table public.rfq_awards
  add column if not exists substance_qty text,
  add column if not exists substance_when text,
  add column if not exists substance_note text,
  add column if not exists substance_updated_at timestamptz;

comment on column public.rfq_awards.substance_qty is '선정된 기관이 적은 시험물질 필요량 (0027). 예: 원료 40 g + 예비 10 g';
comment on column public.rfq_awards.substance_when is '시험물질을 보낼 시점 (0027). 예: 착수 2주 전까지';
comment on column public.rfq_awards.substance_note is '시험물질에 대한 기관 메모 (0027). 예: 보관 조건, 함께 보낼 자료';
comment on column public.rfq_awards.substance_updated_at is '필요량을 마지막으로 적은 시각 (0027)';

alter table public.rfq_awards drop constraint if exists rfq_awards_substance_len;
alter table public.rfq_awards add constraint rfq_awards_substance_len check (
  coalesce(length(substance_qty), 0) <= 120 and coalesce(length(substance_when), 0) <= 120 and coalesce(length(substance_note), 0) <= 300
);

-- ─────────────────────────────────────────────
-- 2) 스키마 판
-- ─────────────────────────────────────────────
create or replace function public.danchu_schema_version()
returns int
language sql
immutable
as $$ select 27 $$;
comment on function public.danchu_schema_version() is
  '마지막으로 적용한 마이그레이션 번호 (0027). 앱(lib/schema-version.ts REQUIRED_SCHEMA_VERSION)과 npm run check:schema 가 확인한다. 다음 마이그레이션이 새 번호로 바꾼다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;
grant execute on function public.danchu_schema_version() to service_role;
