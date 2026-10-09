-- 단추(Danchu) 15차: 기관 중복 판정, 배포 메일 발송 추적
-- 0014 실행 후 적용. 두 번 실행해도 안전합니다. (적용 전 lower(trim(name))·사업자번호 중복이 없어야 한다)
--
-- 배경
-- 1) 기관 중복 판정이 이름 정확 일치뿐이라 "○○연구소" / " ○○연구소 " / 사업자번호 같은 기관이 둘 생길 수 있었다.
--    사업자번호(숫자만)와 이름(소문자·양끝 공백 제거)에 unique 를 건다. 동시 가입 레이스도 DB 가 막는다.
-- 2) 배포 메일이 실패하면 초대 행만 남고 아무도 몰랐다. mailed_at 을 남기고 cron 이 미발송분을 재발송한다.

alter table public.cro_orgs add column if not exists business_no_norm text
  generated always as (nullif(regexp_replace(coalesce(business_no, ''), '[^0-9]', '', 'g'), '')) stored;
create unique index if not exists cro_orgs_business_no_key on public.cro_orgs (business_no_norm) where business_no_norm is not null;
create unique index if not exists cro_orgs_name_key on public.cro_orgs (lower(trim(name)));

alter table public.rfq_invites add column if not exists mailed_at timestamptz;
create index if not exists rfq_invites_unmailed_idx on public.rfq_invites (sent_at) where mailed_at is null and status in ('sent', 'draft');
