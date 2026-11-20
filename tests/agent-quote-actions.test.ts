import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * 에이전트 견적서 도구의 실행 (2026-11-20 설계안 D2)
 * - quote_doc_get: 단추 계산 금액과 저장 판
 * - quote_doc_edit: 판이 다르면 409, 금액 칸은 400, 저장은 판 비교로
 * - quote_from_doc·quote_reply_fields: 회신 초안을 웹 처리(PUT)로 임시 저장, 제출본은 건드리지 않음
 */

const fx = vi.hoisted(() => ({
  doc: null as null | { head: Record<string, unknown>; data: Record<string, unknown> },
  saved: [] as { raw: Record<string, unknown>; opts: Record<string, unknown> }[],
  saveChanged: false,
  draftStatus: "draft" as "draft" | "submitted",
  puts: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/supabase", () => ({ getSupabaseAdmin: () => null }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, getAll: () => [] }) }));
vi.mock("@/lib/supabase-server", () => ({ createSessionClient: async () => null }));
vi.mock("@/lib/agent-act", async (orig) => ({
  ...(await orig<object>()),
  inviteForOrg: async () => ({ id: "inv1", token: "tok_abcdefgh" }),
  markVia: async () => undefined,
  callAs: async (_s: unknown, _r: unknown, _h: unknown, _p: unknown, body: Record<string, unknown>) => (fx.puts.push(body), { status: 200, body: { ok: true } }),
}));
vi.mock("@/lib/quote-doc-db", async (orig) => ({
  ...(await orig<object>()),
  docForInvite: async () => (fx.doc ? { id: "d1", docNo: "Q-1" } : null),
  loadDoc: async () => (fx.doc ? structuredClone(fx.doc) : null),
  saveDoc: async (_o: string, _id: string, raw: Record<string, unknown>, opts: Record<string, unknown>) => (fx.saved.push({ raw, opts }), fx.saveChanged ? { ok: false, changed: true } : { ok: true, updatedAt: "v2" }),
}));
vi.mock("@/lib/quote-load", async (orig) => ({
  ...(await orig<object>()),
  loadQuote: async () => ({
    joined: true,
    rfq: { rows: [{ seq: 1, name: "반복투여 4주" }, { seq: 2, name: "특수 분석" }] },
    draft: { status: fx.draftStatus, note: "", steps: [], common: { validUntil: "", startDate: "", payTerms: "", substanceQty: "", reportLang: "", includes: [] }, items: [{ seq: 1, avail: "", amount: "", weeks: "" }, { seq: 2, avail: "", amount: "", weeks: "" }] },
  }),
}));

import { runAgentAction, catalogFor, findAction } from "@/lib/agent-actions";
import { blankTest, DEFAULT_VISIBLE, EMPTY_TERMS } from "@/lib/quote-doc";
import type { AgentSession } from "@/lib/agent-api";

const ORG = "22222222-2222-4222-8222-222222222222";
const cro = { userId: "11111111-1111-4111-8111-111111111111", email: "a@lab.test", role: "cro", profile: { role: "cro", cro_org_id: ORG }, org: { id: ORG, name: "가람랩", status: "approved", plan: "pro" }, pendingOrg: null } as unknown as AgentSession;
const REQ = new Request("https://danchu.example/api/agent/act");
const NO = "DC-2026-0003";

beforeEach(() => {
  const a = { ...blankTest("반복투여 4주"), uid: "ta", rfqSeq: 1, item: "반복투여 4주", extras: [{ id: "x", label: "본시험", amount: 30_000_000 }] };
  const b = { ...blankTest("특수 분석"), uid: "tb", rfqSeq: 2, item: "특수 분석" };
  fx.doc = { head: { id: "d1", docNo: "Q-1", rfqNo: NO, updatedAt: "v1", client: "", substance: "", issuedOn: "2026-11-20", validUntil: null, memo: "", inviteId: "inv1", title: "" }, data: { tests: [a, b], visible: DEFAULT_VISIBLE, discount: 0, terms: EMPTY_TERMS, glp: "GLP" } };
  fx.saved = [];
  fx.saveChanged = false;
  fx.draftStatus = "draft";
  fx.puts = [];
});

describe("견적서 도구 목록", () => {
  it("읽기 두 개만 비서 도구, 쓰기는 확인 뒤, 금액 넣기는 비서 도구가 아니다", () => {
    const c = catalogFor(cro);
    expect(c.find((a) => a.name === "quote_doc_get")).toMatchObject({ level: "read", tool: true });
    expect(c.find((a) => a.name === "quote_doc_preview")).toMatchObject({ level: "read", tool: true });
    for (const n of ["quote_doc_edit", "quote_doc_set_amount", "quote_from_doc", "quote_reply_fields"]) expect(c.find((a) => a.name === n), n).toMatchObject({ level: "confirm", tool: false });
  });
  it("견적서 도구는 견적서 툴 요금제 기능, 회신 칸 고치기는 요금제와 상관없다", () => {
    for (const n of ["quote_doc_get", "quote_doc_edit", "quote_doc_set_amount", "quote_doc_preview", "quote_from_doc"]) expect(findAction("cro", n)?.feature, n).toBe("quote_tool");
    expect(findAction("cro", "quote_reply_fields")?.feature).toBeUndefined();
  });
});

describe("견적서 보기·고치기", () => {
  it("견적서가 없으면 doc_missing", async () => {
    fx.doc = null;
    expect((await runAgentAction(cro, REQ, "quote_doc_get", NO, {})).body).toEqual({ error: "doc_missing" });
  });
  it("보기: 저장 판과 금액, 금액을 넣어야 하는 줄", async () => {
    const r = await runAgentAction(cro, REQ, "quote_doc_get", NO, {});
    expect(r.body).toMatchObject({ head: { updatedAt: "v1" }, totals: { supply: 30_000_000 }, manualNeeded: ["반복투여 4주", "특수 분석"].slice(1) });
  });
  it("고치기: 판이 다르면 409, 저장하지 않는다", async () => {
    const r = await runAgentAction(cro, REQ, "quote_doc_edit", NO, { updatedAt: "old", tests: [{ uid: "ta", weeks: 10 }] });
    expect(r).toMatchObject({ status: 409, body: { error: "changed", updatedAt: "v1" } });
    expect(fx.saved).toEqual([]);
  });
  it("고치기: 금액 칸은 400", async () => {
    const r = await runAgentAction(cro, REQ, "quote_doc_edit", NO, { updatedAt: "v1", tests: [{ uid: "ta", amount: 1 }] });
    expect(r).toMatchObject({ status: 400, body: { error: "amount_not_allowed" } });
  });
  it("고치기: 판 비교로 저장하고 전·후 금액을 돌려준다. 바꾸기 전 모습은 응답에 넣지 않는다", async () => {
    const r = await runAgentAction(cro, REQ, "quote_doc_edit", NO, { updatedAt: "v1", tests: [{ uid: "ta", weeks: 10, why: "4주 투여" }] });
    expect(r.status).toBe(200);
    expect(fx.saved[0].opts).toEqual({ ifUpdatedAt: "v1" });
    expect(r.body).toMatchObject({ updatedAt: "v2", diffs: [{ uid: "ta", fields: ["weeks", "why"] }] });
    expect(r).not.toHaveProperty("before");
    expect(JSON.stringify(r.body)).not.toContain("\"data\"");
  });
  it("고치기: 저장하는 사이 웹에서 바뀌면 409", async () => {
    fx.saveChanged = true;
    expect((await runAgentAction(cro, REQ, "quote_doc_edit", NO, { updatedAt: "v1", tests: [{ uid: "ta", weeks: 10 }] })).status).toBe(409);
  });
  it("금액 넣기: 시험 목록 금액이 없는 줄에만", async () => {
    const ok = await runAgentAction(cro, REQ, "quote_doc_set_amount", NO, { updatedAt: "v1", uid: "tb", amount: 5_000_000 });
    expect(ok.status).toBe(200);
    expect(JSON.stringify(fx.saved[0].raw)).toContain("5000000");
    expect(await runAgentAction(cro, REQ, "quote_doc_set_amount", NO, { updatedAt: "v1" })).toMatchObject({ status: 400 });
  });
});

describe("회신", () => {
  it("견적서 금액으로 회신 채우기: 금액 있는 줄만, 가능 여부는 그대로, 웹 처리로 임시 저장", async () => {
    const r = await runAgentAction(cro, REQ, "quote_from_doc", NO, {});
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ filled: [1], empty: [2], mismatched: [] });
    const items = fx.puts[0].items as { seq: number; amount: string; avail: string }[];
    expect(items[0]).toMatchObject({ amount: "30000000", avail: "" });
  });
  it("요청서와 시험 이름이 달라진 줄은 채우지 않는다", async () => {
    (fx.doc!.data.tests as { item: string }[])[0].item = "반복투여 13주";
    const r = await runAgentAction(cro, REQ, "quote_from_doc", NO, {});
    expect(r.body).toMatchObject({ filled: [], mismatched: [1] });
  });
  it("제출한 견적은 고치지 않는다", async () => {
    fx.draftStatus = "submitted";
    expect((await runAgentAction(cro, REQ, "quote_reply_fields", NO, { items: [{ seq: 1, avail: "가능" }] })).body).toEqual({ error: "submitted" });
  });
  it("회신 칸: 금액은 400, 가능 여부·사유는 저장", async () => {
    expect((await runAgentAction(cro, REQ, "quote_reply_fields", NO, { items: [{ seq: 1, amount: "1" }] })).body).toEqual({ error: "amount_not_allowed" });
    const r = await runAgentAction(cro, REQ, "quote_reply_fields", NO, { items: [{ seq: 2, avail: "불가", reason: "장비 없음" }] });
    expect(r.status).toBe(200);
    expect((fx.puts[0].items as { avail: string }[])[1].avail).toBe("불가");
  });
});
