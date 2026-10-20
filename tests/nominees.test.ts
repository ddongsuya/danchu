import { beforeEach, describe, expect, it, vi } from "vitest";

/* 지명 기관과 "지명 기관에만 안내" (0023): 위자드 문구, 접수 라우트의 join_by·nominees_only 저장, 첫 안내 때 참여 결정 기한 다시 잡기 */
type Q = { table: string; op: "select" | "insert" | "update" | "delete"; payload?: unknown; filters: [string, unknown][] };
const fx = vi.hoisted(() => ({
  calls: [] as Q[],
  respond: (_q: Q): { data: unknown; error: unknown } => ({ data: null, error: null }),
  session: { userId: "sponsor-1", email: "sponsor@example.com", profile: { role: "requester" } } as null | { userId: string; email: string; profile: { role: string } },
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
  return {
    getSupabaseAdmin: () => ({
      from: builder,
      rpc: async (name: string) => (name === "next_rfq_no" ? { data: "DC-2026-0100", error: null } : name === "danchu_schema_version" ? { data: 24, error: null } : { data: null, error: null }),
      storage: { from: () => ({ createSignedUploadUrl: async () => ({ data: { signedUrl: "https://x" }, error: null }) }) },
    }),
  };
});
vi.mock("@/lib/auth", () => ({ sessionOrNull: async () => fx.session }));
vi.mock("@/lib/rate-limit", () => ({ rateLimited: async () => false, clientIp: () => "203.0.113.9", TOO_MANY: "too many" }));
vi.mock("@/lib/notify", () => ({
  logEvent: vi.fn(async () => {}),
  notifyUsers: vi.fn(async () => {}),
  adminUserIds: async () => [],
  adminEmails: () => [],
  operatorReplyTo: () => "hello@danchu.kr",
  siteUrl: () => "https://danchu.kr",
}));
vi.mock("@/lib/mail", async (orig) => ({ ...(await orig<typeof import("@/lib/mail")>()), sendMail: vi.fn(async () => true), sendRfqMails: vi.fn(async () => {}) }));
vi.mock("@/lib/mail-preferences", () => ({ notificationRecipients: async (to: string[]) => to }));
// 응답 뒤 자동 안내는 이 테스트에서 돌리지 않는다 (저장 값만 본다)
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), after: () => {} }));

import { cleanNominees, joinDeadline } from "@/lib/request-policy";
import { DEFAULT_VALUES, WIZ, validateRequired } from "@/lib/rfq-schema";
import { POST as intake } from "@/app/api/rfq/route";
import { autoDistribute, distributeTo } from "@/lib/distribute";
import { notifyUsers } from "@/lib/notify";
import type { RfqRow } from "@/lib/data";

beforeEach(() => {
  fx.calls = [];
  fx.respond = () => ({ data: null, error: null });
});

describe("지명 기관", () => {
  const approved = ["㈜바이오벤처 안전성평가연구소", "켐온", "우정바이오"];
  it("승인된 기관 이름만, 중복 없이, 기관 수 한도 안에서", () => {
    expect(cleanNominees(["켐온", " 켐온 ", "없는기관", "우정바이오", "㈜바이오벤처 안전성평가연구소", 3], "3곳", approved)).toEqual(["켐온", "우정바이오", "㈜바이오벤처 안전성평가연구소"]);
    expect(cleanNominees(["켐온", "우정바이오", "㈜바이오벤처 안전성평가연구소"], "전체", approved)).toHaveLength(3);
    expect(cleanNominees("켐온", "3곳", approved)).toEqual([]);
    expect(cleanNominees(["켐온"], "3곳", [])).toEqual([]);
  });
  it("위자드 마지막 단계는 여전히 동의 단계다 (지명 단계가 끼어들어도)", () => {
    expect(WIZ[WIZ.length - 1].fields.every((f) => f.id.startsWith("agree"))).toBe(true);
    expect(WIZ.findIndex((w) => w.fields.some((f) => f.id === "nominees"))).toBe(WIZ.findIndex((w) => w.fields.some((f) => f.id === "croCount")) + 1);
    expect(WIZ.some((w) => w.fields.some((f) => f.id === "nominees" && f.type === "orgs" && !f.required))).toBe(true);
  });
});

