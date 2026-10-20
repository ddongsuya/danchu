import { beforeEach, describe, expect, it, vi } from "vitest";

/* ── 공용 가짜 DB: from(table) 체인을 기록하고 fixture.respond 로 답한다 ── */
type Q = { table: string; op: "select" | "insert" | "update" | "delete"; payload?: unknown; filters: [string, unknown][] };
const fx = vi.hoisted(() => ({
  session: null as null | { userId: string; email: string; profile: { role: string } },
  calls: [] as Q[],
  respond: (_q: Q): { data: unknown; error: unknown; count?: number } => ({ data: null, error: null }),
  rfq: null as unknown,
  loaded: null as unknown,
  loadOpts: [] as unknown[],
  audit: vi.fn(),
  logEvent: vi.fn(),
  notifyUsers: vi.fn(),
  learn: vi.fn(async () => {}),
  saveQuote: vi.fn(async () => ({ ok: true, quote_id: "quote-1", first: true, total_invites: 3, submitted_invites: 1 })),
  setSeatCount: vi.fn(async (..._a: unknown[]): Promise<Record<string, unknown>> => ({ ok: true, used: 0, before: "3곳" })),
  reportContract: vi.fn(async () => ({ ok: true, rfq_id: "rfq-1", rfq_no: "DC-2026-0001", user_id: "sponsor-1", substance: "ABC-1", corrected: false })),
  org: null as unknown,
  selectQuote: vi.fn(async () => ({ ok: true, award_id: "award-1", invite_id: "inv-w", cro_org_id: "org-managed", cro_name: "바이오랩" })),
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
      in: chain, is: chain, lt: chain, gte: chain, neq: chain, order: chain, limit: chain,
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
  viewerLoadOpts: async () => ({ markOpened: fx.session?.profile.role !== "admin", operator: fx.session?.profile.role === "admin" }),
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
vi.mock("@/lib/data", () => ({ getRfqByNo: async () => fx.rfq, getCroOrg: async () => fx.org, ownsRfq: () => false }));
vi.mock("@/lib/quote-load", async (orig) => ({
  ...(await orig<typeof import("@/lib/quote-load")>()),
  loadQuote: async (_token: string, opts?: unknown) => {
    fx.loadOpts.push(opts);
    return fx.loaded;
  },
}));
vi.mock("@/lib/rpc", async (orig) => ({ ...(await orig<typeof import("@/lib/rpc")>()), saveQuote: fx.saveQuote, reportContract: fx.reportContract, selectQuote: fx.selectQuote, setSeatCount: fx.setSeatCount }));
vi.mock("@/lib/catalog-db", () => ({ learnFromSubmission: fx.learn }));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: (fn: () => unknown) => void fn() }));

import { POST as createOrg } from "@/app/api/admin/cros/route";
import { POST as setContractStatus } from "@/app/api/admin/awards/[id]/contract-status/route";
import { PATCH as patchRfq } from "@/app/api/admin/rfqs/[no]/route";
import { POST as submitQuote } from "@/app/api/quote/[token]/route";
import { POST as changeDeadline } from "@/app/api/admin/rfqs/[no]/deadline/route";
import { POST as changeStatus } from "@/app/api/admin/rfqs/[no]/status/route";
import { POST as reportContractRoute } from "@/app/api/awards/[id]/contract/route";
import { POST as declineQuote } from "@/app/api/quote/[token]/decline/route";
import { POST as orgAction } from "@/app/api/admin/cros/[id]/route";
import { POST as selectRoute } from "@/app/api/rfq/[no]/select/route";

