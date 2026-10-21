#!/usr/bin/env bash
# Start the local MiroFish backend for tools/mirofish/run.py.
#
# Usage: tools/mirofish/start-backend.sh [--foreground | --stop | --status]
#   (default)     start detached, wait until GET /health is ok, then return
#   --foreground  same, but stay attached until the backend exits (Ctrl-C stops it)
#   --stop        stop the backend recorded in the PID file. MiroFish first drains
#                 the graph-memory writes of every active simulation, about 11 min
#                 each at most; the wait limit is MIROFISH_STOP_WAIT_S
#                 (default 720 s per active simulation)
#   --status      print whether it is running
#
# Required: LLM_API_KEY, ZEP_API_KEY. Optional: LLM_BASE_URL, LLM_MODEL_NAME.
# Paths: MIROFISH_HOME (default $HOME/.cache/danchu-mirofish), with overrides
# MIROFISH_SRC (default $MIROFISH_HOME/src) and MIROFISH_VENV (default
# $MIROFISH_HOME/venv). Relative paths are resolved against the current
# directory. Port: MIROFISH_PORT (default 5001).
#
# The backend has no authentication, returns tracebacks and allows any web
# origin (CORS '*' on /api/*), so it is bound to 127.0.0.1 only (FLASK_HOST,
# backend/run.py:40-41). Loopback does not stop a page open in a local browser
# from calling it, so stop it with --stop when a run is done, and do not leave it
# running on a machine that is also used for web browsing.
#
# Environment: the backend gets an allowlist of variables (the two keys, the LLM
# settings, proxy and CA settings, Hugging Face cache settings without tokens,
# locale). The key values are handed over through the environment, never on a
# command line. .env loading is turned off (PYTHON_DOTENV_DISABLED=1) for the
# backend and every simulation subprocess. HOME is passed unchanged, so files
# under it stay readable by the backend like by any other process of this user.
set -euo pipefail

PIN="7657031ac01184afe2cb220f5ee3545573b5e843"

