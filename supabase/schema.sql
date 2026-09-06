-- 단추(Danchu) RFQ MVP 스키마
-- Supabase SQL Editor에 그대로 붙여 넣어 실행하세요.

create extension if not exists pgcrypto;

-- RFQ 본문
create table if not exists public.rfq_requests (
  id            uuid primary key default gen_random_uuid(),
  rfq_no        text unique not null,                 -- DC-2026-0001
  created_at    timestamptz not null default now(),
  status        text not null default 'received',     -- received | distributed | quoted | closed
  submitted_step smallint not null default 1,         -- 1: 기본만, 2: 상세까지

  -- 조회·필터용 핵심 컬럼 (payload에도 동일 값 포함)
  company       text not null,
  contact_name  text not null,
  email         text not null,
  phone         text,
  org_type      text,
  purpose       text,
  substance     text not null,
  categories    text[] not null default '{}',
  budget        text,
  cro_count     text,
  confidentiality text,
  reply_by      date,

  -- 전체 폼 값 (STEP1 + STEP2 + 세부조건 "카테고리.필드" 키)
  payload       jsonb not null,

  user_agent    text,
  ip            inet
);

create index if not exists rfq_requests_created_at_idx on public.rfq_requests (created_at desc);
create index if not exists rfq_requests_email_idx on public.rfq_requests (email);

-- 첨부파일 메타 (실제 파일은 Storage 버킷 rfq-files)
create table if not exists public.rfq_files (
  id          uuid primary key default gen_random_uuid(),
  rfq_id      uuid not null references public.rfq_requests(id) on delete cascade,
  storage_path text not null,
  file_name   text not null,
  size_bytes  bigint not null,
  mime_type   text,
  created_at  timestamptz not null default now()
);

-- 연도별 채번 카운터
create table if not exists public.rfq_counters (
  year   int primary key,
  seq    int not null default 0
);

-- 원자적 채번: DC-{YYYY}-{0001}
create or replace function public.next_rfq_no(p_year int)
returns text
language plpgsql
as $$
declare
  v_seq int;
begin
  insert into public.rfq_counters (year, seq) values (p_year, 1)
  on conflict (year) do update set seq = public.rfq_counters.seq + 1
  returning seq into v_seq;
  return format('DC-%s-%s', p_year, lpad(v_seq::text, 4, '0'));
end;
$$;

-- RLS: 서버(service role)만 접근. anon 키로는 읽기·쓰기 불가.
alter table public.rfq_requests enable row level security;
alter table public.rfq_files    enable row level security;
alter table public.rfq_counters enable row level security;

-- Storage 버킷 (private)
insert into storage.buckets (id, name, public)
values ('rfq-files', 'rfq-files', false)
on conflict (id) do nothing;