const admin = { userId: "admin-1", email: "ops@danchu.kr", profile: { role: "admin" } };
const cro = { userId: "cro-1", email: "cro@example.com", profile: { role: "cro" } };
const json = (body: unknown, method = "POST") => new Request("https://danchu.kr/x", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const AWARD = "00000000-0000-4000-8000-0000000000a1";

beforeEach(() => {
  fx.session = null;
  fx.calls = [];
  fx.respond = () => ({ data: null, error: null });
  fx.loadOpts = [];
  fx.audit.mockReset();
  fx.logEvent.mockReset();
  fx.notifyUsers.mockReset();
  fx.learn.mockClear();
  fx.saveQuote.mockClear();
  fx.reportContract.mockClear();
  fx.org = null;
});

describe("POST /api/admin/cros (운영자 관리 기관 추가)", () => {
  const body = { name: "㈜바이오랩", contactEmail: "lab@example.com", categories: ["일반독성"], businessNo: "123-45-67890" };
  it("운영자가 아니면 403", async () => {
    fx.session = cro;
    expect((await createOrg(json(body))).status).toBe(403);
    expect(fx.calls).toHaveLength(0);
  });
  it("필수값이 빠지면 400", async () => {
    fx.session = admin;
    expect((await createOrg(json({ ...body, contactEmail: "" }))).status).toBe(400);
  });
  it("사업자번호나 정규화한 이름이 같으면 409 와 기존 기관 id", async () => {
    fx.session = admin;
    fx.respond = (q) => (q.table === "cro_orgs" && q.op === "select" ? { data: [{ id: "org-old", name: "바이오랩 주식회사", business_no: null, status: "approved", managed: false }], error: null } : { data: null, error: null });
    const r = await createOrg(json(body));
    expect(r.status).toBe(409);
    expect(await r.json()).toMatchObject({ existingId: "org-old" });
    expect(fx.calls.some((c) => c.op === "insert")).toBe(false);
  });
  it("참여 중·운영자 관리로 만들고 승인 메일은 보내지 않는다", async () => {
    fx.session = admin;
    fx.respond = (q) => (q.op === "insert" ? { data: { id: "org-new", name: "㈜바이오랩" }, error: null } : { data: [], error: null });
    const r = await createOrg(json(body));
    expect(r.status).toBe(200);
    const ins = fx.calls.find((c) => c.op === "insert");
    expect(ins?.table).toBe("cro_orgs");
    expect(ins?.payload).toMatchObject({ name: "㈜바이오랩", contact_email: "lab@example.com", status: "approved", managed: true, categories: ["일반독성"] });
    expect(fx.notifyUsers).not.toHaveBeenCalled();
    expect(fx.audit).toHaveBeenCalledWith(expect.anything(), "org.create", expect.objectContaining({ id: "org-new" }), expect.anything());
  });
});

describe("POST /api/admin/awards/[id]/contract-status", () => {
  const ctx = { params: Promise.resolve({ id: AWARD }) };
  const award = (reported: boolean) => (q: Q) =>
    q.table === "rfq_awards" && q.op === "select"
      ? { data: { id: AWARD, rfq_id: "rfq-1", cro_name: "바이오랩", contract_status: reported ? "signed" : "pending", contract_reported_at: reported ? "2026-10-01T00:00:00Z" : null, contract_note: null }, error: null }
      : q.table === "rfq_requests"
        ? { data: { rfq_no: "DC-2026-0001" }, error: null }
        : { data: null, error: null };
  it("운영자만", async () => {
    fx.session = cro;
    expect((await setContractStatus(json({ status: "negotiating" }), ctx)).status).toBe(403);
  });
  it("체결 보고된 수주는 409", async () => {
    fx.session = admin;
    fx.respond = award(true);
    expect((await setContractStatus(json({ status: "not_signed", note: "보류" }), ctx)).status).toBe(409);
    expect(fx.calls.some((c) => c.op === "update")).toBe(false);
  });
  it("미체결은 사유가 없으면 400", async () => {
    fx.session = admin;
    fx.respond = award(false);
    expect((await setContractStatus(json({ status: "not_signed" }), ctx)).status).toBe(400);
  });
  it("협의 중을 기록하고 이력·감사 로그를 남긴다", async () => {
    fx.session = admin;
    fx.respond = award(false);
    const r = await setContractStatus(json({ status: "negotiating", note: "의뢰자 확인" }), ctx);
    expect(r.status).toBe(200);
    expect(fx.calls.find((c) => c.op === "update")?.payload).toEqual({ contract_status: "negotiating", contract_note: "의뢰자 확인" });
    expect(fx.logEvent).toHaveBeenCalled();
    expect(fx.audit).toHaveBeenCalledWith(expect.anything(), "award.contract_status", expect.anything(), expect.objectContaining({ after: expect.objectContaining({ contract_status: "negotiating" }) }));
  });
});

describe("PATCH /api/admin/rfqs/[no] 자동 공개 스위치 제거", () => {
  const ctx = { params: Promise.resolve({ no: "DC-2026-0001" }) };
  beforeEach(() => {
    fx.rfq = { id: "rfq-1", rfq_no: "DC-2026-0001", status: "distributed", cro_count: "3곳", confidentiality: "일반" };
  });
  it("autoPublish 는 더 받지 않는다 (비교표 공개 단계가 없다)", async () => {
    fx.session = admin;
    const r = await patchRfq(json({ autoPublish: false }, "PATCH"), ctx);
    expect(r.status).toBe(400);
    expect(fx.calls.some((c) => c.op === "update")).toBe(false);
  });
  it("기관 수 변경은 요청 행을 잠그는 DB 함수(set_seat_count)로", async () => {
    fx.session = admin;
    fx.setSeatCount.mockResolvedValueOnce({ ok: true, used: 1, before: "3곳" });
    const r = await patchRfq(json({ croCount: "5곳" }, "PATCH"), ctx);
    expect(r.status).toBe(200);
    expect(fx.setSeatCount).toHaveBeenCalledWith("rfq-1", "5곳");
    expect(fx.calls.some((c) => c.op === "update")).toBe(false);
  });
  it("이미 참여한 기관 수보다 적게 줄이면 409 (DB 가 잠금 안에서 센 수)", async () => {
    fx.session = admin;
    fx.setSeatCount.mockResolvedValueOnce({ ok: false, code: "too_few", used: 4 });
    const r = await patchRfq(json({ croCount: "3곳" }, "PATCH"), ctx);
    expect(r.status).toBe(409);
    expect((await r.json()).error).toContain("이미 4곳이 참여해");
  });
});

describe("POST /api/quote/[token] 운영자 대리 입력", () => {
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
      inviteId: "inv-1", rfqId: "rfq-1", croName: "바이오랩", croOrgId: "org-1", token: "tok_abcdefgh",
      expired: false, locked: false, declined: false, closed: false, joined: true, withdrawn: false,
    };
    fx.respond = (q) => (q.table === "rfq_requests" ? { data: { user_id: null, email: "sponsor@example.com" }, error: null } : { data: null, error: null });
  });
  it("운영자 제출: operator 로 기록, 열람 기록 안 함, 카탈로그 학습 안 함, 감사 로그", async () => {
    fx.session = admin;
    const r = await submitQuote(json(body), ctx);
    expect(r.status).toBe(200);
    // 운영자는 기관 열람으로 남기지 않고, 회신 마감 전이면 기한 잠금 없이 고칠 수 있다
    expect(fx.loadOpts[0]).toEqual({ markOpened: false, operator: true });
    // 입력 주체는 save_quote 한 트랜잭션 안에서 남긴다 (따로 갱신하지 않는다)
    expect((fx.saveQuote.mock.calls[0] as unknown[])[1]).toMatchObject({ entry_source: "operator" });
    expect(fx.calls.some((c) => c.table === "cro_quotes" && c.op === "update" && "entry_source" in ((c.payload as object) ?? {}))).toBe(false);
    expect(fx.learn).not.toHaveBeenCalled();
    expect(fx.audit).toHaveBeenCalledWith(expect.objectContaining({ userId: "admin-1" }), "quote.proxy", expect.objectContaining({ type: "cro_quote", id: "quote-1" }), expect.anything());
    expect(fx.logEvent.mock.calls[0][2]).toContain("운영자 대리 입력");
  });
  it("기관 제출(토큰): cro 로 기록하고 카탈로그를 학습한다", async () => {
    fx.session = null;
    const r = await submitQuote(json(body), ctx);
    expect(r.status).toBe(200);
    expect(fx.loadOpts[0]).toEqual({ markOpened: true, operator: false });
    expect((fx.saveQuote.mock.calls[0] as unknown[])[1]).toMatchObject({ entry_source: "cro" });
    expect(fx.learn).toHaveBeenCalledTimes(1);
    expect(fx.audit).not.toHaveBeenCalled();
  });  it("기관이 참여하기 전이면 운영자 대리 입력을 409 로 막고 save_quote 를 부르지 않는다 (0023)", async () => {
    fx.session = admin;
    fx.loaded = { ...(fx.loaded as object), joined: false, draft: null, operator: true };
    const r = await submitQuote(json(body), ctx);
    expect(r.status).toBe(409);
    expect((await r.json()).error).toContain("참여하기 전");
    expect(fx.saveQuote).not.toHaveBeenCalled();
    expect(fx.audit).not.toHaveBeenCalled();
  });
  it("기관도 참여 전에는 제출할 수 없다", async () => {
    fx.session = null;
    fx.loaded = { ...(fx.loaded as object), joined: false, draft: null };
    const r = await submitQuote(json(body), ctx);
    expect(r.status).toBe(409);
    expect(fx.saveQuote).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/rfqs/[no]/deadline 기한 변경 메일", () => {
  const ctx = { params: Promise.resolve({ no: "DC-2026-0001" }) };
  it("담당자 있는 기관은 포털 링크, 운영자 관리 기관은 초대별 /q 링크", async () => {
    fx.session = admin;
    fx.rfq = { id: "rfq-1", rfq_no: "DC-2026-0001", status: "distributed", compared_at: null, reply_by: "2098-12-01", substance: "ABC-1", user_id: null };
    fx.respond = (q) => {
      if (q.table === "rfq_invites" && q.op === "select")
        return { data: [
          { id: "inv-m", token: "tok_member1", cro_org_id: "org-member", cro_email: "member-org@example.com", status: "sent", joined_at: "2026-10-02T00:00:00Z" },
          { id: "inv-g", token: "tok_managed", cro_org_id: "org-managed", cro_email: "managed@example.com", status: "sent", joined_at: "2026-10-02T00:00:00Z" },
          { id: "inv-u", token: "tok_undec01", cro_org_id: "org-undecided", cro_email: "undecided@example.com", status: "sent", joined_at: null },
        ], error: null };
      if (q.table === "profiles") return { data: [{ id: "m1", cro_org_id: "org-member" }, { id: "u1", cro_org_id: "org-undecided" }], error: null };
      // 받는 사람은 지금의 기관 대표 메일 + 소속 담당자 (초대의 cro_email 이 아님, lib/distribute.ts orgMailTargets)
      if (q.table === "cro_orgs") return { data: [{ id: "org-member", managed: false, contact_email: "member-org@example.com" }, { id: "org-managed", managed: true, contact_email: "managed@example.com" }, { id: "org-undecided", managed: false, contact_email: "undecided@example.com" }], error: null };
      if (q.table === "rfq_requests" && q.op === "update") return { data: [{ id: "rfq-1" }], error: null };
      return { data: null, error: null };
    };
    const r = await changeDeadline(json({ replyBy: "2099-01-05" }), ctx);
    expect(r.status).toBe(200);
    const calls = fx.notifyUsers.mock.calls as [string[], { href?: string }, { to: string[] } | undefined][];
    const portal = calls.find((c) => c[1].href === "/cro");
    expect(portal?.[0]).toEqual(["m1"]);
    expect(portal?.[2]?.to).toEqual(["member-org@example.com"]);
    const token = calls.find((c) => c[1].href === "/q/tok_managed");
    expect(token?.[0]).toEqual([]);
    expect(token?.[2]?.to).toEqual(["managed@example.com"]);
    expect(calls.some((c) => c[1].href === "/cro" && c[2]?.to.includes("managed@example.com"))).toBe(false);
    // 참여 결정 전 기관: 시험물질명 없이, 요약 화면 링크로 (0023)
    const undecided = calls.find((c) => c[2]?.to.includes("undecided@example.com")) as unknown as [string[], { title: string; body?: string; href?: string }] | undefined;
    expect(undecided?.[1].href).toBe("/cro/r/inv-u");
    expect(`${undecided?.[1].title} ${undecided?.[1].body}`).not.toContain("ABC-1");
    expect(calls.find((c) => c[2]?.to.includes("member-org@example.com"))?.[1]).toMatchObject({ href: "/cro" });
  });
});

