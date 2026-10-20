import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * 보안 보강 (0021) 라우트 로직: 소유는 user_id 로만, 초대 철회는 모든 읽기·쓰기·파일 경로에서 거절,
 * 제출 초대 재발송은 지금의 기관 대표 메일로만, 기관 이동 시 대표 권한 초기화.
 * DB 쪽(잠금 뒤 재검사, 토큰 재발급 트리거)은 tests/db/security_*.sql 이 실제 PostgreSQL 로 본다.
 */

type Row = Record<string, unknown>;
type Call = { table: string; op: "select" | "update" | "insert" | "delete"; payload?: unknown; filters: string[]; or?: string };
const fx = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  calls: [] as { table: string; op: string; payload?: unknown; filters: string[]; or?: string }[],
  session: null as null | { userId: string; email: string; profile: Record<string, unknown> },
  rpc: vi.fn(async (_fn: string, _args: unknown): Promise<{ data: unknown; error: unknown }> => ({ data: null, error: null })),
  saveQuote: vi.fn(async (..._a: unknown[]): Promise<Record<string, unknown>> => ({ ok: true, quote_id: "q-1", first: false, total_invites: 1, submitted_invites: 1 })),
  sendMail: vi.fn(async (_m: unknown) => true),
  notifyUsers: vi.fn(async () => {}),
  logEvent: vi.fn(async () => {}),
  audit: vi.fn(async () => {}),
  signedUrl: vi.fn(async () => ({ data: { signedUrl: "https://storage.example.invalid/signed" }, error: null })),
  deleteUser: vi.fn(async () => ({ error: null })),
  /** 이 호출을 DB 오류로 돌려준다 (리뷰 수정 테스트용) */
  fail: null as null | ((c: { table: string; op: string }) => boolean),
}));

vi.mock("@/lib/supabase", () => {
  const builder = (table: string) => {
    const call: Call = { table, op: "select", filters: [] };
    const preds: ((r: Row) => boolean)[] = [];
    let head = false;
    let counted = false;
    const rows = () => (fx.tables[table] ?? []).filter((r) => preds.every((p) => p(r)));
    const run = (): { data: unknown; error: unknown; count?: number } => {
      fx.calls.push(call);
      if (fx.fail?.(call)) return { data: null, error: { message: "boom", code: "XX000" } };
      if (call.op === "update") {
        const hit = rows();
        for (const r of hit) Object.assign(r, call.payload as Row);
        return { data: hit, error: null };
      }
      if (call.op === "insert") {
        const r = { ...(call.payload as Row) };
        (fx.tables[table] ??= []).push(r);
        return { data: r, error: null };
      }
      if (call.op === "delete") {
        fx.tables[table] = (fx.tables[table] ?? []).filter((r) => !preds.every((p) => p(r)));
        return { data: null, error: null };
      }
      const list = rows().map((r) => ({ ...r })); // 복사본: 나중의 update 가 앞서 읽은 행을 바꾸지 않게
      return { data: head ? null : list, error: null, ...(counted ? { count: list.length } : {}) };
    };
    const b: Record<string, unknown> = {};
    Object.assign(b, {
      select: (_c?: string, o?: { count?: string; head?: boolean }) => {
        if (o?.count) counted = true;
        if (o?.head) head = true;
        return b;
      },
      update: (p: unknown) => ((call.op = "update"), (call.payload = p), b),
      insert: (p: unknown) => ((call.op = "insert"), (call.payload = p), b),
      delete: () => ((call.op = "delete"), b),
      eq: (k: string, v: unknown) => (call.filters.push(`eq:${k}`), preds.push((r) => r[k] === v), b),
      neq: (k: string, v: unknown) => (call.filters.push(`neq:${k}`), preds.push((r) => r[k] !== v), b),
      in: (k: string, v: unknown[]) => (call.filters.push(`in:${k}`), preds.push((r) => v.includes(r[k])), b),
      is: (k: string, v: unknown) => (call.filters.push(`is:${k}`), preds.push((r) => (r[k] ?? null) === v), b),
      not: (k: string) => (call.filters.push(`not:${k}`), b),
      // 이메일 OR 소유 조회가 다시 생기면 테스트가 알아챈다
      or: (expr: string) => ((call.or = expr), b),
      order: () => b, limit: () => b, range: () => b, gte: () => b, lt: () => b, ilike: () => b,
      maybeSingle: async () => {
        const r = run();
        return { ...r, data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data };
      },
      single: async () => {
        const r = run();
        return { ...r, data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data };
      },
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => Promise.resolve(run()).then(res, rej),
    });
    return b;
  };
  const client = {
    from: builder,
    rpc: (fn: string, args: unknown) => fx.rpc(fn, args),
    storage: { from: () => ({ createSignedUrl: fx.signedUrl, list: async () => ({ data: [], error: null }), remove: async () => ({ error: null }), createSignedUploadUrl: async () => ({ data: { signedUrl: "u" }, error: null }) }) },
    auth: { admin: { deleteUser: fx.deleteUser } },
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
  viewerLoadOpts: async () => ({ markOpened: true, operator: false }),
}));
vi.mock("@/lib/notify", () => ({
  logEvent: fx.logEvent,
  notifyUsers: fx.notifyUsers,
  adminUserIds: async () => [],
  adminEmails: () => [],
  operatorReplyTo: () => "hello@danchu.kr",
  siteUrl: () => "https://danchu.kr",
}));
vi.mock("@/lib/mail", async (orig) => ({ ...(await orig<typeof import("@/lib/mail")>()), sendMail: fx.sendMail }));
vi.mock("@/lib/mail-preferences", () => ({ notificationRecipients: async (to: string[]) => to }));
vi.mock("@/lib/audit", async (orig) => ({ ...(await orig<typeof import("@/lib/audit")>()), audit: fx.audit }));
vi.mock("@/lib/rate-limit", async (orig) => ({ ...(await orig<typeof import("@/lib/rate-limit")>()), rateLimited: async () => false }));
vi.mock("@/lib/rpc", async (orig) => ({ ...(await orig<typeof import("@/lib/rpc")>()), saveQuote: fx.saveQuote }));
vi.mock("@/lib/catalog-db", () => ({ catalogMap: async () => new Map(), learnFromSubmission: async () => {} }));
vi.mock("@/lib/observe", () => ({ captureError: () => {}, sentryEnabled: () => false, maskEmail: (s: string) => s }));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: (fn: () => unknown) => void fn() }));

