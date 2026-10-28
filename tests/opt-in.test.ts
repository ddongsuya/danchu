import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * 참여 선택형 배포 2단계 (설계 5절, 0023): 참여 전 요약과 참여 뒤 전체 보기, 참여 라우트, 참여 전 저장 거절,
 * 불참과 철회, 운영자는 대신 참여·참여 전 입력 불가, 참여 전 첨부·PDF 잠금, 배포는 자리 수로 자르지 않음.
 * DB 쪽 규칙(join_offer 자리 계산, save_quote not_joined, 기록 보호 트리거)은 tests/db/opt_in_join.sql 이 실제 PostgreSQL 로 본다.
 */

type Row = Record<string, unknown>;
type Call = { table: string; op: "select" | "update" | "insert" | "delete"; payload?: unknown; filters: string[] };
const fx = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  calls: [] as { table: string; op: string; payload?: unknown; filters: string[] }[],
  session: null as null | { userId: string; email: string; profile: Record<string, unknown> },
  rpcCalls: [] as { fn: string; args: Record<string, unknown> }[],
  rpcResult: {} as Record<string, unknown>,
  sendMail: vi.fn(async (_m: { to: string[]; subject: string; html: string }) => true),
  notifyUsers: vi.fn(async (..._a: unknown[]) => {}),
  logEvent: vi.fn(async (..._a: unknown[]) => {}),
  audit: vi.fn(async (..._a: unknown[]) => {}),
  catalogMap: vi.fn(async (_org: string) => new Map()),
  signedUrl: vi.fn(async () => ({ data: { signedUrl: "https://storage.example.invalid/signed" }, error: null })),
  seq: 0,
}));

vi.mock("@/lib/supabase", () => {
  const builder = (table: string) => {
    const call: Call = { table, op: "select", filters: [] };
    const preds: ((r: Row) => boolean)[] = [];
    const rows = () => (fx.tables[table] ?? []).filter((r) => preds.every((p) => p(r)));
    const run = (): { data: unknown; error: unknown } => {
      fx.calls.push(call);
      if (call.op === "update") {
        const hit = rows();
        for (const r of hit) Object.assign(r, call.payload as Row);
        return { data: hit, error: null };
      }
      if (call.op === "insert") {
        const r = { id: `id-${++fx.seq}`, token: `tok_new_${fx.seq}_000000`, ...(call.payload as Row) };
        (fx.tables[table] ??= []).push(r);
        return { data: r, error: null };
      }
      return { data: rows().map((r) => ({ ...r })), error: null };
    };
    const b: Record<string, unknown> = {};
    const one = async () => {
      const r = run();
      return { ...r, data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data };
    };
    Object.assign(b, {
      select: () => b,
      update: (p: unknown) => ((call.op = "update"), (call.payload = p), b),
      insert: (p: unknown) => ((call.op = "insert"), (call.payload = p), b),
      eq: (k: string, v: unknown) => (call.filters.push(`eq:${k}`), preds.push((r) => r[k] === v), b),
      in: (k: string, v: unknown[]) => (call.filters.push(`in:${k}`), preds.push((r) => v.includes(r[k])), b),
      is: (k: string, v: unknown) => (call.filters.push(`is:${k}`), preds.push((r) => (r[k] ?? null) === v), b),
      order: () => b, limit: () => b, gte: () => b, lt: () => b,
      maybeSingle: one,
      single: one,
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(run()).then(res, rej),
    });
    return b;
  };
  const client = {
    from: builder,
    rpc: async (fn: string, args: Record<string, unknown>) => {
      fx.rpcCalls.push({ fn, args });
      if (fn === "danchu_schema_version") return { data: 28, error: null };
      return { data: fx.rpcResult[fn] ?? null, error: null };
    },
    storage: { from: () => ({ createSignedUrl: fx.signedUrl, list: async () => ({ data: [{ name: "x" }], error: null }), createSignedUploadUrl: async () => ({ data: { signedUrl: "u", token: "t" }, error: null }) }) },
  };
  return { getSupabaseAdmin: () => client };
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
vi.mock("@/lib/notify", () => ({
  logEvent: fx.logEvent,
  notifyUsers: fx.notifyUsers,
  adminUserIds: async () => ["admin-1"],
  adminEmails: () => [],
  operatorReplyTo: () => "hello@danchu.kr",
  siteUrl: () => "https://danchu.kr",
}));
vi.mock("@/lib/mail", async (orig) => ({ ...(await orig<typeof import("@/lib/mail")>()), sendMail: fx.sendMail }));
vi.mock("@/lib/mail-preferences", () => ({ notificationRecipients: async (to: string[]) => to }));
vi.mock("@/lib/audit", async (orig) => ({ ...(await orig<typeof import("@/lib/audit")>()), audit: fx.audit }));
vi.mock("@/lib/rate-limit", async (orig) => ({ ...(await orig<typeof import("@/lib/rate-limit")>()), rateLimited: async () => false }));
vi.mock("@/lib/catalog-db", () => ({ catalogMap: fx.catalogMap, learnFromSubmission: async () => {} }));
vi.mock("@/lib/observe", () => ({ captureError: () => {}, sentryEnabled: () => false, maskEmail: (s: string) => s }));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: (fn: () => unknown) => void fn() }));

