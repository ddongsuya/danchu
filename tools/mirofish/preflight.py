#!/usr/bin/env python3
"""Check the two MiroFish keys before a real run, for a few cents at most.

Run with the MiroFish venv python (it has openai and zep-cloud):
    $MIROFISH_HOME/venv/bin/python tools/mirofish/preflight.py

Checks
  1. LLM_API_KEY / ZEP_API_KEY are set (names only are printed, never values).
  2. LLM: one tiny chat completion in JSON mode with the model MiroFish will use
     (LLM_MODEL_NAME, default gpt-4o-mini) at LLM_BASE_URL (default OpenAI).
     MiroFish sends temperature and response_format=json_object, so this does too.
  3. Zep: create a throwaway graph, set an ontology with 10 entity types and
     10 edge types (the most MiroFish sends), then delete the graph. No episodes
     are added, so no Zep credits are used. A plan that allows fewer custom
     types fails here instead of in the middle of a paid run.

Exit codes: 0 all ok, 1 a check failed, 2 a key is missing.
"""

from __future__ import annotations

import os
import re
import sys
import uuid

ZEP_BASE_URL = "https://api.getzep.com/api/v2"  # same as MiroFish backend/app/utils/zep.py
N_TYPES = 10  # MiroFish caps ontologies at 10 entity and 10 edge types (backend/app/utils/ontology.py)


def redact(text: str) -> str:
    """Remove key values and key-shaped strings from text before printing."""
    out = str(text)
    for name in ("LLM_API_KEY", "ZEP_API_KEY"):
        value = os.environ.get(name, "")
        if len(value) >= 8:
            out = out.replace(value, f"<{name}>")
    out = re.sub(r"sk-[A-Za-z0-9_\-]{8,}", "sk-<redacted>", out)
    out = re.sub(r"z_[A-Za-z0-9_\-\.]{8,}", "z_<redacted>", out)
    return out[:600]


def say(msg: str) -> None:
    print(f"[preflight] {msg}", flush=True)


def check_env() -> bool:
    missing = [n for n in ("LLM_API_KEY", "ZEP_API_KEY") if not os.environ.get(n, "").strip()]
    if missing:
        say("missing: " + ", ".join(missing) + ". Add them as environment variables in the cloud "
            "environment settings, then start a new session.")
        return False
    base = os.environ.get("LLM_BASE_URL", "").strip() or "https://api.openai.com/v1"
    if "anthropic" in base.lower():
        say("LLM_BASE_URL points at Anthropic. MiroFish sends temperature with every call, which "
            "current Claude models reject. Use an OpenAI key instead.")
        return False
    say("LLM_API_KEY and ZEP_API_KEY are set")
    return True


def check_llm() -> bool:
    try:
        from openai import OpenAI
    except ImportError:
        say("openai package not found: run this with the MiroFish venv python")
        return False
    base = os.environ.get("LLM_BASE_URL", "").strip() or "https://api.openai.com/v1"
    model = os.environ.get("LLM_MODEL_NAME", "").strip() or "gpt-4o-mini"
    client = OpenAI(api_key=os.environ["LLM_API_KEY"].strip(), base_url=base, timeout=60, max_retries=1)
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "Reply with JSON only."},
                {"role": "user", "content": 'Return {"ok": true} as JSON.'},
            ],
            temperature=0.3,
            max_tokens=20,
            response_format={"type": "json_object"},
        )
    except Exception as err:  # noqa: BLE001 - report any provider error plainly
        status = getattr(err, "status_code", None)
        body = redact(getattr(err, "message", "") or err)
        hint = ""
        if status == 401:
            hint = " The key is wrong or revoked."
        elif status == 429 and "quota" in body.lower():
            hint = " The account has no credit left: add prepaid credit in OpenAI Billing."
        elif status == 429:
            hint = " Rate limited: the usage tier may still be Free (buy at least $5 of credit)."
        elif status == 404:
            hint = f" Model '{model}' is not available to this key."
        say(f"LLM check FAILED ({type(err).__name__}, HTTP {status}): {body}.{hint}")
        return False
    text = (resp.choices[0].message.content or "").strip()
    usage = getattr(resp, "usage", None)
    tokens = f", {usage.total_tokens} tokens" if usage else ""
    say(f"LLM ok: model {resp.model} at {base} answered {text[:40]!r}{tokens}")
    return True