import { listRequestsForUser, ownsRfq } from "@/lib/data";
import { deleteAccount } from "@/lib/account";
import { loadByInvite } from "@/lib/quote-load";
import { GET as fileGet } from "@/app/api/files/[id]/route";
import { GET as pdfGet } from "@/app/api/quotes/[id]/pdf/route";
import { GET as quoteGet, PUT as quotePut, POST as quotePost } from "@/app/api/quote/[token]/route";
import { POST as uploadUrl } from "@/app/api/quote/[token]/upload-url/route";
import { POST as declinePost } from "@/app/api/quote/[token]/decline/route";
import { POST as cancelInvite } from "@/app/api/admin/invites/[id]/cancel/route";
import { POST as resendInvite } from "@/app/api/admin/invites/[id]/resend/route";
import { POST as changeStatus } from "@/app/api/admin/rfqs/[no]/status/route";
import { POST as setUser } from "@/app/api/admin/users/[id]/route";
import { POST as orgMembers } from "@/app/api/cro/org/members/route";
import { POST as orgEdit } from "@/app/api/cro/org/route";
import type { InviteRow } from "@/lib/data";
import { inviteMailTo, notifyInvitedOrgs, resendUnmailedInvites } from "@/lib/distribute";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const RFQ_A = "00000000-0000-4000-8000-0000000000f1";
const FILE_A = "00000000-0000-4000-8000-0000000000f2";
const QUOTE_A = "00000000-0000-4000-8000-0000000000f3";
const INV = "00000000-0000-4000-8000-0000000000e1";
const ORG = "00000000-0000-4000-8000-0000000000c1";
const ORG2 = "00000000-0000-4000-8000-0000000000c2";
const TOKEN = "tok_current_0000000000000000000000";
const OLD = "old@example.test";

