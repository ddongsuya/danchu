-- 단추(Danchu) 40차: 담당자가 모두 떠난 기관의 CRM 자료를 30일 뒤 지우기 위한 시각 (2026-11-10)
-- 0039 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경
-- 개인정보처리방침과 기관 이용 조건(고객 관리 기능과 개인정보)은 "기관 등록을 해지하면 30일을 둔 뒤 지운다"고 적는다.
-- 지금까지는 운영자가 손으로 지워야 했다. 기관의 담당자 계정이 모두 탈퇴한 시각을 적어 두고,
-- 예약 작업(lib/crm-purge.ts)이 30일 뒤 그 기관의 CRM 자료(고객사·담당자·안건·일정·기록·할 일·가져오기 기록)를 지운다.
-- 그 사이에 담당자가 다시 들어오면 시각을 비운다 (지우지 않는다).

do $$ begin
  if to_regprocedure('public.billing_success_fee(bigint)') is null or public.danchu_schema_version() < 39 then
    raise exception '0039_marginal_success_fee.sql 을 먼저 적용해 주세요';
  end if;
end $$;

alter table public.cro_orgs add column if not exists members_left_at timestamptz;
comment on column public.cro_orgs.members_left_at is '담당자 계정이 하나도 남지 않은 것을 예약 작업이 처음 본 시각 (0040). 30일 뒤 CRM 자료를 지운다. 담당자가 다시 생기면 비운다';

-- 첨부 업로드 확인 시각 (0007). 2026-11-10 운영 DB 타입을 받아 보니 이 열이 운영에 없었다
-- (0007 의 다른 부분은 적용돼 있다). 열이 없으면 첨부 확인(/api/rfq/[no]/files/confirm)과 내려받기 판정이 실패한다.
-- 이미 있으면 아무 일도 하지 않는다. 새로 넣는 경우 기존 첨부는 올린 것으로 본다 (0007 과 같은 처리).
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'rfq_files' and column_name = 'uploaded_at') then
    alter table public.rfq_files add column uploaded_at timestamptz;
    update public.rfq_files set uploaded_at = created_at where uploaded_at is null;
  end if;
end $$;

create or replace function public.danchu_schema_version()
returns int
language sql
immutable
as $$ select 40 $$;
comment on function public.danchu_schema_version() is
  '마지막으로 적용한 마이그레이션 번호 (0040). 앱(lib/schema-version.ts REQUIRED_SCHEMA_VERSION)과 npm run check:schema 가 확인한다. 다음 마이그레이션이 새 번호로 바꾼다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;
grant execute on function public.danchu_schema_version() to service_role;
