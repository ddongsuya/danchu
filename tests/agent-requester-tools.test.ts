import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * 의뢰자·공통 도구 (2026-11-20 설계안 D4)
 * - 기관 견적서 보기: 내 요청만, 비교표가 열린 뒤에만, 제출한 견적만
 * - 받은 계약서(안): 보내기 전이면 not_sent
 * - 알림 보기·읽음, 선정 없이 마무리·다시 열기·첨부는 웹 처리를 그대로 부른다
 */

const ME = "11111111-1111-4111-8111-111111111111";
const fx = vi.hoisted(() => ({
  rfq: null as null | Record<string, unknown>,
  calls: [] as { body: Record<string, unknown> }[],
  sent: null as string | null,
}));

vi.mock("@/lib/supabase", () => ({ getSupabaseAdmin: () => null }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, getAll: () => [] }) }));
vi.mock("@/lib/supabase-server", () => ({ createSessionClient: async () => null }));
vi.mock("@/lib/data", async (orig) => ({
  ...(await orig<object>()),
  getRfqByNo: async () => fx.rfq,
  ownsRfq: (r: { user_id: string }, id: string) => r.user_id === id,
  getRfqDetail: async () => ({ quotes: [{ id: "q1", status: "submitted", cro_name: "가람랩", cro_org_id: "o1", invite_id: "i1" }, { id: "q2", status: "draft" }] }),
  listNotifications: async () => ({ list: [{ id: "n1", kind: "견적", title: "새 견적", body: "x".repeat(200), href: "/app", read_at: null, created_at: "2026-11-20" }, { id: "n2", kind: "질의", title: "답변", body: null, href: null, read_at: "2026-11-20", created_at: "2026-11-19" }], hasMore: false }),
}));
vi.mock("@/lib/quote-doc-db", async (orig) => ({ ...(await orig<object>()), submittedDoc: async () => null }));
vi.mock("@/lib/contract-draft-db", async (orig) => ({ ...(await orig<object>()), awardForRfq: async () => ({ id: "a1" }), draftSentAt: async () => fx.sent, draftForAward: async () => ({ title: "계약서(안)" }) }));
vi.mock("@/lib/agent-act", async (orig) => ({
  ...(await orig<object>()),
  markVia: async () => undefined,
  callAs: async (_s: unknown, _r: unknown, _h: unknown, _p: unknown, body: Record<string, unknown>) => (fx.calls.push({ body }), { status: 200, body: { ok: true } }),
}));

import { catalogFor, runAgentAction } from "@/lib/agent-actions";
import type { AgentSession } from "@/lib/agent-api";

const requester = { userId: ME, email: "r@x.test", role: "requester", profile: { id: ME, role: "requester" }, org: null, pendingOrg: null } as unknown as AgentSession;
const REQ = new Request("https://danchu.example/api/agent/act");
const NO = "DC-2026-0004";

beforeEach(() => {
  fx.rfq = { id: "r1", rfq_no: NO, user_id: ME, compared_at: "2026-11-20T00:00:00Z", selected_quote_id: null };
  fx.calls = [];
  fx.sent = null;
});

describe("목록", () => {
  it("읽기는 비서 도구, 기관 밖으로 나가는 일은 확인 뒤", () => {
    const c = catalogFor(requester);
    for (const n of ["quote_view", "contract_draft_view", "notifications"]) expect(c.find((a) => a.name === n), n).toMatchObject({ level: "read", tool: true });
    for (const n of ["request_close", "request_reopen", "request_file_url", "request_file_done"]) expect(c.find((a) => a.name === n), n).toMatchObject({ level: "confirm", tool: false });
    expect(c.find((a) => a.name === "notifications_read")).toMatchObject({ level: "auto", tool: true });
  });
});

describe("기관 견적서 보기", () => {
  it("남의 요청은 404, 비교표가 열리기 전은 not_open", async () => {
    fx.rfq = { ...fx.rfq!, user_id: "someone" };
    expect((await runAgentAction(requester, REQ, "quote_view", NO, { quoteId: "q1" })).status).toBe(404);
    fx.rfq = { ...fx.rfq!, user_id: ME, compared_at: null };
    expect((await runAgentAction(requester, REQ, "quote_view", NO, { quoteId: "q1" })).body).toEqual({ error: "not_open" });
  });
  it("제출 안 한 견적은 404, 견적서가 없으면 doc_missing", async () => {
    expect((await runAgentAction(requester, REQ, "quote_view", NO, { quoteId: "q2" })).status).toBe(404);
    expect((await runAgentAction(requester, REQ, "quote_view", NO, { quoteId: "q1" })).body).toEqual({ error: "doc_missing" });
  });
});

describe("계약서(안)", () => {
  it("보내기 전이면 not_sent, 보낸 뒤에는 본문과 화면 주소", async () => {
    expect((await runAgentAction(requester, REQ, "contract_draft_view", NO, {})).body).toEqual({ error: "not_sent" });
    fx.sent = "2026-11-20";
    expect((await runAgentAction(requester, REQ, "contract_draft_view", NO, {})).body).toMatchObject({ sentAt: "2026-11-20", path: `/app/r/${NO}/contract` });
  });
});

describe("알림", () => {
  it("읽지 않은 것만 고를 수 있고 본문은 120자까지", async () => {
    const r = await runAgentAction(requester, REQ, "notifications", null, { unread: true });
    const list = r.body.notifications as { id: string; body: string }[];
    expect(list.map((n) => n.id)).toEqual(["n1"]);
    expect(list[0].body).toHaveLength(120);
  });
  it("읽음 처리는 웹 처리로", async () => {
    expect((await runAgentAction(requester, REQ, "notifications_read", null, { id: "22222222-2222-4222-8222-222222222222" })).status).toBe(200);
    expect(fx.calls[0].body).toEqual({ id: "22222222-2222-4222-8222-222222222222" });
  });
});

describe("마무리·다시 열기·첨부", () => {
  it("웹 처리에 본문을 그대로 넘긴다", async () => {
    await runAgentAction(requester, REQ, "request_close", NO, { outcome: "보류", note: "예산 재검토" });
    await runAgentAction(requester, REQ, "request_reopen", NO, {});
    await runAgentAction(requester, REQ, "request_file_url", NO, { name: "a.pdf", size: 10 });
    expect(fx.calls.map((c) => c.body)).toEqual([{ outcome: "보류", note: "예산 재검토" }, {}, { name: "a.pdf", size: 10 }]);
  });
});
