import { createHash } from "node:crypto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { OpenAIProvider, setDefaultModelProvider, Usage, type Model, type ModelResponse } from "@openai/agents";
import { NextRequest } from "next/server";

const fx = vi.hoisted(() => ({ records: new Map<string, { body: string; etag: string; uploadedAt: Date }>(), sequence: 0, get: vi.fn(), put: vi.fn(), del: vi.fn() }));
vi.mock("@vercel/blob", () => {
  class BlobPreconditionFailedError extends Error {}
  fx.get.mockImplementation(async (path: string, opts: { access: string; useCache: boolean }) => {
    expect(opts.access).toBe("private"); expect(opts.useCache).toBe(false);
    const record = fx.records.get(path);
    return record ? { statusCode: 200, stream: new Response(record.body).body, blob: { etag: record.etag, size: record.body.length } } : null;
  });
  fx.put.mockImplementation(async (path: string, body: string, opts: { access: string; allowOverwrite: boolean; ifMatch?: string; ttlDays: number }) => {
    expect(opts.access).toBe("private"); expect(opts.ttlDays).toBe(1);
    const current = fx.records.get(path);
    if (opts.ifMatch && opts.ifMatch !== current?.etag) throw new BlobPreconditionFailedError();
    if (current && !opts.allowOverwrite) throw new Error("already exists");
    const etag = String(++fx.sequence);
    fx.records.set(path, { body, etag, uploadedAt: new Date() });
    return { etag };
  });
  fx.del.mockImplementation(async (path: string, opts: { ifMatch?: string }) => {
    if (opts.ifMatch && opts.ifMatch !== fx.records.get(path)?.etag) throw new BlobPreconditionFailedError();
    fx.records.delete(path);
  });
  return { get: fx.get, put: fx.put, del: fx.del, list: vi.fn(async () => ({ blobs: [] })), BlobPreconditionFailedError };
});

import { labEnabled, saveRequestDraft } from "../lib/agent-lab/domain";
import { hasLabAccess } from "../lib/agent-lab/access";
import { createLabSession, resetLabSession, restoreLabSnapshot, runLabTurn, saveLabSnapshot } from "../lib/agent-lab/runtime";
import { changeLabSession, loadLabSession, newStoredLabSession, reserveLabBudget } from "../lib/agent-lab/storage";
import { GET, POST } from "../app/api/agent-lab/route";
import { POST as grantAccess } from "../app/api/agent-lab/access/route";

const code = "A".repeat(43);
const hash = createHash("sha256").update(code).digest("hex");
const preview = () => ({ NODE_ENV: "production", VERCEL_ENV: "preview", VERCEL_GIT_COMMIT_REF: "feat/dual-ai-agents", DANCHU_AGENT_LAB: "1", DANCHU_AGENT_BLOB_STORE_ID: "store_test", DANCHU_AGENT_ACCESS_HASH: hash, DANCHU_AGENT_ACCESS_EXPIRES_AT: new Date(Date.now() + 3600000).toISOString() }) as NodeJS.ProcessEnv;
const draft = { title: "혈청 분석", kind: "other" as const, material: "혈청", samples: 30, items: ["ALT", "AST", "BUN", "CREA"], deadline: "2026-12-10", note: "" };
beforeEach(() => { fx.records.clear(); fx.sequence = 0; fx.get.mockClear(); fx.put.mockClear(); fx.del.mockClear(); Object.entries(preview()).forEach(([key, value]) => vi.stubEnv(key, value)); });
afterEach(() => { vi.unstubAllEnvs(); setDefaultModelProvider(new OpenAIProvider()); });

describe("preview invitation boundary", () => {
  it("enables only the configured preview branch with a valid invitation and store", () => {
    expect(labEnabled(preview())).toBe(true);
    for (const patch of [{ VERCEL_ENV: "production" }, { VERCEL_GIT_COMMIT_REF: "main" }, { DANCHU_AGENT_ACCESS_HASH: "" }, { DANCHU_AGENT_BLOB_STORE_ID: "" }, { DANCHU_AGENT_ACCESS_EXPIRES_AT: "2000-01-01" }]) expect(labEnabled({ ...preview(), ...patch })).toBe(false);
  });
  it("rejects missing, wrong, malformed and expired invitations", () => {
    expect(hasLabAccess(code, preview())).toBe(true);
    for (const value of [undefined, "", "B".repeat(43), "A".repeat(500)]) expect(hasLabAccess(value, preview())).toBe(false);
    expect(hasLabAccess(code, { ...preview(), DANCHU_AGENT_ACCESS_EXPIRES_AT: "2000-01-01" })).toBe(false);
  });
  it("rejects unauthenticated reads and writes before touching storage", async () => {
    expect((await GET(new NextRequest("https://preview.example/api/agent-lab"))).status).toBe(401);
    expect((await POST(new NextRequest("https://preview.example/api/agent-lab", { method: "POST" }))).status).toBe(401);
    expect(fx.get).not.toHaveBeenCalled(); expect(fx.put).not.toHaveBeenCalled();
  });
  it("grants an HttpOnly secure session without echoing the invitation", async () => {
    const response = await grantAccess(new NextRequest("https://preview.example/api/agent-lab/access", { method: "POST", headers: { "Content-Type": "application/json", origin: "https://preview.example" }, body: JSON.stringify({ accessCode: code }) }));
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toMatch(/HttpOnly/);
    expect(response.headers.get("set-cookie")).toMatch(/Secure/);
    expect(response.headers.get("set-cookie")).toMatch(/SameSite=strict/);
    expect(await response.json()).toEqual({ ok: true });
  });
  it("rejects cross-site invitation submissions", async () => {
    const response = await grantAccess(new NextRequest("https://preview.example/api/agent-lab/access", { method: "POST", headers: { "Content-Type": "application/json", origin: "https://other.example" }, body: JSON.stringify({ accessCode: code }) }));
    expect(response.status).toBe(403);
  });
});

