import { beforeEach, describe, expect, it, vi } from "vitest";

/* 매일 cron 의 참여 단계 (0023): 참여 결정 기한, 참여 부족 알림, 회신 기한 임박 알림, 빈 자리 재안내, 참여 기관만 리마인더, 자동 회신 삭제 */
const fx = vi.hoisted(() => ({
  logEvent: vi.fn(async (..._a: unknown[]) => {}),
  notifyUsers: vi.fn(async (..._a: unknown[]) => {}),
  notifyInvitedOrgs: vi.fn(async (..._a: unknown[]) => {}),
  closeReplies: vi.fn(async (..._a: unknown[]): Promise<Record<string, unknown>> => ({ ok: false, count: 0, pending: 0, message: "" })),
  saveQuote: vi.fn(async () => ({ ok: true })),
  routeDb: null as null | ((q: Q) => { data: unknown; error: unknown }),
}));
type Q = { table: string; op: "select" | "insert" | "update" | "delete"; payload?: unknown; filters: [string, unknown][]; single?: boolean };

/** from(table) 체인을 기록하고 respond 로 답하는 가짜 DB */
function fakeDb(respond: (q: Q) => { data: unknown; error: unknown }, calls: Q[] = []) {
  const builder = (table: string) => {
    const q: Q = { table, op: "select", filters: [] };
    const finish = () => {
      calls.push(q);
      return Promise.resolve(respond(q));
    };
    const b: Record<string, unknown> = {};
    const rec = (tag: string) => (k: string, v: unknown) => (q.filters.push([`${tag}${k}`, v]), b);
    Object.assign(b, {
      select: () => b,
      insert: (p: unknown) => ((q.op = "insert"), (q.payload = p), b),
      update: (p: unknown) => ((q.op = "update"), (q.payload = p), b),
      delete: () => ((q.op = "delete"), b),
      eq: rec(""), is: rec("is:"), in: rec("in:"), lt: rec("lt:"), gte: rec("gte:"), neq: rec("neq:"),
      order: () => b, limit: () => b,
      maybeSingle: () => ((q.single = true), finish()),
      single: () => ((q.single = true), finish()),
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => finish().then(res, rej),
    });
    return b;
  };
  return { from: builder, rpc: async () => ({ data: null, error: null }), calls };
}

vi.mock("@/lib/notify", () => ({
  logEvent: fx.logEvent,
  notifyUsers: fx.notifyUsers,
  adminUserIds: async () => ["admin-1"],
  adminEmails: () => ["ops@danchu.kr"],
  operatorReplyTo: () => "hello@danchu.kr",
  siteUrl: () => "https://danchu.kr",
}));
vi.mock("@/lib/distribute", () => ({
  notifyInvitedOrgs: fx.notifyInvitedOrgs,
  distributeOpenRfqs: async () => ({ rfqs: 0, invites: 0 }),
  resendUnmailedInvites: async () => ({ tried: 0, sent: 0 }),
  orgMailTargets: async () => new Map(),
  inviteMailTo: (inv: { cro_email: string }) => [inv.cro_email],
  inviteReplyTo: () => undefined,
}));
vi.mock("@/lib/compare", () => ({ closeReplies: fx.closeReplies }));
vi.mock("@/lib/rpc", () => ({ saveQuote: fx.saveQuote }));
vi.mock("@/lib/retention", () => ({ runRetention: async () => ({ accessLogs: 0, requests: 0, files: 0, notifications: 0 }) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimited: async () => false }));
vi.mock("@/lib/mail", () => ({ sendMail: async () => true, contractFollowupMail: () => ({ subject: "", html: "" }) }));
vi.mock("@/lib/mail-preferences", () => ({ notificationRecipients: async (to: string[]) => to }));
vi.mock("@/lib/supabase", () => ({ getSupabaseAdmin: () => (fx.routeDb ? fakeDb(fx.routeDb) : null) }));

import { businessDaysBefore, lateJoinOpen, lowParticipation, seatReleased, seatState } from "@/lib/request-policy";
import { reofferNow, runOptInSteps } from "@/lib/opt-in-cron";
import { GET as cron } from "@/app/api/cron/daily/route";