describe("요청 취소 메일: 기관마다 따로, 계정 없는 기관은 /q", () => {
  const ctx = { params: Promise.resolve({ no: "DC-2026-0001" }) };
  it("받는 사람 칸에 다른 기관 주소가 섞이지 않고, 운영자 관리 기관은 로그인 없는 링크", async () => {
    fx.session = admin;
    fx.rfq = { id: "rfq-1", rfq_no: "DC-2026-0001", status: "distributed", user_id: null };
    fx.respond = (q) => {
      if (q.table === "rfq_invites" && q.op === "select")
        return { data: [
          { id: "inv-m", token: "tok_member1", cro_org_id: "org-member", cro_email: "member-org@example.com" },
          { id: "inv-g", token: "tok_managed", cro_org_id: "org-managed", cro_email: "managed@example.com" },
        ], error: null };
      if (q.table === "profiles") return { data: [{ id: "m1", email: "m1@member.example", cro_org_id: "org-member" }], error: null };
      if (q.table === "cro_orgs") return { data: [{ id: "org-member", managed: false, contact_email: "member-org@example.com" }, { id: "org-managed", managed: true, contact_email: "managed@example.com" }], error: null };
      return { data: null, error: null };
    };
    expect((await changeStatus(json({ status: "cancelled" }), ctx)).status).toBe(200);
    const calls = fx.notifyUsers.mock.calls as [string[], { href?: string }, { to: string[]; replyTo?: string } | undefined][];
    expect(calls).toHaveLength(2);
    const member = calls.find((c) => c[1].href === "/cro");
    expect(member?.[2]?.to.sort()).toEqual(["m1@member.example", "member-org@example.com"]);
    const managed = calls.find((c) => c[1].href === "/q/tok_managed");
    expect(managed?.[2]?.to).toEqual(["managed@example.com"]);
    expect(managed?.[2]?.replyTo).toBe("hello@danchu.kr");
  });
});

