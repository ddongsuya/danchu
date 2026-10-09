-- 단추(Danchu) 10차: 운영 강화 — 스토리지 한도, 조회 인덱스
-- 0009 실행 후 Supabase SQL Editor에 그대로 붙여 넣어 실행하세요. 두 번 실행해도 안전합니다.
--
-- 배경
-- 1) 첨부는 브라우저가 서명 URL로 Storage에 직접 올린다. 서버는 메타데이터의 size 만 보므로
--    버킷 자체에 한도가 없으면 20MB 검사를 우회해 수 GB 를 올릴 수 있다. 버킷 수준에서 막는다.
-- 2) 의뢰자 요청 목록은 이메일로도 찾는다(계정 연결 전 접수분). 대소문자 무시 비교용 인덱스.
-- 3) 크론 리마인더·자동 회신은 reply_by 로 초대를 찾는다.

-- ─────────────────────────────────────────────
-- 1) 버킷 한도: 20MB, 허용 형식만
-- ─────────────────────────────────────────────
update storage.buckets
set file_size_limit = 20971520,
    allowed_mime_types = array[
      'application/pdf',
      'image/png', 'image/jpeg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/x-hwp', 'application/haansofthwp', 'application/vnd.hancom.hwp',
      'application/octet-stream'
    ]
where id = 'rfq-files';

update storage.buckets
set file_size_limit = 20971520,
    allowed_mime_types = array['application/pdf']
where id = 'cro-files';

-- ─────────────────────────────────────────────
-- 2) 인덱스
-- ─────────────────────────────────────────────
create index if not exists rfq_requests_email_lower_idx on public.rfq_requests (lower(email));
create index if not exists rfq_invites_reply_by_idx on public.rfq_invites (reply_by) where status in ('sent', 'draft');
create index if not exists rfq_files_rfq_idx on public.rfq_files (rfq_id);
