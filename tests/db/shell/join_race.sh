#!/usr/bin/env bash
# 동시 참여 (0023): 자리 3곳 요청에 6개 기관이 동시에 참여하기를 누르면 3곳만 참여하고 나머지는 full 이다.
# 각 연결은 참여한 뒤 0.8초 동안 커밋하지 않는다. join_offer 가 요청 행을 잠그므로 다른 연결은 기다렸다가 갱신된 자리를 본다.
# 이어서 지명 예약: 지명 1곳이 결정하기 전에 일반 기관 4곳이 동시에 누르면 일반 자리 2곳만 찬다.
# scripts/db-test.sh 가 PSQL·ROOT·PG* 환경을 넘겨 부른다. 데이터는 커밋되므로 요청 번호를 따로 쓴다.
set -uo pipefail
q() { "$PSQL" -X -q -At -v ON_ERROR_STOP=1 --no-psqlrc "$@"; }
fail() { echo "ASSERT 실패: $*" >&2; exit 1; }
TMPD="$(mktemp -d)"; trap 'rm -rf "$TMPD"' EXIT

# 준비: 3곳 요청 1건, 참여 결정 전 초대 n 개 (커밋). 출력: 요청 id 다음에 "초대id:토큰" 목록
prepare() {
  local no="$1" n="$2" join_by="$3" nominees="$4"
  { cat "$ROOT/tests/db/support/fixtures.sql"; cat <<SQL
create temp table rq as select pg_temp.t_rfq('$no') id;
update public.rfq_requests set cro_count = '3곳', join_by = $join_by where id = (select id from rq);
create temp table inv as
  select g, pg_temp.t_invite((select id from rq), pg_temp.t_org('$no-' || g), now(), false,
                             case when g <= $nominees then 'nominated' else 'matched' end) id
  from generate_series(1, $n) g;
select (select id from rq) || ' ' || string_agg(i.id || ':' || i.token, ' ' order by inv.g)
  from inv join public.rfq_invites i on i.id = inv.id;
SQL
  } | q | tail -n 1
}

join_all() {
  local out="$1"; shift
  local pids=() k=0 pair
  for pair in "$@"; do
    k=$((k + 1))
    q -c "begin; select public.join_offer('${pair%%:*}', '${pair#*:}', null, 'token', 'v1', null, null)->>'code'; select pg_sleep(0.8); commit;" >"$out.$k" 2>&1 &
    pids+=($!)
  done
  for p in "${pids[@]}"; do wait "$p" || fail "참여 연결 실패: $(cat "$out".*)"; done
}

# 1) 6곳 동시 참여 → 3곳만
read -r RQ PAIRS < <(prepare T-JOIN-RACE-1 6 null 0)
[[ -n "${PAIRS:-}" ]] || fail "준비 데이터를 만들지 못했습니다"
# shellcheck disable=SC2086
set -- $PAIRS
START=$(date +%s%N)
join_all "$TMPD/a" "$@"
END=$(date +%s%N)
OK=0; FULL=0
for f in "$TMPD"/a.*; do
  c="$(grep -v '^$' "$f" | head -n 1)"
  if [[ -z "$c" ]]; then OK=$((OK + 1)); elif [[ "$c" == "full" ]]; then FULL=$((FULL + 1)); else fail "예상하지 못한 결과: $c"; fi
done
(( OK == 3 && FULL == 3 )) || fail "참여 3곳·full 3곳이어야 합니다 (참여 $OK, full $FULL)"
N="$(q -c "select count(*) from public.rfq_invites where rfq_id = '$RQ' and joined_at is not null")"
[[ "$N" == "3" ]] || fail "참여 기록은 3건이어야 합니다 (실제 $N)"
USED="$(q -c "select public.offer_seat_state('$RQ')->>'used'")"
[[ "$USED" == "3" ]] || fail "쓴 자리는 3이어야 합니다 (실제 $USED)"
WAITED_MS=$(( (END - START) / 1000000 ))
(( WAITED_MS >= 1500 )) || fail "참여가 요청 행 잠금으로 줄을 서지 않았습니다 (${WAITED_MS}ms)"
echo "  동시 참여 6곳 (자리 3곳): 참여 3 · full 3, 참여 기록 3건 (${WAITED_MS}ms, 잠금으로 줄 섬)"

# 2) 지명 예약 중 동시 참여: 지명 1곳 결정 전, 일반 4곳 동시 → 일반 2곳만, 나머지는 reserved. 지명 기관은 그 뒤에도 참여
read -r RQ2 PAIRS2 < <(prepare T-JOIN-RACE-2 5 "now() + interval '1 day'" 1)
[[ -n "${PAIRS2:-}" ]] || fail "두 번째 준비 데이터를 만들지 못했습니다"
# shellcheck disable=SC2086
set -- $PAIRS2
NOMINEE="$1"; shift
join_all "$TMPD/b" "$@"
OK=0; RES=0
for f in "$TMPD"/b.*; do
  c="$(grep -v '^$' "$f" | head -n 1)"
  if [[ -z "$c" ]]; then OK=$((OK + 1)); elif [[ "$c" == "reserved" ]]; then RES=$((RES + 1)); else fail "예상하지 못한 결과: $c"; fi
done
(( OK == 2 && RES == 2 )) || fail "일반 2곳 참여·2곳 reserved 여야 합니다 (참여 $OK, reserved $RES)"
C="$(q -c "select public.join_offer('${NOMINEE%%:*}', '${NOMINEE#*:}', null, 'token', 'v1', null, null)->>'ok'")"
[[ "$C" == "true" ]] || fail "지명 기관은 비워 둔 자리로 참여해야 합니다: $C"
N2="$(q -c "select count(*) from public.rfq_invites where rfq_id = '$RQ2' and joined_at is not null")"
[[ "$N2" == "3" ]] || fail "참여 기록은 3건이어야 합니다 (실제 $N2)"
echo "  지명 예약 중 동시 참여 4곳: 일반 2 · reserved 2, 지명 기관은 비워 둔 자리로 참여 (합계 3)"
