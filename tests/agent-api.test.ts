import { beforeEach, describe, expect, it, vi } from "vitest";

/* 에이전트 읽기 입구(lib/agent-api.ts): 토큰 검증, 역할 경계, 공개 규칙 */
const fx = vi.hoisted(() => ({
  user: null as null | Record<string, unknown>,
  tokenOk: "",
  profile: { id: "u-1", email: "a@example.test", role: "requester", name: "가", cro_org_id: null, pending_org_id: null } as Record<string, unknown>,
  org: null as null | Record<string, unknown>,
}));
vi.mock("@/lib/supabase", () => {
  const make = (table: string) => {
    const q: Record<string, unknown> = {};
    Object.assign(q, {
      select: () => q,
      eq: () => q,
      maybeSingle: async () => ({ data: table === "profiles" ? fx.profile : fx.org }),
    });
    return q;
  };
  return {
    getSupabaseAdmin: () => ({
      from: (t: string) => make(t),
      auth: { getUser: async (tok: string) => (tok === fx.tokenOk && fx.user ? { data: { user: fx.user }, error: null } : { data: { user: null }, error: new Error("bad") }) },
    }),
  };
});
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`redirect:${to}`); } }));

import { agentSession, bearerToken, compareView, croItem, gateRole, joinTerms, meView, quoteBriefView, requesterItem } from "@/lib/agent-api";
import type { Loaded } from "@/lib/quote-load";
import { CRO_TERMS_VERSION, JOIN_CONSENT } from "@/lib/request-policy";
import type { Session } from "@/lib/auth";

const TOKEN = "eyJhbGciOiJIUzI1NiJ9.payload-part-xx.signature-part-yy";
const req = (auth?: string) => new Request("https://danchu.kr/api/agent/me", { headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  fx.tokenOk = TOKEN;
  fx.user = { id: "u-1", email: "a@example.test", email_confirmed_at: "2026-11-01T00:00:00Z", user_metadata: {} };
  fx.profile = { id: "u-1", email: "a@example.test", role: "requester", name: "가", cro_org_id: null, pending_org_id: null };
  fx.org = null;
});

describe("토큰", () => {
  it("Bearer 형식만 받는다", () => {
    expect(bearerToken(req(`Bearer ${TOKEN}`))).toBe(TOKEN);
    expect(bearerToken(req())).toBeNull();
    expect(bearerToken(req(`Basic ${TOKEN}`))).toBeNull();
    expect(bearerToken(req("Bearer short"))).toBeNull();
    expect(bearerToken(req(`Bearer ${TOKEN} extra`))).toBeNull();
  });
  it("토큰 없음·틀린 토큰·이메일 미확인은 unauthorized", async () => {
    expect(await agentSession(req())).toBe("unauthorized");
    expect(await agentSession(req(`Bearer ${TOKEN}x`))).toBe("unauthorized");
    fx.user = { ...fx.user!, email_confirmed_at: null };
    expect(await agentSession(req(`Bearer ${TOKEN}`))).toBe("unauthorized");
  });
  it("확인된 의뢰자 토큰은 세션이 되고 역할은 프로필에서만 정한다", async () => {
    const s = await agentSession(req(`Bearer ${TOKEN}`));
    expect(typeof s).toBe("object");
    if (typeof s === "object") {
      expect(s.role).toBe("requester");
      expect(meView(s).org).toBeNull();
      expect(meView(s).id).toBe("u-1");
    }
  });
});

describe("역할 경계", () => {
  const base = (role: string, org: Record<string, unknown> | null) => ({ userId: "u", email: "e", profile: { role } as Session["profile"], org: org as Session["org"], pendingOrg: null }) as Session;
  it("운영자는 이 입구를 쓰지 않는다", () => {
    expect(gateRole(base("admin", null))).toBe("forbidden");
  });
  it("기관 담당자는 승인된 자기 기관이 있어야 한다", () => {
    expect(gateRole(base("cro", null))).toBe("org_not_ready");
    expect(gateRole(base("cro", { id: "o", status: "pending" }))).toBe("org_not_ready");
    expect(gateRole(base("cro", { id: "o", status: "approved", managed: true }))).toBe("org_not_ready");
    const ok = gateRole(base("cro", { id: "o", name: "기관", status: "approved", managed: false, plan: "plus" }));
    expect(typeof ok === "object" && ok.role).toBe("cro");
    if (typeof ok === "object") expect(meView(ok).org).toEqual({ id: "o", name: "기관", plan: "plus" });
  });
  it("기관은 정식 서비스 뒤 Pro 요금제에서만, 시범 운영 중에는 모든 기관", () => {
    const org = (plan: string) => base("cro", { id: "o", name: "기관", status: "approved", managed: false, plan });
    expect(gateRole(org("plus"), "2028-02-01")).toBe("plan_required");
    expect(gateRole(org("free"), "2028-02-01")).toBe("plan_required");
    expect(typeof gateRole(org("pro"), "2028-02-01")).toBe("object");
    expect(typeof gateRole(org("free"), "2026-11-18")).toBe("object");
  });
  it("의뢰자는 요금제와 관계없이 쓴다", () => {
    expect(typeof gateRole(base("requester", null), "2028-02-01")).toBe("object");
  });
});

