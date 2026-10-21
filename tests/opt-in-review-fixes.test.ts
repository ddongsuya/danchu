import { beforeEach, describe, expect, it, vi } from "vitest";

/* 참여 선택형 검토 반영 (2026-10-20): "지명 기관에만 안내" 운영자 수동 안내, 회신 기한 고정, 취소 초대 알림 제외, 의뢰자 목록 분모 */
type Q = { table: string; op: "select" | "insert" | "update" | "delete"; payload?: unknown; filters: [string, unknown][] };
const fx = vi.hoisted(() => ({
  session: null as null | { userId: string; email: string; profile: { role: string } },
  calls: [] as Q[],
  respond: (_q: Q): { data: unknown; error: unknown; count?: number } => ({ data: null, error: null }),
  rfq: null as unknown,
  audit: vi.fn(),
  logEvent: vi.fn(),
  notifyUsers: vi.fn(),
  distributeTo: vi.fn(async (..._a: unknown[]): Promise<Record<string, unknown>> => ({ sent: 1, mailed: 1, names: ["기관"], skipped: [] })),
  notifyInvitedOrgs: vi.fn(async (..._a: unknown[]) => {}),
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
      in: (k: string, v: unknown) => (q.filters.push([`in:${k}`, v]), b),
      order: chain, limit: chain,
      maybeSingle: finish,
      single: finish,
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => finish().then(res, rej),
    });
    return b;
  };
  return { getSupabaseAdmin: () => ({ from: builder }) };
});
vi.mock("@/lib/auth", () => ({
  sessionOrNull: async (role?: string) => {
    const s = fx.session;
    if (!s) return null;
    if (role && s.profile.role !== role) return null;
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
vi.mock("@/lib/distribute", () => ({ distributeTo: fx.distributeTo, notifyInvitedOrgs: fx.notifyInvitedOrgs, ORG_COLUMNS: "id" }));

import { POST as distributePost } from "@/app/api/admin/rfqs/[no]/distribute/route";
import { POST as deadlinePost } from "@/app/api/admin/rfqs/[no]/deadline/route";

const admin = { userId: "admin-1", email: "ops@danchu.kr", profile: { role: "admin" } };
const ORG = "00000000-0000-4000-8000-0000000000c1";
const ctx = { params: Promise.resolve({ no: "DC-2099-0001" }) };
const json = (body: unknown) => new Request("https://danchu.kr/x", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const rfqRow = (over: Record<string, unknown> = {}) => ({
  id: "rfq-1", rfq_no: "DC-2099-0001", status: "distributed", reply_by: "2099-03-31", nominees_only: false, auto_distribute: true,
  compared_at: null, selected_quote_id: null, distributed_at: "2099-01-01T00:00:00Z", categories: ["일반독성"], substance: "ABC-1", user_id: "sponsor-1", ...over,
});

vi.mock("@/lib/data", () => ({ getRfqByNo: async () => fx.rfq }));

beforeEach(() => {
  fx.session = admin;
  fx.calls = [];
  fx.respond = (q) => (q.table === "cro_orgs" ? { data: [{ id: ORG, name: "기관" }], error: null } : { data: null, error: null });
  fx.audit.mockClear();
  fx.distributeTo.mockClear();
  fx.notifyInvitedOrgs.mockClear();
  fx.rfq = rfqRow();
});

describe("참여 안내 추가: 회신 기한은 모든 기관이 같다", () => {
  it("요청에 회신 기한이 있으면 body 의 다른 날짜를 무시하고 요청 기한으로 안내한다", async () => {
    const r = await distributePost(json({ orgIds: [ORG], replyBy: "2099-04-30" }), ctx);
    expect(r.status).toBe(200);
    expect(fx.distributeTo.mock.calls[0][2]).toBe("2099-03-31");
  });
  it("요청에 기한이 없을 때만 고른 날짜를 쓴다", async () => {
    fx.rfq = rfqRow({ reply_by: null });
    await distributePost(json({ orgIds: [ORG], replyBy: "2099-04-30" }), ctx);
    expect(fx.distributeTo.mock.calls[0][2]).toBe("2099-04-30");
  });
});

describe("참여 안내 추가: '지명 기관에만 안내' 요청", () => {
  beforeEach(() => {
    fx.rfq = rfqRow({ nominees_only: true });
  });
  it("의뢰자 요청 확인과 사유가 없으면 409, 안내하지 않는다", async () => {
    const r = await distributePost(json({ orgIds: [ORG], replyBy: "2099-03-31" }), ctx);
    expect(r.status).toBe(409);
    expect((await r.json()).error).toContain("지명 기관에만 안내");
    expect(fx.distributeTo).not.toHaveBeenCalled();
    const r2 = await distributePost(json({ orgIds: [ORG], overrideNomineesOnly: true, overrideReason: " " }), ctx);
    expect(r2.status).toBe(409);
  });
  it("의뢰자 요청 확인과 사유가 있으면 안내하고 감사 기록에 사유를 남긴다", async () => {
    const r = await distributePost(json({ orgIds: [ORG], overrideNomineesOnly: true, overrideReason: "10/21 전화 요청" }), ctx);
    expect(r.status).toBe(200);
    expect(fx.distributeTo).toHaveBeenCalledTimes(1);
    expect(fx.audit).toHaveBeenCalledWith(expect.anything(), "rfq.distribute_override", expect.objectContaining({ id: "rfq-1" }), expect.objectContaining({ note: "10/21 전화 요청" }));
  });
});

describe("회신 기한 변경: 취소한 초대에는 알리지 않는다", () => {
  it("초대 조회에서 취소(revoked)를 빼고, 참여 결정 전 알림은 열린 안내에만", async () => {
    const offers = [
      { id: "i1", token: "t1", cro_org_id: null, cro_email: "a@x", status: "sent", joined_at: null, withdrawn_at: null, revoked_at: null },
      { id: "i2", token: "t2", cro_org_id: null, cro_email: "b@x", status: "draft", joined_at: "2099-01-02T00:00:00Z", withdrawn_at: null, revoked_at: null },
    ];
    fx.respond = (q) => {
      if (q.table === "rfq_requests" && q.op === "update") return { data: [{ id: "rfq-1" }], error: null };
      if (q.table === "rfq_invites" && q.op === "select") return { data: offers, error: null };
      return { data: null, error: null };
    };
    const r = await deadlinePost(json({ replyBy: "2099-04-30" }), ctx);
    expect(r.status).toBe(200);
    const sel = fx.calls.find((c) => c.table === "rfq_invites" && c.op === "select");
    expect(sel?.filters).toContainEqual(["is:revoked_at", null]);
    const undecided = fx.notifyInvitedOrgs.mock.calls.map((c) => (c[0] as { id: string }[]).map((i) => i.id));
    expect(undecided).toEqual([["i2"], ["i1"]]);
  });
});

describe("의뢰자 요청 목록: 제출 / 참여 기관 수", () => {
  it("분모는 자리를 차지한 참여 기관만 센다 (참여 결정 전·불참·철회·취소 제외)", async () => {
    const { listRequestsForUser } = await vi.importActual<typeof import("@/lib/data")>("@/lib/data");
    fx.respond = (q) => {
      if (q.table === "rfq_requests") return { data: [{ id: "rfq-1", rfq_no: "DC-2099-0001" }], error: null };
      if (q.table === "rfq_invites")
        return {
          data: [
            { rfq_id: "rfq-1", status: "submitted", joined_at: "t", withdrawn_at: null, revoked_at: null },
            { rfq_id: "rfq-1", status: "draft", joined_at: "t", withdrawn_at: null, revoked_at: null },
            { rfq_id: "rfq-1", status: "sent", joined_at: null, withdrawn_at: null, revoked_at: null },
            { rfq_id: "rfq-1", status: "declined", joined_at: null, withdrawn_at: null, revoked_at: null },
            { rfq_id: "rfq-1", status: "declined", joined_at: "t", withdrawn_at: "t", revoked_at: null },
            { rfq_id: "rfq-1", status: "expired", joined_at: "t", withdrawn_at: null, revoked_at: "t" },
          ],
          error: null,
        };
      return { data: null, error: null };
    };
    const [row] = await listRequestsForUser("sponsor-1");
    expect(row).toMatchObject({ invites: 2, submitted: 1 });
  });
});
