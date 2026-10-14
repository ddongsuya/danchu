#!/usr/bin/env bash
# Install MiroFish (AGPL-3.0) as a separate local tool for Danchu, pinned to one commit.
# MiroFish is run unmodified and is never linked into or served by Danchu.
#
# Usage: tools/mirofish/setup.sh
#   MIROFISH_HOME  install root (default: $HOME/.cache/danchu-mirofish)
#                  src/   git checkout at the pinned commit
#                  venv/  backend virtualenv (uv sync --frozen)
#                  logs/  backend.log (written by start-backend.sh)
# Needs git, uv and Python 3.11 or 3.12. The venv takes about 7 GB (torch and
# CUDA wheels come in through camel-oasis) and the first sync takes about 5 min.
# Safe to run again: it only fetches, checks out and syncs what is missing.
set -euo pipefail

PIN="7657031ac01184afe2cb220f5ee3545573b5e843"
REPO_URL="https://github.com/666ghj/MiroFish.git"
# Absolute, symlink-free MIROFISH_HOME: the script changes directory before
# using it (a relative venv would land inside the checkout), and python-dotenv
# searches the physical path.
MIROFISH_HOME="${MIROFISH_HOME:-$HOME/.cache/danchu-mirofish}"
mkdir -p -- "$MIROFISH_HOME"
MIROFISH_HOME="$(cd -P -- "$MIROFISH_HOME" && pwd -P)"
SRC="$MIROFISH_HOME/src"
VENV="$MIROFISH_HOME/venv"

say() { printf '[setup] %s\n' "$*"; }
die() { printf '[setup] ERROR: %s\n' "$*" >&2; exit 1; }

