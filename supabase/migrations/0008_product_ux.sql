-- Apply before deploying the product UX branch. Additive, existing CDA remains private.
alter table public.rfq_invites add column if not exists cda_signed_at timestamptz;
alter table public.rfq_invites add column if not exists cda_reference text;
alter table public.profiles add column if not exists email_notifications boolean not null default true;

-- Serialize all invitation insert paths, including cron and manual distribution.
create or replace function public.enforce_invitation_limit() returns trigger
language plpgsql security definer set search_path = public as $$
declare r public.rfq_requests%rowtype; used integer; cap integer;
begin
  select * into r from public.rfq_requests where id = new.rfq_id for update;
  if r.status in ('selected','contracting','closed','cancelled') or r.compared_at is not null then
    raise exception 'request_not_open';
  end if;
  cap := case r.cro_count when '전체' then null when '5곳' then 5 else 3 end;
  if cap is not null then
    select count(*) into used from public.rfq_invites where rfq_id = new.rfq_id;
    if used >= cap then raise exception 'invitation_limit_reached'; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists invitation_limit on public.rfq_invites;
create trigger invitation_limit before insert on public.rfq_invites
for each row execute function public.enforce_invitation_limit();
revoke execute on function public.enforce_invitation_limit() from public, anon, authenticated;

-- An estimate without institution confirmation/PDF must not finalize an award.
create or replace function public.check_award_quote() returns trigger
language plpgsql security definer set search_path = public as $$
declare q public.cro_quotes%rowtype;
begin
  select * into q from public.cro_quotes where id = new.quote_id;
  if q.auto or q.pdf_path is null or q.start_date is null or
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
