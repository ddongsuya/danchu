#!/usr/bin/env bash
# 단추 실제 PostgreSQL 테스트 (Docker 없이).
# 1) 임시 디렉터리에 새 클러스터를 만들고 빈 로컬 포트·유닉스 소켓으로 띄운다
# 2) Supabase 최소 대역(tests/db/support/supabase-stubs.sql)을 깐다
# 3) supabase/migrations/*.sql 을 번호 순으로 적용한다. 파일마다 곧바로 한 번 더 적용해 두 번 실행해도 안전한지 본다
# 4) tests/db/*.sql 을 하나씩 트랜잭션 안에서 돌리고 되돌린다. 실패는 RAISE EXCEPTION 으로 알린다
#    이어서 tests/db/shell/*.sh (동시 연결·배포 순서 검사) 를 돌린다
# 5) 결과를 출력하고 클러스터를 지운다. 하나라도 실패하면 0 이 아닌 값으로 끝난다
#
# 환경 변수: PG_BIN (기본 /usr/lib/postgresql/16/bin 또는 PATH 의 pg_ctl), DB_TEST_KEEP=1 이면 클러스터를 남긴다,
#           DB_TEST_FULL_RERUN=1 이면 마지막에 전체 마이그레이션을 처음부터 한 번 더 적용한다
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_BIN="${PG_BIN:-}"
if [[ -z "$PG_BIN" ]]; then
  if [[ -x /usr/lib/postgresql/16/bin/pg_ctl ]]; then PG_BIN=/usr/lib/postgresql/16/bin
  elif command -v pg_ctl >/dev/null 2>&1; then PG_BIN="$(dirname "$(command -v pg_ctl)")"
  else echo "pg_ctl 을 찾지 못했습니다. PG_BIN 을 지정해 주세요." >&2; exit 2; fi
fi
PSQL="$(command -v psql || echo "$PG_BIN/psql")"

TMP="$(mktemp -d -t danchu-db-XXXXXX)"
DATA="$TMP/data"
SOCK="$TMP/sock"
LOG="$TMP/postgres.log"
mkdir -p "$SOCK"

# root 로는 initdb 가 돌지 않는다. root 이면 postgres 사용자로 클러스터를 돌린다
AS=()
if [[ "$(id -u)" == "0" ]]; then
  if id postgres >/dev/null 2>&1; then
    chown -R postgres "$TMP"
    AS=(runuser -u postgres --)
  else
    echo "root 로 실행 중인데 postgres 사용자가 없습니다." >&2; exit 2
  fi
fi

free_port() {
  local p
  for p in $(seq 54330 54399); do
    if ! (exec 3<>"/dev/tcp/127.0.0.1/$p") 2>/dev/null; then echo "$p"; return; fi
    exec 3>&- 2>/dev/null || true
  done
  echo 0
}
PORT="$(free_port)"
if [[ "$PORT" == "0" ]]; then echo "빈 포트를 찾지 못했습니다." >&2; exit 2; fi

cleanup() {
  "${AS[@]}" "$PG_BIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true
  if [[ "${DB_TEST_KEEP:-}" == "1" ]]; then echo "클러스터를 남겼습니다: $TMP (port $PORT)"; else rm -rf "$TMP"; fi
}
trap cleanup EXIT

"${AS[@]}" "$PG_BIN/initdb" -D "$DATA" -U postgres -A trust -E UTF8 --locale=C.UTF-8 >"$TMP/initdb.log" 2>&1 \
  || "${AS[@]}" "$PG_BIN/initdb" -D "$DATA" -U postgres -A trust -E UTF8 --no-locale >"$TMP/initdb.log" 2>&1 \
  || { cat "$TMP/initdb.log" >&2; exit 2; }
"${AS[@]}" "$PG_BIN/pg_ctl" -D "$DATA" -l "$LOG" -w -t 30 \
  -o "-p $PORT -k $SOCK -c listen_addresses='' -c fsync=off -c timezone=UTC" start >/dev/null \
  || { cat "$LOG" >&2; exit 2; }