import { rfqSummaryOf, rfqViewOf, loadByInvite } from "@/lib/quote-load";
import { POST as joinPost } from "@/app/api/quote/[token]/join/route";
import { PUT as quotePut, POST as quotePost, GET as quoteGet } from "@/app/api/quote/[token]/route";
import { POST as declinePost } from "@/app/api/quote/[token]/decline/route";
import { POST as uploadUrl } from "@/app/api/quote/[token]/upload-url/route";
import { GET as fileGet } from "@/app/api/files/[id]/route";
import { GET as pdfGet } from "@/app/api/quotes/[id]/pdf/route";
import { distributeTo, inviteMailHtml, inviteMailSubject, INVITE_MAIL_ACTION } from "@/lib/distribute";
import { CRO_TERMS_VERSION, JOIN_CONSENT, seatUsage, seatsLabel, seatsDetailLabel, joinDeadline, occupiesSeat } from "@/lib/request-policy";
import { inviteStage, inviteStageLabel, INVITE_STAGE_LABEL } from "@/lib/status";
import { canJoinAs, proxyEntryAllowed } from "@/lib/concierge";
import type { InviteRow, RfqRow } from "@/lib/data";
import { newVariant } from "@/lib/catalog";

const RFQ = "00000000-0000-4000-8000-0000000000f1";
const INV = "00000000-0000-4000-8000-0000000000e1";
const ORG = "00000000-0000-4000-8000-0000000000c1";
const FILE = "00000000-0000-4000-8000-0000000000d1";
const QUOTE = "00000000-0000-4000-8000-0000000000b1";
const TOKEN = "tok_optin_000000000000000000000000";

const SECRET = { substance: "비밀물질-7", purpose: "IND 신청 전 독성 확인", notes: "의뢰자 자유 기술 메모", company: "㈜의뢰사" };

function rfqRow(over: Row = {}): RfqRow {
  return {
    id: RFQ, rfq_no: "DC-2026-0100", status: "distributed", company: SECRET.company, org_type: "바이오벤처", substance: SECRET.substance, purpose: SECRET.purpose,
    categories: ["일반독성"], intent: "발주 예정", confidentiality: "일반", cro_count: "3곳", reply_by: "2099-01-20", join_by: "2099-01-05T14:59:59.000Z",
    compared_at: null, selected_quote_id: null, user_id: "sponsor-1", email: "sponsor@example.com", distributed_at: "2026-10-01T00:00:00Z", nominees_only: false,
    payload: {
      categories: ["일반독성"],
      "일반독성.items": ["4주 반복투여독성"],
      "일반독성.species": ["랫드"],
      "일반독성.recovery": "2주",
      "일반독성.glpLevel": "GLP",
      "일반독성.tk": "포함",
      "일반독성.method": "의뢰자가 적은 시험법 설명",
      authority: ["식약처(MFDS)"],
      start: "2027-01",
      purpose: SECRET.purpose,
      devField: "항암",
      notes: SECRET.notes,
      route: "경구",
      advisorAnswers: ["의뢰자 상황 설명"],
      advisorAsk: ["회복군 설계를 설명해 주세요"],
    },
    ...over,
  } as unknown as RfqRow;
}
function invite(over: Row = {}): InviteRow {
  return {
    id: INV, rfq_id: RFQ, rfq_no: "DC-2026-0100", cro_name: "바이오랩", cro_email: "lab@example.com", cro_org_id: ORG, token: TOKEN, reply_by: "2099-01-20",
    expires_at: "2099-01-27T14:59:59Z", status: "sent", opened_at: null, cda_signed_at: null, revoked_at: null, declined_at: null, decline_reason: null,
    joined_at: null, withdrawn_at: null, source: "matched", sent_at: "2026-10-01T00:00:00Z",
    ...over,
  } as unknown as InviteRow;
}
const SEATS = { ok: true, cap: 3, used: 1, reserved: 1, open: 1, join_by: "2099-01-05T14:59:59.000Z" };

