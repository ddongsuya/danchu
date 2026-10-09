-- 단추(Danchu) 14차: 청구 월 마감, 기관 성사수수료율
-- 0013 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경
-- 1) 전달 명세에 "확정" 개념이 없어 과거 달의 청구 제외를 누구나 계속 바꿀 수 있었다. 월을 마감하면 그 달 전달의
--    청구 토글이 막힌다. 다시 열려면 운영자가 마감을 해제한다(기록 남음).
-- 2) 성사수수료는 선정 견적 금액(rfq_awards.fee_basis_amount)에 기관별 요율을 곱한다. 요율 자리가 없었다.

create table if not exists public.billing_periods (
  month      date primary key,              -- 그 달 1일
  closed_at  timestamptz not null default now(),
  closed_by  uuid references auth.users(id) on delete set null,
  note       text
);
alter table public.billing_periods enable row level security;

-- 성사수수료율 (예: 0.05 = 5%). null 이면 미정. 구간 요율은 운영자가 계약서 기준으로 계산해 넣는다
alter table public.cro_orgs add column if not exists fee_rate numeric(5,4);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'cro_orgs_fee_rate_chk') then
    alter table public.cro_orgs add constraint cro_orgs_fee_rate_chk check (fee_rate is null or (fee_rate >= 0 and fee_rate <= 1));
  end if;
end $$;

-- 요청 목록 검색용 (번호·회사·물질은 ilike 로 찾는다)
create index if not exists rfq_requests_company_idx on public.rfq_requests (lower(company));
create index if not exists rfq_requests_substance_idx on public.rfq_requests (lower(substance));
