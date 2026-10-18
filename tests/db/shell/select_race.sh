#!/usr/bin/env bash
# 동시 선정 (0022): 두 연결이 같은 요청에서 서로 다른 견적을 동시에 선정하면 한 건만 성공하고 수주 기록은 1건이다.
# 이어서 선정과 견적 수정이 겹치면, 수정이 먼저 잠금을 잡은 경우 옛 판의 선정은 quote_changed 로 거절된다.
# scripts/db-test.sh 가 PSQL·ROOT·PG* 환경을 넘겨 부른다. 데이터는 커밋되므로 요청 번호를 따로 쓴다.
set -uo pipefail
q() { "$PSQL" -X -q -At -v ON_ERROR_STOP=1 --no-psqlrc "$@"; }
fail() { echo "ASSERT 실패: $*" >&2; exit 1; }
TMPD="$(mktemp -d)"; trap 'rm -rf "$TMPD"' EXIT

# 준비: 요청 1건에 기관 2곳이 정식 견적을 제출 (커밋)
read -r RQ QA RA QB RB < <({ cat "$ROOT/tests/db/support/fixtures.sql"; cat <<'SQL'
create temp table ids as
  select rq, pg_temp.t_quote(pg_temp.t_invite(rq, pg_temp.t_org('경합A')), 20000000) qa,
             pg_temp.t_quote(pg_temp.t_invite(rq, pg_temp.t_org('경합B')), 21000000) qb
  from (select pg_temp.t_rfq('T-RACE-1') rq) s;
-- 판은 다음 문장에서 읽는다 (같은 문장 안에서는 방금 넣은 견적이 보이지 않는다)
select rq || ' ' || qa || ' ' || (select revision from public.cro_quotes where id = qa) || ' ' || qb || ' ' || (select revision from public.cro_quotes where id = qb) from ids;
SQL
} | q | tail -n 1)
[[ -n "${RB:-}" ]] || fail "준비 데이터를 만들지 못했습니다"

# A 는 선정한 뒤 1.5초 동안 커밋하지 않는다. B 는 그 사이 다른 견적을 선정한다 → A 의 요청 행 잠금을 기다린다
q -c "begin; select public.select_quote('$RQ', '$QA', null, $RA)::text; select pg_sleep(1.5); commit;" >"$TMPD/a" 2>&1 &
PID_A=$!
sleep 0.3
START=$(date +%s%N)
q -c "select public.select_quote('$RQ', '$QB', null, $RB)::text;" >"$TMPD/b" 2>&1
END=$(date +%s%N)
wait $PID_A || fail "A 연결 실패: $(cat "$TMPD/a")"
WAITED_MS=$(( (END - START) / 1000000 ))
A="$(grep -v '^$' "$TMPD/a" | head -n 1)"; B="$(cat "$TMPD/b")"
[[ "$A" == *'"ok": true'* ]] || fail "먼저 잠근 선정이 성공해야 합니다: $A"
[[ "$B" == *'already_selected'* ]] || fail "두 번째 선정은 already_selected 여야 합니다: $B"
(( WAITED_MS >= 800 )) || fail "두 번째 선정이 잠금을 기다리지 않았습니다 (${WAITED_MS}ms)"
N="$(q -c "select count(*) from public.rfq_awards where rfq_id = '$RQ'")"
[[ "$N" == "1" ]] || fail "수주 기록은 1건이어야 합니다 (실제 $N)"
SEL="$(q -c "select selected_quote_id from public.rfq_requests where id = '$RQ'")"
[[ "$SEL" == "$QA" ]] || fail "선정 견적은 A 여야 합니다"
echo "  동시 선정: 한 건 성공, 다른 한 건 already_selected (${WAITED_MS}ms 대기), 수주 기록 1건"

# 수정과 선정이 겹칠 때: 기관 재제출(save_quote)이 요청 행을 잡고 있는 동안 의뢰자가 옛 판으로 선정 → 기다린 뒤 quote_changed
read -r RQ2 Q2 R2 INV2 TOK2 < <({ cat "$ROOT/tests/db/support/fixtures.sql"; cat <<'SQL'
create temp table ids2 as
  select rq, i, pg_temp.t_quote(i, 30000000) q from (
    select rq, pg_temp.t_invite(rq, pg_temp.t_org('경합C')) i from (select pg_temp.t_rfq('T-RACE-2') rq) s) s2;
select rq || ' ' || q || ' ' || (select revision from public.cro_quotes where id = q) || ' ' || i || ' ' || (select token from public.rfq_invites where id = i) from ids2;
SQL
} | q | tail -n 1)
[[ -n "${TOK2:-}" ]] || fail "두 번째 준비 데이터를 만들지 못했습니다"
q -c "begin; select public.save_quote('$INV2', jsonb_build_object('total_amount', 25000000, 'pdf_path', 'x/q.pdf', 'start_date', current_date, 'valid_until', current_date + 30), '[]'::jsonb, true, null, '$TOK2')->>'ok'; select pg_sleep(1.5); commit;" >"$TMPD/c" 2>&1 &
PID_C=$!
sleep 0.3
D="$(q -c "select public.select_quote('$RQ2', '$Q2', null, $R2)::text;" 2>&1)"
wait $PID_C || fail "수정 연결 실패: $(cat "$TMPD/c")"
[[ "$(grep -v '^$' "$TMPD/c" | head -n 1)" == "true" ]] || fail "재제출이 성공해야 합니다: $(cat "$TMPD/c")"
[[ "$D" == *'quote_changed'* ]] || fail "옛 판 선정은 quote_changed 여야 합니다: $D"
N2="$(q -c "select count(*) from public.rfq_awards where rfq_id = '$RQ2'")"
[[ "$N2" == "0" ]] || fail "옛 판 선정은 수주 기록을 남기지 않아야 합니다 (실제 $N2)"
echo "  수정 중 선정: 옛 판 선정 거절(quote_changed), 수주 기록 0건"