describe("공개 규칙", () => {
  it("기관 목록 한 줄에는 의뢰자 계정 id·선정 id 가 없다", () => {
    const out = croItem({ id: "i", no: "DC-2026-0001", title: "물질", cats: "독성", client: null, clientKey: "user-uuid", clientHint: "바이오텍 · 이름은 선정 뒤 공개", group: "decide", stageLabel: "참여 결정 전", next: "참여 결정", due: null, steps: [], money: [], note: "", action: null, awardId: "aw-1" });
    expect(out).not.toHaveProperty("clientKey");
    expect(out).not.toHaveProperty("awardId");
    expect(JSON.stringify(out)).not.toContain("user-uuid");
    expect(out.client).toBeNull();
    expect(out).not.toHaveProperty("action");
    expect(out.group).toBe("decide");
  });
  it("참여 결정 전에만 웹과 같은 참여 동의 문장·약관 판을 준다", () => {
    expect(joinTerms({ stageLabel: "참여 결정 전" })).toEqual({ terms: CRO_TERMS_VERSION, consent: JOIN_CONSENT, termsUrl: "/terms/cro" });
    expect(joinTerms({ stageLabel: "작성 중" })).toBeNull();
    expect(joinTerms({ stageLabel: "참여" })).toBeNull();
  });
  it("의뢰자 목록 한 줄에는 합계만 있다", () => {
    const row = { id: "r", rfq_no: "DC-2026-0002", substance: "물질", categories: ["독성"], status: "open", created_at: "2026-11-01", join_by: null, reply_by: "2026-11-20", sent: 5, opened: 3, joined: 2, cap: 5, submitted: 1, compared_at: null, selected_quote_id: null, company: "회사", email: "x@y" };
    const out = requesterItem(row as never);
    expect(out).toMatchObject({ no: "DC-2026-0002", sent: 5, joined: 2, submitted: 1, compareOpen: false, selected: false, outcome: null });
    expect(JSON.stringify(out)).not.toContain("x@y");
  });
  it("선정 없이 마무리한 사유는 주고, 메모는 주지 않는다", () => {
    const row = { id: "r", rfq_no: "DC-2026-0003", substance: "물질", categories: [], status: "closed", created_at: "2026-11-01", join_by: null, reply_by: null, sent: 3, opened: 3, joined: 2, cap: 5, submitted: 2, compared_at: "2026-11-10", selected_quote_id: null, outcome: "보류", outcome_note: "가나바이오와 협의" };
    const out = requesterItem(row as never);
    expect(out.outcome).toBe("보류");
    expect(JSON.stringify(out)).not.toContain("가나바이오");
  });
  it("비교표가 열리기 전에는 기관명·금액 없이 숫자만", () => {
    const v = compareView(
      { compared_at: null, selected_quote_id: null, reply_by: "2026-11-20" },
      [
        { status: "submitted", joined_at: "t", withdrawn_at: null, revoked_at: null },
        { status: "sent", joined_at: "t", withdrawn_at: null, revoked_at: null },
        { status: "sent", joined_at: null, withdrawn_at: null, revoked_at: null },
      ],
      [{ status: "submitted", cro_name: "A기관", total_amount: 100, final_weeks: 10, first_submitted_at: "2026-11-02" }],
    );
    expect(v).toEqual({ open: false, joined: 2, submitted: 1, replyBy: "2026-11-20" });
    expect(JSON.stringify(v)).not.toContain("A기관");
  });
  it("열린 뒤에는 제출한 견적만 회신 도착 순(금액 순 아님)", () => {
    const v = compareView({ compared_at: "2026-11-21", selected_quote_id: null, reply_by: "2026-11-20" }, [], [
      { status: "submitted", cro_name: "늦은 싼 곳", total_amount: 50, final_weeks: 8, first_submitted_at: "2026-11-10" },
      { status: "draft", cro_name: "초안", total_amount: 1, final_weeks: 1, first_submitted_at: null },
      { status: "submitted", cro_name: "먼저 온 비싼 곳", total_amount: 200, final_weeks: 12, first_submitted_at: "2026-11-03" },
    ]);
    expect(v.open).toBe(true);
    if (v.open) expect(v.columns.map((c) => c.lab)).toEqual(["먼저 온 비싼 곳", "늦은 싼 곳"]);
  });
  it("열린 뒤 열에는 승인 동작에 넘길 견적 id·판·초대 id와 선정 가능 여부", () => {
    const v = compareView({ compared_at: "2026-11-21", selected_quote_id: "q-1", reply_by: "2026-11-20" }, [], [
      { id: "q-1", invite_id: "i-1", revision: 2, status: "submitted", cro_name: "가", total_amount: 1, final_weeks: 1, first_submitted_at: "2026-11-03", auto: false, pdf_path: "a.pdf", start_date: "2026-12-01", valid_until: "2099-01-01" },
      { id: "q-2", invite_id: "i-2", revision: 1, status: "submitted", cro_name: "나", total_amount: 1, final_weeks: 1, first_submitted_at: "2026-11-04", auto: false, pdf_path: null, start_date: null, valid_until: null },
    ]);
    if (!v.open) throw new Error("open");
    expect(v.columns[0]).toMatchObject({ quoteId: "q-1", inviteId: "i-1", revision: 2, selected: true });
    expect(v.columns[1]).toMatchObject({ quoteId: "q-2", selectable: false, selected: false });
  });
  it("기관 견적서가 있는 견적은 단추 웹 견적서 주소를 붙인다", () => {
    const v = compareView({ rfq_no: "DC-2026-0142", compared_at: "2026-11-21", selected_quote_id: null, reply_by: "2026-11-20" }, [], [
      { id: "q-1", status: "submitted", cro_name: "가", total_amount: 1, final_weeks: 1, first_submitted_at: "2026-11-03" },
      { id: "q-2", status: "submitted", cro_name: "나", total_amount: 1, final_weeks: 1, first_submitted_at: "2026-11-04" },
    ], new Set(["q-2"]));
    if (!v.open) throw new Error("open");
    expect(v.columns.map((c) => c.docPath)).toEqual([null, "/app/r/DC-2026-0142/q/q-2/doc"]);
  });
});

