import { beforeEach, describe, expect, it, vi } from "vitest";

/* 참여 선택형 전환 (0023 적용 뒤 한 번): 열린 예전 요청의 참여 결정 기한 채우기, 관리 기관에 참여 안내 다시 보내기, 운영자 라우트 */
const fx = vi.hoisted(() => ({
  logEvent: vi.fn(async (..._a: unknown[]) => {}),
  sendMail: vi.fn(async (_m: { to: string[]; subject: string; html: string; replyTo?: string }) => true),
  audit: vi.fn(async (..._a: unknown[]) => {}),
  session: null as null | { userId: string; email: string; profile: { role: string } },
  respond: (_q: Q): { data: unknown; error: unknown } => ({ data: null, error: null }),
  calls: [] as Q[],
}));
type Q = { table: string; op: "select" | "insert" | "update" | "delete"; payload?: unknown; filters: [string, unknown][] };

function fakeDb() {
  const builder = (table: string) => {
    const q: Q = { table, op: "select", filters: [] };
    const finish = () => {
      fx.calls.push(q);
      return Promise.resolve(fx.respond(q));
    };
    const b: Record<string, unknown> = {};
    const rec = (tag: string) => (k: string, v: unknown) => (q.filters.push([`${tag}${k}`, v]), b);
    Object.assign(b, {
      select: () => b,
      insert: (p: unknown) => ((q.op = "insert"), (q.payload = p), b),
      update: (p: unknown) => ((q.op = "update"), (q.payload = p), b),
      eq: rec(""), is: rec("is:"), in: rec("in:"), gt: rec("gt:"), gte: rec("gte:"),
      order: () => b, limit: () => b,
      maybeSingle: () => finish(),
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => finish().then(res, rej),
    });
    return b;
  };
  return { from: builder, rpc: async () => ({ data: 25, error: null }) };
}

vi.mock("@/lib/supabase", () => ({ getSupabaseAdmin: () => fakeDb() }));
vi.mock("@/lib/schema-version", async (orig) => ({ ...(await orig<typeof import("@/lib/schema-version")>()), assertSchemaReady: async () => {} }));
vi.mock("@/lib/notify", () => ({
  logEvent: fx.logEvent,
  notifyUsers: async () => {},
  adminUserIds: async () => [],
  adminEmails: () => [],
  operatorReplyTo: () => "hello@danchu.kr",
  siteUrl: () => "https://danchu.kr",
}));
vi.mock("@/lib/mail", async (orig) => ({ ...(await orig<typeof import("@/lib/mail")>()), sendMail: fx.sendMail }));
vi.mock("@/lib/mail-preferences", () => ({ notificationRecipients: async (to: string[]) => to }));
vi.mock("@/lib/audit", async (orig) => ({ ...(await orig<typeof import("@/lib/audit")>()), audit: fx.audit }));
vi.mock("@/lib/rate-limit", async (orig) => ({ ...(await orig<typeof import("@/lib/rate-limit")>()), rateLimited: async () => false }));
vi.mock("@/lib/observe", () => ({ captureError: () => {}, sentryEnabled: () => false, maskEmail: (s: string) => s }));
vi.mock("@/lib/auth", () => ({
  sessionOrNull: async (role?: string) => {
    const s = fx.session;
    if (!s) return null;
    if (role && s.profile.role !== role && s.profile.role !== "admin") return null;
    return s;
  },
}));

import { legacyOpenRequests, planOptInTransition, runOptInTransition, TRANSITION_EVENT } from "@/lib/opt-in-transition";
import { GET as planRoute, POST as runRoute } from "@/app/api/admin/opt-in/transition/route";
import { getSupabaseAdmin } from "@/lib/supabase";

const TODAY = "2099-01-12"; // 월요일
const NOW = new Date("2099-01-12T09:00:00+09:00");
const sb = () => getSupabaseAdmin()!;

const rfqRow = (over: Record<string, unknown> = {}) => ({
  id: "rfq-1", rfq_no: "DC-2099-0001", status: "distributed", compared_at: null, selected_quote_id: null, join_by: null,
  cro_count: "3곳", reply_by: "2099-01-30", categories: ["일반독성"], substance: "비밀물질-7", intent: "비교 견적",
  confidentiality: "일반", org_type: "바이오텍", payload: {}, user_id: "sponsor-1", email: "sponsor@example.com", ...over,
});
const invRow = (id: string, org: string, over: Record<string, unknown> = {}) => ({ id, token: `tok_${id}_xxxxxxxx`, cro_org_id: org, cro_name: `기관${id}`, cro_email: `${id}@old.example.com`, reply_by: "2099-01-30", ...over });
const ORGS = [
  { id: "org-m", managed: true, status: "approved", contact_email: "bd@managed.example.com" },
  { id: "org-p", managed: false, status: "approved", contact_email: "bd@portal.example.com" },
  { id: "org-s", managed: true, status: "suspended", contact_email: "bd@stopped.example.com" },
];

