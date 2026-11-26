-- 단추(Danchu) 51차: 견적서 PDF 없이도 선정 (2026-11-27, 운영 버그 수정)
-- 0050 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 0008 의 선정 트리거(check_award_quote)는 견적서 PDF(pdf_path)를 필수로 봤다.
-- 2026-11-18 사용자 결정으로 견적서 PDF는 선택 첨부가 됐고(lib/quote-policy.ts quoteSelectable, 웹·에이전트 같은 규칙),
-- 앱은 PDF 없는 정식 견적을 선정 가능으로 보여 주지만 DB 가 거절해 "선택을 저장하지 못했어요"(500)가 났다.
-- 선정 조건을 앱과 같게 맞춘다: 예비 견적(auto)이 아니고, 착수일이 있고, 유효기간이 지나지 않았을 것.
--
-- 되돌리기(앞으로 가는 새 마이그레이션으로): 0008 의 check_award_quote 본문(pdf_path is null 검사 포함)을 다시 만들고 스키마 판을 50 으로.

do $$ begin
  if public.danchu_schema_version() < 50 then
    raise exception '0050_agent_action_log.sql 을 먼저 적용해 주세요';
  end if;
end $$;

create or replace function public.check_award_quote() returns trigger
language plpgsql security definer set search_path = public as $$
declare q public.cro_quotes%rowtype;
begin
  select * into q from public.cro_quotes where id = new.quote_id;
  -- 견적서 PDF는 선택 첨부라 보지 않는다 (lib/quote-policy.ts quoteSelectable 과 같은 조건)
  if not found or q.auto or q.start_date is null or
     (q.valid_until is not null and q.valid_until < (now() at time zone 'Asia/Seoul')::date) then
    raise exception '정식 견적서와 유효기간을 확인한 뒤 기관을 선택해 주세요.';
  end if;
  return new;
end;
$$;
drop trigger if exists award_quote_ready on public.rfq_awards;
create trigger award_quote_ready before insert on public.rfq_awards
for each row execute function public.check_award_quote();
revoke execute on function public.check_award_quote() from public, anon, authenticated;

create or replace function public.danchu_schema_version()
returns int
language sql
immutable
as $$ select 51 $$;
comment on function public.danchu_schema_version() is
  '마지막으로 적용한 마이그레이션 번호 (0051). 앱(lib/schema-version.ts REQUIRED_SCHEMA_VERSION)과 npm run check:schema 가 확인한다. 다음 마이그레이션이 새 번호로 바꾼다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;
grant execute on function public.danchu_schema_version() to service_role;