describe("취소한 요청 다시 열기", () => {
  const ctx = { params: Promise.resolve({ no: "DC-2026-0001" }) };
  it("제출된 견적이 있으면 견적 도착(quoted)으로 되돌린다", async () => {
    fx.session = admin;
    fx.rfq = { id: "rfq-1", rfq_no: "DC-2026-0001", status: "cancelled", compared_at: null, selected_quote_id: null, distributed_at: "2026-10-01T00:00:00Z", user_id: null };
    fx.respond = (q) => (q.table === "cro_quotes" ? { data: [], error: null, count: 2 } : { data: [], error: null });
    expect((await changeStatus(json({ status: "reopen" }), ctx)).status).toBe(200);
    expect(fx.calls.find((c) => c.table === "rfq_requests" && c.op === "update")?.payload).toMatchObject({ status: "quoted" });
  });
  it("제출된 견적이 없으면 배포 단계로", async () => {
    fx.session = admin;
    fx.rfq = { id: "rfq-1", rfq_no: "DC-2026-0001", status: "cancelled", compared_at: null, selected_quote_id: null, distributed_at: "2026-10-01T00:00:00Z", user_id: null };
    fx.respond = (q) => (q.table === "cro_quotes" ? { data: [], error: null, count: 0 } : { data: [], error: null });
    expect((await changeStatus(json({ status: "reopen" }), ctx)).status).toBe(200);
    expect(fx.calls.find((c) => c.table === "rfq_requests" && c.op === "update")?.payload).toMatchObject({ status: "distributed" });
  });
});

