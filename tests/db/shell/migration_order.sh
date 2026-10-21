#!/usr/bin/env bash
# 배포 순서 확인 (0022): 0018 까지만 적용된 DB 에서는
#  1) 스키마 판 함수(danchu_schema_version)가 없어 앱의 확인(lib/schema-version.ts)과 npm run check:schema 가 실패하고
#  2) 0022 를 먼저 붙여 넣으면 아무것도 바꾸지 않고 멈춘다 (0019·0020·0021 이 빠졌다는 메시지).
#  3) 0019 → 0020 → 0021 → 0022 를 순서대로 적용하면 판이 22 가 된다.
#  4) 0023 은 0022 없이 적용하면 멈추고, 0022 다음에 적용하면 판이 23 이 된다.
#  5) 0024 는 0023 없이 적용하면 멈추고 아무것도 바꾸지 않으며, 끝나지 않은 달이 마감돼 있어도 멈추고,
#     0023 다음에 적용하면 판이 24 가 된다.
#  6) 0025 는 0024 없이 적용하면 멈추고 아무것도 바꾸지 않으며, 0024 다음에 적용하면 판이 25 가 된다.
#  7) 0026 은 0025 없이 적용하면 멈추고 아무것도 바꾸지 않으며, 0025 다음에 적용하면 판이 26 이 된다.
# 별도 데이터베이스(danchu_order)를 만들어 쓰고 지운다. scripts/db-test.sh 가 PSQL·ROOT·PG* 환경을 넘겨 부른다.
set -uo pipefail
DB=danchu_order
q() { "$PSQL" -X -q -At -v ON_ERROR_STOP=1 --no-psqlrc "$@"; }
fail() { echo "ASSERT 실패: $*" >&2; exit 1; }
TMPD="$(mktemp -d)"
trap 'rm -rf "$TMPD"; q -d postgres -c "drop database if exists $DB" >/dev/null 2>&1' EXIT