describe("기관 견적 작성용 읽기 (quoteBriefView)", () => {
  const loaded = (patch: Partial<Loaded> = {}): Loaded =>
    ({
      rfq: {
        full: true, no: "DC-2026-0142", substance: "후보물질 A", categories: ["일반독성"], client: "가나바이오 주식회사", masked: false, identityMasked: true,
        ddayLabel: "회신 D-5", urgent: false, confid: "일반", overview: [["의뢰 목적", "IND"]], rows: [{ seq: 1, category: "일반독성", name: "랫드 4주 반복투여", cond: "경구" }],
        common: [["추가 내용", "연락처 비공개"]], situation: [], ask: [], attachments: "", replyBy: "2026-11-30", authorities: ["식약처"],
        files: [{ id: "f-1", name: "설계안.pdf", size: 10 }], translation: false,
      },
      draft: { items: [{ seq: 1, avail: "가능", amount: "48500000", weeks: "14", source: "catalog" }], note: "", pdfName: "", status: "draft", common: { validUntil: "", startDate: "", payTerms: "", substanceQty: "", reportLang: "", includes: [] }, prefilled: true, steps: [] },
      inviteId: "inv-secret", rfqId: "rfq-secret", croName: "가 기관", croOrgId: "org-1", token: "tok-secret",
      expired: false, locked: false, declined: false, closed: false, closedReason: null, joined: true, withdrawn: false, canRejoin: false, operator: false, seats: null, joinBy: null,
      ...patch,
    }) as Loaded;

  it("의뢰자 회사명·토큰·초대 id·파일 id 를 넣지 않는다", () => {
    const text = JSON.stringify(quoteBriefView(loaded()));
    for (const secret of ["가나바이오", "tok-secret", "inv-secret", "rfq-secret", "f-1", "org-1"]) expect(text).not.toContain(secret);
    expect(quoteBriefView(loaded()).request.files).toEqual(["설계안.pdf"]);
  });

  it("참여 뒤에는 단추가 계산한 초안 금액 그대로", () => {
    const b = quoteBriefView(loaded());
    expect(b.state).toBe("open");
    expect(b.draft?.items[0]).toMatchObject({ seq: 1, avail: "가능", amount: "48500000", source: "catalog" });
    expect(b.draft?.prefilled).toBe(true);
  });

  it("참여 전·불참·닫힘·잠김 상태, 참여 전에는 초안 없음", () => {
    expect(quoteBriefView(loaded({ joined: false, draft: null })).state).toBe("not_joined");
    expect(quoteBriefView(loaded({ joined: false })).draft).toBeNull();
    expect(quoteBriefView(loaded({ joined: false, declined: true })).state).toBe("declined");
    expect(quoteBriefView(loaded({ closed: true, closedReason: "compared" })).state).toBe("closed");
    expect(quoteBriefView(loaded({ locked: true })).state).toBe("locked");
  });
});
