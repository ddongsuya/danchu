# DB 테스트 (실제 PostgreSQL)

`npm run test:db` 는 `scripts/db-test.sh` 를 돌린다. Docker 없이 로컬 PostgreSQL 16 바이너리(`/usr/lib/postgresql/16/bin`, 또는 `PG_BIN`)로 임시 클러스터를 만들어 검사하고 끝나면 지운다.

## 순서

1. `mktemp -d` 에 새 클러스터를 만들고 빈 로컬 포트와 유닉스 소켓으로 띄운다 (TCP 리슨 없음). root 로 실행하면 `postgres` 사용자로 클러스터를 돌린다.
2. `support/supabase-stubs.sql` 로 Supabase 최소 대역을 깐다.
3. `supabase/migrations/*.sql` 을 번호 순으로 적용한다. 파일마다 곧바로 한 번 더 적용해 "두 번 실행해도 안전"한지 본다. 모두 `ON_ERROR_STOP`.
4. `tests/db/*.sql` 을 하나씩 돌린다. 파일마다 `begin` → `support/fixtures.sql` → 테스트 → `rollback` 이라 테스트끼리 데이터가 섞이지 않는다.
   이어서 `tests/db/shell/*.sh` 를 돌린다. 연결 여러 개(동시 선정·잠금 대기)나 별도 데이터베이스(배포 순서)가 필요한 검사라 데이터를 커밋한다. 그래서 마지막에 돈다.
5. 통과·실패 수를 출력한다. 하나라도 실패하면 종료 코드 1.

환경 변수: `PG_BIN` (바이너리 위치), `DB_TEST_KEEP=1` (클러스터 디렉터리를 남김), `DB_TEST_FULL_RERUN=1` (마지막에 전체 마이그레이션을 처음부터 한 번 더 적용).

## 무엇이 진짜이고 무엇이 대역인가

진짜: PostgreSQL 16 엔진, 저장소의 마이그레이션 SQL 전부(고치지 않고 그대로), 그 안의 표·제약·트리거·함수(`save_quote`, `select_quote`, `report_contract`, `billing_*`, `close_billing_month` 등). 테스트는 이 함수들을 직접 부른다.

대역 (`support/supabase-stubs.sql`, 운영 DB 에는 적용하지 않는다):

- 역할 `anon`, `authenticated`, `service_role` (로그인 불가, `service_role` 은 bypassrls). Supabase 처럼 `public` 스키마에 새로 만드는 표·함수·시퀀스를 세 역할에 모두 여는 기본 권한(`alter default privileges`)도 흉내 낸다. 그래서 `security_privileges.sql` 에서 막히는 것은 마이그레이션의 RLS·`revoke` 덕분이다.
- `auth` 스키마: `auth.users` (id, email, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, created_at, updated_at), `auth.jwt()`·`auth.uid()`·`auth.role()` 은 Supabase 처럼 `current_setting('request.jwt.claims', true)` 에서 읽는다. 테스트에서 `set_config('request.jwt.claims', '{"sub":"..."}', true)` 로 흉내 낼 수 있다.
- `storage` 스키마: `storage.buckets`, `storage.objects` 최소 열.
- `extensions` 스키마 (비어 있음). `pgcrypto` 는 진짜 확장을 쓴다.

검사하지 않는 것: PostgREST(`sb.rpc`·`.from()` 의 JSON 변환), Supabase Auth·Storage 서비스 자체, 앱 코드. 앱 쪽은 Vitest(`npm test`)가 본다.

## 알려진 한계

- 전체 마이그레이션을 처음부터 다시 적용하면 `0009_anonymous_billing.sql` 이 실패한다. 0018·0019·0020 이 `billing_summary` 의 반환 열을 바꾼 뒤라 0009 의 `create or replace` 가 받아들여지지 않는다. 각 파일을 적용 직후 한 번 더 돌리는 것은 안전하고(기본 검사), 지난 마이그레이션은 고치지 않으므로 전체 재적용은 `DB_TEST_FULL_RERUN=1` 로만 돌린다.
- 시간은 트랜잭션 안에서 `now()` 가 고정이다. 월 경계 테스트는 `pg_temp.t_month(n)` · `t_mid(n)` 으로 이번 달 기준 상대 날짜를 쓴다.