const NOW = new Date("2099-01-12T09:00:00+09:00").getTime(); // 월요일 09:00
const TODAY = "2099-01-12";
const PAST_JOIN_BY = "2099-01-09T14:59:59.000Z"; // 금요일 자정(서울), 지남
const FUTURE_JOIN_BY = "2099-01-13T14:59:59.000Z";
const J = "2099-01-08T00:00:00Z";

type Inv = { id: string; status: string; source?: string; joined_at?: string | null; withdrawn_at?: string | null; revoked_at?: string | null; expires_at?: string; cro_email?: string; cro_name?: string; token?: string; cro_org_id?: string | null };
const inv = (id: string, over: Partial<Inv> = {}): Inv => ({ id, status: "sent", source: "matched", joined_at: null, withdrawn_at: null, revoked_at: null, expires_at: "2099-02-07T14:59:59Z", cro_email: `${id}@example.com`, cro_name: `기관${id}`, token: `tok_${id}xxxxxx`, cro_org_id: null, ...over });
const rfqRow = (over: Record<string, unknown> = {}) => ({
  id: "rfq-1", rfq_no: "DC-2099-0001", status: "distributed", compared_at: null, selected_quote_id: null, cro_count: "3곳", reply_by: "2099-01-30",
  join_by: PAST_JOIN_BY, categories: ["일반독성"], substance: "ABC-1", user_id: "sponsor-1", email: "sponsor@example.com", ...over,
});

/** 요청 하나·초대·이력으로 답하는 가짜 DB */
function world(rfq: Record<string, unknown>, invites: Inv[], events: { kind: string; meta: Record<string, unknown> }[] = []) {
  return fakeDb((q) => {
    if (q.table === "rfq_requests") return { data: [rfq], error: null };
    if (q.table === "rfq_invites") return { data: invites, error: null };
    if (q.table === "rfq_events") return { data: events, error: null };
    return { data: null, error: null };
  });
}
type NotifyCall = [string[], { title: string; body?: string; href?: string }, { to: string[] } | undefined];
const notified = () => fx.notifyUsers.mock.calls as unknown as NotifyCall[];
const eventKinds = () => fx.logEvent.mock.calls.map((c) => c[1]);
const eventMeta = (kind: string) => fx.logEvent.mock.calls.find((c) => c[1] === kind)?.[5] as Record<string, unknown> | undefined;

beforeEach(() => {
  fx.logEvent.mockClear();
  fx.notifyUsers.mockClear();
  fx.notifyInvitedOrgs.mockClear();
  fx.closeReplies.mockClear();
  fx.saveQuote.mockClear();
  fx.routeDb = null;
});