describe("받을 견적 수와 지명 안내 문구 (0023)", () => {
  const countStep = WIZ.find((w) => w.fields.some((f) => f.id === "croCount"))!;
  const nomineeStep = WIZ.find((w) => w.fields.some((f) => f.id === "nominees"))!;
  it("질문은 '몇 곳의 견적을 받을까요?'이고 자리는 먼저 참여한 순서라고 적는다", () => {
    expect(countStep.q).toBe("몇 곳의 견적을 받을까요?");
    expect(countStep.sub).toContain("먼저 참여한 순서");
    expect(validateRequired({ ...DEFAULT_VALUES, company: "의뢰사", name: "김담당", email: "x@example.com", croCount: "10곳" })).toBe("받을 견적 수를 선택해 주세요.");
  });
  it("지명 안내는 참여 결정 기한까지 자리를 비워 두고, 불참·미결정이면 다른 기관에 돌아간다고 적는다", () => {
    expect(nomineeStep.sub).toContain("참여 결정 기한까지 비워 둡니다");
    expect(nomineeStep.sub).toContain("먼저 참여한 다른 기관에 돌아갑니다");
    expect(nomineeStep.sub).not.toContain("먼저 전달");
  });
  it("'지명 기관에만 안내'는 지명 단계의 선택 체크박스이고 기본은 꺼져 있다", () => {
    const f = nomineeStep.fields.find((x) => x.id === "nomineesOnly");
    expect(f).toMatchObject({ type: "checkbox", label: "지명 기관에만 안내" });
    expect(f?.required).toBeFalsy();
    expect(DEFAULT_VALUES.nomineesOnly).toBeUndefined();
  });
  it("화면 문구에 대시 문자가 없다", () => {
    const text = [countStep.q, countStep.sub, nomineeStep.q, nomineeStep.sub, ...nomineeStep.fields.map((x) => `${x.label ?? ""}${x.help ?? ""}`)].join(" ");
    expect(text).not.toMatch(/[–—]/);
  });
});

describe("POST /api/rfq 는 참여 결정 기한과 '지명 기관에만 안내'를 저장한다", () => {
  const base = {
    company: "의뢰사", name: "김담당", email: "x@example.com", purpose: "허가자료 제출용", intent: "발주 예정", substance: "DC-101",
    croCount: "3곳", confid: "일반", categories: ["일반독성"], replyBy: "2099-03-31", agreePrivacy: true, agreeTerms: true, agreeShare: true,
  };
  const post = (payload: Record<string, unknown>) => intake(new Request("https://danchu.kr/api/rfq", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payload }) }));
  const inserted = () => fx.calls.find((c) => c.table === "rfq_requests" && c.op === "insert")?.payload as Record<string, unknown> | undefined;
  beforeEach(() => {
    fx.respond = (q) => {
      if (q.table === "cro_orgs") return { data: [{ name: "켐온" }, { name: "우정바이오" }], error: null };
      if (q.table === "rfq_requests" && q.op === "insert") return { data: { id: "rfq-new" }, error: null };
      return { data: null, error: null };
    };
  });
  it("join_by 는 오늘부터 2영업일 (회신 기한이 멀 때)", async () => {
    const r = await post(base);
    expect(r.status, JSON.stringify(await r.clone().json())).toBe(200);
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
    expect(inserted()?.join_by).toBe(joinDeadline(today, "2099-03-31"));
    expect(inserted()?.nominees_only).toBe(false);
  });
  it("지명 기관이 있고 체크하면 nominees_only = true", async () => {
    await post({ ...base, nominees: ["켐온"], nomineesOnly: true });
    expect(inserted()?.nominees_only).toBe(true);
    expect((inserted()?.payload as Record<string, unknown>).nomineesOnly).toBe(true);
  });
  it("지명 기관이 남지 않으면 체크해도 끈다 (아무에게도 안내가 가지 않는 요청을 막는다)", async () => {
    await post({ ...base, nominees: ["없는기관"], nomineesOnly: true });
    expect(inserted()?.nominees_only).toBe(false);
    expect((inserted()?.payload as Record<string, unknown>).nomineesOnly).toBeUndefined();
  });
  it("문자열 'true' 같은 값은 켜지 않는다", async () => {
    await post({ ...base, nominees: ["켐온"], nomineesOnly: "true" });
    expect(inserted()?.nominees_only).toBe(false);
  });
});