describe("POST /api/awards/[id]/contract 운영자 기록", () => {
  const ctx = { params: Promise.resolve({ id: AWARD }) };
  beforeEach(() => {
    fx.respond = (q) => (q.table === "rfq_awards" ? { data: { id: AWARD, rfq_id: "rfq-1", cro_org_id: "org-1", cro_name: "바이오랩", contract_date: null, contract_amount: null, contract_status: "pending" }, error: null } : { data: { email: "sponsor@example.com" }, error: null });
  });
  it("운영자가 처음 기록해도 감사 로그를 남기고, 기관 보고라고 쓰지 않는다", async () => {
    fx.session = admin;
    const r = await reportContractRoute(json({ date: "2026-10-10", amount: "50000000" }), ctx);
    expect(r.status).toBe(200);
    expect(fx.audit).toHaveBeenCalledWith(expect.objectContaining({ userId: "admin-1" }), "award.contract", expect.objectContaining({ type: "rfq_award", id: AWARD }), expect.objectContaining({ note: "운영자 기록" }));
    expect(fx.logEvent.mock.calls[0][2]).toContain("(운영자 기록)");
    const sponsor = (fx.notifyUsers.mock.calls as [string[], { title: string; body?: string }][]).find((c) => c[0][0] === "sponsor-1");
    expect(sponsor?.[1].title).not.toContain("보고");
    expect(sponsor?.[1].body).toContain("단추가 기관에 확인해 기록");
  });
  it("기관 담당자의 첫 보고는 지금처럼 보고로 남기고 감사 로그는 없다", async () => {
    fx.session = { userId: "cro-1", email: "cro@example.com", profile: { role: "cro", cro_org_id: "org-1" } } as never;
    const r = await reportContractRoute(json({ date: "2026-10-10", amount: "50000000" }), ctx);
    expect(r.status).toBe(200);
    expect(fx.audit).not.toHaveBeenCalled();
    expect(fx.logEvent.mock.calls[0][2]).toBe("바이오랩 계약 체결 보고");
  });
});