## 테스트 쓰기

- `do $$ ... $$;` 블록 안에서 `pg_temp.t_eq(실제, 기대, '설명')`, `pg_temp.t_assert(조건, '설명')` 를 쓴다. 실패하면 `RAISE EXCEPTION` 으로 파일 전체가 실패한다.
- 데이터 도우미: `t_org`, `t_rfq`, `t_invite`(기본은 기관이 참여한 초대, `p_joined => false` 면 참여 결정 전), `t_quote`(제출된 정식 견적), `t_award` (`support/fixtures.sql`).
- 마이그레이션을 테스트 안에서 다시 적용하려면 `\set f :migrations_dir '/0020_billing_rules.sql'` 다음 `\i :f` (`billing_idempotent.sql` 참고).

| 파일 | 내용 |
|---|---|
| `billing_tiers.sql` | 구간 경계(9,999,999 / 10,000,000 / 49,999,999 / 50,000,000), 금액 미입력, 미제출 초대 미청구, 단가 미정은 null |
| `billing_resubmit.sql` | 재제출 1회 청구, 처음 제출한 달 청구, `first_submitted_at` 고정, 서울 시간 월 경계 |
| `billing_exclusion.sql` | 운영자 청구 제외, 운영자 관리 기관·대리 입력 견적도 청구 (기관이 참여한 초대) |
| `billing_success_fee.sql` | 성사수수료: 5,000만 원 판정은 선정 견적, signed 만 정산, 계약 금액 기준, 체결 확인 월, 정정해도 월 유지, 예상은 합계 미포함, 요율 미정 |
| `billing_statement.sql` | 월 구독료 명세·합계, `monthly_cap` 열·참조 없음, 월 마감 저장본 고정·재마감 |
| `billing_idempotent.sql` | 데이터가 있는 상태에서 0020 재적용 시 값 유지 |
| `security_invite_revoke.sql` | 초대 철회(`revoke_invite`, `revoked_at`): 철회 직후 옛 토큰 저장 거절(경합), 토큰 재발급, 재개해도 철회 유지·지울 수 없음, 다른 초대는 되살아남, 제출 초대 취소 불가. `save_quote` 잠금 뒤 재검사(토큰·만료·회신하지 않음·기관 중지·소속) |
| `security_member_rotation.sql` | 담당자 제외·이동·삭제 때 그 기관 링크 전부 재발급(제출 건 포함, 견적·상태·기한 유지), 다른 기관 링크 불변, 옛 토큰 거절·새 토큰으로 이어 저장. 이동 시 `org_role` member 초기화, 기존 owner 유지 |
| `selection_integrity.sql` | 배포가 메일을 기다리는 사이 제출·선정 → 배포 재개(조건부 갱신) 뒤에도 선정 유지, 조건 없는 덮어쓰기는 트리거가 거절, 선정 뒤 재제출·초안 거절(상태가 되돌아가 있어도 `selected_quote_id` 로 거절). 견적 판(`revision`): 접속 기록·건너뛴 저장은 그대로, 재제출하면 오름, 직접 바꿀 수 없음. 확인 화면 뒤 수정된 견적은 옛 판으로 선정 거절(`quote_changed`)·수주 기록 없음, 지금 판으로 선정하면 판·금액 기록. 두 번 선정은 한 건만, 요청당 수주 기록 1건, 3개 인자 `select_quote` 없음, `danchu_schema_version() >= 22` |
| `security_privileges.sql` | 모든 업무 표 RLS 켜짐·정책 없음·뷰 없음, anon·authenticated 로 모든 표 읽기 0행·삭제 0행, 요청 직접 생성·견적 직접 수정 거절, service_role 은 읽음. 핵심 RPC 18개(0023 참여·철회·자리 함수 포함)와 모든 security definer 함수는 anon·authenticated 실행 불가(실제 호출도 거절), service_role 은 실행 |
| `opt_in_join.sql` | 참여 선택형(0023): 자리 수만큼 먼저 참여한 순서, 다시 눌러도 첫 기록 유지, 참여 기록(경로·링크 지문·조건 판·IP·UA·계정). 지명 예약(결정 기한 전 일반 기관은 `reserved`, 지명 불참·기한 경과 시 풀림). 참여 거절(취소·불참·만료·기관 중지·승인 대기·마감·취소 요청·회신 기한 3영업일 전·운영자·다른 기관·포털 비로그인). 참여 전 저장 거절(기관·운영자 대리 입력·직접 삽입), 참여 뒤 대리 입력 가능. 철회(제출 전만, 자리 비움, 재참여·저장 불가). 참여 기록 보호(직접 쓰기·변경·삭제 거절, 계정 삭제 시 계정만 비움). 지명 기관에만 안내. 청구: 참여 견적·참여 뒤 대리 입력 청구, 참여 기록 없음·legacy 미청구, legacy 수주 성사수수료 합계 제외. 0023 재적용 시 전환(작성 중·제출 → legacy, 열린 sent 그대로)과 기록 유지 |
| `shell/join_race.sh` | 자리 3곳에 6곳이 동시에 참여: 3곳만 참여·나머지 full, 요청 행 잠금으로 줄 섬. 지명 1곳 결정 전 일반 4곳 동시: 2곳 참여·2곳 reserved, 지명 기관은 비워 둔 자리로 참여 |
| `shell/select_race.sh` | 두 연결이 같은 요청을 동시에 선정: 먼저 잠근 쪽만 성공, 다른 쪽은 잠금을 기다린 뒤 `already_selected`, 수주 기록 1건. 기관 재제출이 잠금을 잡은 동안 옛 판으로 선정하면 기다린 뒤 `quote_changed`, 수주 기록 0건 |
| `shell/migration_order.sh` | 0018 까지만 적용한 DB: 판 함수 없음(앱 확인 실패), 0022 를 먼저 적용하면 멈추고 아무것도 바꾸지 않음, 0019 → 0020 → 0021 → 0022 순서로 적용하면 판 22. 0023 을 0022 없이 적용하면 멈춤, 0022 다음에 적용하면 판 23 |
| `security_claim.sql` | 이메일 재사용: B 가 A 의 옛 주소로 가입해도 A 요청은 연결되지 않고 미귀속 요청만 한 번 연결, 익명화 요청 제외, B 삭제가 A 요청에 영향 없음 |
| `billing_review_fixes.sql` | 리뷰 수정: 금액 없이 제출 → 그 달 마감 → 다음 달 금액 입력 시 금액이 들어온 달(`billing_at`)에 한 번 청구·마감 저장본 유지, 처음부터 금액이 있으면 `billing_at = first_submitted_at`·재제출해도 고정. 월 구독료는 구독 시작 월(`monthly_fee_from`)부터 이번 달까지만(지난달·다음 달·오래전 달 없음), 시작 월은 1일로, 해지 시 비움. 청구 제외 초대의 성사수수료 정산은 유지하고 `invite_billable = false` 표시. 0009 전 수주의 선정 견적 금액·기관을 0020 이 채움 |
| `security_review_fixes.sql` | 리뷰 수정: 대표 메일 주인이 기관을 떠나면(소속 해제·계정 삭제) 대표 메일을 비우고 운영자·남은 대표에게 알림(다른 담당자가 떠나면 그대로). 계정 삭제로 `user_id` 가 비워진 요청은 `orphaned_at` 표시·재연결 안 함(지울 수 없음). 소속 없는 기관 계정은 토큰으로 저장, 다른 기관 소속은 `not_member`. 토큰 함수 `search_path = pg_catalog, extensions, public` |
