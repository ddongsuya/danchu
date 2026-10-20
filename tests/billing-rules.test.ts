import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* 청구 기준 (2026-10-18 결정, 0020). DB 쪽 검사는 tests/db/*.sql (npm run test:db) */

type Q = { table: string; op: "select" | "insert" | "update" | "delete"; cols?: string; payload?: unknown; filters: [string, string, unknown][] };
const fx = vi.hoisted(() => ({
  calls: [] as Q[],
  respond: (_q: Q): { data: unknown; error: unknown; count?: number } => ({ data: null, error: null }),
  session: null as null | { userId: string; email: string; profile: { role: string } },
  org: null as unknown,
  audit: vi.fn(),
  sendMail: vi.fn(async () => true),
  notifyUsers: vi.fn(async () => {}),
  logEvent: vi.fn(async () => {}),
}));

vi.mock("@/lib/supabase", () => {
  const builder = (table: string) => {
    const q: Q = { table, op: "select", filters: [] };
    const finish = () => {
      fx.calls.push(q);
      return Promise.resolve(fx.respond(q));
    };
    const b: Record<string, unknown> = {};
    const f = (kind: string) => (k: string, v: unknown) => (q.filters.push([kind, k, v]), b);
    Object.assign(b, {
      select: (c?: string) => ((q.cols = c), b),
      insert: (p: unknown) => ((q.op = "insert"), (q.payload = p), b),
      update: (p: unknown) => ((q.op = "update"), (q.payload = p), b),
      delete: () => ((q.op = "delete"), b),
      eq: f("eq"), in: f("in"), is: f("is"), lt: f("lt"), gte: f("gte"), neq: f("neq"),
      order: () => b, limit: () => b,
      maybeSingle: finish,
      single: finish,
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => finish().then(res, rej),
    });
    return b;
  };
  // 배포 전 스키마 판 확인(lib/schema-version.ts)은 이 코드가 기대하는 판을 돌려준다
  return { getSupabaseAdmin: () => ({ from: builder, rpc: async (fn: string) => (fn === "danchu_schema_version" ? { data: 24, error: null } : { data: null, error: null }) }) };
});
vi.mock("@/lib/mail-preferences", () => ({ notificationRecipients: async (to: string[]) => to }));
vi.mock("@/lib/mail", () => ({ mailWrap: (s: string) => s, esc: (s: string) => s, sendMail: fx.sendMail }));
vi.mock("@/lib/notify", () => ({
  logEvent: fx.logEvent,
  notifyUsers: fx.notifyUsers,
  operatorReplyTo: () => "hello@danchu.kr",
  siteUrl: () => "https://danchu.kr",
}));
vi.mock("@/lib/auth", () => ({ sessionOrNull: async () => fx.session }));
vi.mock("@/lib/data", () => ({ getCroOrg: async () => fx.org }));
vi.mock("@/lib/audit", async (orig) => ({ ...(await orig<typeof import("@/lib/audit")>()), audit: fx.audit }));

import {
  SUBSCRIPTION_MAX_EXCL, SUCCESS_FEE_MIN, billingTier, chargesPerQuote, joinStatusNote, statementDigest, statementTotals, successFeeEligible, successFeeView, wonOrPending,
} from "@/lib/billing";
import { comma } from "@/lib/format";
import { ORG_COLUMNS, distributeTo } from "@/lib/distribute";
import { PATCH as patchOrg } from "@/app/api/admin/cros/[id]/route";
import { GET as exportCsv } from "@/app/api/admin/billing/export/route";

const SQL = readFileSync("supabase/migrations/0020_billing_rules.sql", "utf8");