describe("POST /api/quote/[token]/decline 운영자 처리 (불참·철회, 0023)", () => {
  const ctx = { params: Promise.resolve({ token: "tok_abcdefgh" }) };
  beforeEach(() => {
    fx.loaded = { rfq: { no: "DC-2026-0001" }, draft: null, inviteId: "inv-1", rfqId: "rfq-1", croName: "바이오랩", croOrgId: "org-1", token: "tok_abcdefgh", expired: false, locked: false, declined: false, closed: false, joined: false, withdrawn: false };
    // 참여 전 불참은 sent·참여 기록 없음 조건부 갱신이 한 행을 바꿔야 성공한다
    fx.respond = (q) => (q.table === "rfq_invites" && q.op === "update" ? { data: [{ id: "inv-1" }], error: null } : { data: null, error: null });
  });
  it("운영자가 기관이 메일로 알린 불참을 기록하면 운영 기록을 남긴다", async () => {
    fx.session = admin;
    expect((await declineQuote(json({ reason: "기관이 메일로 불가 회신" }), ctx)).status).toBe(200);
    expect(fx.audit).toHaveBeenCalledWith(expect.objectContaining({ userId: "admin-1" }), "invite.decline_proxy", expect.objectContaining({ type: "rfq_invite", id: "inv-1" }), expect.objectContaining({ note: "기관이 메일로 불가 회신" }));
  });
  it("기관이 토큰으로 불참하면 운영 기록은 없다", async () => {
    fx.session = null;
    expect((await declineQuote(json({}), ctx)).status).toBe(200);
    expect(fx.audit).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/cros/[id] 운영자 관리 기관 수신 거부", () => {
  const ctx = { params: Promise.resolve({ id: "org-managed" }) };
  it("배포를 멈추고 열린 초대를 닫되, 기관에 중지 메일을 보내지 않는다", async () => {
    fx.session = admin;
    fx.org = { id: "org-managed", name: "바이오랩", status: "approved", managed: true, approved_at: null, contact_email: "lab@example.com" };
    const r = await orgAction(json({ action: "optout" }), ctx);
    expect(r.status).toBe(200);
    expect(fx.calls.find((c) => c.table === "cro_orgs" && c.op === "update")?.payload).toMatchObject({ status: "suspended" });
    expect(fx.calls.find((c) => c.table === "rfq_invites" && c.op === "update")?.payload).toMatchObject({ status: "expired" });
    expect(fx.audit).toHaveBeenCalledWith(expect.anything(), "org.optout", expect.objectContaining({ id: "org-managed" }), expect.objectContaining({ note: "기관이 수신 거부" }));
    expect(fx.notifyUsers).not.toHaveBeenCalled();
  });
  it("운영자 관리 기관을 중지해도 참여 중지 메일을 보내지 않는다", async () => {
    fx.session = admin;
    fx.org = { id: "org-managed", name: "바이오랩", status: "approved", managed: true, approved_at: null, contact_email: "lab@example.com" };
    expect((await orgAction(json({ action: "suspend" }), ctx)).status).toBe(200);
    expect(fx.notifyUsers).not.toHaveBeenCalled();
  });
  it("참여 기관에는 수신 거부를 쓰지 않는다", async () => {
    fx.session = admin;
    fx.org = { id: "org-1", name: "켐랩", status: "approved", managed: false, approved_at: null, contact_email: "chem@example.com" };
    expect((await orgAction(json({ action: "optout" }), ctx)).status).toBe(400);
  });
});

describe("POST /api/rfq/[no]/select 선정 메일", () => {
  const ctx = { params: Promise.resolve({ no: "DC-2026-0001" }) };
  const QID = "00000000-0000-4000-8000-0000000000b1";
  it("운영자 관리 기관이 선정되면 포털 대신 /q 링크와 운영 회신 주소, 미선정 계정 없는 기관도 /q, 의뢰자 문구는 보고 주체를 약속하지 않는다", async () => {
    fx.session = admin;
    fx.rfq = { id: "rfq-1", rfq_no: "DC-2026-0001", substance: "ABC-1", company: "의뢰사", contact_name: "김담당", email: "sponsor@example.com", phone: null, user_id: "sponsor-1" };
    fx.respond = (q) => {
      if (q.table === "cro_quotes" && q.filters.some(([k]) => k === "status"))
        return q.filters.some(([k]) => k === "id")
          ? { data: { auto: false, pdf_path: "x.pdf", start_date: "2099-01-01", valid_until: "2099-12-31" }, error: null }
          : { data: [{ invite_id: "inv-l" }], error: null };
      if (q.table === "cro_quotes") return { data: { id: QID, invite_id: "inv-w", cro_org_id: "org-managed", cro_name: "바이오랩", total_amount: 1000 }, error: null };
      if (q.table === "rfq_invites" && q.filters.some(([k, v]) => k === "id" && v === "inv-w")) return { data: { id: "inv-w", token: "tok_winner1", cro_org_id: "org-managed", cro_email: "lab@example.com" }, error: null };
      if (q.table === "rfq_invites") return { data: [{ id: "inv-l", token: "tok_loser01", cro_org_id: "org-solo", cro_email: "solo@example.com", status: "submitted" }, { id: "inv-o", token: "tok_open001", cro_org_id: null, cro_email: "open@example.com", status: "sent", joined_at: "2026-10-02T00:00:00Z" }, { id: "inv-u", token: "tok_undec01", cro_org_id: null, cro_email: "undecided@example.com", status: "sent", joined_at: null }], error: null };
      if (q.table === "profiles") return { data: [], error: null };
      if (q.table === "cro_orgs") return { data: [{ id: "org-managed", managed: true, contact_email: "lab@example.com" }, { id: "org-solo", managed: false, contact_email: "solo@example.com" }], error: null };
      return { data: null, error: null };
    };
    const r = await selectRoute(json({ quoteId: QID, revision: 3 }), ctx);
    expect(r.status).toBe(200);
    // 확인 화면이 본 견적 판을 그대로 넘긴다 (0022)
    expect(fx.selectQuote).toHaveBeenCalledWith("rfq-1", QID, expect.any(String), 3);
    const calls = fx.notifyUsers.mock.calls as [string[], { title: string; body?: string; href?: string }, { to: string[]; replyTo?: string } | undefined][];
    const win = calls.find((c) => c[1].title.startsWith("선정되었습니다"));
    expect(win?.[1].href).toBe("/q/tok_winner1");
    expect(win?.[1].body).toContain("운영자가 이 메일 주소로 여쭙");
    expect(win?.[1].body).not.toContain("보고해 주세요");
    expect(win?.[2]?.replyTo).toBe("hello@danchu.kr");
    const lose = calls.find((c) => c[1].title.startsWith("미선정"));
    expect(lose?.[1].href).toBe("/q/tok_loser01");
    expect(lose?.[2]?.to).toEqual(["solo@example.com"]);
    // 기한 전 선정: 아직 회신하지 않은 기관에는 미선정이 아니라 회신 마감을 따로 알린다
    const open = calls.filter((c) => c[2]?.to.includes("open@example.com"));
    expect(open).toHaveLength(1);
    expect(open[0][1].title).toContain("회신이 마감되었습니다");
    // 참여 결정 전 기관에는 시험물질명 없이 참여 안내가 닫혔다는 것만 (0023)
    const undecided = calls.filter((c) => c[2]?.to.includes("undecided@example.com"));
    expect(undecided).toHaveLength(1);
    expect(undecided[0][1].title).toContain("참여 안내가 마감되었습니다");
    expect(`${undecided[0][1].title} ${undecided[0][1].body}`).not.toContain("ABC-1");
    expect(calls.filter((c) => c[1].title.startsWith("미선정"))).toHaveLength(1);
    const sponsor = calls.find((c) => c[0][0] === "admin-1" && c[1].title.includes("선정 완료"));
    expect(sponsor?.[1].body).not.toContain("기관이 단추에 보고");
  });
});