const json = (body: unknown = {}, method = "POST", headers: Record<string, string> = {}) =>
  new Request("https://danchu.kr/x", { method, headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
const tctx = { params: Promise.resolve({ token: TOKEN }) };
const admin = { userId: "admin-1", email: "ops@danchu.kr", profile: { role: "admin" } };
const croMember = { userId: "cro-user-1", email: "m@lab.example", profile: { role: "cro", cro_org_id: ORG } };
const otherCro = { userId: "cro-user-2", email: "x@other.example", profile: { role: "cro", cro_org_id: "00000000-0000-4000-8000-0000000000c9" } };
const body = {
  items: [{ seq: 1, avail: "가능", amount: "12000000", weeks: "6", reason: "" }],
  note: "",
  common: { validUntil: "2099-01-31", startDate: "2099-01-01", payTerms: "", substanceQty: "", reportLang: "", includes: [] },
};

beforeEach(() => {
  fx.tables = {
    rfq_requests: [rfqRow() as unknown as Row],
    rfq_invites: [invite() as unknown as Row],
    cro_orgs: [{ id: ORG, status: "approved", managed: false, contact_email: "lab@example.com" }],
    rfq_files: [{ id: FILE, rfq_id: RFQ, storage_path: "DC-2026-0100/x.pdf", file_name: "의뢰사_계획서.pdf", size_bytes: 2048, uploaded_at: "2026-10-01", created_at: "2026-10-01" }],
    cro_quotes: [],
    profiles: [],
  };
  fx.calls = [];
  fx.rpcCalls = [];
  fx.rpcResult = { offer_seat_state: SEATS };
  fx.session = null;
  fx.sendMail.mockClear();
  fx.notifyUsers.mockClear();
  fx.logEvent.mockClear();
  fx.audit.mockClear();
  fx.catalogMap.mockClear();
});

const inv0 = () => fx.tables.rfq_invites[0];
const join = (over: Row) => Object.assign(inv0(), { joined_at: "2026-10-02T00:00:00Z", join_channel: "token", ...over });

/* ── 1) 요약과 전체 보기 ── */
describe("참여 전 요약은 설계 규칙표의 항목만", () => {
  const SUMMARY_KEYS = ["분야", "제출처", "요청 성격", "의뢰자 기관 유형", "희망 착수", "회신 기한", "참여 결정 기한", "기밀 등급", "CDA", "첨부", "참여 자리", "이용 조건"];
  it("요약: 항목 이름이 규칙표와 같고 시험물질명·목적·자유 기술·회사명·첨부 목록이 어디에도 없다", () => {
    const v = rfqSummaryOf(rfqRow(), invite(), 2, SEATS);
    expect(v.full).toBe(false);
    expect(v.overview.map(([k]) => k)).toEqual(SUMMARY_KEYS);
    expect(v.substance).toBe("");
    expect(v.common).toEqual([]);
    expect(v.situation).toEqual([]);
    expect(v.ask).toEqual([]);
    expect(v.files).toEqual([]);
    expect(v.attachments).toBe("2건 · 참여 뒤 열람");
    const all = JSON.stringify(v);
    for (const secret of [...Object.values(SECRET), "의뢰자가 적은 시험법 설명", "항암", "TK 병행", "의뢰자 상황 설명", "회복군 설계를"]) expect(all).not.toContain(secret);
    const ov = Object.fromEntries(v.overview);
    expect(ov["참여 결정 기한"]).toBe("2099-01-05");
    expect(ov["참여 자리"]).toBe("자리 3곳 중 1곳 남음 (일부 자리는 참여 결정 기한까지 지명 기관 몫)");
    expect(ov["이용 조건"]).toContain(CRO_TERMS_VERSION);
    expect(ov["의뢰자 기관 유형"]).toBe("바이오벤처");
  });
  it("요약의 시험 항목은 종·회복 기간·GLP 여부만", () => {
    const v = rfqSummaryOf(rfqRow(), invite(), 0, null);
    expect(v.rows).toEqual([{ seq: 1, category: "일반독성", name: "4주 반복투여독성", cond: "랫드 · 회복 2주 · GLP" }]);
    expect(Object.fromEntries(v.overview)["첨부"]).toBe("없음");
    expect(Object.fromEntries(v.overview)["참여 자리"]).toBe("-");
  });
  it("CDA 요청 요약은 CDA 필요를 알린다", () => {
    const v = rfqSummaryOf(rfqRow({ confidentiality: "CDA 필요 (단추 표준 CDA)" }), invite(), 1, SEATS);
    expect(Object.fromEntries(v.overview)["CDA"]).toContain("필요");
  });
  it("전체 보기: 시험물질명·목적·자유 기술·의뢰자 설명·첨부가 열리고 회사명은 선정 전까지 가린다", () => {
    const v = rfqViewOf(rfqRow(), invite({ joined_at: "2026-10-02T00:00:00Z" }), [{ id: FILE, file_name: "의뢰사_계획서.pdf", size_bytes: 2048 }]);
    expect(v.full).toBe(true);
    expect(v.substance).toBe(SECRET.substance);
    expect(JSON.stringify(v.overview)).toContain(SECRET.purpose);
    expect(JSON.stringify(v.common)).toContain(SECRET.notes);
    expect(v.situation).toEqual(["의뢰자 상황 설명"]);
    expect(v.files).toHaveLength(1);
    expect(v.files[0].name).not.toContain("의뢰사");
    expect(v.client).not.toContain(SECRET.company);
  });
});

describe("loadByInvite: 참여 전후", () => {
  it("참여 전: 요약, 견적·카탈로그를 읽지 않음, 첫 열람 시각은 남김, 자리 현황을 읽음", async () => {
    fx.catalogMap.mockResolvedValue(new Map([["일반독성::4주 반복투여독성", [newVariant({ key: "일반독성::4주 반복투여독성", category: "일반독성", item: "4주 반복투여독성" }, { price_min: 1000, price_max: 1000, weeks: 4 })]]]));
    const got = await loadByInvite(invite());
    expect(got?.joined).toBe(false);
    expect(got?.rfq.full).toBe(false);
    expect(got?.draft).toBeNull();
    expect(got?.seats).toMatchObject({ cap: 3, open: 1 });
    expect(fx.catalogMap).not.toHaveBeenCalled();
    expect(fx.calls.some((c) => c.table === "cro_quotes")).toBe(false);
    expect(inv0().opened_at).toBeTruthy();
    expect(JSON.stringify(got)).not.toContain(SECRET.substance);
  });
  it("참여 뒤: 전체 보기와 카탈로그 초안", async () => {
    join({});
    fx.catalogMap.mockResolvedValue(new Map([["일반독성::4주 반복투여독성", [newVariant({ key: "일반독성::4주 반복투여독성", category: "일반독성", item: "4주 반복투여독성" }, { price_min: 1000, price_max: 1000, weeks: 4 })]]]));
    const got = await loadByInvite(inv0() as unknown as InviteRow);
    expect(got?.joined).toBe(true);
    expect(got?.rfq.substance).toBe(SECRET.substance);
    expect(got?.draft?.prefilled).toBe(true);
    expect(got?.seats).toBeNull();
  });
  it("철회한 초대는 첨부 목록과 초안을 주지 않는다", async () => {
    join({ status: "declined", withdrawn_at: "2026-10-03T00:00:00Z" });
    const got = await loadByInvite(inv0() as unknown as InviteRow);
    expect(got?.withdrawn).toBe(true);
    expect(got?.declined).toBe(true);
    expect(got?.rfq.files).toEqual([]);
    expect(fx.catalogMap).not.toHaveBeenCalled();
  });
  it("운영자가 열어도 참여 전이면 요약이고 열람 기록을 남기지 않는다", async () => {
    const got = await loadByInvite(invite(), { operator: true, markOpened: false });
    expect(got?.rfq.full).toBe(false);
    expect(got?.operator).toBe(true);
    expect(inv0().opened_at).toBeNull();
  });
  it("GET /api/quote/[token] 도 참여 전에는 요약과 joined=false", async () => {
    const r = await quoteGet(new Request("https://danchu.kr/x"), tctx);
    const d = await r.json();
    expect(d.joined).toBe(false);
    expect(d.draft).toBeNull();
    expect(JSON.stringify(d)).not.toContain(SECRET.substance);
  });
});

/* ── 2) 참여 라우트 ── */
describe("POST /api/quote/[token]/join", () => {
  const joined = { ok: true, joined_at: "2026-10-02T00:00:00Z", channel: "token", seats: SEATS };
  it("토큰 링크: join_offer 에 token 경로·조건 판·IP·UA 를 넘기고 이력을 남긴다", async () => {
    fx.rpcResult.join_offer = joined;
    const r = await joinPost(json({ agree: true, terms: CRO_TERMS_VERSION }, "POST", { "x-forwarded-for": "203.0.113.7", "user-agent": "TestUA/1.0" }), tctx);
    expect(r.status).toBe(200);
    const c = fx.rpcCalls.find((x) => x.fn === "join_offer");
    expect(c?.args).toMatchObject({ p_invite_id: INV, p_token: TOKEN, p_actor: null, p_channel: "token", p_terms_version: CRO_TERMS_VERSION, p_ip: "203.0.113.7", p_ua: "TestUA/1.0" });
    expect(fx.logEvent).toHaveBeenCalledWith(RFQ, "joined", expect.stringContaining("바이오랩 참여"), expect.stringContaining(CRO_TERMS_VERSION), null, expect.anything());
    // 자리 현황 원본(참여 수·지명 수)은 돌려주지 않는다 (경쟁 기관 수 노출 방지)
    expect(await r.json()).toEqual({ ok: true, already: false, rejoined: false });
  });
  it("그 기관 담당자로 로그인했으면 portal 경로와 계정을 남긴다", async () => {
    fx.session = croMember;
    fx.rpcResult.join_offer = { ...joined, channel: "portal" };
    expect((await joinPost(json({ agree: true, terms: CRO_TERMS_VERSION }), tctx)).status).toBe(200);
    expect(fx.rpcCalls.find((x) => x.fn === "join_offer")?.args).toMatchObject({ p_channel: "portal", p_actor: "cro-user-1" });
  });
  it("다른 기관 담당자 계정이면 token 경로로 넘기고 DB 의 not_member 를 403 으로", async () => {
    fx.session = otherCro;
    fx.rpcResult.join_offer = { ok: false, code: "not_member" };
    const r = await joinPost(json({ agree: true, terms: CRO_TERMS_VERSION }), tctx);
    expect(r.status).toBe(403);
    expect(fx.rpcCalls.find((x) => x.fn === "join_offer")?.args).toMatchObject({ p_channel: "token" });
  });
  it("운영자는 대신 참여할 수 없다: 403, join_offer 를 부르지 않는다", async () => {
    fx.session = admin;
    const r = await joinPost(json({ agree: true, terms: CRO_TERMS_VERSION }), tctx);
    expect(r.status).toBe(403);
    expect((await r.json()).error).toContain("대신 참여할 수 없습니다");
    expect(fx.rpcCalls.some((x) => x.fn === "join_offer")).toBe(false);
    expect(canJoinAs("admin")).toBe(false);
    expect(canJoinAs("cro")).toBe(true);
    expect(canJoinAs(null)).toBe(true);
  });
  it("동의 없이 누르면 400, 조건 판이 다르면 409", async () => {
    expect((await joinPost(json({ terms: CRO_TERMS_VERSION }), tctx)).status).toBe(400);
    expect((await joinPost(json({ agree: true, terms: "old-terms" }), tctx)).status).toBe(409);
    expect(fx.rpcCalls.some((x) => x.fn === "join_offer")).toBe(false);
  });
  it("자리 없음·지명 몫·마감은 409 와 안내", async () => {
    for (const [code, word] of [["full", "모두 찼습니다"], ["reserved", "지명한 기관 몫"], ["cutoff", "3영업일 전"], ["closed", "더 참여할 수 없습니다"]] as const) {
      fx.rpcResult.join_offer = { ok: false, code };
      const r = await joinPost(json({ agree: true, terms: CRO_TERMS_VERSION }), tctx);
      expect(r.status).toBe(409);
      expect((await r.json()).error).toContain(word);
    }
  });
  it("이미 참여한 초대는 다시 기록하지 않는다", async () => {
    join({});
    const r = await joinPost(json({ agree: true, terms: CRO_TERMS_VERSION }), tctx);
    expect(await r.json()).toMatchObject({ ok: true, already: true });
    expect(fx.rpcCalls.some((x) => x.fn === "join_offer")).toBe(false);
  });
  it("동의 문장은 설계 규칙표 문구 그대로", () => {
    expect(JOIN_CONSENT).toBe("이 요청에 참여합니다. 요청서 내용은 이 견적에만 쓰고 외부에 알리지 않습니다. 견적을 제출하면 그 1건이 이용 조건에 따른 청구 단위가 됩니다(시범 운영 중 무료). 제출 전에는 언제든 철회할 수 있고, 철회하면 청구하지 않습니다.");
  });
});

/* ── 3) 참여 전 저장 거절 ── */
describe("참여 전에는 견적을 저장할 수 없다", () => {
  it("기관: 자동 저장(PUT)과 제출(POST) 모두 409, save_quote 를 부르지 않는다", async () => {
    expect((await quotePut(json(body, "PUT"), tctx)).status).toBe(409);
    const r = await quotePost(json(body), tctx);
    expect(r.status).toBe(409);
    expect((await r.json()).error).toContain("참여");
    expect(fx.rpcCalls.some((x) => x.fn === "save_quote")).toBe(false);
  });
  it("운영자 대리 입력도 409 와 대리 입력 안내", async () => {
    fx.session = admin;
    const r = await quotePost(json(body), tctx);
    expect(r.status).toBe(409);
    expect((await r.json()).error).toContain("대신 입력할 수 없습니다");
    expect(fx.rpcCalls.some((x) => x.fn === "save_quote")).toBe(false);
    expect(proxyEntryAllowed({ joined_at: null })).toBe(false);
    expect(proxyEntryAllowed({ joined_at: "2026-10-02T00:00:00Z" })).toBe(true);
  });
  it("참여 뒤에는 운영자 대리 입력이 save_quote 까지 간다", async () => {
    fx.session = admin;
    join({});
    fx.rpcResult.save_quote = { ok: true, quote_id: QUOTE, first: true, total_invites: 1, submitted_invites: 1 };
    const r = await quotePost(json({ ...body, pdf: undefined }), tctx);
    // PDF 가 없으면 400 이 먼저 나지만, 참여 검사는 통과했다 (409 아님)
    expect(r.status).not.toBe(409);
  });
  it("견적서 PDF 업로드 주소도 참여 전에는 주지 않는다", async () => {
    const r = await uploadUrl(json({ name: "q.pdf", size: 1000, type: "application/pdf" }), tctx);
    expect(r.status).toBe(409);
    fx.session = admin;
    const r2 = await uploadUrl(json({ name: "q.pdf", size: 1000, type: "application/pdf" }), tctx);
    expect(r2.status).toBe(409);
    expect((await r2.json()).error).toContain("대신 올릴 수 없습니다");
  });
  it("철회한 초대는 403", async () => {
    join({ status: "declined", withdrawn_at: "2026-10-03T00:00:00Z" });
    const r = await quotePost(json(body), tctx);
    expect(r.status).toBe(403);
    expect((await r.json()).error).toContain("철회");
  });
});

/* ── 4) 불참과 철회 ── */
describe("POST /api/quote/[token]/decline: 참여 전 불참, 참여 뒤 철회", () => {
  it("참여 전 불참: 상태만 바꾸고 철회 함수는 부르지 않으며, 의뢰자에게 알리지 않는다", async () => {
    const r = await declinePost(json({ mode: "decline", reason: "일정 불가" }), tctx);
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, mode: "decline" });
    expect(inv0()).toMatchObject({ status: "declined", decline_reason: "일정 불가" });
    const upd = fx.calls.find((c) => c.table === "rfq_invites" && c.op === "update" && (c.payload as Row).status === "declined");
    expect(upd?.filters).toEqual(expect.arrayContaining(["eq:status", "is:joined_at"]));
    expect(fx.rpcCalls.some((x) => x.fn === "withdraw_offer")).toBe(false);
    expect((fx.notifyUsers.mock.calls as unknown[][]).some((c) => (c[0] as string[]).includes("sponsor-1"))).toBe(false);
    expect(fx.logEvent).toHaveBeenCalledWith(RFQ, "declined", expect.stringContaining("불참"), "일정 불가", null);
  });
  it("참여 뒤 철회: withdraw_offer 를 부르고, 의뢰자에게 기관명 없이 알린다", async () => {
    join({ status: "draft" });
    fx.rpcResult.withdraw_offer = { ok: true, seats: SEATS };
    const r = await declinePost(json({ mode: "withdraw" }), tctx);
    expect(r.status).toBe(200);
    expect(fx.rpcCalls.find((x) => x.fn === "withdraw_offer")?.args).toMatchObject({ p_invite_id: INV, p_token: TOKEN, p_reason: null });
    const sponsor = (fx.notifyUsers.mock.calls as [string[], { title: string; body?: string }][]).find((c) => c[0].includes("sponsor-1"));
    expect(sponsor?.[1].title).toContain("철회");
    expect(JSON.stringify(sponsor)).not.toContain("바이오랩");
    expect(fx.logEvent).toHaveBeenCalledWith(RFQ, "withdrawn", expect.stringContaining("참여 철회"), undefined, null);
  });
  it("화면이 본 단계와 지금 단계가 다르면 409 (불참을 누른 사이 참여된 경우)", async () => {
    join({});
    expect((await declinePost(json({ mode: "decline" }), tctx)).status).toBe(409);
    expect(fx.rpcCalls.some((x) => x.fn === "withdraw_offer")).toBe(false);
  });
  it("제출한 견적은 철회할 수 없다", async () => {
    join({ status: "submitted" });
    fx.tables.cro_quotes = [{ id: QUOTE, invite_id: INV, status: "submitted", cro_quote_items: [] }];
    expect((await declinePost(json({ mode: "withdraw" }), tctx)).status).toBe(400);
  });
  it("운영자는 기관이 알린 철회를 기록할 수 있고 감사 기록이 남는다", async () => {
    fx.session = admin;
    join({ status: "draft" });
    fx.rpcResult.withdraw_offer = { ok: true };
    expect((await declinePost(json({ reason: "기관 메일" }), tctx)).status).toBe(200);
    expect(fx.audit).toHaveBeenCalledWith(expect.objectContaining({ userId: "admin-1" }), "invite.withdraw_proxy", expect.objectContaining({ id: INV }), expect.anything());
  });
  it("불참 안내 문구에 '다음 배포 대상 선정에 참고'가 없다", async () => {
    const fs = await import("node:fs");
    const src = fs.readFileSync("components/cro/DeclineForm.tsx", "utf8") + fs.readFileSync("app/api/quote/[token]/decline/route.ts", "utf8");
    expect(src).not.toContain("다음 배포 대상 선정에 참고");
  });
});

