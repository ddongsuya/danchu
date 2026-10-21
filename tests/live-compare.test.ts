import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* 비교표 공개 (2026-10-20 결정 1) · 기한 전 마감 없음 (2026-10-21 결정 2) · 열린 비교표 고정 (결정 3): 견적 알림, 회신 마감(compared_at), 기한 변경 */
type Q = { table: string; op: "select" | "insert" | "update" | "delete"; payload?: unknown; filters: [string, unknown][] };
const fx = vi.hoisted(() => ({
  session: null as null | { userId: string; email: string; profile: { role: string } },
  calls: [] as Q[],
  respond: (_q: Q): { data: unknown; error: unknown; count?: number } => ({ data: null, error: null }),
  rfq: null as unknown,
  loaded: null as unknown,
  audit: vi.fn(),
  logEvent: vi.fn(),
  notifyUsers: vi.fn(),
  saveQuote: vi.fn(async (): Promise<Record<string, unknown>> => ({ ok: true, quote_id: "quote-1", first: true, total_invites: 3, submitted_invites: 1 })),
}));

vi.mock("@/lib/supabase", () => {
  const builder = (table: string) => {
    const q: Q = { table, op: "select", filters: [] };
    const finish = () => {
      fx.calls.push(q);
      return Promise.resolve(fx.respond(q));
    };
    const b: Record<string, unknown> = {};
    const chain = () => b;
    Object.assign(b, {
      select: chain,
      insert: (p: unknown) => ((q.op = "insert"), (q.payload = p), b),
      update: (p: unknown) => ((q.op = "update"), (q.payload = p), b),
      delete: () => ((q.op = "delete"), b),
      eq: (k: string, v: unknown) => (q.filters.push([k, v]), b),
      is: (k: string, v: unknown) => (q.filters.push([`is:${k}`, v]), b),
      in: chain, lt: chain, gte: chain, neq: chain, order: chain, limit: chain, contains: chain,
      maybeSingle: finish,
      single: finish,
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => finish().then(res, rej),
    });
    return b;
  };
  return { getSupabaseAdmin: () => ({ from: builder, storage: { from: () => ({ list: async () => ({ data: [], error: null }) }) } }) };
});
vi.mock("@/lib/auth", () => ({
  sessionOrNull: async (role?: string) => {
    const s = fx.session;
    if (!s) return null;
    if (role && s.profile.role !== role && s.profile.role !== "admin") return null;
    return s;
  },
}));
vi.mock("@/lib/audit", async (orig) => ({ ...(await orig<typeof import("@/lib/audit")>()), audit: fx.audit }));
vi.mock("@/lib/notify", () => ({
  logEvent: fx.logEvent,
  notifyUsers: fx.notifyUsers,
  adminUserIds: async () => ["admin-1"],
  adminEmails: () => [],
  operatorReplyTo: () => "hello@danchu.kr",
  siteUrl: () => "https://danchu.kr",
}));
vi.mock("@/lib/data", () => ({ getRfqByNo: async () => fx.rfq, ownsRfq: () => false }));
vi.mock("@/lib/quote-load", async (orig) => ({ ...(await orig<typeof import("@/lib/quote-load")>()), loadQuote: async () => fx.loaded }));
vi.mock("@/lib/rpc", async (orig) => ({ ...(await orig<typeof import("@/lib/rpc")>()), saveQuote: fx.saveQuote }));
vi.mock("@/lib/catalog-db", () => ({ learnFromSubmission: vi.fn(async () => {}) }));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: (fn: () => unknown) => void fn() }));

import { POST as submitQuote } from "@/app/api/quote/[token]/route";
import { POST as closeRoute } from "@/app/api/admin/rfqs/[no]/close-replies/route";
import { POST as changeDeadline } from "@/app/api/admin/rfqs/[no]/deadline/route";
import { closeReplies } from "@/lib/compare";
import type { RfqRow } from "@/lib/data";