# Absolute, symlink-free paths: the script changes directory before using them,
# and python-dotenv searches the physical path.
canon() {
  if [[ -d "$1" ]]; then
    (cd -P -- "$1" && pwd -P)
  else
    case "$1" in /*) printf '%s\n' "$1" ;; *) printf '%s/%s\n' "$(pwd -P)" "$1" ;; esac
  fi
}
MIROFISH_HOME="$(canon "${MIROFISH_HOME:-$HOME/.cache/danchu-mirofish}")"
SRC="$(canon "${MIROFISH_SRC:-$MIROFISH_HOME/src}")"
VENV="$(canon "${MIROFISH_VENV:-$MIROFISH_HOME/venv}")"
PORT="${MIROFISH_PORT:-5001}"
HOST="127.0.0.1"
LOG_DIR="$MIROFISH_HOME/logs"
LOG="$LOG_DIR/backend.log"
PID_FILE="$MIROFISH_HOME/backend.pid"
HEALTH_URL="http://$HOST:$PORT/health"
HEALTH_WAIT_S="${MIROFISH_HEALTH_WAIT_S:-90}"

say() { printf '[backend] %s\n' "$*"; }
die() { printf '[backend] ERROR: %s\n' "$*" >&2; exit 1; }
lc() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }

pid_alive() { [[ -n "${1:-}" ]] && kill -0 "$1" 2>/dev/null; }
read_pid() { [[ -f "$PID_FILE" ]] && tr -dc '0-9' <"$PID_FILE" || true; }
pid_args() {
  if [[ -r "/proc/$1/cmdline" ]]; then tr '\0' ' ' <"/proc/$1/cmdline"; else ps -p "$1" -o args= 2>/dev/null || true; fi
}
pid_cwd() {
  if [[ -e "/proc/$1/cwd" ]]; then
    readlink "/proc/$1/cwd" 2>/dev/null || true
  elif command -v lsof >/dev/null 2>&1; then
    lsof -a -p "$1" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1
  fi
}
# The backend is "$VENV/bin/python run.py" with its working directory in $SRC/backend.
is_mirofish_pid() {
  local args cwd
  args="$(pid_args "$1")"
  [[ "$args" == "$VENV/bin/python run.py"* ]] || return 1
  cwd="$(pid_cwd "$1")"
  [[ -z "$cwd" || "$cwd" == "$SRC/backend" ]]
}
healthy() {
  local out
  out="$(curl -fsS --noproxy '*' -m 3 "$HEALTH_URL" 2>/dev/null)" || return 1
  [[ "$out" == *'"status"'*'"ok"'* ]]
}
port_open() { (exec 3<>"/dev/tcp/$HOST/$PORT") 2>/dev/null; }
api_get() { curl -fsS --noproxy '*' -m 10 "http://$HOST:$PORT$1" 2>/dev/null; }

# Simulations with an active run state. Shutdown drains their graph-memory
# writes one by one (simulation_runner.py:1460-1530, up to 665 s each).
active_sims() {
  local list id st
  list="$(api_get /api/simulation/list)" || return 0
  for id in $(printf '%s' "$list" | grep -o '"simulation_id": *"sim_[0-9a-f]*"' | grep -o 'sim_[0-9a-f]*' | sort -u); do
    st="$(api_get "/api/simulation/$id/run-status" | grep -o '"runner_status": *"[a-z]*"' | grep -o '"[a-z]*"$' | tr -d '"')" || true
    case "$st" in starting|running|paused|stopping) printf '%s %s\n' "$id" "$st" ;; esac
  done
}

stop_backend() {
  local pid active n wait_s i
  pid="$(read_pid)"
  if ! pid_alive "$pid"; then
    say "not running (no live PID in $PID_FILE)"
    rm -f "$PID_FILE"
    return 0
  fi
  is_mirofish_pid "$pid" || die "PID $pid from $PID_FILE is not '$VENV/bin/python run.py' in $SRC/backend; not touching it"
  active=""
  if healthy; then active="$(active_sims)"; fi
  n=0
  if [[ -n "$active" ]]; then n="$(printf '%s\n' "$active" | wc -l | tr -d ' ')"; fi
  wait_s="${MIROFISH_STOP_WAIT_S:-$((720 * (n > 1 ? n : 1)))}"
  [[ "$wait_s" =~ ^[0-9]+$ ]] || die "MIROFISH_STOP_WAIT_S must be a number of seconds"
  if ((n > 0)); then
    say "active simulations; MiroFish drains their graph-memory writes to Zep before it exits:"
    printf '%s\n' "$active" | sed 's/^/[backend]   /'
    say "a SIGKILL during that drain loses the pending writes and leaves run_state.json at running or stopping"
  fi
  say "stopping PID $pid (SIGTERM), waiting up to ${wait_s}s"
  kill -TERM "$pid"
  for ((i = 1; i <= wait_s; i++)); do
    if ! pid_alive "$pid"; then rm -f "$PID_FILE"; say "stopped after ${i}s"; return 0; fi
    if ((i % 30 == 0)); then say "still stopping after ${i}s (graph-memory drain; see $LOG)"; fi
    sleep 1
  done
  die "PID $pid still alive after ${wait_s}s; it may still be draining graph-memory writes (see $LOG). Run --stop again later or raise MIROFISH_STOP_WAIT_S. kill -KILL $pid drops the pending Zep writes and leaves stale running or stopping state, so use it only when the log shows no progress"
}

mode="${1:-start}"
case "$mode" in
  start|--foreground) ;;
  --stop) stop_backend; exit 0 ;;
  --status)
    pid="$(read_pid)"
    if pid_alive "$pid" && healthy; then say "running, PID $pid, $HEALTH_URL ok"; exit 0; fi
    if pid_alive "$pid"; then say "PID $pid alive but $HEALTH_URL not ok"; exit 1; fi
    say "not running"; exit 1 ;;
  -h|--help) sed -n '2,/^set -euo/p' "$0" | sed '$d'; exit 0 ;;
  *) die "unknown option '$mode' (use --foreground, --stop or --status)" ;;
esac

# --- preconditions -----------------------------------------------------------
[[ -n "${LLM_API_KEY:-}" ]] || die "LLM_API_KEY is empty. Export an OpenAI-compatible key first (the value is never printed)"
[[ -n "${ZEP_API_KEY:-}" ]] || die "ZEP_API_KEY is empty. Export a Zep Cloud key first (the value is never printed)"
LLM_BASE_URL="${LLM_BASE_URL:-https://api.openai.com/v1}"
LLM_MODEL_NAME="${LLM_MODEL_NAME:-gpt-4o-mini}"

# MiroFish needs an OpenAI-compatible provider: it sends temperature to every
# model not named gpt-5*, which current Claude models reject. Only the two
# MiroFish variables are looked at here, and nothing is printed.
base_lc="$(lc "${LLM_BASE_URL%/}")"
case "$base_lc" in
  *anthropic*) die "LLM_BASE_URL points at an Anthropic endpoint; MiroFish needs an OpenAI-compatible provider" ;;
esac
case "$LLM_API_KEY" in
  sk-ant-*) die "LLM_API_KEY looks like an Anthropic key (sk-ant-); use an OpenAI-compatible key" ;;
esac
case "$(lc "$LLM_MODEL_NAME")" in
  *claude*) say "WARNING: LLM_MODEL_NAME contains 'claude'. MiroFish sends temperature on every call, which current Claude models reject; use an OpenAI-compatible model" ;;
esac

[[ -f "$SRC/backend/run.py" ]] || die "no MiroFish checkout at $SRC (run tools/mirofish/setup.sh)"
[[ -x "$VENV/bin/python" ]] || die "no venv at $VENV (run tools/mirofish/setup.sh)"
head="$(git -C "$SRC" rev-parse HEAD 2>/dev/null || true)"
[[ "$head" == "$PIN" ]] || die "$SRC is at '${head:-unknown}', expected pinned commit $PIN (run setup.sh)"
# Untracked files count too: backend/ is first on sys.path (backend/run.py:19),
# so an added module could shadow a dependency. MiroFish's .gitignore already
# covers uploads/, logs/, __pycache__/ and .env.
[[ -z "$(git -C "$SRC" status --porcelain 2>/dev/null)" ]] \
  || die "$SRC has modified or untracked files; MiroFish must run unmodified. Inspect with: git -C $SRC status"

# .env files: config.py loads one with override=True (backend/app/config.py:8-14)
# and every simulation subprocess loads one again when /start spawns it
# (scripts/run_parallel_simulation.py:93-103). PYTHON_DOTENV_DISABLED=1 below
# turns all of that off; refusing a checkout that holds one is a second check.
dotenvs=()
for f in "$SRC/.env" "$SRC/backend/.env" "$SRC/backend/app/.env"; do [[ -e "$f" ]] && dotenvs+=("$f"); done
if ((${#dotenvs[@]})); then
  printf '[backend] ERROR: refusing to start, MiroFish would load these .env files with override=True:\n' >&2
  printf '            %s\n' "${dotenvs[@]}" >&2
  exit 1
fi

# Already running?
old_pid="$(read_pid)"
if pid_alive "$old_pid"; then
  if healthy; then
    say "already running, PID $old_pid, $HEALTH_URL ok (stop it first to change keys: $0 --stop)"
    exit 0
  fi
  die "PID $old_pid from $PID_FILE is alive but $HEALTH_URL is not ok; run $0 --stop"
fi
rm -f "$PID_FILE"
port_open && die "port $PORT on $HOST is already in use by another process"

# --- launch ---------------------------------------------------------------------
mkdir -p "$LOG_DIR"
export FLASK_HOST="$HOST" FLASK_PORT="$PORT" LLM_API_KEY ZEP_API_KEY LLM_BASE_URL LLM_MODEL_NAME
export LANG="${LANG:-C.UTF-8}" PYTHONUNBUFFERED=1 PYTHONIOENCODING=utf-8 PYTHON_DOTENV_DISABLED=1
# Allowlist of variable names, matched in full by the launcher below. Proxy and
# CA settings are for outbound HTTPS; HF_* without tokens (twhin-bert-base is public).
KEEP_RE='PATH|HOME|LANG|LC_ALL|LC_CTYPE|TZ|TMPDIR|USER'
KEEP_RE+='|PYTHONUNBUFFERED|PYTHONIOENCODING|PYTHON_DOTENV_DISABLED|FLASK_HOST|FLASK_PORT'
KEEP_RE+='|LLM_API_KEY|ZEP_API_KEY|LLM_BASE_URL|LLM_MODEL_NAME'
KEEP_RE+='|HTTPS_PROXY|https_proxy|HTTP_PROXY|http_proxy|NO_PROXY|no_proxy|ALL_PROXY|all_proxy'
KEEP_RE+='|SSL_CERT_FILE|SSL_CERT_DIR|REQUESTS_CA_BUNDLE|CURL_CA_BUNDLE'
KEEP_RE+='|HF_(?!.*TOKEN)\w+|TRANSFORMERS_\w+|TOKENIZERS_PARALLELISM|OMP_NUM_THREADS'
# Like 'env -i NAME=value ... python run.py', but the values stay out of every
# argv (setsid, nohup and this launcher show only names and paths in ps).
LAUNCH='import os, re, sys
py, keep = sys.argv[1], re.compile(sys.argv[2])
env = {k: v for k, v in os.environ.items() if keep.fullmatch(k)}
os.execve(py, [py, "run.py"], env)'

say "MIROFISH_HOME=$MIROFISH_HOME"
say "source $SRC (commit ${PIN:0:7}), venv $VENV"
say "env passed by name: LLM_API_KEY ZEP_API_KEY LLM_BASE_URL LLM_MODEL_NAME FLASK_HOST FLASK_PORT PYTHON_DOTENV_DISABLED (+ proxy/CA, HF settings without tokens, locale)"
say "binding $HOST:$PORT, log $LOG"
say "stop it when the run is done ($0 --stop): no authentication, any web origin may call it"
{
  printf '\n===== %s start-backend.sh (%s) =====\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$mode"
} >>"$LOG"

cd "$SRC/backend"
launch=("$VENV/bin/python" -I -c "$LAUNCH" "$VENV/bin/python" "$KEEP_RE")
if [[ "$mode" == "--foreground" ]]; then
  "${launch[@]}" >>"$LOG" 2>&1 &
else
  # setsid + nohup: survives the terminal that started it.
  if command -v setsid >/dev/null 2>&1; then
    setsid nohup "${launch[@]}" >>"$LOG" 2>&1 </dev/null &
  else
    nohup "${launch[@]}" >>"$LOG" 2>&1 </dev/null &
  fi
fi
pid=$!
echo "$pid" >"$PID_FILE"
say "started PID $pid, waiting up to ${HEALTH_WAIT_S}s for $HEALTH_URL"

for _ in $(seq 1 "$HEALTH_WAIT_S"); do
  if ! pid_alive "$pid"; then
    rm -f "$PID_FILE"
    printf '[backend] ERROR: the backend exited during startup. Last log lines:\n' >&2
    tail -n 25 "$LOG" >&2 || true
    exit 1
  fi
  if healthy; then
    say "healthy: $HEALTH_URL"
    break
  fi
  sleep 1
done
healthy || die "no healthy answer from $HEALTH_URL after ${HEALTH_WAIT_S}s; see $LOG (PID $pid still recorded)"

if [[ "$mode" == "--foreground" ]]; then
  trap 'say "forwarding stop to PID $pid"; kill -TERM "$pid" 2>/dev/null || true' INT TERM
  set +e
  wait "$pid"
  rc=$?
  # wait returns early when a trapped signal arrives; wait again for the real exit.
  while pid_alive "$pid"; do wait "$pid"; rc=$?; done
  set -e
  rm -f "$PID_FILE"
  say "backend exited with status $rc"
  exit "$rc"
fi
say "stop it with: $0 --stop"
