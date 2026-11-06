-- 단추(Danchu) 35차: 사전예약 이름·휴대폰·설문·문자 (2026-11-06)
-- 0034 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경 (2026-11-05~06 사용자 결정)
--   사전예약에 이름·휴대폰 번호(필수)·이메일과 설문을 받는다. 의뢰자 설문으로 가입 규모(예정 시기·연간 시험 수)를 세어 기관 설득에 쓴다.
--   예약하면 완료 문자, 2027-06-01 시범 운영 시작일에 시작 문자를 보낸다 (솔라피, lib/sms.ts). 보낸 시각을 행에 남겨 두 번 보내지 않는다.
--   광고성 정보 수신 동의는 선택이고 따로 남긴다 (정보통신망법 제50조). 예약 안내 문자 두 통은 동의와 관계없이 보낸다.
--   기관 예약은 이제 "참여 생각"을 묻지 않는다 → 0030 의 기관 제약(org·intent 필수)을 org 필수로 바꾼다.
--   보존: 0030 과 같다. 시범 운영 시작 6개월 뒤(2027-12-01) 정리 작업이 모두 지운다 (개인정보처리방침 3항).

alter table public.early_signups add column if not exists name text;
alter table public.early_signups add column if not exists phone text;
alter table public.early_signups add column if not exists yearly text;
alter table public.early_signups add column if not exists quote_count text;
alter table public.early_signups add column if not exists monthly text;
alter table public.early_signups add column if not exists ad_agreed_at timestamptz;
alter table public.early_signups add column if not exists done_sms_at timestamptz;
alter table public.early_signups add column if not exists open_sms_at timestamptz;

comment on column public.early_signups.phone is '휴대전화 숫자만 (0035). 완료·시범 운영 시작 문자';
comment on column public.early_signups.ad_agreed_at is '[선택] 광고성 정보 수신 동의 시각 (0035). null 이면 동의 안 함';
comment on column public.early_signups.done_sms_at is '예약 완료 문자를 보낸 시각 (0035)';
comment on column public.early_signups.open_sms_at is '시범 운영 시작 문자를 보낸 시각 (0035). 예약 작업이 null 인 행만 보낸다';

do $$ begin
  if exists (select 1 from pg_constraint where conname = 'early_signups_cro_chk') then
    alter table public.early_signups drop constraint early_signups_cro_chk;
  end if;
  alter table public.early_signups add constraint early_signups_cro_chk check (role <> 'cro' or org is not null);
  if not exists (select 1 from pg_constraint where conname = 'early_signups_phone_chk') then
    -- 0035 전 행은 phone 이 없다
    alter table public.early_signups add constraint early_signups_phone_chk check (phone is null or phone ~ '^01[016789][0-9]{7,8}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'early_signups_name_chk') then
    alter table public.early_signups add constraint early_signups_name_chk check (coalesce(length(name), 0) <= 40);
  end if;
end $$;

create index if not exists early_signups_open_sms_idx on public.early_signups (created_at) where open_sms_at is null and phone is not null;

comment on table public.early_signups is
  '사전예약 (0030, 0035). /early 양식. 같은 갈래·이메일은 한 행. 시범 운영 시작 6개월 뒤(2027-12-01) 정리 작업이 지운다. 서비스 키로만 읽고 쓴다';

-- ─────────────────────────────────────────────
-- 스키마 버전
-- ─────────────────────────────────────────────
create or replace function public.danchu_schema_version() returns int language sql immutable as $$ select 35 $$;
comment on function public.danchu_schema_version() is '마지막으로 적용한 마이그레이션 번호 (0035). lib/schema-version.ts REQUIRED_SCHEMA_VERSION 과 맞춘다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;
grant execute on function public.danchu_schema_version() to service_role;