/** 요청 목록·초대·기관·담당자로 답한다. moved 가 false 면 join_by 조건부 갱신이 0행 */
function world(rfqs: Record<string, unknown>[], invites: Record<string, unknown>[], moved = true) {
  fx.respond = (q) => {
    if (q.table === "rfq_requests" && q.op === "update") return { data: moved ? [{ id: "rfq-1" }] : [], error: null };
    if (q.table === "rfq_requests") return { data: rfqs, error: null };
    if (q.table === "rfq_invites" && q.op === "select") return { data: invites, error: null };
    if (q.table === "cro_orgs") {
      const ids = (q.filters.find(([k]) => k === "in:id")?.[1] as string[]) ?? [];
      return { data: ORGS.filter((o) => ids.includes(o.id)), error: null };
    }
    if (q.table === "profiles") return { data: [], error: null };
    return { data: null, error: null };
  };
}

beforeEach(() => {
  fx.logEvent.mockClear();
  fx.sendMail.mockClear();
  fx.sendMail.mockImplementation(async () => true);
  fx.audit.mockClear();
  fx.calls.length = 0;
  fx.session = null;
});

describe("전환 대상", () => {
  it("참여 결정 기한이 없는 열린 요청만 (배포·견적 도착, 마감·선정 전, 회신 기한 오늘 이후)", async () => {
    world([rfqRow()], []);
    await legacyOpenRequests(sb(), TODAY);
    const q = fx.calls.find((c) => c.table === "rfq_requests")!;
    expect(q.filters).toEqual(expect.arrayContaining([
      ["is:join_by", null],
      ["in:status", ["distributed", "quoted"]],
      ["is:compared_at", null],
      ["is:selected_quote_id", null],
      ["gte:reply_by", TODAY],
    ]));
  });

  it("미리 보기는 승인된 관리 기관의 결정 전 안내만 고르고 아무것도 쓰지 않는다", async () => {
    world([rfqRow()], [invRow("a", "org-m"), invRow("b", "org-p"), invRow("c", "org-s")]);
    const plan = await planOptInTransition(sb(), TODAY, NOW);
    expect(plan.offers).toBe(1);
    expect(plan.requests[0]).toMatchObject({ rfqNo: "DC-2099-0001", replyBy: "2099-01-30", offers: [{ inviteId: "a", croName: "기관a", to: ["bd@managed.example.com"] }] });
    // 월요일 기준 2영업일 = 수요일 자정(서울)
    expect(plan.requests[0].joinBy).toBe(new Date("2099-01-14T23:59:59+09:00").toISOString());
    // 결정 전 안내 조건: sent, 참여 기록 없음, 취소·철회 아님, 링크 만료 전
    const invQ = fx.calls.find((c) => c.table === "rfq_invites")!;
    expect(invQ.filters).toEqual(expect.arrayContaining([["status", "sent"], ["is:joined_at", null], ["is:revoked_at", null], ["is:withdrawn_at", null], ["gt:expires_at", NOW.toISOString()]]));
    expect(fx.calls.some((c) => c.op !== "select")).toBe(false);
    expect(fx.sendMail).not.toHaveBeenCalled();
  });
});