describe("자리·기한 계산 (offer_seat_state·join_offer 와 같은 규칙)", () => {
  it("영업일 전 날짜와 늦은 참여 마감", () => {
    expect(businessDaysBefore("2099-01-30", 3)).toBe("2099-01-27"); // 금 → 화
    expect(businessDaysBefore("2099-01-26", 3)).toBe("2099-01-21"); // 월 → 지난주 수
    expect(lateJoinOpen("2099-01-30", PAST_JOIN_BY, "2099-01-27", NOW)).toBe(true);
    expect(lateJoinOpen("2099-01-30", PAST_JOIN_BY, "2099-01-28", NOW)).toBe(false);
    // 참여 결정 기한 안이면 회신 기한이 가까워도 참여할 수 있다
    expect(lateJoinOpen("2099-01-13", FUTURE_JOIN_BY, TODAY, NOW)).toBe(true);
    expect(lateJoinOpen("2099-01-11", FUTURE_JOIN_BY, TODAY, NOW)).toBe(false);
  });
  it("지명 기관 몫은 참여 결정 기한 전에만 비워 둔다", () => {
    const list = [inv("a", { joined_at: J }), inv("n", { source: "nominated" }), inv("b")];
    expect(seatState("3곳", FUTURE_JOIN_BY, list, NOW)).toEqual({ cap: 3, used: 1, reserved: 1, open: 1, join_by: FUTURE_JOIN_BY });
    expect(seatState("3곳", PAST_JOIN_BY, list, NOW)).toMatchObject({ reserved: 0, open: 2 });
    expect(seatState("전체", PAST_JOIN_BY, list, NOW)).toMatchObject({ cap: null, open: null, used: 1 });
  });
  it("자리를 비운 초대: 철회·취소한 참여, 지명 기관의 불참, 기한까지 결정하지 않은 지명 기관", () => {
    expect(seatReleased(inv("w", { joined_at: J, withdrawn_at: J, status: "declined" }), FUTURE_JOIN_BY, NOW)).toBe(true);
    expect(seatReleased(inv("r", { joined_at: J, revoked_at: J, status: "expired" }), FUTURE_JOIN_BY, NOW)).toBe(true);
    expect(seatReleased(inv("n", { source: "nominated", status: "declined" }), FUTURE_JOIN_BY, NOW)).toBe(true);
    expect(seatReleased(inv("n", { source: "nominated" }), FUTURE_JOIN_BY, NOW)).toBe(false);
    expect(seatReleased(inv("n", { source: "nominated" }), PAST_JOIN_BY, NOW)).toBe(true);
    // 일반 기관의 불참은 자리를 쓴 적이 없다
    expect(seatReleased(inv("g", { status: "declined" }), PAST_JOIN_BY, NOW)).toBe(false);
    expect(seatReleased(inv("j", { joined_at: J }), PAST_JOIN_BY, NOW)).toBe(false);
  });
  it("참여 부족: 자리 3곳은 2곳 미만, 5곳은 절반 미만, 전체는 안내의 절반 미만 또는 2곳 미만", () => {
    expect(lowParticipation("3곳", 1, 9)).toBe(true);
    expect(lowParticipation("3곳", 2, 9)).toBe(false);
    expect(lowParticipation("5곳", 2, 9)).toBe(true);
    expect(lowParticipation("5곳", 3, 9)).toBe(false);
    expect(lowParticipation("전체", 2, 6)).toBe(true);
    expect(lowParticipation("전체", 3, 6)).toBe(false);
    expect(lowParticipation("전체", 1, 1)).toBe(true);
  });
});

describe("참여 결정 기한 경과와 참여 부족", () => {
  const invites = [inv("a", { joined_at: J }), inv("n", { source: "nominated", cro_name: "지명랩" }), inv("b"), inv("c")];
  it("기한이 지나면 지명 기관 몫을 풀었다고 남기고, 참여가 모자라면 운영자와 의뢰자(한 번)에게 알린다", async () => {
    const r = await runOptInSteps(world(rfqRow(), invites) as never, TODAY, NOW);
    expect(r).toMatchObject({ joinDeadlines: 1, lowParticipation: 1, errors: [] });
    expect(eventKinds()).toEqual(expect.arrayContaining(["join_deadline", "low_participation"]));
    expect(eventMeta("join_deadline")).toMatchObject({ join_by: PAST_JOIN_BY, used: 1, released: 1 });
    const admin = notified().find((c) => c[0][0] === "admin-1");
    expect(admin?.[1].title).toContain("참여 부족 · 참여 1/3곳");
    expect(admin?.[2]?.to).toEqual(["ops@danchu.kr"]);
    const sponsor = notified().filter((c) => c[0][0] === "sponsor-1");
    expect(sponsor).toHaveLength(1);
    expect(sponsor[0][1].title).toContain("참여한 기관이 아직 1곳입니다");
    expect(sponsor[0][2]?.to).toEqual(["sponsor@example.com"]);
    // 의뢰자 안내에 참여하지 않은 기관 이름은 없다
    expect(JSON.stringify(sponsor[0])).not.toMatch(/기관b|기관c|지명랩/);
    expect(sponsor[0][1].body).not.toMatch(/[–—]/);
  });
  it("같은 기한은 한 번만 처리한다", async () => {
    const r = await runOptInSteps(world(rfqRow(), invites, [{ kind: "join_deadline", meta: { join_by: PAST_JOIN_BY } }]) as never, TODAY, NOW);
    expect(r.joinDeadlines).toBe(0);
    expect(notified()).toHaveLength(0);
  });
  it("기한을 늘린 뒤 새 기한이 지나면 다시 처리하지만 의뢰자 안내는 다시 보내지 않는다", async () => {
    const r = await runOptInSteps(world(rfqRow(), invites, [{ kind: "join_deadline", meta: { join_by: "2099-01-06T14:59:59.000Z" } }, { kind: "low_participation", meta: {} }]) as never, TODAY, NOW);
    expect(r).toMatchObject({ joinDeadlines: 1, lowParticipation: 1 });
    expect(notified().some((c) => c[0][0] === "admin-1")).toBe(true);
    expect(notified().some((c) => c[0][0] === "sponsor-1")).toBe(false);
  });
  it("참여가 충분하면 기한 경과만 남긴다", async () => {
    const r = await runOptInSteps(world(rfqRow(), [inv("a", { joined_at: J }), inv("b", { joined_at: J, status: "draft" }), inv("c")]) as never, TODAY, NOW);
    expect(r).toMatchObject({ joinDeadlines: 1, lowParticipation: 0 });
    expect(notified()).toHaveLength(0);
  });
  it("기한 전에는 아무것도 하지 않는다", async () => {
    const r = await runOptInSteps(world(rfqRow({ join_by: FUTURE_JOIN_BY }), invites) as never, TODAY, NOW);
    expect(r).toMatchObject({ joinDeadlines: 0, lowParticipation: 0, reoffered: 0 });
    expect(fx.logEvent).not.toHaveBeenCalled();
  });
  it("참여 결정 기한이 없는 예전 요청은 기한 처리를 하지 않는다", async () => {
    const r = await runOptInSteps(world(rfqRow({ join_by: null }), [inv("a", { joined_at: J }), inv("b", { joined_at: J })]) as never, TODAY, NOW);
    expect(r.joinDeadlines).toBe(0);
  });
});