describe("구간 기준 금액", () => {
  it("TS 와 SQL 기준 금액이 같다", () => {
    const sub = SQL.match(/function public\.billing_subscription_max_excl\(\)[\s\S]*?select (\d+)::bigint/);
    const succ = SQL.match(/function public\.billing_success_fee_min\(\)[\s\S]*?select (\d+)::bigint/);
    expect(sub && Number(sub[1])).toBe(SUBSCRIPTION_MAX_EXCL);
    expect(succ && Number(succ[1])).toBe(SUCCESS_FEE_MIN);
    expect(SUBSCRIPTION_MAX_EXCL).toBe(10_000_000);
    expect(SUCCESS_FEE_MIN).toBe(50_000_000);
  });
  it("경계: 9,999,999 / 10,000,000 / 49,999,999 / 50,000,000", () => {
    expect(billingTier(9_999_999)).toBe("subscription");
    expect(billingTier(10_000_000)).toBe("per_quote");
    expect(billingTier(49_999_999)).toBe("per_quote");
    expect(billingTier(50_000_000)).toBe("per_quote_success");
    expect(chargesPerQuote(9_999_999)).toBe(false);
    expect(chargesPerQuote(10_000_000)).toBe(true);
    expect(successFeeEligible(49_999_999)).toBe(false);
    expect(successFeeEligible(50_000_000)).toBe(true);
  });
  it("금액이 없거나 0 이면 금액 미입력 (청구하지 않음)", () => {
    expect(billingTier(null)).toBe("no_amount");
    expect(billingTier(undefined)).toBe("no_amount");
    expect(billingTier(0)).toBe("no_amount");
    expect(chargesPerQuote(null)).toBe(false);
  });
  it("SQL 구간 함수의 경계 비교가 TS 와 같다 (미만 / 이상)", () => {
    expect(SQL).toMatch(/when p_amount < public\.billing_subscription_max_excl\(\) then 'subscription'/);
    expect(SQL).toMatch(/when p_amount < public\.billing_success_fee_min\(\) then 'per_quote'/);
  });
});

describe("성사수수료: 예상(견적 기준)과 정산(계약 기준)", () => {
  it("판정은 선정 견적 금액, 정산은 체결 계약 금액 × 요율", () => {
    const f = successFeeView({ quoteAmount: 60_000_000, contractAmount: 55_000_000, contractStatus: "signed", feeRate: 0.03 });
    expect(f).toEqual({ eligible: true, expected: 1_800_000, settled: 1_650_000, signed: true });
  });
  it("체결 전에는 정산 없음, 예상만", () => {
    expect(successFeeView({ quoteAmount: 50_000_000, contractAmount: null, contractStatus: "negotiating", feeRate: 0.03 })).toEqual({ eligible: true, expected: 1_500_000, settled: 0, signed: false });
  });
  it("미체결은 예상도 정산도 없다", () => {
    expect(successFeeView({ quoteAmount: 80_000_000, contractAmount: null, contractStatus: "not_signed", feeRate: 0.03 })).toMatchObject({ expected: 0, settled: 0 });
  });
  it("선정 견적 5,000만 원 미만은 계약 금액이 커도 대상 아님", () => {
    expect(successFeeView({ quoteAmount: 49_999_999, contractAmount: 70_000_000, contractStatus: "signed", feeRate: 0.03 })).toMatchObject({ eligible: false, settled: 0 });
  });
  it("요율 미정은 0 이 아니라 미정", () => {
    const f = successFeeView({ quoteAmount: 90_000_000, contractAmount: 90_000_000, contractStatus: "signed", feeRate: null });
    expect(f.settled).toBeNull();
    expect(f.expected).toBeNull();
    expect(wonOrPending(f.settled, comma, "요율 미정")).toBe("요율 미정");
    expect(wonOrPending(0, comma)).toBe("0원");
  });
});