/* ── 5) 첨부·PDF 잠금 ── */
describe("참여 전 초대에는 첨부와 견적서 PDF 를 주지 않는다", () => {
  const fileReq = () => fileGet(new Request(`https://danchu.kr/api/files/${FILE}?token=${TOKEN}`), { params: Promise.resolve({ id: FILE }) });
  it("토큰·포털 모두 참여 전이면 403", async () => {
    expect((await fileReq()).status).toBe(403);
    fx.session = croMember;
    expect((await fileGet(new Request(`https://danchu.kr/api/files/${FILE}`), { params: Promise.resolve({ id: FILE }) })).status).toBe(403);
  });
  it("철회한 초대도 403", async () => {
    join({ status: "declined", withdrawn_at: "2026-10-03T00:00:00Z" });
    expect((await fileReq()).status).toBe(403);
  });
  it("참여한 초대는 열린다", async () => {
    join({});
    vi.stubGlobal("fetch", vi.fn(async () => new Response("pdf", { status: 200 })));
    expect((await fileReq()).status).not.toBe(403);
    vi.unstubAllGlobals();
  });
  it("견적서 PDF: 참여 기록이 없는 초대의 토큰으로는 열지 않는다", async () => {
    fx.tables.cro_quotes = [{ id: QUOTE, invite_id: INV, rfq_id: RFQ, cro_org_id: ORG, status: "draft", pdf_path: "q/x.pdf" }];
    const req = () => pdfGet(new Request(`https://danchu.kr/api/quotes/${QUOTE}/pdf?token=${TOKEN}`), { params: Promise.resolve({ id: QUOTE }) });
    expect((await req()).status).toBe(403);
    join({});
    expect((await req()).status).not.toBe(403);
  });
});