describe("회신 기한 3영업일 전에도 참여 1곳 이하", () => {
  const rfq = rfqRow({ reply_by: "2099-01-14", join_by: "2099-01-05T14:59:59.000Z" }); // 월요일 기준 3영업일 전 = 지난주 금 → 오늘은 그 뒤
  const events = [{ kind: "join_deadline", meta: { join_by: "2099-01-05T14:59:59.000Z" } }];
  it("운영자에게 의뢰자에게 기한 연장을 물어 달라고 한 번 알린다", async () => {
    const r = await runOptInSteps(world(rfq, [inv("a", { joined_at: J }), inv("b")], events) as never, TODAY, NOW);
    expect(r.extendAsked).toBe(1);
    const admin = notified().find((c) => c[0][0] === "admin-1");
    expect(admin?.[1].body).toContain("회신 기한 연장");
    expect(notified().some((c) => c[0][0] === "sponsor-1")).toBe(false);
    expect(eventMeta("low_participation_cutoff")).toMatchObject({ reply_by: "2099-01-14", used: 1 });
  });
  it("같은 회신 기한에는 다시 알리지 않고, 참여가 2곳이면 알리지 않는다", async () => {
    const again = await runOptInSteps(world(rfq, [inv("a", { joined_at: J })], [...events, { kind: "low_participation_cutoff", meta: { reply_by: "2099-01-14" } }]) as never, TODAY, NOW);
    expect(again.extendAsked).toBe(0);
    const enough = await runOptInSteps(world(rfq, [inv("a", { joined_at: J }), inv("b", { joined_at: J })], events) as never, TODAY, NOW);
    expect(enough.extendAsked).toBe(0);
  });
});