describe("명세 합계", () => {
  const row = (o: Partial<Parameters<typeof statementTotals>[0][number]>) => ({ org_id: "a", billable: 0, excluded: 0, per_quote: 0, monthly_fee: null, per_quote_fee: 0, guidance_fee: 0, settled_fee: 0, total_due: 0, terms_pending: false, ...o });
  it("구독료·건당·정산을 더하고, 예상은 따로, 미정 기관 수를 센다", () => {
    const t = statementTotals([
      row({ org_id: "a", billable: 3, per_quote: 2, monthly_fee: 500_000, per_quote_fee: 600_000, guidance_fee: 1_500_000, settled_fee: 1_650_000, total_due: 2_750_000 }),
      row({ org_id: "b", billable: 1, per_quote: 1, per_quote_fee: null, total_due: 0, terms_pending: true }),
    ]);
    expect(t).toEqual({ billable: 4, perQuote: 3, perQuoteFee: 600_000, monthlyFee: 500_000, guidanceFee: 1_500_000, settledFee: 1_650_000, total: 2_750_000, pendingOrgs: 1 });
  });
  it("마감 저장본 비교 지문은 순서와 무관하고 금액 변화에 반응한다", () => {
    const a = [row({ org_id: "a", total_due: 1 }), row({ org_id: "b", total_due: 2 })];
    expect(statementDigest(a)).toBe(statementDigest([...a].reverse()));
    expect(statementDigest(a)).not.toBe(statementDigest([row({ org_id: "a", total_due: 1 }), row({ org_id: "b", total_due: 3 })]));
  });
});

describe("배포: 월 전달 한도 없음", () => {
  beforeEach(() => {
    fx.calls = [];
    fx.sendMail.mockClear();
    let n = 0;
    fx.respond = (q) => {
      if (q.table === "rfq_invites" && q.op === "insert") return { data: { id: `inv-${++n}`, token: `tok-${n}` }, error: null };
      if (q.table === "rfq_invites" && q.op === "select") return { data: [], error: null, count: n };
      if (q.table === "profiles") return { data: [], error: null };
      return { data: null, error: null };
    };
  });
  const rfq = { id: "rfq-1", rfq_no: "DC-2026-0100", substance: "X", categories: ["일반독성"], purpose: null, intent: "비교 견적", confidentiality: "일반", org_type: "바이오벤처", cro_count: "전체", status: "received", reply_by: null, user_id: null, email: "s@example.test", payload: {}, created_at: "2026-10-18T00:00:00Z" };
  const orgs = Array.from({ length: 4 }, (_, i) => ({ id: `org-${i}`, name: `기관${i}`, contact_email: `cro${i}@example.test`, categories: ["일반독성"], glp_certs: [], managed: i === 3 }));

  it("기관 조회 컬럼에 요금 약정이 없다", () => {
    expect(ORG_COLUMNS).not.toMatch(/monthly_cap|monthly_fee|per_request_fee|fee_rate/);
  });
  it("이번 달 전달 수와 무관하게 모든 기관에 보낸다 (관리 기관 포함)", async () => {
    const res = await distributeTo(rfq as never, orgs, "2026-10-30", "admin-1", false, "manual");
    expect(res.sent).toBe(4);
    expect(res.names).toEqual(["기관0", "기관1", "기관2", "기관3"]);
    expect(res).not.toHaveProperty("capped");
    // 한도를 세려고 이번 달 청구 대상 전달을 조회하지 않는다
    const monthCount = fx.calls.filter((q) => q.table === "rfq_invites" && q.op === "select" && q.filters.some(([, k]) => k === "billable" || k === "sent_at"));
    expect(monthCount).toEqual([]);
    const inserts = fx.calls.filter((q) => q.table === "rfq_invites" && q.op === "insert");
    expect(inserts).toHaveLength(4);
    // 전달 시점에 청구 제외를 넣지 않는다 (견적을 내야 청구, 관리 기관도 같다)
    for (const q of inserts) expect(q.payload).not.toHaveProperty("billable");
  });
  it("lib/distribute.ts 에 월 한도 코드가 남아 있지 않다", () => {
    const src = readFileSync("lib/distribute.ts", "utf8");
    expect(src).not.toMatch(/monthly_cap|withinMonthlyCap|capped/);
  });
});