/* ── 6) 배포와 메일 ── */
describe("참여 안내 배포", () => {
  const orgs = Array.from({ length: 5 }, (_, i) => ({ id: `org-${i}`, name: `기관${i}`, contact_email: `o${i}@example.com`, categories: ["일반독성"], glp_certs: [] }));
  it("자리 3곳 요청이어도 분야가 맞는 기관 5곳 모두에 안내한다", async () => {
    fx.tables.rfq_invites = [];
    const r = await distributeTo(rfqRow({ cro_count: "3곳" }), orgs, "2099-01-20", null, true);
    expect(r.sent).toBe(5);
    expect(fx.tables.rfq_invites).toHaveLength(5);
    expect(r.blocked).toBeUndefined();
  });
  it("지명 기관에만 안내하는 요청에는 자동 매칭 안내를 만들지 않는다", async () => {
    fx.tables.rfq_invites = [];
    const r = await distributeTo(rfqRow({ nominees_only: true }), orgs, "2099-01-20", null, true, "matched");
    expect(r.sent).toBe(0);
    expect(r.blocked).toBe("nominees_only");
    const n = await distributeTo(rfqRow({ nominees_only: true }), orgs.slice(0, 1), "2099-01-20", null, true, "nominated");
    expect(n.sent).toBe(1);
  });
  it("안내 메일: 제목과 버튼은 '요약 보고 참여 결정', 시험물질명·목적·자유 기술은 없다", async () => {
    fx.tables.rfq_invites = [];
    await distributeTo(rfqRow(), orgs.slice(0, 1), "2099-01-20", null, true);
    const m = fx.sendMail.mock.calls[0][0];
    expect(m.subject).toContain(INVITE_MAIL_ACTION);
    expect(INVITE_MAIL_ACTION).toBe("요약 보고 참여 결정");
    expect(m.html).toContain(`>${INVITE_MAIL_ACTION}</a>`);
    for (const secret of Object.values(SECRET)) {
      expect(m.subject).not.toContain(secret);
      expect(m.html).not.toContain(secret);
    }
    expect(m.html).not.toMatch(/[–—]/);
    // 기관 앱 알림에도 시험물질명이 없다
    expect(JSON.stringify(fx.notifyUsers.mock.calls)).not.toContain(SECRET.substance);
  });
  it("메일 함수 단독으로도 같은 규칙", () => {
    const html = inviteMailHtml(rfqRow(), "2099-01-20", TOKEN, INV, { members: 1 });
    expect(inviteMailSubject(rfqRow(), "2099-01-20")).not.toContain(SECRET.substance);
    expect(html).not.toContain(SECRET.substance);
    expect(html).toContain("참여 결정 기한 2099-01-05");
    expect(html).toContain("먼저 참여한 순서");
  });
});