const admin = { userId: "admin-1", email: "ops@danchu.kr", profile: { role: "admin" } };
const json = (body: unknown) => new Request("https://danchu.kr/x", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
type Call = [string[], { title: string; body?: string; href?: string }, { to: string[]; subject?: string } | undefined];
const calls = () => fx.notifyUsers.mock.calls as unknown as Call[];

beforeEach(() => {
  fx.session = null;
  fx.calls = [];
  fx.respond = () => ({ data: null, error: null });
  fx.audit.mockReset();
  fx.logEvent.mockReset();
  fx.notifyUsers.mockReset();
  fx.saveQuote.mockClear();
});

describe("견적 제출 알림: 비교표가 열리기 전에는 진행 현황만 (2026-10-20 결정 1)", () => {
  const ctx = { params: Promise.resolve({ token: "tok_abcdefgh" }) };
  const body = {
    items: [{ seq: 1, avail: "가능", amount: "12000000", weeks: "6", reason: "" }],
    note: "",
    common: { validUntil: "2099-01-31", startDate: "2099-01-01", payTerms: "", substanceQty: "", reportLang: "", includes: [] },
  };
  beforeEach(() => {
    fx.loaded = {
      rfq: { no: "DC-2026-0001", rows: [{ seq: 1, category: "일반독성", name: "4주 반복투여", cond: "" }] },
      draft: { items: [], note: "", pdfName: "기관견적.pdf", status: "draft", common: {} },
      inviteId: "inv-1", rfqId: "rfq-1", croName: "바이오랩", croOrgId: null, token: "tok_abcdefgh",
      expired: false, locked: false, declined: false, closed: false, joined: true, withdrawn: false,
    };
    fx.respond = (q) => (q.table === "rfq_requests" ? { data: { user_id: "sponsor-1", email: "sponsor@example.com", reply_by: "2099-01-10" }, error: null } : { data: null, error: null });
  });
  const sponsorCall = () => calls().find((c) => c[0][0] === "sponsor-1");

  it("첫 견적: 요청 화면 링크, 기관명·금액 없이 참여·제출 수만, 메일 한 통", async () => {
    expect((await submitQuote(json(body), ctx)).status).toBe(200);
    const c = sponsorCall();
    expect(c?.[1].href).toBe("/app/r/DC-2026-0001");
    expect(`${c?.[1].title} ${c?.[1].body}`).not.toContain("바이오랩");
    expect(`${c?.[1].title} ${c?.[1].body}`).not.toMatch(/12,?000,?000|1,200만/);
    expect(c?.[1].body).toContain("비교표가 열리면");
    expect(c?.[2]?.to).toEqual(["sponsor@example.com"]);
  });
  it("두 번째 견적과 전원 회신은 앱 알림만 (메일 없음)", async () => {
    fx.saveQuote.mockResolvedValueOnce({ ok: true, quote_id: "quote-2", first: true, total_invites: 2, submitted_invites: 2 });
    expect((await submitQuote(json(body), ctx)).status).toBe(200);
    const c = sponsorCall();
    expect(c).toBeDefined();
    expect(c?.[2]).toBeUndefined();
  });
  it("의뢰자 알림의 분모는 안내한 기관 수가 아니라 참여한 기관 수다 (안내 수·불참 수를 알리지 않는다, 0023)", async () => {
    fx.saveQuote.mockResolvedValueOnce({ ok: true, quote_id: "quote-1", first: true, total_invites: 9, submitted_invites: 1, joined_invites: 3 });
    await submitQuote(json(body), ctx);
    expect(sponsorCall()?.[1].body).toContain("참여 3곳 중 1곳 제출");
    expect(sponsorCall()?.[1].body).not.toContain("9");
    // 운영자 알림은 안내 전체 기준 그대로
    expect(calls().find((c) => c[0][0] === "admin-1")?.[1].title).toContain("회신 1/9");
  });
  it("수정 제출은 진행 현황을 바꾸지 않으므로 의뢰자에게 알리지 않는다", async () => {
    fx.saveQuote.mockResolvedValueOnce({ ok: true, quote_id: "quote-1", first: false, total_invites: 3, submitted_invites: 1 });
    await submitQuote(json(body), ctx);
    expect(sponsorCall()).toBeUndefined();
    expect(calls().find((c) => c[0][0] === "admin-1")?.[1].body).toContain("수정");
  });
  it("마지막 참여 기관의 제출로 비교표가 열리면 견적 알림 대신 비교표 알림을 한 번 보낸다 (save_quote compare_opened)", async () => {
    fx.saveQuote.mockResolvedValueOnce({ ok: true, quote_id: "quote-2", first: true, total_invites: 4, submitted_invites: 2, joined_invites: 2, compare_opened: true });
    fx.respond = (q) => {
      if (q.table === "rfq_requests") return { data: { id: "rfq-1", rfq_no: "DC-2026-0001", user_id: "sponsor-1", email: "sponsor@example.com", substance: "ABC-1" }, error: null };
      if (q.table === "cro_quotes") return { data: null, error: null, count: 2 };
      return { data: [], error: null };
    };
    expect((await submitQuote(json(body), ctx)).status).toBe(200);
    // 비교표 알림은 응답 뒤(after)에 간다
    await vi.waitFor(() => expect(calls().some((c) => c[0][0] === "sponsor-1")).toBe(true));
    const sponsor = calls().filter((c) => c[0][0] === "sponsor-1");
    expect(sponsor).toHaveLength(1);
    expect(sponsor[0][1].title).toContain("비교표가 열렸습니다");
    expect(sponsor[0][2]?.to).toEqual(["sponsor@example.com"]);
    expect(fx.logEvent.mock.calls.some((c) => c[1] === "compared")).toBe(true);
  });
  it("화면을 연 뒤 선정·마감되면 save_quote 의 closed 를 409 로 돌려준다", async () => {
    fx.saveQuote.mockResolvedValueOnce({ ok: false, code: "closed" });
    const r = await submitQuote(json(body), ctx);
    expect(r.status).toBe(409);
    expect((await r.json()).error).toContain("회신이 닫혔습니다");
    expect(sponsorCall()).toBeUndefined();
  });
});

describe("회신 마감 (compared_at = 회신 마감 시각)", () => {
  // 기본은 회신 기한이 지난 요청 (예약 작업이 여는 경우). 기한 전 요청은 early
  const rfq = { id: "rfq-1", rfq_no: "DC-2026-0001", substance: "ABC-1", status: "quoted", compared_at: null, reply_by: "2026-01-10", user_id: "sponsor-1", email: "sponsor@example.com" } as unknown as RfqRow;
  const early = { ...rfq, reply_by: "2099-01-10" } as unknown as RfqRow;
  const db = (closedNow: boolean) => (q: Q) => {
    if (q.table === "cro_quotes") return { data: null, error: null, count: 2 };
    if (q.table === "rfq_invites")
      return { data: [
        { id: "i1", token: "tok_aaaaaaa1", cro_org_id: null, cro_email: "a@example.com", status: "submitted" },
        { id: "i2", token: "tok_aaaaaaa2", cro_org_id: null, cro_email: "b@example.com", status: "submitted" },
        { id: "i3", token: "tok_aaaaaaa3", cro_org_id: null, cro_email: "c@example.com", status: "sent", joined_at: "2026-10-02T00:00:00Z" },
        // 참여 결정 전 안내는 미회신으로 세지 않는다 (0023)
        { id: "i4", token: "tok_aaaaaaa4", cro_org_id: null, cro_email: "d@example.com", status: "sent", joined_at: null },
      ], error: null };
    if (q.table === "rfq_requests" && q.op === "update") return { data: closedNow ? [{ id: "rfq-1" }] : [], error: null };
    return { data: [], error: null };
  };

  it("한 번만 마감하고 의뢰자에게 요약을 보낸다. 상태는 compared", async () => {
    fx.respond = db(true);
    const r = await closeReplies(rfq, null, true);
    expect(r).toMatchObject({ ok: true, count: 2, pending: 1 });
    const up = fx.calls.find((c) => c.table === "rfq_requests" && c.op === "update");
    expect(up?.payload).toMatchObject({ status: "compared" });
    expect(up?.filters).toContainEqual(["is:compared_at", null]);
    const sponsor = calls().find((c) => c[0][0] === "sponsor-1");
    expect(sponsor?.[1].body).toContain("1곳 미제출");
    expect(sponsor?.[2]?.to).toEqual(["sponsor@example.com"]);
    // 기한 후 자동 마감은 기관에 따로 알리지 않는다
    expect(calls().some((c) => c[2]?.to.includes("c@example.com"))).toBe(false);
  });
  it("이미 다른 쪽이 마감했으면 요약을 다시 보내지 않는다", async () => {
    fx.respond = db(false);
    const r = await closeReplies(rfq, null, true);
    expect(r.ok).toBe(false);
    expect(fx.notifyUsers).not.toHaveBeenCalled();
  });
  const ctxNo = { params: Promise.resolve({ no: "DC-2026-0001" }) };
  it("의뢰자 요청 기한 전 마감은 없다: { sponsorRequested: true } 를 보내도 409 이고 아무것도 바꾸지 않는다 (2026-10-21 결정 2)", async () => {
    fx.session = admin;
    fx.rfq = early;
    fx.respond = db(true);
    const r = await closeRoute(json({ sponsorRequested: true }), ctxNo);
    expect(r.status).toBe(409);
    const d = await r.json();
    expect(d.code).toBe("early_close_removed");
    expect(d.error).toContain("회신 기한 전에는 회신을 마감할 수 없습니다");
    expect(d.error).not.toContain("의뢰자");
    expect(fx.calls.some((c) => c.op === "update")).toBe(false);
    expect(fx.notifyUsers).not.toHaveBeenCalled();
    expect(fx.audit).not.toHaveBeenCalled();
  });
  it("참여한 기관이 모두 제출했어도 기한 전 운영자 마감은 409 다 (참여 마감 뒤 전원 제출은 DB 가 연다)", async () => {
    fx.session = admin;
    fx.rfq = early;
    fx.respond = (q) => {
      if (q.table === "rfq_invites") return { data: [
        { id: "i1", token: "tok_aaaaaaa1", cro_org_id: null, cro_email: "a@example.com", status: "submitted", joined_at: "2026-10-02T00:00:00Z" },
      ], error: null };
      return db(true)(q);
    };
    expect((await closeRoute(json({}), ctxNo)).status).toBe(409);
    expect(fx.calls.some((c) => c.op === "update")).toBe(false);
  });
  it("closeReplies 도 기한 전이면 열지 않는다 (예약 작업·운영자 공통)", async () => {
    fx.respond = db(true);
    const r = await closeReplies(early, "admin-1", false);
    expect(r.ok).toBe(false);
    expect(fx.calls.some((c) => c.op === "update")).toBe(false);
  });
  it("회신 기한이 지난 요청은 운영자가 예약 작업보다 먼저 열 수 있다. 기관에는 앱 알림만, 메일은 의뢰자에게만", async () => {
    fx.session = admin;
    fx.rfq = rfq;
    fx.respond = db(true);
    const r = await closeRoute(json({}), ctxNo);
    expect(r.status).toBe(200);
    const up = fx.calls.find((c) => c.table === "rfq_requests" && c.op === "update");
    expect(up?.payload).toMatchObject({ status: "compared" });
    expect(calls().some((c) => c[2]?.to.some((t) => t !== "sponsor@example.com"))).toBe(false);
    expect(fx.audit).toHaveBeenCalledWith(expect.anything(), "rfq.close_replies", expect.anything(), expect.objectContaining({ after: expect.not.objectContaining({ sponsor_requested: expect.anything() }) }));
  });
  it("의뢰자 요청 마감 코드와 화면 조작이 남아 있지 않다", () => {
    const src = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
    for (const f of ["lib/compare.ts", "app/api/admin/rfqs/[no]/close-replies/route.ts", "components/admin/AdminActions.tsx"]) {
      const code = src(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(code).not.toMatch(/sponsorRequested|sponsor_requested/);
      expect(code).not.toMatch(/제4조\s*제?7항|4조7항/);
    }
    // 운영자 마감 버튼은 회신 기한이 지난 요청에서만 보인다
    expect(src("components/admin/AdminActions.tsx")).toMatch(/canClose = [^;]*!early/);
  });
  it("견적 수를 읽지 못하면 '견적 없음'이 아니라 실패로 돌려준다 (예약 작업이 회신 없음 안내를 보내지 않게)", async () => {
    fx.respond = (q) => (q.table === "cro_quotes" ? { data: null, error: { message: "timeout" }, count: undefined } : db(true)(q));
    const r = await closeReplies(rfq, null, true);
    expect(r).toMatchObject({ ok: false, failed: true });
    expect(fx.calls.some((c) => c.op === "update")).toBe(false);
    expect(fx.notifyUsers).not.toHaveBeenCalled();
    fx.respond = (q) => (q.table === "rfq_invites" ? { data: null, error: { message: "timeout" } } : db(true)(q));
    expect(await closeReplies(rfq, null, true)).toMatchObject({ ok: false, failed: true });
  });
  it("운영자 회신 마감도 읽기 오류는 500 으로 알린다", async () => {
    fx.session = admin;
    fx.rfq = rfq;
    fx.respond = (q) => (q.table === "cro_quotes" ? { data: null, error: { message: "timeout" } } : db(true)(q));
    expect((await closeRoute(json({}), ctxNo)).status).toBe(500);
    expect(fx.audit).not.toHaveBeenCalled();
  });
  it("제출된 견적이 없으면 마감하지 않는다", async () => {
    fx.respond = (q) => (q.table === "cro_quotes" ? { data: null, error: null, count: 0 } : { data: [], error: null });
    const r = await closeReplies(rfq, null, true);
    expect(r.ok).toBe(false);
    expect(fx.calls.some((c) => c.op === "update")).toBe(false);
  });
});

describe("열린 비교표는 다시 열지 않고 회신 기한도 바꾸지 않는다 (2026-10-21 결정 3)", () => {
  const ctx = { params: Promise.resolve({ no: "DC-2026-0001" }) };
  const opened = { id: "rfq-1", rfq_no: "DC-2026-0001", status: "compared", compared_at: "2026-10-11T00:00:00Z", selected_quote_id: null, reply_by: "2026-10-10", distributed_at: "2026-10-01T00:00:00Z", substance: "ABC-1", user_id: "sponsor-1" };
  it("비교표가 열린 요청의 기한 연장은 409 이고 분명한 한국어 안내를 준다. 요청·초대를 바꾸지 않고 아무에게도 알리지 않는다", async () => {
    fx.session = admin;
    fx.rfq = opened;
    fx.respond = (q) => (q.table === "rfq_requests" && q.op === "update" ? { data: [{ id: "rfq-1" }], error: null } : { data: [], error: null });
    const r = await changeDeadline(json({ replyBy: "2099-01-05" }), ctx);
    expect(r.status).toBe(409);
    const d = await r.json();
    expect(d.code).toBe("compare_locked");
    expect(d.error).toBe("비교표가 열린 요청은 회신 기한을 바꾸거나 회신을 다시 열 수 없습니다. 받은 견적으로 선정하시거나, 더 받아야 하면 새 요청으로 보내 주세요.");
    expect(fx.calls.some((c) => c.op === "update")).toBe(false);
    expect(fx.notifyUsers).not.toHaveBeenCalled();
    expect(fx.audit).not.toHaveBeenCalled();
  });
  it("같은 기한으로 다시 열기(compared_at 비우기)도 409", async () => {
    fx.session = admin;
    fx.rfq = { ...opened, reply_by: "2099-01-05", compared_at: "2098-12-20T00:00:00Z" };
    expect((await changeDeadline(json({ replyBy: "2099-01-05" }), ctx)).status).toBe(409);
    expect(fx.calls.some((c) => c.op === "update")).toBe(false);
  });
  it("보류·종료 뒤에도 비교표가 열린 요청이면 409 (상태보다 compared_at 을 먼저 본다)", async () => {
    fx.session = admin;
    fx.rfq = { ...opened, status: "closed" };
    expect((await changeDeadline(json({ replyBy: "2099-01-05" }), ctx)).status).toBe(409);
  });
  it("열리기 전에는 기한을 늘릴 수 있다. compared_at 을 건드리지 않고, 조건부 갱신으로 그 사이 열린 요청은 바꾸지 않는다", async () => {
    fx.session = admin;
    fx.rfq = { id: "rfq-1", rfq_no: "DC-2026-0001", status: "quoted", compared_at: null, selected_quote_id: null, reply_by: "2026-10-10", distributed_at: "2026-10-01T00:00:00Z", substance: "ABC-1", user_id: "sponsor-1" };
    fx.respond = (q) => {
      if (q.table === "rfq_invites" && q.op === "select") return { data: [{ id: "i1", token: "tok_aaaaaaa1", cro_org_id: null, cro_email: "a@example.com", status: "submitted" }], error: null };
      if (q.table === "rfq_requests" && q.op === "update") return { data: [{ id: "rfq-1" }], error: null };
      return { data: [], error: null };
    };
    const r = await changeDeadline(json({ replyBy: "2099-01-05" }), ctx);
    expect(r.status).toBe(200);
    const up = fx.calls.find((c) => c.table === "rfq_requests" && c.op === "update");
    expect(up?.payload).toEqual({ reply_by: "2099-01-05" });
    expect(up?.filters).toContainEqual(["is:compared_at", null]);
    expect(up?.filters).toContainEqual(["is:selected_quote_id", null]);
    const inv = fx.calls.find((c) => c.table === "rfq_invites" && c.op === "update");
    expect(inv?.payload).toMatchObject({ reply_by: "2099-01-05" });
    expect(calls().find((c) => c[2]?.to.includes("a@example.com"))?.[1].body).toContain("비교표가 열리면 수정과 다시 제출은 닫힙니다");
  });
  it("그 사이 비교표가 열렸으면(조건부 갱신 0건) 409 이고 초대 기한을 늘리지 않는다", async () => {
    fx.session = admin;
    fx.rfq = { id: "rfq-1", rfq_no: "DC-2026-0001", status: "quoted", compared_at: null, selected_quote_id: null, reply_by: "2099-01-01", substance: "ABC-1", user_id: "sponsor-1" };
    fx.respond = (q) => {
      if (q.table === "rfq_requests" && q.op === "update") return { data: [], error: null };
      return { data: [], error: null };
    };
    const r = await changeDeadline(json({ replyBy: "2099-01-05" }), ctx);
    expect(r.status).toBe(409);
    expect((await r.json()).error).toContain("그 사이 비교표가 열렸거나");
    expect(fx.calls.some((c) => c.table === "rfq_invites" && c.op === "update")).toBe(false);
    expect(fx.notifyUsers).not.toHaveBeenCalled();
  });
  it("열린 요청에 같은 기한을 다시 넣으면 거절한다", async () => {
    fx.session = admin;
    fx.rfq = { id: "rfq-1", rfq_no: "DC-2026-0001", status: "quoted", compared_at: null, selected_quote_id: null, reply_by: "2099-01-05" };
    expect((await changeDeadline(json({ replyBy: "2099-01-05" }), ctx)).status).toBe(400);
  });
  it("선정한 요청은 기한을 바꾸지 않는다", async () => {
    fx.session = admin;
    fx.rfq = { id: "rfq-1", rfq_no: "DC-2026-0001", status: "selected", compared_at: null, selected_quote_id: "q1", reply_by: "2026-10-10" };
    expect((await changeDeadline(json({ replyBy: "2099-01-05" }), ctx)).status).toBe(400);
  });
});

describe("참여 결정 기한 연장 (운영자, 요청마다 한 번, 0023)", () => {
  const ctx = { params: Promise.resolve({ no: "DC-2026-0001" }) };
  const base = {
    id: "rfq-1", rfq_no: "DC-2026-0001", status: "distributed", compared_at: null, selected_quote_id: null, reply_by: "2099-01-20",
    join_by: "2099-01-05T14:59:59.000Z", join_by_extended_at: null, categories: ["일반독성"], substance: "ABC-1", user_id: "sponsor-1", distributed_at: "2099-01-01T00:00:00Z",
  };
  const offers = [
    { id: "i-u", token: "tok_undecided", cro_org_id: null, cro_email: "undecided@example.com", status: "sent", joined_at: null, expires_at: "2099-01-27T14:59:59Z" },
    { id: "i-j", token: "tok_joined001", cro_org_id: null, cro_email: "joined@example.com", status: "sent", joined_at: "2099-01-02T00:00:00Z", expires_at: "2099-01-27T14:59:59Z" },
  ];
  const db = (updated = true) => (q: Q) => {
    if (q.table === "rfq_requests" && q.op === "update") return { data: updated ? [{ id: "rfq-1" }] : [], error: null };
    if (q.table === "rfq_invites" && q.op === "select") return { data: offers, error: null };
    return { data: [], error: null };
  };

  it("한 번 늘리고, 참여 결정 전 기관에만 시험물질명 없이 알린다. 의뢰자에게도 알린다", async () => {
    fx.session = admin;
    fx.rfq = base;
    fx.respond = db();
    const r = await changeDeadline(json({ joinBy: "2099-01-08" }), ctx);
    expect(r.status).toBe(200);
    const up = fx.calls.find((c) => c.table === "rfq_requests" && c.op === "update");
    expect(up?.payload).toMatchObject({ join_by: new Date("2099-01-08T23:59:59+09:00").toISOString() });
    expect((up?.payload as Record<string, unknown>).join_by_extended_at).toEqual(expect.any(String));
    // 한 번만: 연장 기록이 비어 있을 때만 바꾼다 (조건부 갱신)
    expect(up?.filters).toContainEqual(["is:join_by_extended_at", null]);
    expect(up?.filters).toContainEqual(["is:selected_quote_id", null]);
    // 회신 기한·초대 기한은 그대로
    expect(fx.calls.some((c) => c.table === "rfq_invites" && c.op === "update")).toBe(false);
    const toU = calls().filter((c) => c[2]?.to.includes("undecided@example.com"));
    expect(toU).toHaveLength(1);
    expect(toU[0][1].title).toContain("참여 결정 기한이 2099-01-08로 늘었습니다");
    expect(`${toU[0][1].title} ${toU[0][1].body}`).not.toContain("ABC-1");
    expect(calls().some((c) => c[2]?.to.includes("joined@example.com"))).toBe(false);
    expect(calls().find((c) => c[0][0] === "sponsor-1")?.[1].title).toContain("참여 결정 기한");
    expect(fx.audit).toHaveBeenCalledWith(expect.anything(), "rfq.join_by", expect.anything(), expect.anything());
    expect(fx.logEvent.mock.calls[0][1]).toBe("join_by_extended");
  });
  it("이미 한 번 늘렸으면 409", async () => {
    fx.session = admin;
    fx.rfq = { ...base, join_by_extended_at: "2099-01-03T00:00:00Z" };
    fx.respond = db();
    const r = await changeDeadline(json({ joinBy: "2099-01-08" }), ctx);
    expect(r.status).toBe(409);
    expect((await r.json()).error).toContain("한 번만");
    expect(fx.calls.some((c) => c.op === "update")).toBe(false);
  });
  it("회신 기한을 넘기거나 지금 기한보다 이르면 400", async () => {
    fx.session = admin;
    fx.rfq = base;
    fx.respond = db();
    expect((await changeDeadline(json({ joinBy: "2099-01-21" }), ctx)).status).toBe(400);
    expect((await changeDeadline(json({ joinBy: "2099-01-05" }), ctx)).status).toBe(400);
    expect((await changeDeadline(json({ joinBy: "2099-1-8" }), ctx)).status).toBe(400);
    expect(fx.calls.some((c) => c.op === "update")).toBe(false);
  });
  it("참여 결정 기한이 없는 예전 요청, 회신 마감된 요청은 늘리지 않는다", async () => {
    fx.session = admin;
    fx.respond = db();
    fx.rfq = { ...base, join_by: null };
    expect((await changeDeadline(json({ joinBy: "2099-01-08" }), ctx)).status).toBe(400);
    fx.rfq = { ...base, status: "compared", compared_at: "2099-01-21T00:00:00Z" };
    expect((await changeDeadline(json({ joinBy: "2099-01-08" }), ctx)).status).toBe(409);
  });
  it("그 사이 다른 운영자가 먼저 늘렸으면 409 이고 아무에게도 알리지 않는다", async () => {
    fx.session = admin;
    fx.rfq = base;
    fx.respond = db(false);
    expect((await changeDeadline(json({ joinBy: "2099-01-08" }), ctx)).status).toBe(409);
    expect(fx.notifyUsers).not.toHaveBeenCalled();
  });
  it("운영자만 할 수 있다", async () => {
    fx.session = { userId: "sponsor-1", email: "s@example.com", profile: { role: "requester" } };
    fx.rfq = base;
    expect((await changeDeadline(json({ joinBy: "2099-01-08" }), ctx)).status).toBe(403);
  });
});

describe("회신 기한 변경 알림: 참여 결정 전 기관에는 시험물질명을 쓰지 않는다", () => {
  it("참여한 기관은 물질명과 함께, 참여 결정 전 기관은 분야만", async () => {
    fx.session = admin;
    fx.rfq = { id: "rfq-1", rfq_no: "DC-2026-0001", status: "distributed", compared_at: null, selected_quote_id: null, reply_by: "2099-01-01", substance: "ABC-1", categories: ["일반독성"], user_id: null };
    fx.respond = (q) => {
      if (q.table === "rfq_requests" && q.op === "update") return { data: [{ id: "rfq-1" }], error: null };
      if (q.table === "rfq_invites" && q.op === "select") return { data: [
        { id: "i1", token: "tok_aaaaaaa1", cro_org_id: null, cro_email: "joined@example.com", status: "sent", joined_at: "2026-10-02T00:00:00Z" },
        { id: "i2", token: "tok_aaaaaaa2", cro_org_id: null, cro_email: "undecided@example.com", status: "sent", joined_at: null },
      ], error: null };
      return { data: [], error: null };
    };
    expect((await changeDeadline(json({ replyBy: "2099-01-05" }), { params: Promise.resolve({ no: "DC-2026-0001" }) })).status).toBe(200);
    expect(calls().find((c) => c[2]?.to.includes("joined@example.com"))?.[1].body).toContain("ABC-1");
    const u = calls().find((c) => c[2]?.to.includes("undecided@example.com"));
    expect(`${u?.[1].title} ${u?.[1].body}`).not.toContain("ABC-1");
    expect(u?.[1].body).toContain("일반독성 견적 요청");
  });
});
