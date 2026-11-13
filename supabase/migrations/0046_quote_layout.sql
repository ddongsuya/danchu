-- 단추(Danchu) 46차: 견적서 판 (2026-11-13)
-- 0045 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- cro_quote_style.layout  기관 기본 판. basic(단추 기본)·summary(요약 줄)·sentence(한 줄 문장)·steps(진행 안내)·side(옆 띠)·sign(확인란)
-- 견적서마다 다른 판은 cro_quote_docs.data(jsonb) 의 layout 에 둔다 (없으면 기관 기본 판). 표 변경 없음.
-- 판 고르기는 Pro 요금제(branding) 기능이고, 시범 운영 중에는 모두 열린다 (lib/plans.ts).
-- 더하기만 하는 변경이라 옛 코드는 그대로 돈다.

do $$ begin
  if public.danchu_schema_version() < 45 then
    raise exception '0045_rfq_questions.sql 을 먼저 적용해 주세요';
  end if;
end $$;

alter table public.cro_quote_style add column if not exists layout text not null default 'basic';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'cro_quote_style_layout_check') then
    alter table public.cro_quote_style add constraint cro_quote_style_layout_check
      check (layout in ('basic', 'summary', 'sentence', 'steps', 'side', 'sign'));
  end if;
end $$;
comment on column public.cro_quote_style.layout is '기관 기본 견적서 판 (0046). lib/quote-doc.ts LAYOUTS';

create or replace function public.danchu_schema_version()
returns int
language sql
immutable
as $$ select 46 $$;
comment on function public.danchu_schema_version() is
  '마지막으로 적용한 마이그레이션 번호 (0046). 앱(lib/schema-version.ts REQUIRED_SCHEMA_VERSION)과 npm run check:schema 가 확인한다. 다음 마이그레이션이 새 번호로 바꾼다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;
grant execute on function public.danchu_schema_version() to service_role;