describe("기관 약정 PATCH", () => {
  const json = (body: unknown) => new Request("http://x/api/admin/cros/org-1", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const ctx = { params: Promise.resolve({ id: "org-1" }) };
  beforeEach(() => {
    fx.calls = [];
    fx.session = { userId: "admin-1", email: "admin@example.test", profile: { role: "admin" } };
    fx.org = { id: "org-1", name: "기관", status: "approved", per_request_fee: null, fee_rate: null, monthly_fee: null };
    fx.respond = () => ({ data: null, error: null });
  });
  it("월 구독료를 저장하고 월 한도는 저장하지 않는다", async () => {
    const r = await patchOrg(json({ monthlyFee: 500000, perRequestFee: 300000, feeRate: 0.03, monthlyCap: 10 }), ctx);
    expect(r.status).toBe(200);
    const up = fx.calls.find((q) => q.table === "cro_orgs" && q.op === "update");
    expect(up?.payload).toEqual({ monthly_fee: 500000, per_request_fee: 300000, fee_rate: 0.03 });
  });
  it("빈 값은 null (구독하지 않음·미정)", async () => {
    await patchOrg(json({ monthlyFee: "", perRequestFee: null }), ctx);
    expect(fx.calls.find((q) => q.op === "update")?.payload).toEqual({ monthly_fee: null, per_request_fee: null });
  });
  it("잘못된 금액은 400", async () => {
    const r = await patchOrg(json({ monthlyFee: -1 }), ctx);
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toContain("월 구독료");
  });
});

describe("0020 마이그레이션 순서", () => {
  it("billing_summary 를 한도 없이 다시 만든 뒤 monthly_cap 을 지운다", () => {
    const create = SQL.indexOf("create or replace function public.billing_summary");
    const drop = SQL.indexOf("drop column if exists monthly_cap");
    expect(create).toBeGreaterThan(-1);
    expect(drop).toBeGreaterThan(create);
    const body = SQL.slice(create, SQL.indexOf("revoke execute on function public.billing_summary"));
    expect(body).not.toMatch(/monthly_cap/);
  });
  it("처음 제출 시각은 트리거가 한 번만 채운다", () => {
    expect(SQL).toMatch(/old\.first_submitted_at is not null then\s+new\.first_submitted_at := old\.first_submitted_at/);
  });
  it("정산은 signed 만, 계약 금액 기준, 체결 확인 월", () => {
    expect(SQL).toMatch(/a\.contract_status = 'signed'/);
    expect(SQL).toMatch(/round\(a\.contract_amount \* a\.rate\)/);
    expect(SQL).toMatch(/\(a\.contract_reported_at at time zone 'Asia\/Seoul'\)::date >= p_from/);
  });
  it("화면 문자열 규칙: 긴 대시 없음", () => {
    for (const f of ["app/admin/billing/page.tsx", "app/api/admin/billing/export/route.ts", "components/admin/OrgTerms.tsx", "app/admin/awards/page.tsx", "lib/billing.ts"]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/[–—]/);
    }
  });
});