export PGHOST="$SOCK" PGPORT="$PORT" PGUSER=postgres PGDATABASE=postgres PGOPTIONS="-c client_min_messages=warning"
q() { "$PSQL" -X -q -v ON_ERROR_STOP=1 -v migrations_dir="$ROOT/supabase/migrations" --no-psqlrc "$@"; }

pass=0; fail=0; failed=()
ok() { pass=$((pass + 1)); echo "  ok    $1"; }
ng() { fail=$((fail + 1)); failed+=("$1"); echo "  FAIL  $1"; }

echo "== Supabase 대역"
if q -f "$ROOT/tests/db/support/supabase-stubs.sql" >"$TMP/out" 2>&1; then ok "supabase-stubs.sql"; else cat "$TMP/out"; ng "supabase-stubs.sql"; fi

shopt -s nullglob
MIGRATIONS=("$ROOT"/supabase/migrations/*.sql)
# 두 번 실행해도 안전한지: 파일마다 적용 직후 같은 파일을 한 번 더 적용한다 (운영자가 SQL Editor 에 같은 파일을 두 번 붙여 넣는 경우).
# 전체를 처음부터 다시 돌리는 검사(DB_TEST_FULL_RERUN=1)는 기본으로 끈다. 0009 의 billing_summary 는 반환 열이 바뀐
# 뒤(0018·0019)에 다시 돌리면 create or replace 가 실패한다. 지난 마이그레이션은 고치지 않으므로 알려진 한계로 둔다 (tests/db/README.md)
echo "== 마이그레이션 (${#MIGRATIONS[@]}개, 파일마다 2회)"
for f in "${MIGRATIONS[@]}"; do
  name="$(basename "$f")"
  for round in 1 2; do
    if q -f "$f" >"$TMP/out" 2>&1; then ok "$name ($round회)"; else sed 's/^/        /' "$TMP/out"; ng "$name ($round회)"; fi
  done
done
if [[ "${DB_TEST_FULL_RERUN:-}" == "1" ]]; then
  echo "== 전체 재적용"
  for f in "${MIGRATIONS[@]}"; do
    name="$(basename "$f")"
    if q -f "$f" >"$TMP/out" 2>&1; then ok "재적용: $name"; else sed 's/^/        /' "$TMP/out"; ng "재적용: $name"; fi
  done
fi

echo "== DB 테스트"
for f in "$ROOT"/tests/db/*.sql; do
  name="$(basename "$f")"
  # 테스트마다 트랜잭션 안에서 공용 도우미(tests/db/support/fixtures.sql)와 함께 돌리고 되돌린다. 테스트끼리 데이터가 섞이지 않는다
  if { echo "begin;"; cat "$ROOT/tests/db/support/fixtures.sql"; echo; cat "$f"; echo; echo "rollback;"; } | q >"$TMP/out" 2>&1; then
    ok "$name"
  else
    sed 's/^/        /' "$TMP/out"; ng "$name"
  fi
done

# 여러 연결이 필요한 검사(동시 선정·잠금 대기)와 별도 데이터베이스가 필요한 검사(배포 순서). 커밋되는 데이터를 쓰므로 마지막에 돈다
echo "== 연결 여러 개 · 배포 순서"
export PSQL ROOT
for f in "$ROOT"/tests/db/shell/*.sh; do
  name="$(basename "$f")"
  if bash "$f" >"$TMP/out" 2>&1; then
    ok "$name"; sed 's/^/      /' "$TMP/out"
  else
    sed 's/^/        /' "$TMP/out"; ng "$name"
  fi
done

echo
echo "결과: 통과 $pass · 실패 $fail"
if (( fail > 0 )); then printf '  실패: %s\n' "${failed[@]}"; exit 1; fi
exit 0