describe("private serverless sessions", () => {
  it("loads a private session into a new object after the original worker disappears", async () => {
    const original = await newStoredLabSession();
    await changeLabSession(original, async session => { saveRequestDraft(session.state, "requester", draft); session.turns = 8; }, false);
    const reloaded = await loadLabSession(original.session.id);
    expect(reloaded!.session).not.toBe(original.session);
    expect(reloaded!.session.state.draft).toEqual(draft);
    expect(reloaded!.session.turns).toBe(8);
    expect(reloaded!.lease).toBeNull();
  });
  it("does not read arbitrary paths from forged cookies", async () => {
    expect(await loadLabSession("../../budget/config")).toBeNull();
    expect(fx.get).not.toHaveBeenCalled();
  });
  it("allows only one concurrent worker to mutate a case", async () => {
    const first = await newStoredLabSession();
    const second = await loadLabSession(first.session.id);
    const action = vi.fn(async session => { session.turns += 1; });
    const result = await Promise.allSettled([changeLabSession(first, action, false), changeLabSession(second!, action, false)]);
    expect(result.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(action).toHaveBeenCalledOnce();
    expect((await loadLabSession(first.session.id))!.session.turns).toBe(1);
  });
  it("preserves the usage count when a failed model turn is persisted", async () => {
    const loaded = await newStoredLabSession();
    await expect(changeLabSession(loaded, async session => { session.turns++; throw new Error("model unavailable"); }, true)).rejects.toThrow("model unavailable");
    const saved = await loadLabSession(loaded.session.id);
    expect(saved!.session.turns).toBe(1); expect(saved!.lease).toBeNull();
    await changeLabSession(saved!, async session => resetLabSession(session), false);
    expect((await loadLabSession(loaded.session.id))!.session.turns).toBe(1);
  });
  it("fails closed instead of replaying an expired worker's pending operation", async () => {
    const loaded = await newStoredLabSession();
    const path = `danchu-agent-test/v1/sessions/${loaded.session.id}.json`;
    const record = fx.records.get(path)!;
    const value = JSON.parse(record.body); value.lease = { id: "interrupted", until: Date.now() - 1 }; record.body = JSON.stringify(value);
    expect(await loadLabSession(loaded.session.id)).toBeNull();
    expect(fx.records.has(path)).toBe(false);
  });
  it("shares a model budget across separately loaded sessions", async () => {
    for (let i = 0; i < 120; i++) await reserveLabBudget("turns");
    await expect(reserveLabBudget("turns")).rejects.toMatchObject({ status: 429 });
  });
  it("resolves concurrent budget updates without losing a reservation", async () => {
    await Promise.all([reserveLabBudget("turns"), reserveLabBudget("turns"), reserveLabBudget("turns")]);
    const record = [...fx.records.entries()].find(([path]) => path.includes("budget/"))![1];
    expect(JSON.parse(record.body).turns).toBe(3);
  });
});

describe("SDK approval recovery", () => {
  it.each([true, false])("restores native tool approval across a JSON round trip: approve=%s", async approve => {
    const responses: ModelResponse[] = [
      { usage: new Usage(), output: [{ type: "function_call", callId: "call_send", name: "send_request", arguments: "{}", status: "completed" }] },
      { usage: new Usage(), output: [{ type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: "테스트 결과를 확인했습니다." }] }] },
    ];
    const model: Model = { getResponse: async () => { const response = responses.shift(); if (!response) throw new Error("Unexpected model call"); return response; }, getStreamedResponse() { throw new Error("No streaming in this test"); } };
    setDefaultModelProvider({ getModel: () => model });
    const session = createLabSession(false);
    saveRequestDraft(session.state, "requester", draft);
    const before = await runLabTurn(session, "requester", { message: "요청을 전달할게." });
    expect(before.approval).not.toBeNull(); expect(session.state.request).toBeNull();
    vi.stubEnv("OPENAI_API_KEY", "test-only-secret-must-not-be-serialized");
    const saved = saveLabSnapshot(session);
    expect(JSON.stringify(saved)).not.toContain("test-only-secret-must-not-be-serialized");
    const restored = await restoreLabSnapshot(JSON.parse(JSON.stringify(saved)));
    await runLabTurn(restored, "requester", { approvalId: before.approval!.id, approve });
    expect(!!restored.state.request).toBe(approve);
    expect(restored.pending).toBeNull();
    await expect(runLabTurn(restored, "requester", { approvalId: before.approval!.id, approve: true })).rejects.toThrow("승인 요청");
    expect(session.state.request).toBeNull();
  });
});
