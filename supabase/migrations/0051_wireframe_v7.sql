-- 단추(Danchu) 51차: 시안 v7 새 기능에 필요한 칸 (2026-11-26)
-- 0050 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 1) cro_price_settings.apply_tox: 기관 단가표를 독성시험 동물 단가에도 쓸지 (기관 설정, 기본 끔).
--    켜면 시험 목록의 독성 가감 단가(본시험 동물·회복군)가 빈 칸일 때 단가표의 동물 단가로 채운다.
-- 2) cro_crm_deals.won_reason · won_note: 수주(선정)한 이유. 실패 사유(lost_reason)와 짝. 분석 화면에서 분포를 본다.
-- 3) cro_crm_activities.files: 활동(미팅·통화·메일·메모) 첨부 파일 목록 [{path, name, size, type}] 최대 10개.
--    회의 녹음·회의록·자료를 붙인다. 파일은 비공개 버킷 crm-files 의 org_id/activity_id/ 아래. 서버(service role)만 읽고 쓴다.
--
-- 되돌리기(앞으로 가는 새 마이그레이션으로): 위 세 칸을 drop column, 버킷 crm-files 를 비우고 지운 뒤 스키마 판을 50 으로.

do $$ begin
  if public.danchu_schema_version() < 50 then
    raise exception '0050_agent_action_log.sql 을 먼저 적용해 주세요';
  end if;
end $$;

alter table public.cro_price_settings
  add column if not exists apply_tox boolean not null default false;
comment on column public.cro_price_settings.apply_tox is
  '단가표를 독성시험 동물 단가에도 쓴다 (0051). 시험 목록 독성 가감 단가가 빈 칸일 때만 채운다';

alter table public.cro_crm_deals
  add column if not exists won_reason text not null default '' check (char_length(won_reason) <= 40),
  add column if not exists won_note   text not null default '' check (char_length(won_note) <= 2000);
comment on column public.cro_crm_deals.won_reason is '수주(선정) 이유 (0051). lib/crm-deals WON_REASONS 중 하나 또는 빈 값';
comment on column public.cro_crm_deals.won_note is '수주 이유 자세히 (0051)';

alter table public.cro_crm_activities
  add column if not exists files jsonb not null default '[]'::jsonb
    check (jsonb_typeof(files) = 'array' and jsonb_array_length(files) <= 10);
comment on column public.cro_crm_activities.files is
  '활동 첨부 [{path, name, size, type}] 최대 10개 (0051). 파일은 비공개 버킷 crm-files';

insert into storage.buckets (id, name, public)
values ('crm-files', 'crm-files', false)
on conflict (id) do nothing;

create or replace function public.danchu_schema_version()
returns int
language sql
immutable
as $$ select 51 $$;
comment on function public.danchu_schema_version() is
  '마지막으로 적용한 마이그레이션 번호 (0051). 앱(lib/schema-version.ts REQUIRED_SCHEMA_VERSION)과 npm run check:schema 가 확인한다. 다음 마이그레이션이 새 번호로 바꾼다';
revoke execute on function public.danchu_schema_version() from public, anon, authenticated;
grant execute on function public.danchu_schema_version() to service_role;