describe("리뷰 수정 (2026-10-18)", () => {
  const ctx = { params: Promise.resolve({ id: "org-1" }) };
  const patch = (body: unknown) => new Request("http://x/api/admin/cros/org-1", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  beforeEach(() => {
    fx.calls = [];
    fx.session = { userId: "admin-1", email: "admin@example.test", profile: { role: "admin" } };
    fx.org = { id: "org-1", name: "기관", status: "approved", per_request_fee: null, fee_rate: null, monthly_fee: null };
    fx.respond = () => ({ data: null, error: null });
  });
  it("구독 시작 월을 그 달 1일로 저장하고, 형식이 틀리면 400", async () => {
    expect((await patchOrg(patch({ monthlyFee: 500000, monthlyFeeFrom: "2026-09" }), ctx)).status).toBe(200);
    expect(fx.calls.find((q) => q.op === "update")?.payload).toEqual({ monthly_fee: 500000, monthly_fee_from: "2026-09-01" });
    fx.calls = [];
    await patchOrg(patch({ monthlyFeeFrom: "" }), ctx);
    expect(fx.calls.find((q) => q.op === "update")?.payload).toEqual({ monthly_fee_from: null });
    const bad = await patchOrg(patch({ monthlyFeeFrom: "2026-13" }), ctx);
    expect(bad.status).toBe(400);
  });
  it("CSV: 금액 미입력 견적은 청구 대상 N (화면 건수와 같게), 청구 제외 초대의 성사수수료는 비고에 표시", async () => {
    const line = (over: Record<string, unknown>) => ({
      quote_id: "q", invite_id: "i", rfq_id: "r", rfq_no: "DC-1", org_id: "o", org_name: "기관", managed: false,
      first_submitted_at: "2026-09-15T03:00:00Z", billing_at: null, total_amount: null, entry_source: "cro", auto: false, invite_source: "matched",
      billable: true, bill_excluded_reason: null, tier: "no_amount", chargeable: false, per_request_fee: 300000, fee_due: 0, ...over,
    });
    const snapshot = {
      taken_at: "2026-10-01T00:00:00Z",
      summary: [],
      lines: [
        line({ quote_id: "q1" }),
        line({ quote_id: "q2", total_amount: 30000000, tier: "per_quote", chargeable: true, fee_due: 300000, billing_at: "2026-10-02T03:00:00Z", first_submitted_at: "2026-09-15T03:00:00Z" }),
      ],
      awards: [{ kind: "settlement", award_id: "a", rfq_id: "r", rfq_no: "DC-2", org_id: "o", org_name: "기관", quote_amount: 60000000, contract_amount: 55000000, contract_status: "signed", awarded_at: "2026-10-01T00:00:00Z", contract_date: "2026-10-05", contract_reported_at: "2026-10-06T00:00:00Z", fee_rate: 0.03, fee: 1650000, invite_billable: false }],
    };
    fx.respond = (q) => (q.table === "billing_periods" ? { data: { snapshot }, error: null } : { data: null, error: null });
    const r = await exportCsv(new Request("http://x/api/admin/billing/export?month=2026-10"));
    const rows = (await r.text()).replace(/^\uFEFF/, "").split("\r\n").map((l) => l.split(","));
    const head = rows[0];
    const yn = head.indexOf("청구 대상");
    const day = head.indexOf("일자");
    const quoteRows = rows.filter((c) => c[0] === "견적 회신");
    expect(quoteRows.map((c) => c[yn])).toEqual(["N", "Y"]);
    // 금액이 나중에 들어온 견적은 금액이 들어온 날로 적는다
    expect(quoteRows[1][day]).toBe("2026-10-02");
    expect(rows.find((c) => c[0] === "성사수수료 정산")?.join(",")).toContain("견적 청구 제외한 초대");
  });
  it("0020: 청구 월은 금액이 있는 상태로 처음 제출된 시각, 구독료는 시작 월부터 이번 달까지", () => {
    expect(SQL).toMatch(/coalesce\(q\.billing_at, q\.first_submitted_at\) at time zone 'Asia\/Seoul'\)::date >= p_from/);
    expect(SQL).toMatch(/o\.monthly_fee_from < p_to/);
    expect(SQL).toMatch(/p_from <= \(now\(\) at time zone 'Asia\/Seoul'\)::date/);
  });
});