q -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null || fail "데이터베이스를 만들지 못했습니다"
q -d "$DB" -f "$ROOT/tests/db/support/supabase-stubs.sql" >/dev/null || fail "대역 적용 실패"
for f in "$ROOT"/supabase/migrations/00{0,1}[0-9]_*.sql; do
  n="$(basename "$f" | cut -c1-4)"
  (( 10#$n <= 18 )) || continue
  q -d "$DB" -f "$f" >"$TMPD/out" 2>&1 || { cat "$TMPD/out" >&2; fail "$(basename "$f") 적용 실패"; }
done

if q -d "$DB" -c "select public.danchu_schema_version()" >/dev/null 2>&1; then fail "0018 DB 에 스키마 판 함수가 있으면 안 됩니다"; fi
echo "  0018 DB: danchu_schema_version() 없음 (앱 확인 실패)"

if q -d "$DB" -f "$ROOT/supabase/migrations/0022_selection_integrity.sql" >"$TMPD/out" 2>&1; then fail "0019~0021 없이 0022 가 적용되면 안 됩니다"; fi
grep -q "0019, 0020, 0021 을 순서대로" "$TMPD/out" || fail "0022 의 멈춤 메시지가 다릅니다: $(cat "$TMPD/out")"
[[ "$(q -d "$DB" -c "select count(*) from information_schema.columns where table_name = 'cro_quotes' and column_name = 'revision'")" == "0" ]] || fail "멈춘 0022 가 일부를 바꿨습니다"
if q -d "$DB" -c "select public.danchu_schema_version()" >/dev/null 2>&1; then fail "멈춘 0022 가 판 함수를 만들었습니다"; fi
echo "  0022 를 먼저 적용: 멈춤 (0019·0020·0021 필요), 바뀐 것 없음"

if q -d "$DB" -f "$ROOT/supabase/migrations/0023_opt_in.sql" >"$TMPD/out" 2>&1; then fail "0019~0022 없이 0023 이 적용되면 안 됩니다"; fi
grep -q "0019, 0020, 0021, 0022 를 순서대로" "$TMPD/out" || fail "0023 의 멈춤 메시지가 다릅니다: $(cat "$TMPD/out")"
[[ "$(q -d "$DB" -c "select count(*) from information_schema.columns where table_name = 'rfq_invites' and column_name = 'joined_at'")" == "0" ]] || fail "멈춘 0023 이 일부를 바꿨습니다"
echo "  0023 을 먼저 적용: 멈춤 (0019~0022 필요), 바뀐 것 없음"

for f in "$ROOT"/supabase/migrations/00{19,20,21,22}_*.sql; do
  q -d "$DB" -f "$f" >"$TMPD/out" 2>&1 || { cat "$TMPD/out" >&2; fail "$(basename "$f") 적용 실패"; }
done
V="$(q -d "$DB" -c "select public.danchu_schema_version()")"
[[ "$V" == "22" ]] || fail "판은 22 여야 합니다 (실제 $V)"
echo "  0019 → 0020 → 0021 → 0022: 판 22"

if q -d "$DB" -f "$ROOT/supabase/migrations/0024_billing_close_lock.sql" >"$TMPD/out" 2>&1; then fail "0023 없이 0024 가 적용되면 안 됩니다"; fi
grep -q "0019, 0020, 0021, 0022, 0023 을 순서대로" "$TMPD/out" || fail "0024 의 멈춤 메시지가 다릅니다: $(cat "$TMPD/out")"
[[ "$(q -d "$DB" -c "select count(*) from information_schema.tables where table_name = 'billing_adjustments'")" == "0" ]] || fail "멈춘 0024 가 일부를 바꿨습니다"
echo "  0024 를 0023 없이 적용: 멈춤 (0019~0023 필요), 바뀐 것 없음"

q -d "$DB" -f "$ROOT/supabase/migrations/0023_opt_in.sql" >"$TMPD/out" 2>&1 || { cat "$TMPD/out" >&2; fail "0023 적용 실패"; }
V="$(q -d "$DB" -c "select public.danchu_schema_version()")"
[[ "$V" == "23" ]] || fail "판은 23 이어야 합니다 (실제 $V)"
echo "  0022 → 0023: 판 23"

if q -d "$DB" -f "$ROOT/supabase/migrations/0026_compare_lock.sql" >"$TMPD/out" 2>&1; then fail "0025 없이 0026 이 적용되면 안 됩니다"; fi
grep -q "0019 부터 0025 까지 순서대로" "$TMPD/out" || fail "0026 의 멈춤 메시지가 다릅니다: $(cat "$TMPD/out")"
[[ "$(q -d "$DB" -c "select count(*) from pg_trigger where tgname = 'rfq_requests_compare_lock'")" == "0" ]] || fail "멈춘 0026 이 트리거를 만들었습니다"
echo "  0026 을 0025 없이 적용: 멈춤 (0019~0025 필요), 바뀐 것 없음"

if q -d "$DB" -f "$ROOT/supabase/migrations/0025_flow_redesign.sql" >"$TMPD/out" 2>&1; then fail "0024 없이 0025 가 적용되면 안 됩니다"; fi
grep -q "0019 부터 0024 까지 순서대로" "$TMPD/out" || fail "0025 의 멈춤 메시지가 다릅니다: $(cat "$TMPD/out")"
[[ "$(q -d "$DB" -c "select count(*) from information_schema.columns where table_name = 'rfq_requests' and column_name = 'started_at'")" == "0" ]] || fail "멈춘 0025 가 일부를 바꿨습니다"
[[ "$(q -d "$DB" -c "select count(*) from information_schema.tables where table_name = 'rfq_pending'")" == "0" ]] || fail "멈춘 0025 가 rfq_pending 을 만들었습니다"
echo "  0025 를 0024 없이 적용: 멈춤 (0019~0024 필요), 바뀐 것 없음"

# 0020 까지는 이번 달도 마감할 수 있었다. 끝나지 않은 달이 마감돼 있으면 0024 는 멈추고 아무것도 바꾸지 않는다
q -d "$DB" -c "insert into public.billing_periods (month, note) values (date_trunc('month', now() at time zone 'Asia/Seoul')::date, '달 중간 마감')" >/dev/null || fail "이번 달 마감 행을 넣지 못했습니다"
if q -d "$DB" -f "$ROOT/supabase/migrations/0024_billing_close_lock.sql" >"$TMPD/out" 2>&1; then fail "끝나지 않은 달이 마감돼 있는데 0024 가 적용되면 안 됩니다"; fi
grep -q "끝나지 않은 달" "$TMPD/out" || fail "0024 의 끝나지 않은 달 멈춤 메시지가 다릅니다: $(cat "$TMPD/out")"
[[ "$(q -d "$DB" -c "select count(*) from information_schema.tables where table_name = 'billing_adjustments'")" == "0" ]] || fail "멈춘 0024 가 일부를 바꿨습니다"
echo "  끝나지 않은 달이 마감된 DB 에 0024: 멈춤 (먼저 마감 해제), 바뀐 것 없음"
q -d "$DB" -c "delete from public.billing_periods where month >= date_trunc('month', now() at time zone 'Asia/Seoul')::date" >/dev/null || fail "마감 해제 실패"

q -d "$DB" -f "$ROOT/supabase/migrations/0024_billing_close_lock.sql" >"$TMPD/out" 2>&1 || { cat "$TMPD/out" >&2; fail "0024 적용 실패"; }
V="$(q -d "$DB" -c "select public.danchu_schema_version()")"
[[ "$V" == "24" ]] || fail "판은 24 여야 합니다 (실제 $V)"
echo "  0023 → 0024: 판 24"

q -d "$DB" -f "$ROOT/supabase/migrations/0025_flow_redesign.sql" >"$TMPD/out" 2>&1 || { cat "$TMPD/out" >&2; fail "0025 적용 실패"; }
V="$(q -d "$DB" -c "select public.danchu_schema_version()")"
[[ "$V" == "25" ]] || fail "판은 25 여야 합니다 (실제 $V)"
echo "  0024 → 0025: 판 25"

q -d "$DB" -f "$ROOT/supabase/migrations/0026_compare_lock.sql" >"$TMPD/out" 2>&1 || { cat "$TMPD/out" >&2; fail "0026 적용 실패"; }
V="$(q -d "$DB" -c "select public.danchu_schema_version()")"
[[ "$V" == "26" ]] || fail "판은 26 이어야 합니다 (실제 $V)"
[[ "$(q -d "$DB" -c "select count(*) from pg_trigger where tgname in ('rfq_requests_compare_lock', 'cro_quotes_compare_lock', 'cro_quote_items_compare_lock', 'cro_quote_addons_compare_lock')")" == "4" ]] || fail "0026 트리거 4개가 있어야 합니다"
echo "  0025 → 0026: 판 26, 열린 비교표 고정 트리거 4개"