def build_ontology():
    """10 entity types and 10 edge types shaped like MiroFish's set_ontology call."""
    import warnings
    from typing import Optional

    # Same pydantic Field(default=None) warning MiroFish silences for dynamic Zep models.
    warnings.filterwarnings("ignore", category=UserWarning, module="pydantic")

    from pydantic import Field
    from zep_cloud import EntityEdgeSourceTarget
    from zep_cloud.external_clients.ontology import EdgeModel, EntityModel, EntityText

    entities = {}
    for i in range(N_TYPES):
        name = f"PreflightType{i}"
        attrs = {
            "__doc__": f"Preflight entity type {i}.",
            "role_note": Field(description="A short note.", default=None),
            "__annotations__": {"role_note": Optional[EntityText]},
        }
        entities[name] = type(name, (EntityModel,), attrs)

    edges = {}
    for i in range(N_TYPES):
        name = f"PREFLIGHT_REL_{i}"
        attrs = {
            "__doc__": f"Preflight relation {i}.",
            "note": Field(description="A short note.", default=None),
            "__annotations__": {"note": Optional[str]},
        }
        cls = type(f"PreflightRel{i}", (EdgeModel,), attrs)
        src, dst = f"PreflightType{i}", f"PreflightType{(i + 1) % N_TYPES}"
        edges[name] = (cls, [EntityEdgeSourceTarget(source=src, target=dst)])
    return entities, edges


def check_zep() -> bool:
    try:
        from zep_cloud.client import Zep
    except ImportError:
        say("zep-cloud package not found: run this with the MiroFish venv python")
        return False
    # zep-cloud gives ZEP_API_URL precedence over base_url; MiroFish rejects it too.
    os.environ.pop("ZEP_API_URL", None)
    client = Zep(api_key=os.environ["ZEP_API_KEY"].strip(), base_url=ZEP_BASE_URL)
    graph_id = f"danchu_preflight_{uuid.uuid4().hex[:12]}"
    created = False
    ok = False
    try:
        client.graph.create(graph_id=graph_id, name="danchu preflight", description="temporary, deleted at once")
        created = True
        say(f"Zep graph created ({graph_id})")
        entities, edges = build_ontology()
        client.graph.set_ontology(graph_ids=[graph_id], entities=entities, edges=edges)
        say(f"Zep ok: ontology with {N_TYPES} entity types and {N_TYPES} edge types accepted")
        ok = True
    except Exception as err:  # noqa: BLE001
        status = getattr(err, "status_code", None)
        body = redact(getattr(err, "body", "") or err)
        hint = ""
        if status == 401:
            hint = " The Zep key is wrong or revoked."
        elif created:
            hint = (" The plan likely allows fewer custom types than MiroFish sends (10). "
                    "Check the Zep plan (the Free plan lists 5) before a paid LLM run.")
        say(f"Zep check FAILED ({type(err).__name__}, HTTP {status}): {body}.{hint}")
    finally:
        if created:
            try:
                client.graph.delete(graph_id=graph_id)
                say("Zep test graph deleted")
            except Exception as err:  # noqa: BLE001
                say(f"warning: could not delete test graph {graph_id}: {redact(err)}. Delete it in the Zep dashboard.")
    return ok


def main() -> int:
    if not check_env():
        return 2
    results = {"llm": check_llm(), "zep": check_zep()}
    if all(results.values()):
        say("all checks passed: start the backend and run run.py")
        return 0
    say("failed: " + ", ".join(k for k, v in results.items() if not v))
    return 1


if __name__ == "__main__":
    sys.exit(main())