describe("참여 결정 기한은 처음 안내한 날부터 센다", () => {
  const rfq = (over: Partial<RfqRow> = {}) => ({
    id: "rfq-1", rfq_no: "DC-2026-0100", status: "received", distributed_at: null, reply_by: "2099-03-31", join_by: "2000-01-04T14:59:59.000Z",
    categories: ["일반독성"], payload: {}, cro_count: "3곳", confidentiality: "일반", intent: "발주 예정", org_type: null, nominees_only: false, user_id: null, email: "s@example.com",
    ...over,
  }) as unknown as RfqRow;
  const org = { id: "org-1", name: "켐온", contact_email: "chem@example.com", categories: ["일반독성"], glp_certs: [], managed: false };
  beforeEach(() => {
    fx.respond = (q) => {
      if (q.table === "rfq_invites" && q.op === "insert") return { data: { id: "inv-1", token: "tok_abcdefgh" }, error: null };
      if (q.table === "rfq_invites") return { data: [], error: null };
      if (q.table === "profiles") return { data: [], error: null };
      return { data: null, error: null };
    };
  });
  it("접수 때 잡은 기한이 지났는데 운영자가 나중에 처음 안내하면 오늘부터 다시 잡는다 (안내 전 요청만)", async () => {
    await distributeTo(rfq(), [org], "2099-03-31", "admin-1", false, "manual");
    const up = fx.calls.find((c) => c.table === "rfq_requests" && c.op === "update" && (c.payload as Record<string, unknown>).join_by);
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
    expect(up?.payload).toEqual({ join_by: joinDeadline(today, "2099-03-31") });
    expect(up?.filters).toContainEqual(["is:distributed_at", null]);
  });
  it("이미 안내한 요청에 기관을 더해도 참여 결정 기한은 그대로다", async () => {
    await distributeTo(rfq({ status: "distributed", distributed_at: "2026-10-01T00:00:00Z" } as Partial<RfqRow>), [org], "2099-03-31", "admin-1", false, "manual");
    expect(fx.calls.some((c) => c.table === "rfq_requests" && c.op === "update" && (c.payload as Record<string, unknown>).join_by)).toBe(false);
  });
});

describe("지명 기관과 분야 매칭 기관에 함께 안내해도 의뢰자 알림은 한 번", () => {
  const nominee = { id: "org-n", name: "켐온", contact_email: "n@example.com", categories: ["일반독성"], glp_certs: [], managed: false };
  const matched = { id: "org-m", name: "우정바이오", contact_email: "m@example.com", categories: ["일반독성"], glp_certs: [], managed: false };
  beforeEach(() => {
    vi.mocked(notifyUsers).mockClear();
    let n = 0;
    fx.respond = (q) => {
      if (q.table === "cro_orgs") return { data: q.filters.some(([k]) => k === "in:name") ? [nominee] : [nominee, matched], error: null };
      if (q.table === "cro_catalog") return { data: [], error: null };
      if (q.table === "rfq_invites" && q.op === "insert") return { data: { id: `inv-${++n}`, token: `tok_abcdefg${n}` }, error: null };
      if (q.table === "rfq_invites") return { data: [], error: null };
      if (q.table === "profiles") return { data: [], error: null };
      return { data: null, error: null };
    };
  });
  it("autoDistribute: 지명 안내 뒤 매칭 안내는 안내한 요청으로 이어 받아 의뢰자 알림을 다시 보내지 않는다", async () => {
    const rfq = {
      id: "rfq-1", rfq_no: "DC-2026-0101", status: "received", distributed_at: null, reply_by: "2099-03-31", join_by: null, created_at: "2026-10-20T00:00:00Z",
      categories: ["일반독성"], payload: { nominees: ["켐온"] }, cro_count: "3곳", confidentiality: "일반", intent: "발주 예정", org_type: null, nominees_only: false, user_id: "sponsor-1", email: "s@example.com",
    } as unknown as RfqRow;
    const r = await autoDistribute(rfq);
    expect(r.sent).toBe(2);
    const sponsorNotices = vi.mocked(notifyUsers).mock.calls.filter(([to]) => Array.isArray(to) && to[0] === "sponsor-1");
    expect(sponsorNotices).toHaveLength(1);
    // 참여 결정 기한도 첫 안내에서 한 번만 잡는다
    expect(fx.calls.filter((c) => c.table === "rfq_requests" && c.op === "update" && (c.payload as Record<string, unknown>).join_by)).toHaveLength(1);
  });
});