const ctx = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });
const json = (body: unknown = {}, method = "POST") => new Request("https://danchu.kr/x", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const asB = () => ({ userId: B, email: OLD, profile: { id: B, role: "requester", email: OLD } });
const asA = () => ({ userId: A, email: "new@example.test", profile: { id: A, role: "requester", email: "new@example.test" } });
const admin = () => ({ userId: "00000000-0000-4000-8000-0000000000ad", email: "ops@danchu.kr", profile: { role: "admin" } });

function invite(over: Row = {}): Row {
  return { id: INV, rfq_id: RFQ_A, rfq_no: "DC-2026-0001", cro_name: "기관가", cro_email: "leaver@example.test", cro_org_id: ORG, token: TOKEN, reply_by: "2099-01-01", expires_at: "2099-01-08T00:00:00Z", status: "sent", opened_at: "2026-01-01", cda_signed_at: null, revoked_at: null, declined_at: null, joined_at: "2026-01-01T00:00:00Z", withdrawn_at: null, ...over };
}

beforeEach(() => {
  // A 가 옛 주소(old@)로 낸 종료 요청. A 는 이메일을 new@ 로 바꿨고, B 가 old@ 로 새로 가입했다
  fx.tables = {
    rfq_requests: [{ id: RFQ_A, rfq_no: "DC-2026-0001", user_id: A, email: OLD, status: "closed", confidentiality: "일반", selected_quote_id: null, compared_at: null, company: "의뢰사", org_type: null, payload: {}, reply_by: "2099-01-01" }],
    rfq_files: [{ id: FILE_A, rfq_id: RFQ_A, storage_path: "DC-2026-0001/x.pdf", file_name: "x.pdf", mime_type: "application/pdf", size_bytes: 10, uploaded_at: "2026-01-01" }],
    cro_quotes: [{ id: QUOTE_A, invite_id: INV, rfq_id: RFQ_A, cro_org_id: ORG, status: "submitted", pdf_path: "p.pdf", pdf_name: "p.pdf", cro_quote_items: [] }],
    rfq_invites: [invite()],
    cro_orgs: [{ id: ORG, name: "기관가", status: "approved", contact_email: "contact@example.test", managed: false }],
    profiles: [],
    rfq_awards: [],
  };
  fx.calls = [];
  fx.session = null;
  fx.rpc.mockReset().mockResolvedValue({ data: null, error: null });
  fx.saveQuote.mockReset().mockResolvedValue({ ok: true, quote_id: "q-1", first: false, total_invites: 1, submitted_invites: 1 });
  fx.sendMail.mockReset().mockResolvedValue(true);
  fx.notifyUsers.mockClear();
  fx.signedUrl.mockClear();
  fx.deleteUser.mockClear();
  fx.fail = null;
});

describe("소유는 user_id 로만 (이메일 재사용)", () => {
  it("ownsRfq: 이메일이 같아도 user_id 가 다르면 소유자가 아니다", () => {
    const rfq = { user_id: A, email: OLD };
    expect(ownsRfq(rfq, A)).toBe(true);
    expect(ownsRfq(rfq, B)).toBe(false);
    expect(ownsRfq({ user_id: null }, B)).toBe(false);
  });
  it("목록: B 에게 A 의 옛 주소 요청이 보이지 않고, 이메일 OR 조회를 쓰지 않는다", async () => {
    expect(await listRequestsForUser(B)).toEqual([]);
    expect((await listRequestsForUser(A)).map((r) => r.id)).toEqual([RFQ_A]);
    const q = fx.calls.filter((c) => c.table === "rfq_requests");
    expect(q.every((c) => !c.or && c.filters.includes("eq:user_id"))).toBe(true);
  });
  it("첨부: B 는 A 의 옛 주소 요청 첨부를 받을 수 없다", async () => {
    fx.session = asB();
    expect((await fileGet(new Request(`https://danchu.kr/api/files/${FILE_A}`), ctx({ id: FILE_A }))).status).toBe(403);
    fx.session = asA();
    expect((await fileGet(new Request(`https://danchu.kr/api/files/${FILE_A}`), ctx({ id: FILE_A }))).status).toBe(302);
  });
  it("견적 PDF: B 는 A 요청의 견적 PDF 를 받을 수 없다", async () => {
    fx.session = asB();
    expect((await pdfGet(new Request(`https://danchu.kr/api/quotes/${QUOTE_A}/pdf`), ctx({ id: QUOTE_A }))).status).toBe(403);
    fx.session = asA();
    expect((await pdfGet(new Request(`https://danchu.kr/api/quotes/${QUOTE_A}/pdf`), ctx({ id: QUOTE_A }))).status).toBe(302);
  });
  it("탈퇴: B 의 탈퇴는 A 의 요청·첨부를 건드리지 않는다", async () => {
    fx.tables.profiles = [{ id: B, email: OLD, role: "requester", name: null, company: null, cro_org_id: null }];
    const r = await deleteAccount((await import("@/lib/supabase")).getSupabaseAdmin()!, B, { reason: "self" });
    expect(r).toMatchObject({ ok: true, cancelled: 0, anonymized: 0, filesDeleted: 0 });
    expect(fx.tables.rfq_requests[0]).toMatchObject({ user_id: A, email: OLD, status: "closed" });
    expect(fx.tables.rfq_files).toHaveLength(1);
    expect(fx.calls.some((c) => c.table === "rfq_requests" && c.or)).toBe(false);
    expect(fx.calls.some((c) => c.op === "update" && c.table === "rfq_requests")).toBe(false);
  });
});

describe("초대 철회 (revoked_at): 모든 읽기·쓰기·파일 경로에서 거절", () => {
  beforeEach(() => {
    fx.tables.rfq_requests[0].status = "distributed";
    fx.tables.rfq_invites = [invite({ status: "expired", revoked_at: "2026-10-18T00:00:00Z" })];
    fx.tables.cro_quotes = [{ id: QUOTE_A, invite_id: INV, rfq_id: RFQ_A, cro_org_id: ORG, status: "draft", pdf_path: "p.pdf", pdf_name: "p.pdf", cro_quote_items: [] }];
  });
  it("loadByInvite 는 철회된 초대를 열지 않는다 (DB 조회 전)", async () => {
    expect(await loadByInvite(invite({ revoked_at: "2026-10-18T00:00:00Z" }) as unknown as InviteRow)).toBeNull();
    expect(fx.calls).toHaveLength(0);
  });
  it("회신 GET·PUT·POST·업로드·회신하지 않음 모두 거절", async () => {
    const p = ctx({ token: TOKEN });
    expect((await quoteGet(new Request("https://danchu.kr/x"), p)).status).toBe(404);
    expect((await quotePut(json({ items: [] }, "PUT"), p)).status).toBe(404);
    expect((await quotePost(json({ items: [] }), p)).status).toBe(404);
    expect((await uploadUrl(json({ name: "q.pdf", size: 10, type: "application/pdf" }), p)).status).toBe(404);
    expect((await declinePost(json({}), p)).status).toBe(404);
    expect(fx.saveQuote).not.toHaveBeenCalled();
  });
  it("첨부·PDF 의 토큰 경로도 거절", async () => {
    expect((await fileGet(new Request(`https://danchu.kr/api/files/${FILE_A}?token=${TOKEN}`), ctx({ id: FILE_A }))).status).toBe(403);
    expect((await pdfGet(new Request(`https://danchu.kr/api/quotes/${QUOTE_A}/pdf?token=${TOKEN}`), ctx({ id: QUOTE_A }))).status).toBe(403);
  });
  it("기관 담당자 계정으로도 철회된 초대의 첨부·PDF 는 열 수 없다", async () => {
    fx.session = { userId: "u-cro", email: "cro@example.test", profile: { role: "cro", cro_org_id: ORG } };
    expect((await fileGet(new Request(`https://danchu.kr/api/files/${FILE_A}`), ctx({ id: FILE_A }))).status).toBe(403);
    expect((await pdfGet(new Request(`https://danchu.kr/api/quotes/${QUOTE_A}/pdf`), ctx({ id: QUOTE_A }))).status).toBe(403);
  });
  it("요청 재개는 개별 철회 초대를 되살리지 않는다 (revoked_at 이 빈 초대만 조회)", async () => {
    fx.session = admin();
    fx.tables.rfq_requests[0].status = "cancelled";
    const { getRfqByNo } = await import("@/lib/data");
    expect(await getRfqByNo("DC-2026-0001")).not.toBeNull();
    const r = await changeStatus(json({ status: "reopen" }), ctx({ no: "DC-2026-0001" }));
    expect(r.status).toBe(200);
    const revive = fx.calls.find((c) => c.table === "rfq_invites" && c.op === "select" && c.filters.includes("eq:status"));
    expect(revive?.filters).toContain("is:revoked_at");
    expect(fx.tables.rfq_invites[0].status).toBe("expired");
  });
});

describe("검사 직후 철회·재발급 경합: save_quote 가 잠금 뒤 거절", () => {
  it("화면 검사를 통과해도 save_quote 가 revoked 를 돌려주면 403, 알림 없음. 지금 토큰을 함께 넘긴다", async () => {
    fx.tables.rfq_requests[0].status = "distributed";
    fx.tables.cro_quotes = [{ id: QUOTE_A, invite_id: INV, rfq_id: RFQ_A, cro_org_id: ORG, status: "draft", cro_quote_items: [] }];
    fx.saveQuote.mockResolvedValueOnce({ ok: false, code: "revoked" });
    const r = await quotePut(json({ items: [] }, "PUT"), ctx({ token: TOKEN }));
    expect(r.status).toBe(403);
    expect(fx.saveQuote).toHaveBeenCalledTimes(1);
    expect(fx.saveQuote.mock.calls[0][5]).toBe(TOKEN);
    expect(fx.notifyUsers).not.toHaveBeenCalled();
  });
  it.each([["org_inactive"], ["not_member"], ["expired"], ["declined"], ["withdrawn"]])("save_quote %s 도 403", async (code) => {
    fx.tables.rfq_requests[0].status = "distributed";
    fx.tables.cro_quotes = [{ id: QUOTE_A, invite_id: INV, rfq_id: RFQ_A, cro_org_id: ORG, status: "draft", cro_quote_items: [] }];
    fx.saveQuote.mockResolvedValueOnce({ ok: false, code });
    expect((await quotePut(json({ items: [] }, "PUT"), ctx({ token: TOKEN }))).status).toBe(403);
  });
  it("save_quote not_joined(기관이 참여하기 전, 0023) 는 409 와 참여 안내", async () => {
    fx.tables.rfq_requests[0].status = "distributed";
    fx.tables.cro_quotes = [{ id: QUOTE_A, invite_id: INV, rfq_id: RFQ_A, cro_org_id: ORG, status: "draft", cro_quote_items: [] }];
    fx.saveQuote.mockResolvedValueOnce({ ok: false, code: "not_joined" });
    const r = await quotePut(json({ items: [] }, "PUT"), ctx({ token: TOKEN }));
    expect(r.status).toBe(409);
    expect(((await r.json()) as { error: string }).error).toMatch(/참여하기/);
    expect(fx.notifyUsers).not.toHaveBeenCalled();
  });
});

describe("운영자 초대 취소", () => {
  it("revoke_invite RPC 로 거두고, 그 사이 제출됐으면 409", async () => {
    fx.session = admin();
    fx.rpc.mockResolvedValueOnce({ data: { ok: true, status: "sent" }, error: null });
    expect((await cancelInvite(json({ reason: "잘못 보냄" }), ctx({ id: INV }))).status).toBe(200);
    expect(fx.rpc).toHaveBeenCalledWith("revoke_invite", { p_invite_id: INV, p_reason: "잘못 보냄" });
    expect(fx.calls.some((c) => c.table === "rfq_invites" && c.op === "update")).toBe(false);
    fx.rpc.mockResolvedValueOnce({ data: { ok: false, code: "not_open" }, error: null });
    expect((await cancelInvite(json({}), ctx({ id: INV }))).status).toBe(409);
  });
});

describe("재발송: 제출 초대 지원, 지금의 기관 대표 메일로만, 메일 실패해도 토큰 그대로", () => {
  beforeEach(() => {
    fx.session = admin();
    fx.tables.rfq_requests[0].status = "quoted";
    fx.tables.rfq_invites = [invite({ status: "submitted", token: "tok_rotated_000000000000000000000" })];
  });
  it("제출한 초대에 새 링크를 기관 대표 메일로 보낸다 (옛 초대 주소 아님)", async () => {
    const r = await resendInvite(json(), ctx({ id: INV }));
    expect(r.status).toBe(200);
    const mail = fx.sendMail.mock.calls[0][0] as { to: string[]; html: string; subject: string };
    expect(mail.to).toEqual(["contact@example.test"]);
    expect(mail.html).toContain("/q/tok_rotated_000000000000000000000");
    expect(mail.subject).toContain("새로 발급");
    expect(fx.tables.rfq_invites[0]).toMatchObject({ status: "submitted", token: "tok_rotated_000000000000000000000", cro_email: "contact@example.test" });
  });
  it("기관 대표 메일이 없으면 옛 초대 주소로 대신 보내지 않는다", async () => {
    fx.tables.cro_orgs[0].contact_email = null;
    expect((await resendInvite(json(), ctx({ id: INV }))).status).toBe(409);
    expect(fx.sendMail).not.toHaveBeenCalled();
  });
  it("메일이 실패해도 토큰·상태를 되돌리지 않는다", async () => {
    fx.sendMail.mockResolvedValueOnce(false);
    expect((await resendInvite(json(), ctx({ id: INV }))).status).toBe(502);
    expect(fx.calls.some((c) => c.table === "rfq_invites" && c.op === "update")).toBe(false);
    expect(fx.tables.rfq_invites[0]).toMatchObject({ token: "tok_rotated_000000000000000000000", status: "submitted", cro_email: "leaver@example.test" });
  });
  it("참여했지만 아직 제출하지 않은 초대에는 '참여하기를 눌러 주세요'가 아니라 회신 링크 안내를 보낸다 (0023)", async () => {
    fx.tables.rfq_invites = [invite({ status: "draft", joined_at: "2026-10-01T00:00:00Z" })];
    expect((await resendInvite(json(), ctx({ id: INV }))).status).toBe(200);
    const mail = fx.sendMail.mock.calls[0][0] as { html: string; subject: string };
    expect(mail.subject).toContain("참여하신 요청의 회신 링크");
    expect(mail.html).toContain(`/q/${TOKEN}`);
    expect(mail.html).not.toContain("참여하기");
  });
  it("참여 결정 전 초대에는 참여 안내 메일을 다시 보낸다", async () => {
    fx.tables.rfq_invites = [invite({ status: "sent", joined_at: null })];
    Object.assign(fx.tables.rfq_requests[0], { categories: ["일반독성"], cro_count: "3곳", join_by: null });
    expect((await resendInvite(json(), ctx({ id: INV }))).status).toBe(200);
    const mail = fx.sendMail.mock.calls[0][0] as { subject: string };
    expect(mail.subject).toContain("참여 안내");
  });
  it("철회된 초대와 중지된 기관에는 보내지 않는다", async () => {
    fx.tables.rfq_invites = [invite({ status: "expired", revoked_at: "2026-10-18T00:00:00Z" })];
    expect((await resendInvite(json(), ctx({ id: INV }))).status).toBe(409);
    fx.tables.rfq_invites = [invite({ status: "submitted" })];
    fx.tables.cro_orgs[0].status = "suspended";
    expect((await resendInvite(json(), ctx({ id: INV }))).status).toBe(409);
    expect(fx.sendMail).not.toHaveBeenCalled();
  });
});

describe("담당자 이동·제외", () => {
  it("운영자가 A 기관 owner 를 B 기관으로 옮기면 org_role 을 member 로 저장한다", async () => {
    fx.session = admin();
    const U = "00000000-0000-4000-8000-000000000011";
    fx.tables.profiles = [{ id: U, role: "cro", cro_org_id: ORG, pending_org_id: null, email: "owner@example.test", org_role: "owner" }];
    fx.tables.cro_orgs.push({ id: ORG2, name: "기관나", status: "approved", managed: false });
    expect((await setUser(json({ role: "cro", croOrgId: ORG2 }), ctx({ id: U }))).status).toBe(200);
    expect(fx.tables.profiles[0]).toMatchObject({ cro_org_id: ORG2, org_role: "member" });
  });
  it("B 로 옮겨 member 가 된 이전 A owner 는 B 의 기관 수정·담당자 관리 API 를 쓸 수 없고, B 의 owner 는 쓸 수 있다", async () => {
    const moved = { userId: "00000000-0000-4000-8000-000000000031", email: "moved@example.test", profile: { role: "cro", cro_org_id: ORG2, org_role: "member" } };
    fx.session = moved;
    expect((await orgEdit(json({ intro: "x" }))).status).toBe(403);
    expect((await orgMembers(json({ userId: "00000000-0000-4000-8000-000000000032", action: "remove" }))).status).toBe(403);
    fx.session = { ...moved, userId: "00000000-0000-4000-8000-000000000033", profile: { role: "cro", cro_org_id: ORG2, org_role: "owner" } };
    expect((await orgMembers(json({ userId: "00000000-0000-4000-8000-000000000032", action: "remove" }))).status).not.toBe(403);
  });
  it("같은 기관이면 org_role 을 건드리지 않는다", async () => {
    fx.session = admin();
    const U = "00000000-0000-4000-8000-000000000012";
    fx.tables.profiles = [{ id: U, role: "cro", cro_org_id: ORG, pending_org_id: null, email: "owner@example.test", org_role: "owner" }];
    expect((await setUser(json({ role: "cro", croOrgId: ORG }), ctx({ id: U }))).status).toBe(200);
    const upd = fx.calls.find((c) => c.table === "profiles" && c.op === "update");
    expect(upd?.payload).not.toHaveProperty("org_role");
  });
  it("담당자 제외는 소속만 비우고(재발급은 DB 트리거) 새 링크를 메일로 자동 발송하지 않는다", async () => {
    const OWNER = "00000000-0000-4000-8000-000000000021";
    const LEAVER = "00000000-0000-4000-8000-000000000022";
    fx.session = { userId: OWNER, email: "owner@example.test", profile: { role: "cro", cro_org_id: ORG, org_role: "owner" } };
    fx.tables.profiles = [
      { id: OWNER, email: "owner@example.test", role: "cro", cro_org_id: ORG, org_role: "owner" },
      { id: LEAVER, email: "leaver@example.test", name: "퇴사자", role: "cro", cro_org_id: ORG, org_role: "member", pending_org_id: null },
    ];
    fx.tables.rfq_invites = [invite({ status: "submitted" })];
    const r = await orgMembers(json({ userId: LEAVER, action: "remove" }));
    expect(r.status).toBe(200);
    expect(fx.tables.profiles[1]).toMatchObject({ cro_org_id: null });
    expect(fx.rpc).not.toHaveBeenCalled();
    expect(fx.sendMail).not.toHaveBeenCalled();
    // 남은 담당자에게는 앱 알림만 (메일 인자 없음)
    const toRest = (fx.notifyUsers.mock.calls as unknown[][]).find((c) => (c[0] as string[]).includes(OWNER));
    expect(toRest?.[2]).toBeUndefined();
  });
});

describe("리뷰 수정 (2026-10-18)", () => {
  // H1: 토큰이 들어가는 메일은 지금의 대표 메일 + 지금 소속 담당자에게만. 초대의 cro_email(배포 당시, 떠난 담당자)로 보내지 않는다
  it("inviteMailTo: 기관 초대는 지금 연락처만, 기관 없는 초대만 cro_email", () => {
    const t = { managed: false, contactEmail: "contact@example.test", members: [{ id: "m1", email: "m1@example.test" }] };
    expect(inviteMailTo({ cro_org_id: ORG, cro_email: "leaver@example.test" }, t).sort()).toEqual(["contact@example.test", "m1@example.test"]);
    expect(inviteMailTo({ cro_org_id: ORG, cro_email: "leaver@example.test" }, { managed: false, contactEmail: null, members: [] })).toEqual([]);
    expect(inviteMailTo({ cro_org_id: null, cro_email: "solo@example.test" }, undefined)).toEqual(["solo@example.test"]);
  });
  it("안내 메일(notifyInvitedOrgs)은 떠난 담당자의 옛 주소로 새 링크를 보내지 않는다", async () => {
    await notifyInvitedOrgs([{ id: INV, token: TOKEN, cro_org_id: ORG, cro_email: "leaver@example.test" }], { kind: "견적", title: "기한 변경" });
    const calls = fx.notifyUsers.mock.calls as unknown as [string[], { href?: string }, { to: string[] }][];
    expect(calls).toHaveLength(1);
    expect(calls[0][2].to).toEqual(["contact@example.test"]);
    expect(calls[0][1].href).toBe(`/q/${TOKEN}`);
  });
  it("배포 메일 재시도(resendUnmailedInvites)도 지금의 대표 메일로", async () => {
    Object.assign(fx.tables.rfq_requests[0], { status: "distributed", substance: "X", categories: ["일반독성"], purpose: null, intent: null });
    const r = await resendUnmailedInvites();
    expect(r.sent).toBe(1);
    const to = (fx.sendMail.mock.calls[0][0] as { to: string[] }).to;
    expect(to).toEqual(["contact@example.test"]);
  });
  it("대표 메일이 비었고 담당자도 없으면 옛 주소로 대신 보내지 않는다", async () => {
    fx.tables.cro_orgs[0].contact_email = null;
    Object.assign(fx.tables.rfq_requests[0], { status: "distributed", substance: "X", categories: ["일반독성"] });
    expect((await resendUnmailedInvites()).sent).toBe(0);
    expect(fx.sendMail).not.toHaveBeenCalled();
  });

  // M1: 정리가 실패하면 계정을 지우지 않는다
  it("탈퇴: 요청 조회가 실패하면 계정을 지우지 않는다", async () => {
    fx.tables.profiles = [{ id: A, email: "new@example.test", role: "requester", name: null, company: null, cro_org_id: null }];
    fx.fail = (c) => c.table === "rfq_requests" && c.op === "select";
    await expect(deleteAccount((await import("@/lib/supabase")).getSupabaseAdmin()!, A, { reason: "self" })).rejects.toThrow(/삭제하지 않았습니다/);
    expect(fx.deleteUser).not.toHaveBeenCalled();
  });
  it("탈퇴: 익명화가 하나라도 실패하면 계정을 지우지 않는다", async () => {
    fx.tables.profiles = [{ id: A, email: "new@example.test", role: "requester", name: null, company: null, cro_org_id: null }];
    fx.fail = (c) => c.table === "rfq_requests" && c.op === "update";
    await expect(deleteAccount((await import("@/lib/supabase")).getSupabaseAdmin()!, A, { reason: "self" })).rejects.toThrow(/정리하지 못해/);
    expect(fx.deleteUser).not.toHaveBeenCalled();
    fx.fail = null;
    const ok = await deleteAccount((await import("@/lib/supabase")).getSupabaseAdmin()!, A, { reason: "self" });
    expect(ok).toMatchObject({ ok: true, anonymized: 1 });
    expect(fx.deleteUser).toHaveBeenCalledTimes(1);
  });

  // L1: 중지된 기관은 포털·첨부로 계속 열람하지 못한다
  it("중지된 기관의 초대는 운영자 외에는 열지 않는다", async () => {
    fx.tables.cro_orgs[0].status = "suspended";
    fx.tables.rfq_requests[0].status = "distributed";
    expect(await loadByInvite(invite() as unknown as InviteRow)).toBeNull();
    const op = await loadByInvite(invite() as unknown as InviteRow, { operator: true, markOpened: false });
    expect(op?.closed).toBe(true);
  });
  it("중지된 기관 담당자는 첨부를 내려받지 못한다 (계정·토큰 모두)", async () => {
    fx.tables.cro_orgs[0].status = "suspended";
    fx.tables.rfq_invites = [invite({ status: "submitted" })];
    fx.session = { userId: "cro-1", email: "m@example.test", profile: { id: "cro-1", role: "cro", cro_org_id: ORG } };
    expect((await fileGet(new Request(`https://danchu.kr/api/files/${FILE_A}`), ctx({ id: FILE_A }))).status).toBe(403);
    fx.session = null;
    expect((await fileGet(new Request(`https://danchu.kr/api/files/${FILE_A}?token=${TOKEN}`), ctx({ id: FILE_A }))).status).toBe(403);
    fx.tables.cro_orgs[0].status = "approved";
    expect((await fileGet(new Request(`https://danchu.kr/api/files/${FILE_A}?token=${TOKEN}`), ctx({ id: FILE_A }))).status).not.toBe(403);
  });

  // M3: 다른 기관 담당자로 로그인한 경우 거절 문구가 로그아웃 방법을 알려 준다
  it("not_member 403 문구는 로그아웃 뒤 링크로 회신하라고 안내한다", async () => {
    fx.tables.rfq_requests[0].status = "distributed";
    fx.tables.cro_quotes = [{ id: QUOTE_A, invite_id: INV, rfq_id: RFQ_A, cro_org_id: ORG, status: "draft", cro_quote_items: [] }];
    fx.saveQuote.mockResolvedValueOnce({ ok: false, code: "not_member" });
    const r = await quotePut(json({ items: [] }, "PUT"), ctx({ token: TOKEN }));
    expect(r.status).toBe(403);
    expect(((await r.json()) as { error: string }).error).toMatch(/로그아웃/);
  });
});
