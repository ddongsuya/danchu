-- 단추(Danchu) 11차: 회원 탈퇴·보존기간 정리
-- 0010 실행 후 적용. 두 번 실행해도 안전합니다.
--
-- 배경
-- 개인정보처리방침은 "요청 시 지체 없이 파기", "견적 요청 3년", "접속 기록 3개월"을 약속한다.
-- 탈퇴(auth.users 삭제)는 profiles·notifications 를 cascade 로 지우지만 rfq_requests 는 user_id 만 null 이 되어
-- 담당자 이름·이메일·전화가 남는다. 그래서 서버가 요청서를 익명화한 뒤 계정을 지우고, 언제 익명화했는지 남긴다.

alter table public.rfq_requests add column if not exists anonymized_at timestamptz;

-- 보존기간 정리 cron 이 "오래됐고 아직 익명화 안 된" 행을 빨리 찾도록
create index if not exists rfq_requests_retention_idx on public.rfq_requests (created_at) where anonymized_at is null;

-- 읽은 알림 정리용
create index if not exists notifications_read_at_idx on public.notifications (read_at) where read_at is not null;
