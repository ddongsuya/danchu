-- 단추(Danchu) 12차: 운영자 예외 처리 — 기한 변경, 초대 한도 계산, 자동 보충 끄기
-- 0011 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경
-- 1) 회신 0건으로 기한이 지난 요청은 "3곳" 한도가 거절·만료 초대까지 세어 재배포가 막혔다.
--    한도는 살아 있는 초대(sent·draft·submitted)만 센다.
-- 2) 운영자가 일부러 뺀 기관을 매일 09:00 보충 배포가 다시 채워 넣었다. 요청 단위로 자동 보충을 끌 수 있다.

alter table public.rfq_requests add column if not exists auto_distribute boolean not null default true;

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
    -- 회신하지 않음·만료된 초대는 자리를 비운 것으로 본다
    select count(*) into used from public.rfq_invites
     where rfq_id = new.rfq_id and status not in ('declined', 'expired');
    if used >= cap then raise exception 'invitation_limit_reached'; end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.enforce_invitation_limit() from public, anon, authenticated;