describe("참여 기록과 청구 (0023)", () => {
  const OPT = readFileSync("supabase/migrations/0023_opt_in.sql", "utf8");
  beforeEach(() => {
    fx.calls = [];
    fx.session = { userId: "admin-1", email: "admin@example.test", profile: { role: "admin" } };
  });
  it("청구하지 않는 참여 상태만 안내가 붙는다", () => {
    expect(joinStatusNote("joined")).toBe("");
    expect(joinStatusNote(undefined)).toBe("");
    expect(joinStatusNote("legacy")).toMatch(/청구하지 않음/);
    expect(joinStatusNote("not_joined")).toMatch(/참여 기록 없음/);
    expect(joinStatusNote("pilot")).toMatch(/시범 운영 중 참여한 요청, 청구하지 않음/);
    for (const s of [joinStatusNote("legacy"), joinStatusNote("not_joined"), joinStatusNote("pilot")]) expect(s).not.toMatch(/[\u2013\u2014]/);
  });
  it("SQL: 청구는 portal·token 참여 기록이 있을 때만, legacy 는 제외. 0020 의 '면제 없음' 원칙을 머리말에서 대신한다", () => {
    expect(OPT).toMatch(/i\.joined_at is not null and i\.join_channel in \('portal', 'token'\)/);
    expect(OPT).toMatch(/\(i\.billable and j\.ok and public\.billing_tier/);
    expect(OPT).toMatch(/0020 배경 3[^\n]*를 대신한다/);
    expect(OPT).toMatch(/if inv\.joined_at is null then return jsonb_build_object\('ok', false, 'code', 'not_joined'\)/);
  });
  it("CSV: 참여 기록 없는 견적·legacy 는 청구 대상 N 과 비고, 참여 기록 없는 수주의 정산은 N·0원", async () => {
    const line = (over: Record<string, unknown>) => ({
      quote_id: "q", invite_id: "i", rfq_id: "r", rfq_no: "DC-1", org_id: "o", org_name: "기관", managed: false,
      first_submitted_at: "2026-10-15T03:00:00Z", billing_at: "2026-10-15T03:00:00Z", total_amount: 30000000, entry_source: "cro", auto: false, invite_source: "matched",
      billable: true, bill_excluded_reason: null, tier: "per_quote", chargeable: true, per_request_fee: 300000, fee_due: 300000, join_status: "joined", ...over,
    });
    const snapshot = {
      taken_at: "2026-11-01T00:00:00Z",
      summary: [],
      lines: [
        line({ quote_id: "q1" }),
        line({ quote_id: "q2", entry_source: "operator" }),
        line({ quote_id: "q3", join_status: "legacy", chargeable: false, fee_due: 0 }),
        line({ quote_id: "q4", join_status: "not_joined", chargeable: false, fee_due: 0 }),
      ],
      awards: [{ kind: "settlement", award_id: "a", rfq_id: "r", rfq_no: "DC-2", org_id: "o", org_name: "기관", quote_amount: 60000000, contract_amount: 55000000, contract_status: "signed", awarded_at: "2026-10-01T00:00:00Z", contract_date: "2026-10-05", contract_reported_at: "2026-10-06T00:00:00Z", fee_rate: 0.03, fee: 1650000, invite_billable: true, invite_joined: false }],
    };
    fx.respond = (q) => (q.table === "billing_periods" ? { data: { snapshot }, error: null } : { data: null, error: null });
    const r = await exportCsv(new Request("http://x/api/admin/billing/export?month=2026-10"));
    const rows = (await r.text()).replace(/^\uFEFF/, "").split("\r\n").map((l) => l.split(","));
    const head = rows[0];
    const yn = head.indexOf("청구 대상");
    const fee = head.indexOf("청구액(원)");
    const quoteRows = rows.filter((c) => c[0] === "견적 회신");
    expect(quoteRows.map((c) => c[yn])).toEqual(["Y", "Y", "N", "N"]);
    expect(quoteRows[2].join(",")).toContain("참여 기능 도입 전 견적");
    expect(quoteRows[3].join(",")).toContain("참여 기록 없음");
    const settle = rows.find((c) => c[0] === "성사수수료 정산")!;
    expect(settle[yn]).toBe("N");
    expect(settle[fee]).toBe("0");
    expect(settle.join(",")).toContain("참여 기록 없음");
  });
});