describe("빈 자리 재안내 (자리가 생겼습니다)", () => {
  const full = [
    inv("a", { joined_at: J }),
    inv("b", { joined_at: J, status: "draft" }),
    inv("w", { joined_at: J, withdrawn_at: J, status: "declined" }),
    inv("u1"),
    inv("u2"),
    inv("x", { status: "declined" }), // 일반 기관 불참: 대상 아님
    inv("e", { expires_at: "2099-01-01T00:00:00Z" }), // 링크 만료: 대상 아님
  ];
  const events = [{ kind: "join_deadline", meta: { join_by: PAST_JOIN_BY } }];
  it("찼던 자리가 철회로 비면 아직 결정하지 않은 안내 기관에 시험물질명 없이 알린다", async () => {
    const r = await runOptInSteps(world(rfqRow(), full, events) as never, TODAY, NOW);
    expect(r.reoffered).toBe(2);
    expect(fx.notifyInvitedOrgs).toHaveBeenCalledTimes(1);
    const [targets, n] = fx.notifyInvitedOrgs.mock.calls[0] as unknown as [Inv[], { title: string; body: string }];
    expect(targets.map((t) => t.id).sort()).toEqual(["u1", "u2"]);
    expect(n.title).toBe("자리가 생겼습니다 · DC-2099-0001");
    expect(n.body).toContain("참여 자리 1곳");
    expect(n.body).toContain("먼저 참여한 기관부터");
    expect(`${n.title} ${n.body}`).not.toContain("ABC-1");
    expect(eventMeta("seat_release")).toMatchObject({ ids: ["w"], open: 1, notified: 2 });
  });
  it("자리가 비는 순간(철회 직후) reofferNow 가 같은 판정으로 바로 알린다", async () => {
    const db = fakeDb((q) => {
      if (q.table === "rfq_requests") return { data: q.single ? rfqRow() : [rfqRow()], error: null };
      if (q.table === "rfq_invites") return { data: full, error: null };
      if (q.table === "rfq_events") return { data: [], error: null };
      return { data: null, error: null };
    });
    const n = await reofferNow(db as never, "rfq-1", TODAY, NOW);
    expect(n).toBe(2);
    expect(fx.notifyInvitedOrgs).toHaveBeenCalledTimes(1);
    expect(eventMeta("seat_release")).toMatchObject({ ids: ["w"], open: 1, notified: 2 });
  });
  it("reofferNow: 회신이 닫힌 요청은 재안내하지 않는다", async () => {
    const db = fakeDb((q) => (q.table === "rfq_requests" ? { data: rfqRow({ compared_at: J }), error: null } : { data: full, error: null }));
    expect(await reofferNow(db as never, "rfq-1", TODAY, NOW)).toBe(0);
    expect(fx.notifyInvitedOrgs).not.toHaveBeenCalled();
  });
  it("같은 빈 자리로는 다시 알리지 않는다", async () => {
    const r = await runOptInSteps(world(rfqRow(), full, [...events, { kind: "seat_release", meta: { ids: ["w"] } }]) as never, TODAY, NOW);
    expect(r.reoffered).toBe(0);
    expect(fx.notifyInvitedOrgs).not.toHaveBeenCalled();
    expect(eventKinds()).not.toContain("seat_release");
  });
  it("참여 결정 기한이 지나 지명 기관 몫이 풀리면 (그 전에 일반 자리가 찼다면) 다시 알린다", async () => {
    const list = [inv("a", { joined_at: J }), inv("b", { joined_at: J }), inv("n", { source: "nominated" }), inv("u1")];
    const r = await runOptInSteps(world(rfqRow(), list) as never, TODAY, NOW);
    expect(r.reoffered).toBe(2); // 결정하지 않은 지명 기관도 이제 일반 자리로 참여할 수 있다
    expect(eventMeta("seat_release")).toMatchObject({ ids: ["n"], open: 1 });
  });
  it("자리가 남아 있던 중에 빈 자리는 다시 알리지 않고 기록만 남긴다", async () => {
    const list = [inv("w", { joined_at: J, withdrawn_at: J, status: "declined" }), inv("u1")];
    const r = await runOptInSteps(world(rfqRow(), list, events) as never, TODAY, NOW);
    expect(r.reoffered).toBe(0);
    expect(fx.notifyInvitedOrgs).not.toHaveBeenCalled();
    expect(eventMeta("seat_release")).toMatchObject({ ids: ["w"], notified: 0 });
  });
  it("늦은 참여 마감(회신 기한 3영업일 전)이 지났으면 다시 알리지 않는다", async () => {
    const r = await runOptInSteps(world(rfqRow({ reply_by: "2099-01-14" }), full, events) as never, TODAY, NOW);
    expect(r.reoffered).toBe(0);
    expect(fx.logEvent.mock.calls.find((c) => c[1] === "seat_release")?.[3]).toContain("늦은 참여 마감");
  });
  it("자리 제한이 없는 요청(전체)은 재안내하지 않는다", async () => {
    const r = await runOptInSteps(world(rfqRow({ cro_count: "전체" }), full, events) as never, TODAY, NOW);
    expect(r.reoffered).toBe(0);
    expect(eventKinds()).not.toContain("seat_release");
  });
  it("한 요청의 오류가 다른 요청을 막지 않는다", async () => {
    const db = fakeDb((q) => {
      if (q.table === "rfq_requests") return { data: [rfqRow({ id: "bad", rfq_no: "DC-BAD" }), rfqRow()], error: null };
      if (q.table === "rfq_invites") return q.filters.some(([k, v]) => k === "rfq_id" && v === "bad") ? { data: null, error: { message: "boom" } } : { data: full, error: null };
      if (q.table === "rfq_events") return { data: events, error: null };
      return { data: null, error: null };
    });
    const r = await runOptInSteps(db as never, TODAY, NOW);
    expect(r.errors).toEqual(["opt-in:DC-BAD"]);
    expect(r.reoffered).toBe(2);
  });
});

