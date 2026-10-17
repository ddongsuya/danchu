import { beforeEach, describe, expect, it, vi } from "vitest";

/* 실시간 비교 (2026-10-17): 견적 알림, 회신 마감(compared_at), 기한 연장으로 다시 열기 */
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
vi.mock("@/lib/quote-load", () => ({ loadQuote: async () => fx.loaded }));
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

describe("견적 제출 알림: 앱 알림은 견적마다, 메일은 요청의 첫 견적만", () => {
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
      expired: false, locked: false, declined: false, closed: false,
    };
    fx.respond = (q) => (q.table === "rfq_requests" ? { data: { user_id: "sponsor-1", email: "sponsor@example.com", reply_by: "2099-01-10" }, error: null } : { data: null, error: null });
  });
  const sponsorCall = () => calls().find((c) => c[0][0] === "sponsor-1");

  it("첫 견적: 비교표 링크, 기관명, 수정 가능 안내, 메일 한 통", async () => {
    expect((await submitQuote(json(body), ctx)).status).toBe(200);
    const c = sponsorCall();
    expect(c?.[1].href).toBe("/app/r/DC-2026-0001/compare");
    expect(c?.[1].title).toContain("바이오랩");
    expect(c?.[1].body).toContain("수정할 수 있습니다");
    expect(c?.[1].body).not.toContain("기한 후 공개");
    expect(c?.[2]?.to).toEqual(["sponsor@example.com"]);
  });
  it("두 번째 견적과 전원 회신은 앱 알림만 (메일 없음)", async () => {
    fx.saveQuote.mockResolvedValueOnce({ ok: true, quote_id: "quote-2", first: true, total_invites: 2, submitted_invites: 2 });
    expect((await submitQuote(json(body), ctx)).status).toBe(200);
    const c = sponsorCall();
    expect(c).toBeDefined();
    expect(c?.[2]).toBeUndefined();
  });
  it("수정 제출도 앱 알림만", async () => {
    fx.saveQuote.mockResolvedValueOnce({ ok: true, quote_id: "quote-1", first: false, total_invites: 3, submitted_invites: 1 });
    await submitQuote(json(body), ctx);
    expect(sponsorCall()?.[1].title).toContain("수정");
    expect(sponsorCall()?.[2]).toBeUndefined();
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
  const rfq = { id: "rfq-1", rfq_no: "DC-2026-0001", substance: "ABC-1", status: "quoted", compared_at: null, reply_by: "2099-01-10", user_id: "sponsor-1", email: "sponsor@example.com" } as unknown as RfqRow;
  const db = (closedNow: boolean) => (q: Q) => {
    if (q.table === "cro_quotes") return { data: null, error: null, count: 2 };
    if (q.table === "rfq_invites")
      return { data: [
        { id: "i1", token: "tok_aaaaaaa1", cro_org_id: null, cro_email: "a@example.com", status: "submitted" },
        { id: "i2", token: "tok_aaaaaaa2", cro_org_id: null, cro_email: "b@example.com", status: "submitted" },
        { id: "i3", token: "tok_aaaaaaa3", cro_org_id: null, cro_email: "c@example.com", status: "sent" },
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
    expect(sponsor?.[1].body).toContain("1곳 미회신");
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
  it("기한 전 마감은 미회신 기관이 있으면 의뢰자 요청 없이는 거절한다 (약관 제4조5항)", async () => {
    fx.session = admin;
    fx.rfq = rfq;
    fx.respond = db(true);
    const r = await closeRoute(json({}), { params: Promise.resolve({ no: "DC-2026-0001" }) });
    expect(r.status).toBe(400);
    expect((await r.json()).error).toContain("의뢰자가 마감을 요청한 경우");
    expect(fx.calls.some((c) => c.table === "rfq_requests" && c.op === "update")).toBe(false);
    expect(fx.notifyUsers).not.toHaveBeenCalled();
  });
  it("의뢰자 요청으로 기한 전에 마감하면 미회신 기관과 제출 기관 모두에 기관마다 알린다", async () => {
    fx.session = admin;
    fx.rfq = rfq;
    fx.respond = db(true);
    const r = await closeRoute(json({ sponsorRequested: true }), { params: Promise.resolve({ no: "DC-2026-0001" }) });
    expect(r.status).toBe(200);
    const toC = calls().filter((c) => c[2]?.to.includes("c@example.com"));
    expect(toC).toHaveLength(1);
    expect(toC[0][1].title).toContain("회신이 마감되었습니다");
    const toA = calls().filter((c) => c[2]?.to.includes("a@example.com"));
    expect(toA).toHaveLength(1);
    expect(toA[0][1].body).toContain("더 수정할 수 없습니다");
    // 기관마다 따로: 한 통에 다른 기관 주소가 섞이지 않는다
    expect(calls().some((c) => c[2]?.to.includes("a@example.com") && c[2]?.to.includes("b@example.com"))).toBe(false);
    expect(fx.logEvent.mock.calls[0][3]).toContain("의뢰자 요청");
    expect(fx.audit).toHaveBeenCalledWith(expect.anything(), "rfq.close_replies", expect.anything(), expect.objectContaining({ after: expect.objectContaining({ sponsor_requested: true }) }));
  });
  it("전원 회신했으면 기한 전이라도 의뢰자 요청 없이 마감하고 제출 기관에 알린다", async () => {
    fx.session = admin;
    fx.rfq = rfq;
    fx.respond = (q) => {
      if (q.table === "rfq_invites") return { data: [
        { id: "i1", token: "tok_aaaaaaa1", cro_org_id: null, cro_email: "a@example.com", status: "submitted" },
        { id: "i2", token: "tok_aaaaaaa2", cro_org_id: null, cro_email: "b@example.com", status: "declined" },
      ], error: null };
      return db(true)(q);
    };
    const r = await closeRoute(json({}), { params: Promise.resolve({ no: "DC-2026-0001" }) });
    expect(r.status).toBe(200);
    expect(calls().filter((c) => c[2]?.to.includes("a@example.com"))).toHaveLength(1);
    expect(calls().some((c) => c[2]?.to.includes("b@example.com"))).toBe(false);
  });
  it("제출된 견적이 없으면 마감하지 않는다", async () => {
    fx.respond = (q) => (q.table === "cro_quotes" ? { data: null, error: null, count: 0 } : { data: [], error: null });
    const r = await closeReplies(rfq, null, true);
    expect(r.ok).toBe(false);
    expect(fx.calls.some((c) => c.op === "update")).toBe(false);
  });
});

describe("기한 연장으로 마감된 회신을 다시 연다", () => {
  const ctx = { params: Promise.resolve({ no: "DC-2026-0001" }) };
  it("compared_at 을 비우고 견적 도착으로 되돌리며, 제출한 기관의 기한도 늘린다", async () => {
    fx.session = admin;
    fx.rfq = { id: "rfq-1", rfq_no: "DC-2026-0001", status: "compared", compared_at: "2026-10-11T00:00:00Z", selected_quote_id: null, reply_by: "2026-10-10", distributed_at: "2026-10-01T00:00:00Z", substance: "ABC-1", user_id: "sponsor-1" };
    fx.respond = (q) => {
      if (q.table === "cro_quotes") return { data: null, error: null, count: 1 };
      if (q.table === "rfq_invites" && q.op === "select") return { data: [{ id: "i1", token: "tok_aaaaaaa1", cro_org_id: null, cro_email: "a@example.com", status: "submitted" }], error: null };
      if (q.table === "rfq_requests" && q.op === "update") return { data: [{ id: "rfq-1" }], error: null };
      return { data: [], error: null };
    };
    const r = await changeDeadline(json({ replyBy: "2099-01-05" }), ctx);
    expect(r.status).toBe(200);
    const up = fx.calls.find((c) => c.table === "rfq_requests" && c.op === "update");
    expect(up?.payload).toEqual({ reply_by: "2099-01-05", compared_at: null, status: "quoted" });
    const inv = fx.calls.find((c) => c.table === "rfq_invites" && c.op === "update");
    expect(inv?.payload).toMatchObject({ reply_by: "2099-01-05" });
    expect(calls().some((c) => c[2]?.to.includes("a@example.com"))).toBe(true);
  });
  it("기한 전에 마감한 요청은 같은 기한으로 다시 열 수 있다", async () => {
    fx.session = admin;
    fx.rfq = { id: "rfq-1", rfq_no: "DC-2026-0001", status: "compared", compared_at: "2098-12-20T00:00:00Z", selected_quote_id: null, reply_by: "2099-01-05", distributed_at: "2098-12-01T00:00:00Z", substance: "ABC-1", user_id: "sponsor-1" };
    fx.respond = (q) => {
      if (q.table === "cro_quotes") return { data: null, error: null, count: 1 };
      if (q.table === "rfq_requests" && q.op === "update") return { data: [{ id: "rfq-1" }], error: null };
      return { data: [], error: null };
    };
    expect((await changeDeadline(json({ replyBy: "2099-01-05" }), ctx)).status).toBe(200);
    expect(fx.calls.find((c) => c.table === "rfq_requests" && c.op === "update")?.payload).toMatchObject({ compared_at: null, status: "quoted" });
  });
  it("열린 요청에 같은 기한을 다시 넣으면 거절한다", async () => {
    fx.session = admin;
    fx.rfq = { id: "rfq-1", rfq_no: "DC-2026-0001", status: "quoted", compared_at: null, selected_quote_id: null, reply_by: "2099-01-05" };
    expect((await changeDeadline(json({ replyBy: "2099-01-05" }), ctx)).status).toBe(400);
  });
  it("그 사이 의뢰자가 선정해 요청 행이 바뀌지 않았으면 초대 기한을 늘리지 않고 아무에게도 알리지 않는다", async () => {
    fx.session = admin;
    fx.rfq = { id: "rfq-1", rfq_no: "DC-2026-0001", status: "quoted", compared_at: null, selected_quote_id: null, reply_by: "2099-01-01", substance: "ABC-1", user_id: "sponsor-1" };
    fx.respond = (q) => {
      if (q.table === "rfq_requests" && q.op === "update") return { data: [], error: null };
      if (q.table === "rfq_invites" && q.op === "select") return { data: [{ id: "i1", token: "tok_aaaaaaa1", cro_org_id: null, cro_email: "a@example.com", status: "submitted" }], error: null };
      return { data: [], error: null };
    };
    expect((await changeDeadline(json({ replyBy: "2099-01-05" }), ctx)).status).toBe(409);
    expect(fx.calls.some((c) => c.table === "rfq_invites" && c.op === "update")).toBe(false);
    expect(fx.notifyUsers).not.toHaveBeenCalled();
  });
  it("선정한 요청은 다시 열지 않는다", async () => {
    fx.session = admin;
    fx.rfq = { id: "rfq-1", rfq_no: "DC-2026-0001", status: "selected", compared_at: null, selected_quote_id: "q1", reply_by: "2026-10-10" };
    expect((await changeDeadline(json({ replyBy: "2099-01-05" }), ctx)).status).toBe(400);
  });
});