# MiroFish loads a .env with override=True (backend/app/config.py:8-14). When
# src/.env is absent it searches upward from backend/app with find_dotenv, and
# the simulation script also reads backend/.env. Any of these files would
# override the shell environment, and placeholder LLM_BOOST_* lines from
# .env.example would silently route Reddit agents to another provider.
# start-backend.sh also sets PYTHON_DOTENV_DISABLED=1; this check runs on the
# physical path because that is the one find_dotenv walks.
check_dotenv() {
  local found=() dir
  for f in "$SRC/.env" "$SRC/backend/.env" "$SRC/backend/app/.env"; do
    [[ -e "$f" ]] && found+=("$f")
  done
  dir="$(dirname "$SRC")"
  while :; do
    [[ -e "$dir/.env" ]] && found+=("$dir/.env")
    [[ "$dir" == "/" ]] && break
    dir="$(dirname "$dir")"
  done
  if ((${#found[@]})); then
    printf '[setup] ERROR: refusing to continue, MiroFish would load these .env files with override=True:\n' >&2
    printf '          %s\n' "${found[@]}" >&2
    printf '        Move them away and pass keys as environment variables instead.\n' >&2
    exit 1
  fi
}

command -v git >/dev/null 2>&1 || die "git is not installed"
command -v uv >/dev/null 2>&1 || die "uv is not installed (https://docs.astral.sh/uv/getting-started/installation/)"

say "MIROFISH_HOME=$MIROFISH_HOME"
say "pinned commit $PIN"
check_dotenv

# Disk check: the synced venv is about 7 GB.
avail_kb="$(df -Pk "$MIROFISH_HOME" | awk 'NR==2 {print $4}')"
if [[ -n "${avail_kb:-}" && "$avail_kb" -lt $((9 * 1024 * 1024)) && ! -x "$VENV/bin/python" ]]; then
  say "WARNING: only $((avail_kb / 1024 / 1024)) GB free under $MIROFISH_HOME; the venv needs about 7 GB"
fi

# Python 3.11 or 3.12 (backend/pyproject.toml: requires-python >=3.11,<3.13).
if py="$(uv python find '>=3.11,<3.13' 2>/dev/null)"; then
  say "python: $("$py" -c 'import sys; print(".".join(map(str, sys.version_info[:3])))') ($py)"
else
  say "no local Python 3.11/3.12 found; uv will try to download one (or run: uv python install 3.12)"
fi

# 1. Source checkout at the pinned commit.
if [[ ! -d "$SRC/.git" ]]; then
  [[ -e "$SRC" ]] && die "$SRC exists but is not a git checkout; remove it or pick another MIROFISH_HOME"
  say "cloning $REPO_URL into $SRC"
  git init -q "$SRC"
  git -C "$SRC" remote add origin "$REPO_URL"
fi
origin="$(git -C "$SRC" remote get-url origin 2>/dev/null || true)"
[[ "$origin" == "$REPO_URL" ]] || die "$SRC has origin '$origin', expected $REPO_URL"

if ! git -C "$SRC" cat-file -e "$PIN^{commit}" 2>/dev/null; then
  say "fetching commit $PIN"
  if ! git -C "$SRC" fetch -q --depth 1 origin "$PIN"; then
    say "shallow fetch by SHA failed, fetching full history"
    git -C "$SRC" fetch -q origin
  fi
fi
git -C "$SRC" cat-file -e "$PIN^{commit}" 2>/dev/null || die "commit $PIN is not available from $REPO_URL"

head="$(git -C "$SRC" rev-parse -q --verify HEAD 2>/dev/null || true)"
if [[ "$head" != "$PIN" ]]; then
  if [[ -n "$head" && -n "$(git -C "$SRC" status --porcelain)" ]]; then
    die "$SRC has modified or untracked files; MiroFish must run unmodified. Inspect with: git -C $SRC status"
  fi
  say "checking out $PIN"
  git -C "$SRC" -c advice.detachedHead=false checkout -q --detach "$PIN"
fi
head="$(git -C "$SRC" rev-parse HEAD)"
[[ "$head" == "$PIN" ]] || die "HEAD is $head, expected $PIN"
# Untracked files count too (MiroFish's .gitignore already covers uploads/, logs/,
# __pycache__/ and .env): backend/ is first on sys.path, so an added module could
# shadow a dependency.
if [[ -n "$(git -C "$SRC" status --porcelain)" ]]; then
  die "$SRC has modified or untracked files; MiroFish must run unmodified. Inspect with: git -C $SRC status"
fi
say "source ok: HEAD=$head (clean)"
check_dotenv

# 2. Backend virtualenv from the locked dependencies.
say "uv sync --frozen (backend) into $VENV; the first run downloads about 7 GB and takes about 5 min"
(
  cd "$SRC/backend"
  UV_PROJECT_ENVIRONMENT="$VENV" uv sync --frozen
)
"$VENV/bin/python" - <<'PY' || die "the venv is incomplete; rerun this script"
import sys
from importlib.metadata import version
import flask, openai, requests, zep_cloud  # noqa: F401
assert (3, 11) <= sys.version_info[:2] < (3, 13), sys.version
print(f"[setup] venv ok: python {sys.version.split()[0]}, flask {version('flask')}, "
      f"openai {version('openai')}, zep-cloud {version('zep-cloud')}")
PY
mkdir -p "$MIROFISH_HOME/logs"

# 3. Environment check. Names only, never values.
say "environment (names only):"
missing=0
for name in LLM_API_KEY ZEP_API_KEY; do
  if [[ -n "${!name:-}" ]]; then say "  $name: set"; else say "  $name: MISSING (required)"; missing=1; fi
done
if [[ -n "${LLM_BASE_URL:-}" ]]; then say "  LLM_BASE_URL: set"; else say "  LLM_BASE_URL: not set, default https://api.openai.com/v1"; fi
if [[ -n "${LLM_MODEL_NAME:-}" ]]; then say "  LLM_MODEL_NAME: set"; else say "  LLM_MODEL_NAME: not set, default gpt-4o-mini"; fi
for prefix in LLM_BOOST_ LANGFUSE TRACEROOT AGENTOPS ZEP_API_URL; do
  while IFS= read -r name; do
    [[ -n "$name" ]] && say "  $name: set here, start-backend.sh will drop it"
  done < <(compgen -e | grep "^$prefix" || true)
done

say "done. Next:"
say "  export LLM_API_KEY=... ZEP_API_KEY=...   (OpenAI-compatible LLM key and Zep Cloud key)"
say "  tools/mirofish/start-backend.sh"
say "  \"$VENV/bin/python\" tools/mirofish/run.py --requirement <id> --dry-run"
if ((missing)); then say "note: required keys are not set in this shell yet"; fi