describe("GET /api/cron/daily", () => {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const d2 = new Date(Date.parse(`${today}T12:00:00Z`) + 2 * 864e5).toISOString().slice(0, 10);
  const remindInvites = [
    inv("undecided", { reply_by: d2 } as Partial<Inv>),
    inv("joined", { joined_at: J, reply_by: d2 } as Partial<Inv>),
    inv("drafting", { joined_at: J, status: "draft", reply_by: d2 } as Partial<Inv>),
    inv("revoked", { joined_at: J, revoked_at: J, reply_by: d2 } as Partial<Inv>),
  ];
  const run = async () => {
    const res = await cron(new Request("https://danchu.kr/api/cron/daily"));
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };
  beforeEach(() => {
    process.env.CRON_SECRET = "";
    process.env.DANCHU_AUTO_REPLY = "1";
    fx.routeDb = (q) => {
      // 리마인더: d2 기한의 열린 초대
      if (q.table === "rfq_invites" && q.filters.some(([k, v]) => k === "reply_by" && v === d2)) return { data: remindInvites, error: null };
      if (q.table === "rfq_invites") return { data: [], error: null };
      if (q.table === "invite_reminders") return { data: null, error: null };
      if (q.table === "rfq_requests" && q.single) return { data: { substance: "ABC-1", status: "distributed", compared_at: null }, error: null };
      // 회신 마감 대상: 기한이 지난 열린 요청 (제출 0건)
      if (q.table === "rfq_requests" && q.filters.some(([k]) => k === "lt:reply_by")) return { data: [rfqRow({ reply_by: "2000-01-03", join_by: null })], error: null };
      if (q.table === "rfq_events" && q.single) return { data: null, error: null };
      if (q.table === "cro_orgs") return { data: [{ id: "auto-org" }], error: null };
      return { data: [], error: null };
    };
  });
  it("리마인더는 참여한 기관 중 아직 제출하지 않은 곳에만 간다 (참여 결정 전·취소 제외)", async () => {
    const r = await run();
    expect(r.status).toBe(200);
    expect(r.body.reminded).toBe(2);
    const reminders = notified().filter((c) => c[1].title.startsWith("회신 기한 이틀 전"));
    expect(reminders.map((c) => c[2]?.to[0]).sort()).toEqual(["drafting@example.com", "joined@example.com"]);
    expect(reminders.every((c) => c[1].body?.includes("참여를 철회"))).toBe(true);
    expect(reminders.some((c) => c[1].body?.includes("회신하지 않음"))).toBe(false);
  });
  it("자동 회신 단계는 없다: 스위치를 켜도 예비 견적을 제출하지 않는다", async () => {
    const r = await run();
    expect(fx.saveQuote).not.toHaveBeenCalled();
    expect(r.body).not.toHaveProperty("autoSubmitted");
    expect(r.body).toMatchObject({ joinDeadlines: 0, lowParticipation: 0, extendAsked: 0, reoffered: 0 });
  });
  it("제출 0건이면 마감하지 않고 운영자·의뢰자에게 한 번 알린다", async () => {
    const r = await run();
    expect(fx.closeReplies).toHaveBeenCalledTimes(1);
    expect(r.body.compared).toBe(0);
    expect(eventKinds()).toContain("no_reply");
    expect(notified().find((c) => c[0][0] === "admin-1" && c[1].title.includes("회신 없음"))?.[1].body).toContain("마감하지 않았습니다");
    expect(notified().some((c) => c[0][0] === "sponsor-1" && c[1].title.includes("아직 견적이 없습니다"))).toBe(true);
  });
});
