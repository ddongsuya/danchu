-- 단추(Danchu) 13차: 기관 내 역할, 토큰 제출자 기록, 운영 감사 로그
-- 0012 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경
-- 1) 기관 안에 역할이 없어 모든 담당자가 기관 정보·대표 이메일·수행 분야를 바꿀 수 있었고 담당자 제거 수단이 없었다.
--    owner(대표 담당자)만 기관 정보 수정·담당자 승인·내보내기를 한다. 기관을 처음 만든 계정이 owner 다.
-- 2) 토큰 링크 제출은 행위자가 null 로 남아 "누가 이 금액을 제출했는지" 분쟁 시 증명이 안 됐다. IP·User-Agent 를 남긴다.
-- 3) 기관 승인·반려·중지, 역할 변경, 계정 삭제, 청구 제외, 기한 변경이 어디에도 기록되지 않았다.

-- ─────────────────────────────────────────────
-- 1) 기관 내 역할
-- ─────────────────────────────────────────────
alter table public.profiles add column if not exists org_role text not null default 'member';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_org_role_chk') then
    alter table public.profiles add constraint profiles_org_role_chk check (org_role in ('owner', 'member'));
  end if;
end $$;
-- 기관마다 가장 먼저 연결된 담당자를 owner 로 (이미 owner 가 있으면 건드리지 않는다)
update public.profiles p set org_role = 'owner'
from (
  select distinct on (cro_org_id) id, cro_org_id from public.profiles
  where cro_org_id is not null order by cro_org_id, created_at
) f
where p.id = f.id
  and not exists (select 1 from public.profiles o where o.cro_org_id = f.cro_org_id and o.org_role = 'owner');

-- 담당자를 내보낼 때 그 기관의 열린 회신 링크를 새로 발급한다 (퇴사자가 받은 메일의 링크를 무효화)
create or replace function public.rotate_org_invite_tokens(p_org uuid)
returns int
language plpgsql
security definer set search_path = public
as $$
declare n int;
begin
  update public.rfq_invites set token = encode(gen_random_bytes(18), 'hex')
   where cro_org_id = p_org and status in ('sent', 'draft');
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.rotate_org_invite_tokens(uuid) from public, anon, authenticated;

-- ─────────────────────────────────────────────
-- 2) 토큰 제출자 기록
-- ─────────────────────────────────────────────
alter table public.cro_quotes add column if not exists submitted_ip inet;
alter table public.cro_quotes add column if not exists submitted_ua text;

-- ─────────────────────────────────────────────
-- 3) 운영 감사 로그 (service role 만 쓴다)
-- ─────────────────────────────────────────────
create table if not exists public.admin_audit (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  actor_id     uuid references auth.users(id) on delete set null,
  actor_email  text,
  action       text not null,          -- org.approve, org.reject, org.suspend, org.terms, user.role, user.delete, invite.billing, rfq.deadline …
  target_type  text not null,          -- cro_org | profile | rfq_invite | rfq_request
  target_id    uuid,
  target_label text,
  before       jsonb,
  after        jsonb,
  note         text
);
create index if not exists admin_audit_created_idx on public.admin_audit (created_at desc);
create index if not exists admin_audit_target_idx on public.admin_audit (target_type, target_id);
alter table public.admin_audit enable row level security;