describe("전환 실행", () => {
  it("참여 결정 기한을 조건부로 채우고 관리 기관에만 전환 안내를 다시 보낸다", async () => {
    world([rfqRow()], [invRow("a", "org-m"), invRow("b", "org-p")]);
    const r = await runOptInTransition(sb(), "admin-1", TODAY, NOW);
    expect(r).toEqual({ requests: 1, mailed: 1, failed: [], skipped: [] });

    const upd = fx.calls.find((c) => c.table === "rfq_requests" && c.op === "update")!;
    expect(upd.payload).toEqual({ join_by: new Date("2099-01-14T23:59:59+09:00").toISOString() });
    expect(upd.filters).toEqual(expect.arrayContaining([["id", "rfq-1"], ["is:join_by", null], ["is:compared_at", null], ["is:selected_quote_id", null]]));

    expect(fx.sendMail).toHaveBeenCalledTimes(1);
    const m = fx.sendMail.mock.calls[0][0];
    expect(m.to).toEqual(["bd@managed.example.com"]);
    expect(m.replyTo).toBe("hello@danchu.kr");
    expect(m.subject).toContain("참여 안내 DC-2099-0001");
    expect(m.html).toContain("앞서 견적 요청으로 안내드린 요청입니다");
    expect(m.html).toContain("참여하기");
    expect(m.html).toContain("참여 결정 기한 2099-01-14");
    expect(m.html).toContain("https://danchu.kr/q/tok_a_xxxxxxxx");
    expect(m.html).not.toContain("비밀물질-7");
    expect(m.html).not.toMatch(/[–—]/);

    const mailedAt = fx.calls.find((c) => c.table === "rfq_invites" && c.op === "update")!;
    expect(mailedAt.filters).toContainEqual(["id", "a"]);
    expect(fx.logEvent.mock.calls.map((c) => c[1])).toEqual(["resend", TRANSITION_EVENT]);
    expect(fx.logEvent.mock.calls[1][5]).toMatchObject({ mailed: ["a"], failed: [] });
  });

  it("다른 운영자가 먼저 처리했거나 그 사이 마감·선정되면 건너뛰고 메일을 보내지 않는다", async () => {
    world([rfqRow()], [invRow("a", "org-m")], false);
    const r = await runOptInTransition(sb(), "admin-1", TODAY, NOW);
    expect(r).toEqual({ requests: 0, mailed: 0, failed: [], skipped: ["DC-2099-0001"] });
    expect(fx.sendMail).not.toHaveBeenCalled();
    expect(fx.logEvent).not.toHaveBeenCalled();
  });

  it("메일이 실패하면 결과와 이력에 남기고 다음 기관을 계속 보낸다", async () => {
    world([rfqRow()], [invRow("a", "org-m"), invRow("d", "org-m")]);
    fx.sendMail.mockImplementationOnce(async () => false);
    const r = await runOptInTransition(sb(), "admin-1", TODAY, NOW);
    expect(r.mailed).toBe(1);
    expect(r.failed).toEqual(["DC-2099-0001 · 기관a · 메일 발송 실패"]);
    expect(fx.logEvent.mock.calls.at(-1)?.[5]).toMatchObject({ mailed: ["d"], failed: ["a"] });
  });

  it("관리 기관 안내가 없는 요청도 참여 결정 기한은 채운다", async () => {
    world([rfqRow()], [invRow("b", "org-p")]);
    const r = await runOptInTransition(sb(), "admin-1", TODAY, NOW);
    expect(r).toMatchObject({ requests: 1, mailed: 0 });
    expect(fx.sendMail).not.toHaveBeenCalled();
    expect(fx.logEvent.mock.calls.map((c) => c[1])).toEqual([TRANSITION_EVENT]);
  });
});

describe("운영자 라우트", () => {
  it("운영자만 미리 보고 실행한다", async () => {
    world([rfqRow()], [invRow("a", "org-m")]);
    fx.session = { userId: "cro-1", email: "c@x.kr", profile: { role: "cro" } };
    expect((await planRoute()).status).toBe(403);
    expect((await runRoute()).status).toBe(403);
    expect(fx.sendMail).not.toHaveBeenCalled();
  });

  it("실행 결과를 문구로 돌려주고 운영 기록에 남긴다", async () => {
    world([rfqRow()], [invRow("a", "org-m")]);
    fx.session = { userId: "admin-1", email: "ops@danchu.kr", profile: { role: "admin" } };
    const plan = (await (await planRoute()).json()) as { offers: number };
    expect(plan.offers).toBe(1);
    const res = await runRoute();
    expect(res.status).toBe(200);
    const d = (await res.json()) as { message: string; mailed: number };
    expect(d.mailed).toBe(1);
    expect(d.message).toBe("열린 요청 1건을 참여 선택형으로 바꾸고, 관리 기관 1곳에 참여 안내를 다시 보냈습니다.");
    expect(d.message).not.toMatch(/[–—]/);
    expect(fx.audit).toHaveBeenCalledWith(expect.objectContaining({ userId: "admin-1" }), "rfq.opt_in_transition", expect.objectContaining({ type: "rfq_request", id: null }), expect.anything());
  });
});