/* ── 7) 자리·단계 도우미 ── */
describe("자리와 단계 이름", () => {
  it("자리에 세는 것은 참여·작성 중·제출 (철회·불참·취소·참여 전 제외)", () => {
    const list = [
      { status: "sent", joined_at: null },
      { status: "sent", joined_at: "t" },
      { status: "draft", joined_at: "t" },
      { status: "submitted", joined_at: "t" },
      { status: "declined", joined_at: "t", withdrawn_at: "t" },
      { status: "declined", joined_at: null },
      { status: "expired", joined_at: "t", revoked_at: "t" },
    ];
    expect(list.filter(occupiesSeat)).toHaveLength(3);
    expect(seatUsage("3곳", list)).toEqual({ cap: 3, used: 3, open: 0 });
    expect(seatUsage("전체", list)).toEqual({ cap: null, used: 3, open: null });
    // 기관용 표시는 참여 수·지명 수를 적지 않는다 (경쟁 기관 수 노출 방지)
    expect(seatsLabel({ cap: null, used: 2, reserved: 0, open: null, join_by: null })).toBe("자리 제한 없음");
    expect(seatsLabel({ cap: 3, used: 1, reserved: 1, open: 1, join_by: null })).toBe("자리 3곳 중 1곳 남음 (일부 자리는 참여 결정 기한까지 지명 기관 몫)");
    expect(seatsDetailLabel({ cap: null, used: 2, reserved: 0, open: null, join_by: null })).toBe("자리 제한 없음 · 지금 2곳 참여");
    expect(seatsDetailLabel({ cap: 3, used: 1, reserved: 1, open: 1, join_by: null })).toBe("자리 3곳 중 1곳 남음 (지명 기관 몫 1곳 별도)");
    expect(seatsLabel({ cap: 3, used: 3, reserved: 0, open: 0, join_by: null })).toBe("자리 3곳 모두 찼습니다");
  });
  it("참여 결정 기한: 2영업일, 회신 기한이 5영업일 안이면 1영업일, 회신 기한을 넘지 않음", () => {
    // 2026-10-16 금요일
    expect(joinDeadline("2026-10-16", "2026-11-30")).toBe(new Date("2026-10-20T23:59:59+09:00").toISOString());
    expect(joinDeadline("2026-10-16", "2026-10-21")).toBe(new Date("2026-10-19T23:59:59+09:00").toISOString());
    expect(joinDeadline("2026-10-16", "2026-10-16")).toBe(new Date("2026-10-16T23:59:59+09:00").toISOString());
  });
  it("화면 단계 이름: 참여 결정 전 / 참여 / 작성 중 / 제출 / 불참 / 철회 / 종료", () => {
    expect(Object.values(INVITE_STAGE_LABEL)).toEqual(["참여 결정 전", "참여", "작성 중", "제출", "불참", "철회", "종료"]);
    expect(inviteStage({ status: "sent" })).toBe("undecided");
    expect(inviteStage({ status: "sent", joined_at: "t" })).toBe("joined");
    expect(inviteStage({ status: "declined" })).toBe("declined");
    expect(inviteStage({ status: "declined", joined_at: "t", withdrawn_at: "t" })).toBe("withdrawn");
    expect(inviteStage({ status: "expired", revoked_at: "t" })).toBe("ended");
    expect(inviteStageLabel({ status: "submitted", joined_at: "t" })).toBe("제출");
  });
});
