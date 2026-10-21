#!/usr/bin/env python3
"""Headless driver for a local MiroFish backend (Danchu internal tool).

MiroFish (AGPL-3.0) runs as a separate local process, started with
start-backend.sh. This script only talks to its REST API; it never imports
MiroFish code. The output is a scenario-exploration report, not a forecast.

Pipeline (verified against MiroFish 7657031, backend/app/api/*.py):
  1 ontology  POST /api/graph/ontology/generate   (multipart, synchronous LLM call)
  2 build     POST /api/graph/build + GET /api/graph/task/<task_id>
  3 create    POST /api/simulation/create          (twitter + reddit both on)
  4 prepare   GET  /api/simulation/entities/<graph_id> (cost guard), then
              POST /api/simulation/prepare + POST /api/simulation/prepare/status
  5 start     POST /api/simulation/start           (parallel, graph memory on)
  6 run       GET  /api/simulation/<sid>/run-status + POST /api/simulation/env-status
  7 finalize  POST /api/simulation/close-env (only once env_alive), fallback POST /api/simulation/stop
  8 report    POST /api/report/generate + POST /api/report/generate/status (task_id only)
              GET  /api/report/<report_id>
  9 cleanup   DELETE /api/graph/delete/<graph_id>, DELETE /api/graph/project/<project_id> (--cleanup)

Run it with the MiroFish venv python (it has 'requests'):
  "$MIROFISH_HOME/venv/bin/python" tools/mirofish/run.py --requirement <id> [--dry-run]

Replicas (run the same question 2 to 3 times and keep recurring themes) must be
separate full runs, each with a new project and graph. Every run writes its
agents' activity into the project's Zep graph and the report agent reads that
graph, so a second simulation on the same graph reports on both runs together.
--project-id and --force-restart therefore refuse a graph that another run
already wrote to, unless --allow-shared-graph is given.

In resume modes MiroFish answers the requirement stored on the project when the
ontology was generated; --requirement is checked against it, never applied.

Exit codes: 0 ok, 1 step failed, 2 invalid input, 3 stopped by a guard (cost,
shared graph or round check), 4 report saved but cleanup failed, 130 interrupted.
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import ipaddress
import json
import math
import os
import re
import signal
import sys
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

PINNED_COMMIT = "7657031ac01184afe2cb220f5ee3545573b5e843"
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_SEED_DIR = SCRIPT_DIR / "seed"
DEFAULT_RUNS_DIR = SCRIPT_DIR / "runs"
# Same default port as start-backend.sh (MIROFISH_PORT, default 5001).
DEFAULT_BASE_URL = f"http://127.0.0.1:{os.environ.get('MIROFISH_PORT') or 5001}"

# Every call carries this header. MiroFish matches it exactly against its
# locales/ files (en, zh); anything else silently falls back to Chinese
# (backend/app/utils/locale.py:28-32). Background threads copy the locale of
# the request that started them.
ACCEPT_LANGUAGE = "en"

# Client-side HTTP timeouts in seconds. Every request passes one explicitly.
T_HEALTH = 10
T_POLL = 30
T_ONTOLOGY = 900  # synchronous LLM call inside the request (graph.py:359-366)
T_BUILD_POST = 120
T_CREATE = 60
T_ENTITIES = 300  # reads every node from Zep
T_PREPARE_POST = 300  # counts entities against Zep before returning
T_FETCH = 120
T_START = 300
# With force=true, /start first stops a running or failed-with-updater run and
# joins its monitor for up to 665 s (simulation.py:1621-1640,
# simulation_runner.py:1026-1040).
T_START_FORCE = 720
T_CLOSE_ENV = 150  # server waits up to the 'timeout' we send (60 s)
T_STOP = 900  # /stop can block ~665 s while the Zep queue drains (simulation_runner.py:1026-1040)
T_REPORT_POST = 120
T_DELETE = 300

TERMINAL_OK = {"completed", "stopped"}
TERMINAL_ALL = {"completed", "stopped", "failed"}
ATTACHABLE = {"running", "starting", "stopping"}
# Default agent active hours (run_parallel_simulation.py:1068-1072).
ACTIVE_HOURS = range(8, 23)
MIN_SIM_HOURS = 24  # critic P1-9: at least 30 rounds of 60 min
MIN_ACTIVE_ROUNDS = 15  # 30 rounds x 60 min from 00:00 gives 15 rounds in 08-22
STALL_S = 300  # no progress this long and a dead process: the run has no monitor
SIM_ID_RE = re.compile(r"^sim_[0-9a-f]{12}$")
PROJECT_ID_RE = re.compile(r"^proj_[0-9a-f]{12}$")
REQ_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")

SECRET_PATTERNS = [
    ("OpenAI-style key", re.compile(r"\bsk-[A-Za-z0-9_-]{20,}")),
    ("Anthropic key", re.compile(r"\bsk-ant-[A-Za-z0-9_-]{10,}")),
    ("AWS access key id", re.compile(r"\bAKIA[0-9A-Z]{16}\b")),
    ("private key block", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("JWT", re.compile(r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}")),
    ("GitHub token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}")),
    ("Zep key", re.compile(r"\bz_[A-Za-z0-9_-]{30,}")),
]
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")

# Requirements whose own text describes the opt-in internal billing draft. They are
# sent only together with seed/optional/ (--include-internal), i.e. after the Danchu
# team has agreed to upload that draft (see seed/requirements/<id>.ko.txt).
NEEDS_INTERNAL = {"R2-fee-acceptance"}

# Entities that would become regulator or standards-body agents. MiroFish's ontology
# prompt asks for such actors (backend/app/services/ontology_generator.py), while the
# requirements forbid them, so the run stops before profiles are generated.
# "regulator(?!y)" keeps "RegulatoryConsultant"-style persona types out.
REGULATOR_TYPE_RE = re.compile(
    r"regulator(?!y)|regulatory_?(agency|authority|body|office)|government|ministry|standards?_?(body|organi[sz]ation)",
    re.IGNORECASE)
REGULATOR_NAME_RE = re.compile(
    r"규제\s?(기관|당국)|정부\s?(기관|부처)|식약처|식품의약품안전처|"
    r"(?<![A-Za-z])(FDA|EMA|MFDS|PMDA|NMPA|OECD|ICH)(?![A-Za-z])|regulator(?!y)|regulatory (agency|authority)",
    re.IGNORECASE)

requests: Any = None  # imported lazily so --dry-run works without it


# ---------------------------------------------------------------- utilities

def utcnow() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def redact(text: Any) -> str:
    """Mask key-like strings in text relayed from MiroFish before it is printed or saved.

    Providers sometimes echo key fragments in error bodies, and MiroFish passes
    those through. The literal LLM_API_KEY / ZEP_API_KEY values are masked too
    when they are set in this process's environment.
    """
    s = str(text if text is not None else "")
    for name in ("LLM_API_KEY", "ZEP_API_KEY"):
        value = os.environ.get(name) or ""
        if len(value) >= 8:
            s = s.replace(value, f"[{name}]")
    for label, pattern in SECRET_PATTERNS:
        s = pattern.sub(f"[redacted {label}]", s)
    return s


def say(msg: str) -> None:
    print(f"[{dt.datetime.now(dt.timezone.utc).strftime('%H:%M:%SZ')}] {redact(msg)}", flush=True)


def warn(msg: str) -> None:
    say(f"WARNING: {msg}")


def short(text: Any, limit: int = 600) -> str:
    s = str(text if text is not None else "").strip()
    return s if len(s) <= limit else s[: limit - 3] + "..."


def last_line(text: Any) -> str:
    lines = [ln.strip() for ln in str(text or "").strip().splitlines() if ln.strip()]
    return lines[-1] if lines else ""


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


_API_ERROR_RE = re.compile(r"status_code:\s*(\d{3}),\s*body:\s*(.{0,300})", re.S)


def condense_error(text: Any) -> tuple[str, int | None]:
    """Zep/HTTP SDK errors embed the full response-header dict; keep 'status_code ... body ...'."""
    s = str(text or "")
    m = _API_ERROR_RE.search(s)
    if not m:
        return short(s, 500), None
    code = int(m.group(1))
    head = s[: s.find("headers:")].strip() if "headers:" in s else ""
    body = m.group(2).strip().splitlines()[0] if m.group(2).strip() else ""
    return short(f"{head} upstream HTTP {code}: {body}".strip(), 500), code


class StepError(Exception):
    """A pipeline step failed. Carries the MiroFish error text and a hint."""

    def __init__(self, step: str, message: str, *, http_status: int | None = None,
                 mirofish_error: str | None = None, hint: str | None = None):
        super().__init__(message)
        self.step = step
        self.message = redact(message)
        self.http_status = http_status
        if mirofish_error and "headers:" in mirofish_error and "status_code" in mirofish_error:
            mirofish_error = condense_error(mirofish_error)[0]
        self.mirofish_error = redact(mirofish_error) if mirofish_error else mirofish_error
        self.hint = hint


class InputError(Exception):
    pass


class GuardAbort(Exception):
    """Stopped before spending: kind is cost_guard, graph_guard or round_guard (exit 3)."""

    def __init__(self, kind: str, message: str, hint: str):
        super().__init__(message)
        self.kind = kind
        self.message = message
        self.hint = hint


# ---------------------------------------------------------------- run log

class RunLog:
    """run.json writer. Holds ids, timestamps, statuses and counts, never secrets."""

    def __init__(self, path: Path | None):
        self.path = path
        self.data: dict[str, Any] = {
            "tool": "danchu tools/mirofish/run.py",
            "note": "Scenario exploration with LLM personas, not a forecast.",
            "mirofish_expected_commit": PINNED_COMMIT,
            "started_at": utcnow(),
            "finished_at": None,
            "outcome": "running",
            "ids": {},
            "counts": {},
            "steps": [],
            "error": None,
        }

    def set(self, key: str, value: Any) -> None:
        self.data[key] = value
        self.flush()

    def ids(self, **kw: Any) -> None:
        self.data["ids"].update({k: v for k, v in kw.items() if v is not None})
        self.flush()

    def counts(self, **kw: Any) -> None:
        self.data["counts"].update({k: v for k, v in kw.items() if v is not None})
        self.flush()

    def step_start(self, name: str) -> dict:
        entry = {"step": name, "started_at": utcnow(), "finished_at": None, "status": "running"}
        self.data["steps"].append(entry)
        self.flush()
        return entry

    def step_end(self, entry: dict, status: str, **detail: Any) -> None:
        entry["finished_at"] = utcnow()
        entry["status"] = status
        if detail:
            entry["detail"] = detail
        self.flush()

    def finish(self, outcome: str, error: dict | None = None) -> None:
        self.data["outcome"] = outcome
        self.data["finished_at"] = utcnow()
        if error:
            self.data["error"] = {k: redact(v) if isinstance(v, str) else v for k, v in error.items()}
        for entry in self.data["steps"]:
            if entry["status"] == "running":
                entry["status"] = outcome
                entry["finished_at"] = self.data["finished_at"]
        self.flush()

    def flush(self) -> None:
        if not self.path:
            return
        tmp = self.path.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(self.data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        os.replace(tmp, self.path)


# ---------------------------------------------------------------- HTTP client

def is_loopback(base_url: str) -> bool:
    host = urlparse(base_url).hostname or ""
    if host == "localhost":
        return True
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


class MiroFish:
    def __init__(self, base_url: str):
        self.base = base_url.rstrip("/")
        self.s = requests.Session()
        self.s.headers.update({"Accept-Language": ACCEPT_LANGUAGE, "User-Agent": "danchu-mirofish-run/1"})
        if is_loopback(base_url):
            # Never route local calls through an HTTP(S) proxy from the environment.
            self.s.trust_env = False

    def call(self, step: str, method: str, path: str, *, timeout: float,
             json_body: Any = None, params: dict | None = None, files: Any = None,
             data: dict | None = None, expect: tuple[int, ...] = (200,),
             timeout_ok: bool = False) -> tuple[int | None, dict]:
        url = f"{self.base}{path}"
        try:
            resp = self.s.request(method, url, json=json_body, params=params, files=files,
                                  data=data, timeout=timeout)
        except requests.exceptions.Timeout:
            if timeout_ok:
                return None, {}
            raise StepError(step, f"{method} {path} timed out after {timeout:.0f}s",
                            hint="MiroFish may still be working; check $MIROFISH_HOME/logs/backend.log")
        except requests.exceptions.ConnectionError as exc:
            raise StepError(step, f"cannot reach MiroFish at {self.base} ({type(exc).__name__})",
                            hint="start it with tools/mirofish/start-backend.sh and check GET /health")
        except requests.exceptions.RequestException as exc:
            raise StepError(step, f"{method} {path} failed on the client side ({type(exc).__name__})",
                            hint="check that the backend is still running: tools/mirofish/start-backend.sh --status")
        try:
            body = resp.json()
        except ValueError:
            body = {"_raw": short(resp.text, 300)}
        if not isinstance(body, dict):
            body = {"_raw": short(body, 300)}
        if resp.status_code not in expect:
            err = body.get("error") or body.get("_raw") or resp.reason
            raise StepError(step, f"{method} {path} returned HTTP {resp.status_code}",
                            http_status=resp.status_code, mirofish_error=short(err, 800))
        return resp.status_code, body


# ---------------------------------------------------------------- input validation

def scan_text(name: str, text: str, problems: list[str], notes: list[str]) -> None:
    for label, pattern in SECRET_PATTERNS:
        if pattern.search(text):
            problems.append(f"{name}: looks like it contains a {label}; remove it before uploading")
    emails = sorted(set(EMAIL_RE.findall(text)))
    if emails:
        notes.append(f"{name}: contains {len(emails)} email address(es); they will be sent to the LLM provider and Zep")
    evidence = sum(1 for ln in text.splitlines() if ln.strip().startswith("근거:"))
    if evidence:
        notes.append(f"{name}: {evidence} '근거:' line(s) with repository paths will be uploaded")


def collect_inputs(args: argparse.Namespace, with_files: bool) -> dict:
    """Validate seed files (when uploading) and the requirement. No network."""
    seed = Path(args.seed_dir).resolve()
    out: dict[str, Any] = {"seed_dir": str(seed), "files": [], "notes": []}
    problems: list[str] = []
    notes: list[str] = out["notes"]

    if not seed.is_dir():
        raise InputError(f"seed directory not found: {seed} (expected upload/, requirements/, optional/)")

    chosen: list[Path] = []
    if with_files:
        upload = sorted((seed / "upload").glob("*.md"))
        optional = sorted((seed / "optional").glob("*.md"))
        if not upload:
            raise InputError(f"no seed files: {seed / 'upload'}/*.md matched nothing")
        chosen = list(upload)
        if args.include_internal:
            if not optional:
                if args.requirement in NEEDS_INTERNAL:
                    raise InputError(f"{args.requirement} needs the internal seed, but {seed / 'optional'}/*.md is empty")
                notes.append(f"--include-internal given but {seed / 'optional'}/*.md is empty")
            chosen += optional
        elif optional:
            notes.append(f"{len(optional)} file(s) in optional/ are NOT uploaded (pass --include-internal to add them)")

    total_bytes = 0
    total_chars = 0
    for path in chosen:
        if "_not-for-upload" in path.parts:
            problems.append(f"{path}: refusing to upload anything under _not-for-upload/")
            continue
        raw = path.read_bytes()
        if not raw.strip():
            problems.append(f"{path.name}: file is empty")
            continue
        try:
            text = raw.decode("utf-8")
        except UnicodeDecodeError:
            problems.append(f"{path.name}: not valid UTF-8")
            continue
        scan_text(path.name, text, problems, notes)
        total_bytes += len(raw)
        total_chars += len(text)
        out["files"].append({
            "path": str(path), "name": path.name, "group": path.parent.name,
            "bytes": len(raw), "chars": len(text), "sha256": sha256_bytes(raw),
        })
    if with_files:
        out["total_bytes"] = total_bytes
        out["total_chars"] = total_chars
    if total_bytes > 45 * 1024 * 1024:
        problems.append(f"seed files total {total_bytes} bytes; MiroFish rejects requests over 50 MB (HTTP 413)")
    if total_chars > 50_000:
        notes.append(f"seed text is {total_chars} chars; the ontology LLM sees a 50,000-char sample only")

    if args.requirement:
        if not REQ_ID_RE.match(args.requirement):
            raise InputError(f"invalid requirement id: {args.requirement!r}")
        if with_files and args.requirement in NEEDS_INTERNAL and not args.include_internal:
            raise InputError(f"{args.requirement} describes the internal billing draft and runs only with "
                             f"--include-internal, after the Danchu team has agreed to upload seed/optional/ "
                             f"(see seed/requirements/{args.requirement}.ko.txt)")
        req_dir = seed / "requirements"
        req_path = req_dir / f"{args.requirement}.en.txt"
        if not req_path.is_file():
            available = sorted(p.name[: -len(".en.txt")] for p in req_dir.glob("*.en.txt")) if req_dir.is_dir() else []
            raise InputError(f"requirement file not found: {req_path}. Available ids: {', '.join(available) or 'none'}")
        raw = req_path.read_bytes()
        try:
            req_text = raw.decode("utf-8").strip()
        except UnicodeDecodeError:
            raise InputError(f"{req_path.name}: not valid UTF-8")
        if not req_text:
            raise InputError(f"{req_path.name}: requirement text is empty")
        scan_text(req_path.name, req_text, problems, notes)
        if len(req_text) > 4000:
            notes.append(f"{req_path.name}: requirement is {len(req_text)} chars; long requirements dilute the prompts")
        out["requirement"] = {"id": args.requirement, "path": str(req_path), "chars": len(req_text),
                              "sha256": sha256_bytes(raw), "text": req_text}

    if problems:
        raise InputError("seed validation failed:\n  - " + "\n  - ".join(problems))
    return out


def validate_args(args: argparse.Namespace) -> None:
    parsed = urlparse(args.base_url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise InputError(f"--base-url must be an http(s) URL, got {args.base_url!r}")
    if args.rounds <= 0:
        raise InputError("--rounds must be a positive integer")
    if args.max_agents <= 0:
        raise InputError("--max-agents must be a positive integer")
    if args.parallel_profiles <= 0:
        raise InputError("--parallel-profiles must be a positive integer")
    if args.report_only and not SIM_ID_RE.match(args.report_only):
        raise InputError(f"--report-only expects a simulation id like sim_0123456789ab, got {args.report_only!r}")
    if args.simulation_id and not SIM_ID_RE.match(args.simulation_id):
        raise InputError(f"--simulation-id expects sim_0123456789ab, got {args.simulation_id!r}")
    if args.project_id and not PROJECT_ID_RE.match(args.project_id):
        raise InputError(f"--project-id expects proj_0123456789ab, got {args.project_id!r}")
    if args.mode == "full" and not args.requirement:
        raise InputError("--requirement <id> is required (file seed/requirements/<id>.en.txt)")


# ---------------------------------------------------------------- pipeline

class Pipeline:
    def __init__(self, args: argparse.Namespace, api: MiroFish, log: RunLog, run_dir: Path, inputs: dict | None):
        self.a = args
        self.api = api
        self.log = log
        self.dir = run_dir
        self.inputs = inputs or {}
        self.project_id: str | None = args.project_id
        self.graph_id: str | None = None
        self.sim_id: str | None = args.simulation_id or args.report_only
        self.report_id: str | None = None
        # Requirement id the project really answers (full mode: --requirement;
        # resume modes: the seed file whose text equals the stored requirement).
        self.req_id: str | None = args.requirement if args.mode == "full" else None
        self.ontology_started: dt.datetime | None = None

    # -- helpers
    def save_json(self, name: str, obj: Any) -> None:
        (self.dir / name).write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    @staticmethod
    def mf_paths() -> tuple[str, str]:
        """MIROFISH_HOME and the checkout, as start-backend.sh resolves them."""
        home = os.environ.get("MIROFISH_HOME") or "~/.cache/danchu-mirofish"
        return home, os.environ.get("MIROFISH_SRC") or f"{home}/src"

    def sim_log_hint(self) -> str:
        home, src = self.mf_paths()
        return (f"see {src}/backend/uploads/simulations/{self.sim_id}/simulation.log "
                f"and {home}/logs/backend.log")

    def run_status(self, step: str, sim_id: str | None = None) -> dict:
        _, body = self.api.call(step, "GET", f"/api/simulation/{sim_id or self.sim_id}/run-status", timeout=T_POLL)
        return body.get("data") or {}

    # -- resume checks
    def check_requirement(self, proj: dict) -> None:
        """MiroFish answers project.simulation_requirement (simulation.py:487, report.py:148), not --requirement."""
        stored = str(proj.get("simulation_requirement") or "").strip()
        pid = proj.get("project_id") or self.project_id
        if not stored:
            warn(f"project {pid} has no stored requirement; MiroFish will refuse prepare and report")
            return
        matched = None
        req_dir = Path(self.a.seed_dir).resolve() / "requirements"
        for path in (sorted(req_dir.glob("*.en.txt")) if req_dir.is_dir() else []):
            try:
                if path.read_text(encoding="utf-8").strip() == stored:
                    matched = path.name[: -len(".en.txt")]
                    break
            except (OSError, UnicodeDecodeError):
                continue
        given = self.inputs.get("requirement")
        if given and given["text"].strip() != stored:
            raise InputError(
                f"--requirement {given['id']} does not match the requirement stored on project {pid}, and "
                "MiroFish answers the stored one in prepare and report. "
                + (f"The stored text is seed/requirements/{matched}.en.txt; pass --requirement {matched} "
                   "or leave --requirement out." if matched else
                   "No file in seed/requirements has that text; leave --requirement out, or start a full run "
                   "for the new requirement."))
        self.req_id = given["id"] if given else matched
        (self.dir / "requirement.en.txt").write_text(stored + "\n", encoding="utf-8")
        self.log.set("project_requirement", {
            "source": f"project {pid}", "chars": len(stored),
            "sha256": sha256_bytes(stored.encode("utf-8")), "matched_seed_id": matched})
        say(f"requirement: MiroFish uses the one stored on project {pid} ({len(stored)} chars, "
            f"seed id {matched or 'unknown'}); saved as requirement.en.txt")

    def graph_guard(self) -> None:
        """Refuse a graph that another simulation already wrote agent activity into.

        Every run here sends enable_graph_memory_update=true, so its agents'
        actions land in the project's Zep graph, and the report agent searches
        only that graph. A second run on it reports on both runs together.
        """
        if self.a.allow_shared_graph:
            warn("--allow-shared-graph: earlier simulations' activity on this graph will mix into the report")
            return
        _, body = self.api.call("graph_guard", "GET", "/api/simulation/list",
                                params={"project_id": self.project_id}, timeout=T_POLL)
        used = []
        for sim in body.get("data") or []:
            sid = sim.get("simulation_id")
            if not sid:
                continue
            rs = self.run_status("graph_guard", sid)
            st = rs.get("runner_status") or "idle"
            actions = int(rs.get("total_actions_count") or 0)
            # A finished run with no actions wrote nothing to the graph.
            if st == "idle" or (st in TERMINAL_ALL and actions == 0):
                continue
            used.append(f"{sid} ({st}, {actions} actions)")
        if used:
            raise GuardAbort(
                "graph_guard",
                f"graph guard: project {self.project_id} already has simulation activity in its Zep graph: "
                + ", ".join(used),
                "replicas must be separate full runs (run.py --requirement <id> without --project-id), because "
                "the report reads the whole graph; pass --allow-shared-graph only if mixing is intended")

    def live_prepare_task(self) -> str | None:
        """A prepare that is still running in MiroFish for this simulation, if any.

        POST /prepare starts a new thread whenever config_generated is false
        (simulation.py:459-531) and has no in-flight check, so resuming must
        poll the existing task instead.
        """
        _, body = self.api.call("prepare", "GET", "/api/graph/tasks", timeout=T_POLL)
        for t in body.get("data") or []:  # newest first
            if (t.get("task_type") == "simulation_prepare"
                    and (t.get("metadata") or {}).get("simulation_id") == self.sim_id
                    and t.get("status") in ("pending", "processing")):
                return t.get("task_id")
        return None

    def orphan_project_hint(self) -> str:
        """After an ontology timeout or interrupt: the project MiroFish created anyway."""
        home, _ = self.mf_paths()
        fallback = (f"find the project id on the '创建项目' or '项目ID' line of {home}/logs/backend.log and, once "
                    "GET /api/graph/project/<id> shows ontology_generated, rerun with --project-id <id>; "
                    "a new full run pays for a second ontology")
        if not self.ontology_started:
            return fallback
        try:
            _, body = self.api.call("ontology", "GET", "/api/graph/project/list", params={"limit": 50},
                                    timeout=T_HEALTH)
        except StepError:
            return fallback
        for p in body.get("data") or []:  # newest first
            if p.get("name") != self.a.project_name:
                continue
            try:
                created = dt.datetime.fromisoformat(str(p.get("created_at")))
            except ValueError:
                continue
            # MiroFish stores naive local time (project.py:152).
            if created.tzinfo is None and created >= self.ontology_started - dt.timedelta(seconds=5):
                pid = p.get("project_id")
                return (f"MiroFish kept working and created project {pid} (status {p.get('status')}). "
                        f"Once GET /api/graph/project/{pid} shows ontology_generated, rerun with "
                        f"--project-id {pid}; a new full run pays for a second ontology")
        return fallback

    def process_gone(self, rs: dict) -> bool:
        """True when run-status names a simulation process that no longer exists (local backend only)."""
        pid = rs.get("process_pid")
        if not pid or not is_loopback(self.api.base):
            return False
        try:
            os.kill(int(pid), 0)
        except ProcessLookupError:
            return True
        except (PermissionError, OSError, ValueError):
            return False
        return False

    def env_alive(self, step: str) -> bool:
        _, body = self.api.call(step, "POST", "/api/simulation/env-status",
                                json_body={"simulation_id": self.sim_id}, timeout=T_POLL)
        return bool((body.get("data") or {}).get("env_alive"))

    # -- step 0
    def health(self) -> None:
        _, body = self.api.call("health", "GET", "/health", timeout=T_HEALTH)
        if body.get("status") != "ok":
            raise StepError("health", f"unexpected /health response: {short(body, 200)}",
                            hint="start the backend with tools/mirofish/start-backend.sh")
        say(f"MiroFish backend is up at {self.api.base}")

    # -- step 1
    def ontology(self) -> None:
        e = self.log.step_start("ontology")
        req = self.inputs["requirement"]
        say(f"step 1 ontology: uploading {len(self.inputs['files'])} file(s), requirement {req['id']} "
            f"(synchronous LLM call, up to {T_ONTOLOGY}s)")
        handles = []
        try:
            files = []
            for f in self.inputs["files"]:
                fh = open(f["path"], "rb")
                handles.append(fh)
                files.append(("files", (f["name"], fh, "text/markdown")))
            form = {"simulation_requirement": req["text"], "project_name": self.a.project_name,
                    "additional_context": ""}
            # The server's OpenAI client can wait 600 s x 3 tries x 2 attempts
            # (llm_client.py:107-110, ontology_generator.py:242), longer than
            # T_ONTOLOGY, and saves the project when it finishes (graph.py:368-380).
            self.ontology_started = dt.datetime.now()
            try:
                status, body = self.api.call("ontology", "POST", "/api/graph/ontology/generate", timeout=T_ONTOLOGY,
                                             files=files, data=form, expect=(200, 400, 413, 500, 502))
            except StepError as exc:
                if exc.http_status is None and "timed out" in exc.message:
                    exc.hint = self.orphan_project_hint()
                raise
        finally:
            for fh in handles:
                fh.close()
        data = body.get("data") or {}
        if status != 200 or not body.get("success"):
            pid = data.get("project_id")
            raise StepError("ontology", f"ontology generation failed (HTTP {status})", http_status=status,
                            mirofish_error=short(body.get("error"), 800),
                            hint=(f"MiroFish kept a failed project {pid}; " if pid else "")
                            + "check LLM_API_KEY/LLM_BASE_URL/LLM_MODEL_NAME and $MIROFISH_HOME/logs/backend.log")
        self.project_id = data["project_id"]
        onto = data.get("ontology") or {}
        n_ent, n_edge = len(onto.get("entity_types") or []), len(onto.get("edge_types") or [])
        self.save_json("ontology.json", {"ontology": onto, "analysis_summary": data.get("analysis_summary"),
                                         "files": data.get("files"),
                                         "total_text_length": data.get("total_text_length")})
        self.log.ids(project_id=self.project_id)
        self.log.counts(entity_types=n_ent, edge_types=n_edge, text_length=data.get("total_text_length"))
        self.log.step_end(e, "ok", entity_types=[t.get("name") for t in onto.get("entity_types") or []])
        say(f"step 1 ontology: ok project_id={self.project_id} ({n_ent} entity types, {n_edge} edge types)")

    # -- step 2
    def get_project(self, step: str) -> dict:
        _, body = self.api.call(step, "GET", f"/api/graph/project/{self.project_id}", timeout=T_POLL)
        return body.get("data") or {}

    def build(self) -> None:
        e = self.log.step_start("build")
        proj = self.get_project("build")
        if proj.get("status") == "graph_completed" and proj.get("graph_id"):
            self.graph_id = proj["graph_id"]
            self.log.ids(graph_id=self.graph_id)
            self.log.step_end(e, "skipped", reason="project already graph_completed")
            say(f"step 2 build: project already has a completed graph {self.graph_id}")
            return
        payload: dict[str, Any] = {"project_id": self.project_id, "graph_name": self.a.project_name,
                                   "chunk_size": 500, "chunk_overlap": 50}
        say(f"step 2 build: POST /api/graph/build project_id={self.project_id}")
        status, body = self.api.call("build", "POST", "/api/graph/build", json_body=payload,
                                     timeout=T_BUILD_POST, expect=(200, 409, 500))
        if status == 500:
            # A rebuild of a failed project first deletes the graph id it saved
            # before the failed create (graph.py:705-712, :621-633), so Zep is
            # called synchronously here.
            raise StepError("build", "POST /api/graph/build returned HTTP 500", http_status=500,
                            mirofish_error=short(body.get("error"), 800),
                            hint="an upstream 401/403 means ZEP_API_KEY is wrong; otherwise see "
                                 "$MIROFISH_HOME/logs/backend.log")
        if status == 409:
            if body.get("recoverable") and self.a.force_rebuild:
                warn("build: MiroFish reports a stale build (409 recoverable); retrying with force=true")
                payload["force"] = True
                status, body = self.api.call("build", "POST", "/api/graph/build", json_body=payload,
                                             timeout=T_BUILD_POST, expect=(200,))
            else:
                raise StepError("build", "graph build refused (HTTP 409)", http_status=409,
                                mirofish_error=short(body.get("error"), 800),
                                hint=("rerun with --project-id %s --force-rebuild to delete the half-built "
                                      "Zep graph and rebuild" % self.project_id) if body.get("recoverable")
                                else "another build or a graph consumer is active; wait and retry")
        data = body.get("data") or {}
        task_id = data.get("task_id")
        self.log.ids(build_task_id=task_id)
        if data.get("reused"):
            proj = self.get_project("build")
            if proj.get("status") == "graph_completed":
                self.graph_id = proj.get("graph_id")
                self.log.ids(graph_id=self.graph_id)
                self.log.step_end(e, "ok", reused=True)
                say(f"step 2 build: reused completed graph {self.graph_id}")
                return
        if not task_id:
            raise StepError("build", f"no task_id in build response: {short(data, 300)}")

        deadline = time.monotonic() + self.a.build_timeout_min * 60
        last = None
        while True:
            status, body = self.api.call("build", "GET", f"/api/graph/task/{task_id}", timeout=T_POLL,
                                         expect=(200, 404))
            if status == 404:
                proj = self.get_project("build")
                if proj.get("status") == "graph_completed":
                    self.graph_id = proj.get("graph_id")
                    break
                raise StepError("build", f"build task {task_id} is gone (backend restarted?)",
                                mirofish_error=short(body.get("error"), 300),
                                hint=f"rerun with --project-id {self.project_id} (MiroFish resumes or answers "
                                     "409 recoverable; add --force-rebuild to rebuild)")
            t = body.get("data") or {}
            st = t.get("status")
            msg, upstream = condense_error(t.get("message"))
            line = f"{st} {t.get('progress', 0)}% {short(msg, 160)}"
            if line != last:
                say(f"step 2 build: {line}")
                last = line
            if st == "completed":
                res = t.get("result") or {}
                self.graph_id = res.get("graph_id")
                self.log.counts(graph_nodes=res.get("node_count"), graph_edges=res.get("edge_count"),
                                chunks=res.get("chunk_count"))
                break
            if st == "failed":
                exc_type = last_line(t.get("error")).split(":", 1)[0]
                if upstream in (401, 403):
                    hint = (f"Zep Cloud answered {upstream}: ZEP_API_KEY is missing, wrong or not allowed. "
                            f"Fix it, restart the backend, then rerun with --project-id {self.project_id}")
                else:
                    hint = ("Zep Cloud rejected the request or ingestion took longer than the 600 s cap. "
                            f"Check ZEP_API_KEY and the Zep plan, then rerun with --project-id {self.project_id}")
                raise StepError("build", "graph build failed in MiroFish (POST /api/graph/build task)",
                                mirofish_error=f"{msg}" + (f" [{exc_type}]" if exc_type else ""), hint=hint)
            if time.monotonic() > deadline:
                raise StepError("build", f"graph build still '{st}' after {self.a.build_timeout_min} min",
                                hint=f"it may still finish; rerun later with --project-id {self.project_id}")
            time.sleep(5)
        proj = self.get_project("build")
        if proj.get("status") != "graph_completed":
            raise StepError("build", f"project status is '{proj.get('status')}', expected graph_completed",
                            mirofish_error=short(proj.get("error"), 400))
        self.graph_id = self.graph_id or proj.get("graph_id")
        self.log.ids(graph_id=self.graph_id)
        self.log.step_end(e, "ok")
        say(f"step 2 build: ok graph_id={self.graph_id}")

    # -- step 3
    def create(self) -> None:
        e = self.log.step_start("create")
        # Both platforms on: the prepared-check needs reddit_profiles.json AND
        # twitter_profiles.csv (simulation.py:296-301).
        payload = {"project_id": self.project_id, "graph_id": self.graph_id,
                   "enable_twitter": True, "enable_reddit": True}
        _, body = self.api.call("create", "POST", "/api/simulation/create", json_body=payload, timeout=T_CREATE)
        self.sim_id = (body.get("data") or {}).get("simulation_id")
        if not self.sim_id:
            raise StepError("create", f"no simulation_id in response: {short(body, 300)}")
        self.log.ids(simulation_id=self.sim_id)
        self.log.step_end(e, "ok")
        say(f"step 3 create: ok simulation_id={self.sim_id}")

    # -- step 4
    def is_prepared(self) -> bool:
        _, body = self.api.call("prepare", "POST", "/api/simulation/prepare/status",
                                json_body={"simulation_id": self.sim_id}, timeout=T_POLL)
        return (body.get("data") or {}).get("status") == "ready"

    def entity_guard(self, resume_hint: str) -> None:
        """Count agents before /prepare spends one LLM call per entity."""
        e = self.log.step_start("entity_count")
        params = {"enrich": "false"}
        if self.a.entity_types:
            params["entity_types"] = ",".join(self.a.entity_types)
        _, body = self.api.call("prepare", "GET", f"/api/simulation/entities/{self.graph_id}",
                                params=params, timeout=T_ENTITIES)
        data = body.get("data") or {}
        count = int(data.get("filtered_count") or 0)
        by_type: dict[str, int] = {}
        preview = []
        for ent in data.get("entities") or []:
            label = next((lb for lb in ent.get("labels") or [] if lb not in ("Entity", "Node")), "?")
            by_type[label] = by_type.get(label, 0) + 1
            preview.append({"name": ent.get("name"), "type": label})
        self.save_json("entities_preview.json", {"filtered_count": count, "total_nodes": data.get("total_count"),
                                                 "by_type": by_type, "entities": preview})
        flagged = [p for p in preview
                   if REGULATOR_TYPE_RE.search(str(p["type"] or "")) or REGULATOR_NAME_RE.search(str(p["name"] or ""))]
        self.log.counts(entities_expected=count, graph_nodes_total=data.get("total_count"))
        self.log.step_end(e, "ok", by_type=by_type, regulator_like=flagged)
        say(f"step 4 prepare: {count} agent(s) expected, by type {by_type}")
        if count == 0:
            raise StepError("prepare", "the graph has no typed entities, so there would be no agents",
                            hint="check the seed text and the ontology.json in the run dir")
        if flagged:
            shown = ", ".join(f"{p['name']} ({p['type']})" for p in flagged[:8])
            bad_types = {p["type"] for p in flagged}
            keep = ",".join(t for t in by_type if t not in bad_types and t != "?")
            if self.a.entity_types:
                warn(f"regulator or standards-body like entities among the chosen --entity-types: {shown}; "
                     "continuing because --entity-types was given")
            else:
                raise StepError("prepare", f"{len(flagged)} regulator or standards-body like entities would become "
                                          f"agents, which the requirements forbid: {shown}",
                                hint=f"rerun with --simulation-id {self.sim_id} --entity-types {keep or '<types>'} "
                                     "(drop the types that hold them), or remove their source text from the seed "
                                     "and start over; see entities_preview.json in the run dir")
        self.guard(count, "before prepare, which makes one profile LLM call per agent",
                   f"{resume_hint} --yes, or narrow with --entity-types")

    def guard(self, count: int, when: str, hint: str) -> None:
        if count > self.a.max_agents and not self.a.yes:
            raise GuardAbort("cost_guard", f"cost guard: {count} agents > --max-agents {self.a.max_agents} ({when})",
                             hint)
        if count > self.a.max_agents:
            warn(f"{count} agents > --max-agents {self.a.max_agents}, continuing because --yes was given")

    def prepare(self, live_task_id: str | None = None) -> None:
        e = self.log.step_start("prepare")
        if live_task_id:
            # Attach to the prepare already running in MiroFish; a second POST
            # would start a concurrent thread on the same files.
            data: dict[str, Any] = {"task_id": live_task_id}
            say(f"step 4 prepare: attaching to prepare task {live_task_id} already running in MiroFish "
                "(no second prepare; --entity-types and --parallel-profiles of this call do not apply)")
        else:
            payload: dict[str, Any] = {"simulation_id": self.sim_id, "use_llm_for_profiles": True,
                                       "parallel_profile_count": self.a.parallel_profiles, "force_regenerate": False}
            if self.a.entity_types:
                payload["entity_types"] = self.a.entity_types
            _, body = self.api.call("prepare", "POST", "/api/simulation/prepare", json_body=payload,
                                    timeout=T_PREPARE_POST)
            data = body.get("data") or {}
        task_id = data.get("task_id")
        self.log.ids(prepare_task_id=task_id)
        if data.get("already_prepared"):
            say("step 4 prepare: already prepared")
        else:
            if not live_task_id:
                say(f"step 4 prepare: started task {task_id}, expected agents {data.get('expected_entities_count')}")
            deadline = time.monotonic() + self.a.prepare_timeout_min * 60
            last = None
            while True:
                # Send both ids: simulation_id answers 'ready' once the files exist.
                status, body = self.api.call("prepare", "POST", "/api/simulation/prepare/status",
                                             json_body={"task_id": task_id, "simulation_id": self.sim_id},
                                             timeout=T_POLL, expect=(200, 404))
                if status == 404:
                    raise StepError("prepare", f"prepare task {task_id} is gone (backend restarted?)",
                                    mirofish_error=short(body.get("error"), 300),
                                    hint=f"rerun with --simulation-id {self.sim_id}")
                t = body.get("data") or {}
                st = t.get("status")
                line = f"{st} {t.get('progress', 0)}% {short(t.get('message'), 160)}"
                if line != last:
                    say(f"step 4 prepare: {line}")
                    last = line
                if st in ("completed", "ready"):
                    break
                if st == "failed":
                    raise StepError("prepare", "simulation prepare failed in MiroFish",
                                    mirofish_error=short(t.get("error") or t.get("message"), 800),
                                    hint=f"fix the cause, then rerun with --simulation-id {self.sim_id}")
                if time.monotonic() > deadline:
                    raise StepError("prepare", f"prepare still '{st}' after {self.a.prepare_timeout_min} min",
                                    hint=f"MiroFish keeps preparing in the backend; rerun later with --simulation-id "
                                         f"{self.sim_id}, which attaches to that prepare task instead of starting "
                                         "a second one")
                time.sleep(5)
        self.save_prepared()
        self.log.step_end(e, "ok")

    def save_prepared(self) -> None:
        counts = {}
        for platform in ("reddit", "twitter"):
            _, body = self.api.call("prepare", "GET", f"/api/simulation/{self.sim_id}/profiles",
                                    params={"platform": platform}, timeout=T_FETCH)
            d = body.get("data") or {}
            self.save_json(f"profiles_{platform}.json", d.get("profiles") or [])
            counts[platform] = int(d.get("count") or 0)
        _, body = self.api.call("prepare", "GET", f"/api/simulation/{self.sim_id}/config", timeout=T_FETCH)
        cfg = body.get("data") or {}
        self.save_json("simulation_config.json", cfg)
        tc = cfg.get("time_config") or {}
        hours = tc.get("total_simulation_hours", 72)
        mpr = tc.get("minutes_per_round", 30) or 30  # runner default when missing (simulation_runner.py:405)
        planned = int(hours * 60 / mpr) if mpr else 0
        self.log.counts(profiles_reddit=counts["reddit"], profiles_twitter=counts["twitter"],
                        agent_configs=len(cfg.get("agent_configs") or []),
                        config_total_hours=hours, config_minutes_per_round=mpr, config_total_rounds=planned,
                        config_agents_per_hour_min=tc.get("agents_per_hour_min"),
                        config_agents_per_hour_max=tc.get("agents_per_hour_max"))
        say(f"step 4 prepare: ok profiles reddit={counts['reddit']} twitter={counts['twitter']}; "
            f"config {hours} h x {mpr} min/round = {planned} rounds (saved to run dir)")
        countries = {}
        for p in (json.loads((self.dir / "profiles_reddit.json").read_text(encoding="utf-8")) or []):
            c = p.get("country") if isinstance(p, dict) else None
            if c:
                countries[c] = countries.get(c, 0) + 1
        if countries:
            say(f"step 4 prepare: profile countries {countries} (MiroFish defaults to '中国'; check the personas)")

    # -- step 5
    def start(self) -> None:
        e = self.log.step_start("start")
        agents = max(self.log.data["counts"].get("profiles_reddit", 0),
                     self.log.data["counts"].get("profiles_twitter", 0))
        self.guard(agents, "before start",
                   f"rerun with --simulation-id {self.sim_id} --yes, or lower the agent count")
        planned = self.log.data["counts"].get("config_total_rounds") or self.a.rounds
        rounds = min(self.a.rounds, planned) if planned else self.a.rounds
        self.round_check(rounds, planned)
        per_hour_max = self.log.data["counts"].get("config_agents_per_hour_max") or agents
        say(f"step 5 start: {agents} agents, {rounds} rounds, 2 platforms; rough ceiling "
            f"{rounds * min(per_hour_max, agents) * 2} agent LLM calls")
        force = bool(self.a.force_restart)
        payload = {"simulation_id": self.sim_id, "platform": "parallel", "max_rounds": self.a.rounds,
                   "enable_graph_memory_update": True, "force": force}
        status, body = self.api.call("start", "POST", "/api/simulation/start", json_body=payload,
                                     timeout=T_START_FORCE if force else T_START, expect=(200, 400, 409))
        if status == 409 and body.get("pending"):
            raise StepError("start", "the previous run of this simulation is still stopping (HTTP 409 pending)",
                            mirofish_error=short(body.get("error"), 400),
                            hint=f"MiroFish is still draining its graph-memory writes; wait until GET "
                                 f"/api/simulation/{self.sim_id}/run-status shows stopped, then rerun the same command")
        if status != 200:
            raise StepError("start", f"start refused (HTTP {status})", http_status=status,
                            mirofish_error=short(body.get("error"), 800),
                            hint=f"if a previous run exists, use --report-only {self.sim_id} or add --force-restart")
        d = body.get("data") or {}
        self.log.counts(total_rounds=d.get("total_rounds"), total_simulation_hours=d.get("total_simulation_hours"))
        self.log.step_end(e, "ok", runner_status=d.get("runner_status"),
                          graph_memory_update_enabled=d.get("graph_memory_update_enabled"),
                          max_rounds_applied=d.get("max_rounds_applied"))
        say(f"step 5 start: ok runner_status={d.get('runner_status')} total_rounds={d.get('total_rounds')} "
            f"graph_memory_update={d.get('graph_memory_update_enabled')}")

    def round_check(self, rounds: int, planned: int | None) -> None:
        """Critic P1-9: rounds start at simulated 00:00 and agents act only in their active hours."""
        mpr = int(self.log.data["counts"].get("config_minutes_per_round") or 30)
        sim_hours = rounds * mpr / 60
        active = sum(1 for r in range(rounds) if (r * mpr // 60) % 24 in ACTIVE_HOURS)
        self.log.counts(planned_rounds=rounds, planned_simulated_hours=round(sim_hours, 1),
                        planned_rounds_in_active_hours=active)
        say(f"step 5 start: {rounds} rounds x {mpr} min = {sim_hours:.1f} simulated hours from 00:00, "
            f"{active} round(s) inside the default active hours 08-22")
        if sim_hours >= MIN_SIM_HOURS and active >= MIN_ACTIVE_ROUNDS:
            return
        msg = (f"round check: {rounds} rounds x {mpr} min/round cover {sim_hours:.1f} simulated hours with "
               f"{active} round(s) in 08-22 (wanted >= {MIN_SIM_HOURS} h and >= {MIN_ACTIVE_ROUNDS} rounds; "
               "critic P1-9 asks for at least 30 rounds of 60 min)")
        if self.a.yes:
            warn(msg + "; continuing because --yes was given")
            return
        want = math.ceil(30 * 60 / mpr)
        if planned and want > planned:
            hint = (f"the prepared config allows only {planned} rounds; rerun with --simulation-id {self.sim_id} "
                    "--yes to run them anyway, or start a new run")
        else:
            hint = f"rerun with --simulation-id {self.sim_id} --rounds {want}, or add --yes to run as is"
        raise GuardAbort("round_guard", msg, hint)

    # -- step 6
    def wait_run(self) -> str:
        """Poll until env_alive (loops done, process waiting for IPC) or the process ended."""
        e = self.log.step_start("run")
        deadline = time.monotonic() + self.a.run_timeout_min * 60
        last, last_print, idle = None, 0.0, 0
        progress, progress_at = None, time.monotonic()
        while True:
            rs = self.run_status("run")
            st = rs.get("runner_status")
            key = (st, rs.get("current_round"), rs.get("total_actions_count"))
            if key != progress:
                progress, progress_at = key, time.monotonic()
            elif (st in ("running", "starting") and time.monotonic() - progress_at > STALL_S
                  and self.process_gone(rs)):
                # After a backend crash run_state.json still says running and no
                # monitor exists (simulation_runner.py:289-298); /stop then
                # finalizes synchronously (:1041-1073).
                warn(f"no progress for {STALL_S // 60} min and simulation process {rs.get('process_pid')} is gone "
                     "(backend restarted?); finalizing with /stop")
                self.log.step_end(e, "ok", ended="process_gone", runner_status=st)
                return "process_gone"
            line = (f"{st} round {rs.get('current_round', 0)}/{rs.get('total_rounds', 0)} "
                    f"(twitter {rs.get('twitter_current_round', 0)}, reddit {rs.get('reddit_current_round', 0)}) "
                    f"actions {rs.get('total_actions_count', 0)}")
            if line != last or time.monotonic() - last_print > 60:
                say(f"step 6 run: {line}")
                last, last_print = line, time.monotonic()
            self.log.counts(current_round=rs.get("current_round"), total_actions=rs.get("total_actions_count"),
                            twitter_actions=rs.get("twitter_actions_count"),
                            reddit_actions=rs.get("reddit_actions_count"))
            if st in TERMINAL_OK:
                self.log.step_end(e, "ok", ended="process exited", runner_status=st)
                return "exited"
            if st == "stopping":
                self.log.step_end(e, "ok", ended="stopping", runner_status=st)
                return "already_ending"
            if st == "failed":
                raise StepError("run", "simulation failed in MiroFish", mirofish_error=short(rs.get("error"), 800),
                                hint=self.sim_log_hint())
            if st == "idle":
                idle += 1
                if idle >= 3:
                    raise StepError("run", "MiroFish has no run state for this simulation (backend restarted?)",
                                    hint=self.sim_log_hint())
            else:
                idle = 0
            if st in ("running", "starting") and self.env_alive("run"):
                self.log.step_end(e, "ok", ended="env_alive", runner_status=st,
                                  twitter_completed=rs.get("twitter_completed"),
                                  reddit_completed=rs.get("reddit_completed"))
                say("step 6 run: both platforms finished their rounds; env is alive and waiting for commands")
                return "env_alive"
            if time.monotonic() > deadline:
                raise StepError("run", f"simulation still '{st}' after {self.a.run_timeout_min} min",
                                hint=f"it keeps running in the backend; resume later with --report-only {self.sim_id}")
            time.sleep(10)

    # -- step 7
    def stop_fallback(self) -> None:
        say(f"step 7 finalize: POST /api/simulation/stop (can block up to ~11 min while Zep drains)")
        status, body = self.api.call("finalize", "POST", "/api/simulation/stop",
                                     json_body={"simulation_id": self.sim_id}, timeout=T_STOP,
                                     expect=(200, 202, 400), timeout_ok=True)
        if status is None:
            warn("stop request timed out on the client side; MiroFish keeps finalizing, polling run-status")
        elif status == 202:
            say("step 7 finalize: stop pending (graph memory still draining), polling run-status")
        elif status == 400:
            warn(f"stop answered 400: {short(body.get('error'), 300)}")
        else:
            say(f"step 7 finalize: stop -> {(body.get('data') or {}).get('runner_status')}")

    def finalize(self, reason: str) -> None:
        e = self.log.step_start("finalize")
        stop_sent = False
        if reason == "env_alive":
            # close-env is a no-op success before env_alive (simulation_runner.py:1900-1904),
            # which is why it is sent only now.
            status, body = self.api.call("finalize", "POST", "/api/simulation/close-env",
                                         json_body={"simulation_id": self.sim_id, "timeout": 60},
                                         timeout=T_CLOSE_ENV, expect=(200, 400, 500))
            if status == 200 and body.get("success"):
                say(f"step 7 finalize: close-env ok ({short((body.get('data') or {}).get('message'), 120)})")
            else:
                warn(f"close-env did not succeed (HTTP {status}): {short(body.get('error') or body.get('data'), 300)}")
                self.stop_fallback()
                stop_sent = True
        elif reason == "process_gone":
            self.stop_fallback()
            stop_sent = True
        deadline = time.monotonic() + self.a.finalize_timeout_min * 60
        last = None
        while True:
            rs = self.run_status("finalize")
            st = rs.get("runner_status")
            if st != last:
                say(f"step 7 finalize: runner_status={st}")
                last = st
            if st in TERMINAL_OK:
                self.log.step_end(e, "ok", runner_status=st, stop_used=stop_sent)
                self.log.counts(total_actions=rs.get("total_actions_count"), current_round=rs.get("current_round"))
                return
            if st == "failed":
                if stop_sent:
                    raise StepError("finalize", "simulation ended 'failed' and /stop did not recover it",
                                    mirofish_error=short(rs.get("error"), 800), hint=self.sim_log_hint())
                warn(f"run ended 'failed' ({short(rs.get('error'), 300)}); retrying the Zep drain with /stop")
                self.stop_fallback()
                stop_sent = True
                deadline = time.monotonic() + self.a.finalize_timeout_min * 60
            elif time.monotonic() > deadline:
                if stop_sent:
                    raise StepError("finalize", f"no terminal status after /stop (still '{st}')",
                                    hint=f"{self.sim_log_hint()}; then resume with --report-only {self.sim_id}")
                warn(f"still '{st}' after {self.a.finalize_timeout_min} min; falling back to /stop")
                self.stop_fallback()
                stop_sent = True
                deadline = time.monotonic() + self.a.finalize_timeout_min * 60
            time.sleep(10)

    def ensure_finished(self) -> None:
        """Used by --report-only: finish a run that is still going, then report."""
        rs = self.run_status("report")
        st = rs.get("runner_status")
        say(f"simulation {self.sim_id}: runner_status={st}")
        if st in TERMINAL_OK:
            return
        if st in ("running", "starting", "stopping"):
            self.finalize(self.wait_run())
        elif st == "failed":
            self.finalize("already_ending")
        else:
            raise StepError("report", f"simulation has runner_status '{st}', nothing to report",
                            hint="run the simulation first (without --report-only)")

    # -- step 8
    def report(self) -> None:
        e = self.log.step_start("report")
        rs = self.run_status("report")
        if rs.get("runner_status") not in TERMINAL_OK:
            raise StepError("report", f"runner_status is '{rs.get('runner_status')}', report needs completed or stopped",
                            mirofish_error=short(rs.get("error"), 400), hint=self.sim_log_hint())
        # Outside --report-only the report must describe the run this call
        # drove. Without force MiroFish returns the first completed report it
        # finds for the simulation id (report.py:214-231), which after
        # --force-restart is the previous run's report.
        fresh = self.a.mode != "report" or bool(self.a.force_restart)
        payload = {"simulation_id": self.sim_id, "force_regenerate": bool(self.a.force_report) or fresh}
        deadline = time.monotonic() + self.a.report_wait_min * 60
        while True:
            status, body = self.api.call("report", "POST", "/api/report/generate", json_body=payload,
                                         timeout=T_REPORT_POST, expect=(200, 409))
            if status == 200:
                break
            err = str(body.get("error") or "")
            retryable = "ingestion_pending" in body or "changed while" in err
            if not retryable or time.monotonic() > deadline:
                raise StepError("report", "report generation refused (HTTP 409)", http_status=409,
                                mirofish_error=short(err, 600),
                                hint="the graph or run is not in a reportable state; " + self.sim_log_hint())
            say(f"step 8 report: 409 ({short(err, 120)}), retrying in 20 s")
            time.sleep(20)
        data = body.get("data") or {}
        self.report_id = data.get("report_id")
        task_id = data.get("task_id")
        self.log.ids(report_id=self.report_id, report_task_id=task_id)
        if data.get("already_generated"):
            if fresh:
                raise StepError("report", f"MiroFish returned the existing report {self.report_id} instead of "
                                          "generating one for this run",
                                hint=f"rerun with --report-only {self.sim_id} --force-report")
            say(f"step 8 report: a completed report already exists ({self.report_id}); "
                "pass --force-report to generate a new one")
        else:
            say(f"step 8 report: generating {self.report_id} (task {task_id})")
            deadline = time.monotonic() + self.a.report_timeout_min * 60
            last = None
            while True:
                # task_id only: with simulation_id MiroFish may return an older
                # completed report first (report_agent.py:2547-2565).
                status, body = self.api.call("report", "POST", "/api/report/generate/status",
                                             json_body={"task_id": task_id}, timeout=T_POLL, expect=(200, 404))
                if status == 404:
                    raise StepError("report", f"report task {task_id} is gone (backend restarted?)",
                                    hint=f"rerun with --report-only {self.sim_id} --force-report")
                t = body.get("data") or {}
                st = t.get("status")
                line = f"{st} {t.get('progress', 0)}% {short(t.get('message'), 160)}"
                if line != last:
                    say(f"step 8 report: {line}")
                    last = line
                if st == "completed":
                    rid = (t.get("result") or {}).get("report_id")
                    self.report_id = rid or self.report_id
                    break
                if st == "failed":
                    raise StepError("report", "report generation failed in MiroFish",
                                    mirofish_error=short(t.get("error") or t.get("message"), 800),
                                    hint=f"rerun with --report-only {self.sim_id} --force-report")
                if time.monotonic() > deadline:
                    raise StepError("report", f"report still '{st}' after {self.a.report_timeout_min} min",
                                    hint=f"it may still finish; rerun later with --report-only {self.sim_id}")
                time.sleep(10)
        _, body = self.api.call("report", "GET", f"/api/report/{self.report_id}", timeout=T_FETCH)
        rep = body.get("data") or {}
        if rep.get("status") != "completed":
            raise StepError("report", f"report {self.report_id} has status '{rep.get('status')}'",
                            mirofish_error=short(rep.get("error"), 600))
        md = rep.get("markdown_content") or ""
        (self.dir / "full_report.md").write_text(md, encoding="utf-8")
        self.save_json("report_outline.json", rep.get("outline"))
        self.save_json("report_meta.json", {k: v for k, v in rep.items() if k not in ("markdown_content", "outline")})
        sections = len((rep.get("outline") or {}).get("sections") or [])
        self.log.ids(report_id=self.report_id, graph_id=rep.get("graph_id") or self.graph_id)
        self.log.counts(report_sections=sections, report_chars=len(md))
        self.log.step_end(e, "ok", sections=sections)
        if not md.strip():
            warn("the report markdown is empty")
        say(f"step 8 report: ok {self.report_id}, {sections} section(s), {len(md)} chars -> {self.dir / 'full_report.md'}")

    # -- step 9
    def cleanup(self) -> bool:
        """Returns False (exit 4, outcome cleanup_failed) on any failure; the report is already saved."""
        e = self.log.step_start("cleanup")
        results: dict[str, Any] = {}
        try:
            ok = self._cleanup(results)
        except StepError as exc:
            ok = False
            warn(f"cleanup failed: {exc.message}" + (f" ({exc.mirofish_error})" if exc.mirofish_error else ""))
        _, src = self.mf_paths()
        say(f"step 9 cleanup: simulation and report folders stay under {src}/backend/uploads "
            "(MiroFish has no delete route for simulations)")
        self.log.step_end(e, "ok" if ok else "failed", http=results)
        return ok

    def _cleanup(self, results: dict) -> bool:
        if not (self.project_id and self.graph_id):
            _, body = self.api.call("cleanup", "GET", f"/api/simulation/{self.sim_id}", timeout=T_POLL)
            st = body.get("data") or {}
            self.project_id = self.project_id or st.get("project_id")
            self.graph_id = self.graph_id or st.get("graph_id")
        ok = True
        if self.graph_id:
            status, body = self.api.call("cleanup", "DELETE", f"/api/graph/delete/{self.graph_id}",
                                         timeout=T_DELETE, expect=(200, 404, 409, 500))
            results["graph"] = status
            if status == 200:
                say(f"step 9 cleanup: deleted Zep graph {self.graph_id}")
            elif status == 404:
                say(f"step 9 cleanup: no local project references graph {self.graph_id} (already cleared?)")
            else:
                ok = False
                warn(f"graph delete HTTP {status}: {condense_error(body.get('error') or body.get('_raw'))[0]}")
        if self.project_id:
            # 500: the project still references a graph whose delete just
            # failed, and the project delete retries it (graph.py:194-195).
            status, body = self.api.call("cleanup", "DELETE", f"/api/graph/project/{self.project_id}",
                                         timeout=T_DELETE, expect=(200, 404, 409, 500))
            results["project"] = status
            if status == 200:
                say(f"step 9 cleanup: deleted project {self.project_id}")
            elif status == 404:
                say(f"step 9 cleanup: project {self.project_id} not found")
            else:
                ok = False
                warn(f"project delete HTTP {status}: {condense_error(body.get('error') or body.get('_raw'))[0]}")
        return ok


# ---------------------------------------------------------------- plan / main

def print_plan(args: argparse.Namespace, inputs: dict | None) -> None:
    print("MiroFish headless plan")
    print(f"  backend      {args.base_url} (Accept-Language: {ACCEPT_LANGUAGE} on every call)")
    print(f"  mode         {args.mode}")
    if inputs and inputs.get("files"):
        print(f"  seed dir     {inputs['seed_dir']}")
        for f in inputs["files"]:
            print(f"    upload     {f['group']}/{f['name']}  {f['bytes']} bytes, {f['chars']} chars, sha256 {f['sha256'][:12]}")
        print(f"    total      {inputs['total_bytes']} bytes, {inputs['total_chars']} chars")
    if inputs and inputs.get("requirement"):
        r = inputs["requirement"]
        print(f"  requirement  {r['id']} ({r['chars']} chars) {Path(r['path']).name}")
        first = r["text"].splitlines()[0] if r["text"] else ""
        print(f"               \"{short(first, 110)}\"")
    if args.mode != "full":
        print("  requirement  MiroFish answers the requirement stored on the project; it is fetched, saved as "
              "requirement.en.txt" + (f" and must match {args.requirement}" if args.requirement else ""))
    for note in (inputs or {}).get("notes", []):
        print(f"  note         {note}")
    print(f"  rounds       max_rounds={args.rounds}" + ("  (WARNING: < 24, early simulated hours are near-empty)" if args.rounds < 24 else ""))
    print(f"  cost guard   max {args.max_agents} agents" + (" (overridden by --yes)" if args.yes else ""))
    if args.mode in ("project", "simulation"):
        print("  graph guard  refuse a graph another simulation already wrote to"
              + (" (overridden by --allow-shared-graph)" if args.allow_shared_graph else ""))
    if args.entity_types:
        print(f"  entities     only types {', '.join(args.entity_types)}")
    steps = []
    if args.mode == "full":
        steps += [
            "1 ontology  POST /api/graph/ontology/generate  multipart files + simulation_requirement + project_name"
            f"  (timeout {T_ONTOLOGY}s)",
            "2 build     POST /api/graph/build {project_id, graph_name, chunk_size 500, chunk_overlap 50}; poll GET /api/graph/task/<id>"
            + ("; on 409 recoverable retry with force" if args.force_rebuild else ""),
        ]
    if args.mode == "project":
        steps.append(f"2 build     GET /api/graph/project/{args.project_id}; build only if not graph_completed; "
                     "graph guard via GET /api/simulation/list?project_id + run-status")
    if args.mode in ("full", "project"):
        steps += [
            "3 create    POST /api/simulation/create {project_id, graph_id, enable_twitter true, enable_reddit true}",
            "4 prepare   GET /api/simulation/entities/<graph_id>?enrich=false (cost guard), "
            f"POST /api/simulation/prepare {{use_llm_for_profiles true, parallel_profile_count {args.parallel_profiles}}}; "
            "poll POST /api/simulation/prepare/status {task_id, simulation_id}; save profiles + config",
        ]
    if args.mode == "simulation":
        steps.append(f"4 prepare   attach to a live simulation_prepare task (GET /api/graph/tasks) if one exists, "
                     f"else POST /api/simulation/prepare {{simulation_id {args.simulation_id}}} (idempotent once "
                     "ready); save profiles + config")
    if args.mode in ("full", "project", "simulation"):
        steps += [
            f"5 start     cost guard, round check (>= {MIN_SIM_HOURS} simulated h and >= {MIN_ACTIVE_ROUNDS} rounds "
            f"in 08-22, else stop unless --yes), then POST /api/simulation/start {{platform parallel, "
            f"max_rounds {args.rounds}, enable_graph_memory_update true, force {str(bool(args.force_restart)).lower()}}}",
            f"6 run       poll GET /api/simulation/<sid>/run-status + POST /api/simulation/env-status (up to {args.run_timeout_min} min)",
            "7 finalize  POST /api/simulation/close-env after env_alive; wait for completed|stopped "
            f"(up to {args.finalize_timeout_min} min); fallback POST /api/simulation/stop (timeout {T_STOP}s)",
        ]
    if args.mode == "report":
        steps.append(f"6-7         finish simulation {args.report_only} if it is still running (close-env / stop)")
    force_report = bool(args.force_report) or args.mode != "report" or bool(args.force_restart)
    steps += [
        f"8 report    POST /api/report/generate {{force_regenerate {str(force_report).lower()}}} (retry on 409); "
        "poll POST /api/report/generate/status {task_id}; GET /api/report/<id> -> full_report.md",
    ]
    if args.cleanup:
        steps.append("9 cleanup   DELETE /api/graph/delete/<graph_id>, DELETE /api/graph/project/<project_id>")
    print("  steps")
    for s in steps:
        print(f"    {s}")
    print(f"  run dir      {Path(args.runs_dir).resolve()}/<UTC timestamp>-<label>/ (run.json, profiles, config, report)")


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Drive a local MiroFish backend headlessly and save a scenario-exploration report.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter)
    p.add_argument("--requirement", help="requirement id; reads seed/requirements/<id>.en.txt")
    p.add_argument("--seed-dir", default=str(DEFAULT_SEED_DIR), help="seed folder with upload/, optional/, requirements/")
    p.add_argument("--include-internal", action="store_true", help="also upload seed/optional/*.md")
    p.add_argument("--base-url", default=os.environ.get("MIROFISH_URL", DEFAULT_BASE_URL), help="MiroFish backend URL")
    p.add_argument("--project-name", default=None, help="MiroFish project and graph name (default danchu-<requirement>)")
    p.add_argument("--rounds", type=int, default=30, help="max_rounds for /start (warns below 24)")
    p.add_argument("--max-agents", type=int, default=40, help="cost guard: stop if more agents than this")
    p.add_argument("--yes", action="store_true", help="continue past the cost guard and the round check")
    p.add_argument("--entity-types", type=lambda s: [x.strip() for x in s.split(",") if x.strip()],
                   help="comma-separated entity types to turn into agents (prepare.entity_types)")
    p.add_argument("--parallel-profiles", type=int, default=5, help="prepare.parallel_profile_count")
    p.add_argument("--force-rebuild", action="store_true", help="on a 409 recoverable build, retry with force=true")
    p.add_argument("--force-restart", action="store_true",
                   help="send force=true to /start (wipes a previous run's logs, not its Zep graph activity)")
    p.add_argument("--allow-shared-graph", action="store_true",
                   help="run on a graph that another simulation already wrote to (its activity mixes into the report)")
    p.add_argument("--force-report", action="store_true", help="send force_regenerate=true to /report/generate")
    p.add_argument("--cleanup", action="store_true", help="after the report, delete the Zep graph and the project")
    mode = p.add_mutually_exclusive_group()
    mode.add_argument("--project-id", help="resume from an existing project (skips ontology; builds only if needed)")
    mode.add_argument("--simulation-id", help="resume a created or prepared simulation (prepare, start, run, report)")
    mode.add_argument("--report-only", metavar="SIMULATION_ID", help="only finish the run if needed and generate the report")
    p.add_argument("--dry-run", action="store_true", help="validate inputs and print the plan; no network calls")
    p.add_argument("--runs-dir", default=str(DEFAULT_RUNS_DIR), help="where run folders are written")
    p.add_argument("--build-timeout-min", type=float, default=20)
    p.add_argument("--prepare-timeout-min", type=float, default=60)
    p.add_argument("--run-timeout-min", type=float, default=240)
    p.add_argument("--finalize-timeout-min", type=float, default=20)
    p.add_argument("--report-wait-min", type=float, default=15, help="how long to retry a 409 from /report/generate")
    p.add_argument("--report-timeout-min", type=float, default=90)
    args = p.parse_args(argv)
    args.mode = ("report" if args.report_only else "simulation" if args.simulation_id
                 else "project" if args.project_id else "full")
    if not args.project_name:
        args.project_name = f"danchu-{args.requirement}" if args.requirement else "danchu"
    return args


def make_run_dir(args: argparse.Namespace) -> Path:
    label = args.requirement or (f"report-{args.report_only}" if args.report_only
                                 else f"resume-{args.simulation_id or args.project_id}")
    base = Path(args.runs_dir).resolve()
    base.mkdir(parents=True, exist_ok=True)
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    for i in range(100):
        d = base / (f"{stamp}-{label}" if i == 0 else f"{stamp}-{label}-{i}")
        try:
            d.mkdir()
            return d
        except FileExistsError:
            continue
    raise InputError(f"could not create a run folder under {base}")


def main(argv: list[str]) -> int:
    global requests
    args = parse_args(argv)
    try:
        validate_args(args)
        inputs = None
        if args.mode == "full":
            inputs = collect_inputs(args, with_files=True)
        elif args.requirement:
            # Resume modes upload nothing. MiroFish uses the requirement stored
            # on the project; --requirement is checked against it at run time.
            inputs = collect_inputs(args, with_files=False)
    except InputError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    if args.rounds < 24 and args.mode in ("full", "project", "simulation"):
        warn(f"--rounds {args.rounds} < 24: rounds start at simulated 00:00 and off-peak hours are near-empty")

    if args.dry_run:
        print_plan(args, inputs)
        print("dry run: inputs are valid; no network calls were made and nothing was written")
        return 0

    try:
        import requests as _requests  # noqa: PLC0415
    except ImportError:
        print("error: the 'requests' package is missing. Run this script with the MiroFish venv python:\n"
              "  \"${MIROFISH_VENV:-${MIROFISH_HOME:-$HOME/.cache/danchu-mirofish}/venv}/bin/python\" "
              "tools/mirofish/run.py ...",
              file=sys.stderr)
        return 2
    requests = _requests

    try:
        run_dir = make_run_dir(args)
    except (InputError, OSError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    log = RunLog(run_dir / "run.json")
    log.set("args", {k: getattr(args, k) for k in (
        "mode", "requirement", "include_internal", "base_url", "project_name", "rounds", "max_agents", "yes",
        "entity_types", "parallel_profiles", "force_rebuild", "force_restart", "force_report", "cleanup",
        "allow_shared_graph", "project_id", "simulation_id", "report_only")})
    if inputs:
        rec = {k: v for k, v in inputs.items() if k != "requirement"}
        rec["files"] = [{k: v for k, v in f.items() if k != "path"} for f in inputs.get("files", [])]
        if inputs.get("requirement"):
            r = inputs["requirement"]
            rec["requirement"] = {k: r[k] for k in ("id", "chars", "sha256")}
            if args.mode == "full":
                # Resume modes save the project's stored requirement instead (check_requirement).
                (run_dir / "requirement.en.txt").write_text(r["text"] + "\n", encoding="utf-8")
        log.set("inputs", rec)
    say(f"run folder {run_dir}")
    print_plan(args, inputs)

    def on_term(signum, frame):  # treat SIGTERM like Ctrl-C so run.json is closed
        raise KeyboardInterrupt
    signal.signal(signal.SIGTERM, on_term)

    api = MiroFish(args.base_url)
    pipe = Pipeline(args, api, log, run_dir, inputs)
    code = 0
    try:
        pipe.health()
        if args.mode == "full":
            pipe.ontology()
        if args.mode == "project":
            log.ids(project_id=pipe.project_id)
            pipe.check_requirement(pipe.get_project("resume"))
        if args.mode in ("full", "project"):
            pipe.build()
            if args.mode == "project":
                pipe.graph_guard()
            pipe.create()
            pipe.entity_guard(f"rerun with --project-id {pipe.project_id}")
        if args.mode in ("simulation", "report"):
            _, body = api.call("resume", "GET", f"/api/simulation/{pipe.sim_id}", timeout=T_POLL)
            st = body.get("data") or {}
            pipe.project_id, pipe.graph_id = st.get("project_id"), st.get("graph_id")
            log.ids(project_id=pipe.project_id, graph_id=pipe.graph_id, simulation_id=pipe.sim_id)
            pipe.check_requirement(pipe.get_project("resume"))
        attach, live_task, prev = False, None, None
        if args.mode == "simulation":
            prev = pipe.run_status("resume").get("runner_status") or "idle"
            if prev in ATTACHABLE and not args.force_restart:
                attach = True
            elif prev in TERMINAL_ALL and not args.force_restart:
                raise StepError("start", f"simulation {pipe.sim_id} already ran (runner_status={prev})",
                                hint=f"use --report-only {pipe.sim_id} for its report. For a replica start a new "
                                     "full run; --force-restart wipes that run's logs but not its activity in the "
                                     "Zep graph")
            else:
                pipe.graph_guard()
            if not pipe.is_prepared():
                live_task = pipe.live_prepare_task()
                if not live_task:
                    pipe.entity_guard(f"rerun with --simulation-id {pipe.sim_id}")
        if args.mode in ("full", "project", "simulation"):
            pipe.prepare(live_task)
            if attach:
                say(f"simulation is already {prev}; attaching instead of starting")
            else:
                pipe.start()
            pipe.finalize(pipe.wait_run())
        if args.mode == "report":
            pipe.ensure_finished()
        pipe.report()
        if args.cleanup and not pipe.cleanup():
            code = 4
        log.finish("ok" if code == 0 else "cleanup_failed")
        say(f"done: report {pipe.report_id} saved in {run_dir}")
        if code == 4:
            say("cleanup failed; delete manually with DELETE /api/graph/delete/<graph_id> and "
                "DELETE /api/graph/project/<project_id>")
        if not args.cleanup:
            say(f"Zep Cloud still holds the uploaded seed text and the simulated activity: graph {pipe.graph_id}, "
                f"project {pipe.project_id}")
            say(f"  delete them when done (after any re-reports): run.py --report-only {pipe.sim_id} --cleanup")
            say("  stop the backend now, it has no authentication and answers any web origin (CORS *): "
                "tools/mirofish/start-backend.sh --stop")
        return code
    except GuardAbort as exc:
        log.finish(f"aborted_by_{exc.kind}", {"step": exc.kind, "message": exc.message})
        print(redact(f"\nSTOPPED: {exc.message}\n  next: {exc.hint}\n  run log: {run_dir / 'run.json'}"),
              file=sys.stderr)
        return 3
    except InputError as exc:  # resume checks that need the backend (requirement mismatch)
        log.finish("invalid_input", {"step": "resume", "message": str(exc)})
        print(redact(f"\nerror: {exc}\n  run log: {run_dir / 'run.json'}"), file=sys.stderr)
        return 2
    except StepError as exc:
        log.finish("failed", {"step": exc.step, "message": exc.message, "http_status": exc.http_status,
                              "mirofish_error": exc.mirofish_error})
        lines = [f"\nFAILED at step '{exc.step}': {exc.message}"]
        if exc.mirofish_error:
            lines.append(f"  MiroFish said: {exc.mirofish_error}")
        if exc.hint:
            lines.append(f"  next: {exc.hint}")
        ids = {k: v for k, v in log.data["ids"].items()}
        if ids:
            lines.append(f"  ids: {json.dumps(ids)}")
        lines.append(f"  run log: {run_dir / 'run.json'}")
        print(redact("\n".join(lines)), file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        log.finish("interrupted")
        ids = log.data["ids"]
        print(f"\nINTERRUPTED. MiroFish keeps working in the backend. ids: {json.dumps(ids)}", file=sys.stderr)
        if ids.get("simulation_id"):
            sid = ids["simulation_id"]
            print(f"  resume: run.py --simulation-id {sid}  (attaches to a prepare or run in progress; it does not "
                  f"start a second one), or run.py --report-only {sid} once the run has started", file=sys.stderr)
        elif ids.get("project_id"):
            req = f" --requirement {pipe.req_id}" if pipe.req_id else ""
            print(f"  resume: run.py --project-id {ids['project_id']}{req}", file=sys.stderr)
        elif args.mode == "full" and pipe.ontology_started:
            try:
                print(redact(f"  resume: {pipe.orphan_project_hint()}"), file=sys.stderr)
            except (Exception, KeyboardInterrupt):  # noqa: BLE001 - best effort while exiting
                pass
        return 130
    except Exception as exc:  # last resort: keep run.json truthful
        log.finish("failed", {"step": "internal", "message": f"{type(exc).__name__}: {short(exc, 400)}"})
        print(redact(f"\nFAILED (unexpected {type(exc).__name__}): {short(exc, 400)}\n  ids: "
                     f"{json.dumps(log.data['ids'])}\n  run log: {run_dir / 'run.json'}"), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
