import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* 0024 (2026-10-20 결정): 마감한 달은 다시 열지 않는다 · 조정 항목 · 시범 기간 참고 수치. DB 쪽 검사는 tests/db/billing_close_lock.sql */

type Q = { table: string; op: string; filters: [string, string, unknown][] };
const fx = vi.hoisted(() => ({
  session: null as null | { userId: string; email: string; profile: { role: string } },
  rpc: vi.fn(async (_fn: string, _args?: unknown): Promise<{ data: unknown; error: unknown }> => ({ data: null, error: null })),
  from: [] as Q[],
  respond: (_q: Q): { data: unknown; error: unknown } => ({ data: null, error: null }),
  audit: vi.fn(async () => {}),
}));

vi.mock("@/lib/supabase", () => {
  const builder = (table: string) => {
    const q: Q = { table, op: "select", filters: [] };
    const finish = () => {
      fx.from.push(q);
      return Promise.resolve(fx.respond(q));
    };
    const b: Record<string, unknown> = {};
    const f = (kind: string) => (k: string, v: unknown) => (q.filters.push([kind, k, v]), b);
    Object.assign(b, {
      select: () => b,
      insert: () => ((q.op = "insert"), b),
      update: () => ((q.op = "update"), b),
      delete: () => ((q.op = "delete"), b),
      eq: f("eq"), lt: f("lt"), order: () => b, limit: () => b,
      maybeSingle: finish,
      then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => finish().then(res, rej),
    });
    return b;
  };
  return { getSupabaseAdmin: () => ({ from: builder, rpc: (fn: string, args?: unknown) => fx.rpc(fn, args) }) };
});
vi.mock("@/lib/auth", () => ({ sessionOrNull: async () => fx.session }));
vi.mock("@/lib/audit", async (orig) => ({ ...(await orig<typeof import("@/lib/audit")>()), audit: fx.audit }));

import {
  ADJUSTMENT_MAX_ABS, CLOSED_MONTH_NOTE, REFERENCE_LABEL, REFERENCE_PER_QUOTE_FEE, REFERENCE_SUCCESS_RATE, REFERENCE_UNIT_LABEL,
  adjustmentsByOrg, countsForReference, parseAdjustmentAmount, rateLabel, referenceForOrg, referenceRate, referenceTotals, referenceUnit, signedWon,
} from "@/lib/billing";
import { comma } from "@/lib/format";
import { POST as closeRoute } from "@/app/api/admin/billing/close/route";
import { POST as adjustRoute } from "@/app/api/admin/billing/adjustments/route";
import { GET as exportCsv } from "@/app/api/admin/billing/export/route";

const SQL = readFileSync("supabase/migrations/0024_billing_close_lock.sql", "utf8");
const ADMIN = { userId: "00000000-0000-4000-8000-0000000000ad", email: "admin@example.test", profile: { role: "admin" } };
const ORG = "00000000-0000-4000-8000-00000000000a";
const post = (body: unknown) => new Request("http://x/api", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

beforeEach(() => {
  fx.session = ADMIN;
  fx.from = [];
  fx.respond = () => ({ data: null, error: null });
  fx.rpc.mockReset();
  fx.rpc.mockImplementation(async () => ({ data: null, error: null }));
  fx.audit.mockClear();
});

describe("마감 라우트: 마감한 달은 다시 열 수 없다", () => {
  it("마감 해제(closed: false)는 409 와 안내 문구, DB 를 건드리지 않는다", async () => {
    const r = await closeRoute(post({ month: "2026-09", closed: false }));
    expect(r.status).toBe(409);
    const d = (await r.json()) as { error: string; code: string };
    expect(d.code).toBe("reopen_refused");
    expect(d.error).toBe("마감한 달은 다시 열 수 없습니다. 바로잡을 금액은 다음 달 명세에 조정 항목으로 넣습니다.");
    expect(d.error).toBe(CLOSED_MONTH_NOTE);
    expect(fx.rpc).not.toHaveBeenCalled();
    expect(fx.from).toEqual([]);
    expect(fx.audit).not.toHaveBeenCalled();
  });
  it("라우트에 billing_periods 삭제 코드가 없다", () => {
    const src = readFileSync("app/api/admin/billing/close/route.ts", "utf8");
    expect(src).not.toMatch(/\.delete\(/);
  });
  it("운영자가 아니면 403", async () => {
    fx.session = null;
    expect((await closeRoute(post({ month: "2026-09", closed: true }))).status).toBe(403);
  });
  it("형식이 틀리면 400", async () => {
    expect((await closeRoute(post({ month: "2026-13", closed: true }))).status).toBe(400);
    expect((await closeRoute(post({ month: "2026-09" }))).status).toBe(400);
  });
  it("마감: close_billing_month 를 그 달 1일로 부르고 감사 기록을 남긴다", async () => {
    fx.rpc.mockImplementation(async () => ({ data: { ok: true, month: "2026-09-01", orgs: 2 }, error: null }));
    const r = await closeRoute(post({ month: "2026-09", closed: true, note: "9월 마감" }));
    expect(r.status).toBe(200);
    expect(fx.rpc).toHaveBeenCalledWith("close_billing_month", { p_month: "2026-09-01", p_actor: ADMIN.userId, p_note: "9월 마감" });
    expect(fx.audit).toHaveBeenCalledWith(expect.anything(), "billing.close", { type: "billing_period", id: null, label: "2026-09" }, { after: { closed: true }, note: "9월 마감" });
    expect(((await r.json()) as { message: string }).message).toContain("다시 열 수 없습니다");
  });
  it("이미 마감한 달은 409 (저장본을 다시 찍지 않는다), 감사 기록 없음", async () => {
    fx.rpc.mockImplementation(async () => ({ data: { ok: true, already: true }, error: null }));
    const r = await closeRoute(post({ month: "2026-09", closed: true }));
    expect(r.status).toBe(409);
    expect(((await r.json()) as { code: string }).code).toBe("already_closed");
    expect(fx.audit).not.toHaveBeenCalled();
  });
  it("끝나지 않은 달은 409 not_ended", async () => {
    fx.rpc.mockImplementation(async () => ({ data: { ok: false, code: "not_ended" }, error: null }));
    const r = await closeRoute(post({ month: "2026-10", closed: true }));
    expect(r.status).toBe(409);
    const d = (await r.json()) as { code: string; error: string };
    expect(d.code).toBe("not_ended");
    expect(d.error).toMatch(/다음 달 1일부터/);
  });
});

describe("조정 항목 라우트", () => {
  const ok = { month: "2026-10", orgId: ORG, amount: -120000, reason: "9월 중복 청구분 돌려드림", correctsMonth: "2026-09" };
  it("운영자가 아니면 403", async () => {
    fx.session = null;
    expect((await adjustRoute(post(ok))).status).toBe(403);
  });
  it("입력 검사: 달·기관·금액(0, 소수, 문자)·사유·바로잡는 달", async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ ...ok, month: "2026-1" }, "month"],
      [{ ...ok, orgId: "x" }, "orgId"],
      [{ ...ok, amount: 0 }, "amount"],
      [{ ...ok, amount: 12.5 }, "amount"],
      [{ ...ok, amount: "abc" }, "amount"],
      [{ ...ok, amount: ADJUSTMENT_MAX_ABS + 1 }, "amount"],
      [{ ...ok, reason: "   " }, "reason"],
      [{ ...ok, reason: "가".repeat(301) }, "reason"],
      [{ ...ok, correctsMonth: "2026/09" }, "correctsMonth"],
    ];
    for (const [body, field] of cases) {
      const r = await adjustRoute(post(body));
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(((await r.json()) as { field: string }).field).toBe(field);
    }
    expect(fx.rpc).not.toHaveBeenCalled();
  });
  it("넣기: add_billing_adjustment 를 1일 날짜로 부르고 감사 기록(사유 포함)", async () => {
    fx.rpc.mockImplementation(async () => ({ data: { ok: true, id: "adj-1", month: "2026-10-01", org_name: "시험기관" }, error: null }));
    const r = await adjustRoute(post({ ...ok, amount: "-120,000" }));
    expect(r.status).toBe(200);
    expect(fx.rpc).toHaveBeenCalledWith("add_billing_adjustment", { p_org: ORG, p_month: "2026-10-01", p_amount: -120000, p_reason: ok.reason, p_corrects: "2026-09-01", p_actor: ADMIN.userId });
    expect(fx.audit).toHaveBeenCalledWith(
      expect.anything(),
      "billing.adjust",
      { type: "billing_period", id: null, label: "2026-10" },
      { after: { adjustment_id: "adj-1", org_id: ORG, org_name: "시험기관", amount: -120000, corrects_month: "2026-09" }, note: ok.reason },
    );
  });
  it("바로잡는 달을 비우면 null", async () => {
    fx.rpc.mockImplementation(async () => ({ data: { ok: true, id: "adj-2" }, error: null }));
    await adjustRoute(post({ ...ok, correctsMonth: "" }));
    expect(fx.rpc.mock.calls[0][1]).toMatchObject({ p_corrects: null });
  });
  it("마감한 달은 409 와 다음 열린 달 안내, 감사 기록 없음", async () => {
    fx.rpc.mockImplementation(async () => ({ data: { ok: false, code: "closed" }, error: null }));
    const r = await adjustRoute(post({ ...ok, month: "2026-09", correctsMonth: "" }));
    expect(r.status).toBe(409);
    const d = (await r.json()) as { code: string; error: string };
    expect(d.code).toBe("closed");
    expect(d.error).toMatch(/다음 열린 달에 넣어 주세요/);
    expect(fx.audit).not.toHaveBeenCalled();
  });
  it("바로잡는 달이 마감되지 않았으면 409 corrects", async () => {
    fx.rpc.mockImplementation(async () => ({ data: { ok: false, code: "corrects" }, error: null }));
    const r = await adjustRoute(post(ok));
    expect(r.status).toBe(409);
    expect(((await r.json()) as { field: string }).field).toBe("correctsMonth");
  });
});

describe("조정·참고 계산 도우미", () => {
  it("조정 금액 입력: 쉼표·원·부호, 0·소수·한도 초과는 거절", () => {
    expect(parseAdjustmentAmount("-120,000")).toBe(-120000);
    expect(parseAdjustmentAmount("+5,000원")).toBe(5000);
    expect(parseAdjustmentAmount(" 70 000 ")).toBe(70000);
    expect(parseAdjustmentAmount(300000)).toBe(300000);
    expect(parseAdjustmentAmount("0")).toBeNull();
    expect(parseAdjustmentAmount("1.5")).toBeNull();
    expect(parseAdjustmentAmount("")).toBeNull();
    expect(parseAdjustmentAmount(null)).toBeNull();
    expect(parseAdjustmentAmount(ADJUSTMENT_MAX_ABS + 1)).toBeNull();
    expect(parseAdjustmentAmount(-ADJUSTMENT_MAX_ABS)).toBe(-ADJUSTMENT_MAX_ABS);
  });
  it("조정 합과 부호 표시", () => {
    const m = adjustmentsByOrg([{ org_id: "a", amount: 5000 }, { org_id: "a", amount: -12000 }, { org_id: "b", amount: 70000 }]);
    expect(m.get("a")).toBe(-7000);
    expect(m.get("b")).toBe(70000);
    expect(signedWon(-7000, comma)).toBe("-7,000원");
    expect(signedWon(70000, comma)).toBe("+70,000원");
  });
  it("참고 단가 함수는 서버(service_role)만 실행한다", () => {
    for (const fn of ["billing_reference_per_quote_fee", "billing_reference_success_rate"]) {
      expect(SQL).toMatch(new RegExp(`revoke execute on function public\\.${fn}\\(\\) from public, anon, authenticated`));
      expect(SQL).toMatch(new RegExp(`grant execute on function public\\.${fn}\\(\\) to service_role`));
    }
  });
  it("참고 단가는 TS 와 SQL 이 같다 (30,000원, 3%)", () => {
    expect(REFERENCE_PER_QUOTE_FEE).toBe(30_000);
    expect(REFERENCE_SUCCESS_RATE).toBe(0.03);
    expect(Number(SQL.match(/function public\.billing_reference_per_quote_fee\(\)[\s\S]*?select (\d+) \$\$/)?.[1])).toBe(REFERENCE_PER_QUOTE_FEE);
    expect(Number(SQL.match(/function public\.billing_reference_success_rate\(\)[\s\S]*?select ([\d.]+)::numeric/)?.[1])).toBe(REFERENCE_SUCCESS_RATE);
  });
  it("이름표", () => {
    expect(REFERENCE_UNIT_LABEL).toBe("참고 단가(예시, 시장 검증 전)");
    expect(REFERENCE_LABEL).toBe("참고 (시범 기간, 청구 안 함)");
  });
  it("기관 약정 값이 있으면 그 값, 없으면 참고 단가", () => {
    expect(referenceUnit(null)).toEqual({ unit: 30_000, source: "reference" });
    expect(referenceUnit(300_000)).toEqual({ unit: 300_000, source: "org" });
    expect(referenceUnit(0)).toEqual({ unit: 0, source: "org" });
    expect(referenceRate(undefined)).toEqual({ rate: 0.03, source: "reference" });
    expect(referenceRate(0.05)).toEqual({ rate: 0.05, source: "org" });
    expect(rateLabel(0.03)).toBe("3%");
    expect(rateLabel(0.025)).toBe("2.5%");
  });
  it("시범·legacy 견적만 센다 (운영자 제외·유료 참여·참여 기록 없음은 아님)", () => {
    expect(countsForReference({ billable: true, join_status: "pilot" })).toBe(true);
    expect(countsForReference({ billable: true, join_status: "legacy" })).toBe(true);
    expect(countsForReference({ billable: false, join_status: "pilot" })).toBe(false);
    expect(countsForReference({ billable: true, join_status: "joined" })).toBe(false);
    expect(countsForReference({ billable: true, join_status: "not_joined" })).toBe(false);
  });
  it("기관 1곳 참고 수치: tests/db/billing_close_lock.sql 의 참고 단가 기관과 같은 값", () => {
    const line = (tier: "subscription" | "per_quote" | "per_quote_success", join_status: string, billable = true) => ({ tier, join_status, billable });
    const r = referenceForOrg({
      lines: [line("subscription", "pilot"), line("per_quote", "pilot"), line("per_quote_success", "pilot"), line("per_quote", "legacy"), line("per_quote", "pilot", false), line("per_quote", "joined")],
      settlements: [{ contract_amount: 55_000_000 }],
      perRequestFee: null,
      feeRate: null,
    });
    expect(r).toEqual({
      subscription_count: 1, per_quote_count: 3, per_quote_unit: 30_000, per_quote_unit_source: "reference", per_quote_fee: 90_000,
      success_count: 1, success_contract_amount: 55_000_000, success_rate: 0.03, success_rate_source: "reference", success_fee: 1_650_000,
    });
    const own = referenceForOrg({ lines: [line("per_quote", "pilot"), line("per_quote_success", "legacy")], settlements: [{ contract_amount: 70_000_000 }], perRequestFee: 300_000, feeRate: 0.05 });
    expect(own).toMatchObject({ per_quote_count: 2, per_quote_fee: 600_000, per_quote_unit_source: "org", success_fee: 3_500_000, success_rate_source: "org" });
  });
  it("참고 합계는 따로 더한다", () => {
    expect(referenceTotals([
      { subscription_count: 1, per_quote_count: 3, per_quote_fee: 90_000, success_count: 1, success_fee: 1_650_000 },
      { subscription_count: 0, per_quote_count: 2, per_quote_fee: 600_000, success_count: 1, success_fee: 3_500_000 },
    ])).toEqual({ subscription: 1, perQuote: 5, perQuoteFee: 690_000, success: 2, successFee: 5_150_000 });
  });
});

describe("CSV: 조정은 청구액, 참고 수치는 따로 둔 열에만", () => {
  it("조정 행은 청구 대상 Y·금액 그대로, 참고 행은 청구 대상 N·청구액 0 과 참고 열", async () => {
    const snapshot = {
      taken_at: "2026-11-01T00:00:00Z",
      summary: [],
      lines: [],
      awards: [],
      adjustments: [{ adjustment_id: "adj-1", org_id: "o", org_name: "시험기관", month: "2026-10-01", amount: -120000, reason: "9월 중복분", corrects_month: "2026-09-01", created_by: null, created_at: "2026-10-03T01:00:00Z" }],
      reference: [{ org_id: "o", org_name: "시험기관", subscription_count: 1, per_quote_count: 3, per_quote_unit: 30000, per_quote_unit_source: "reference", per_quote_fee: 90000, success_count: 1, success_contract_amount: 55000000, success_rate: 0.03, success_rate_source: "reference", success_fee: 1650000 }],
    };
    fx.respond = (q) => (q.table === "billing_periods" ? { data: { snapshot }, error: null } : { data: null, error: null });
    const r = await exportCsv(new Request("http://x/api/admin/billing/export?month=2026-10"));
    const text = (await r.text()).replace(/^﻿/, "");
    const rows = text.split("\r\n").map((l) => l.match(/("([^"]|"")*"|[^,]*)(,|$)/g)!.map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "")));
    const head = rows[0];
    const col = (name: string) => head.indexOf(name);
    for (const h of ["참고: 1,000만 원 미만 견적 수", "참고: 건당 이용료 대상 견적 수", "참고: 건당 단가(원)", "참고: 건당 이용료(원)", "참고: 성사수수료(원)"]) expect(head).toContain(h);
    const adj = rows.find((c) => c[0] === "조정")!;
    expect(adj[col("청구 대상")]).toBe("Y");
    expect(adj[col("청구액(원)")]).toBe("-120000");
    expect(adj[col("비고")]).toContain("바로잡는 달 2026-09");
    const ref = rows.find((c) => c[0] === "참고 (시범 기간, 청구 안 함)")!;
    expect(ref[col("청구 대상")]).toBe("N");
    expect(ref[col("청구액(원)")]).toBe("0");
    expect(ref[col("참고: 건당 이용료 대상 견적 수")]).toBe("3");
    expect(ref[col("참고: 건당 이용료(원)")]).toBe("90000");
    expect(ref[col("참고: 성사수수료(원)")]).toBe("1650000");
    expect(ref[col("비고")]).toContain("참고 단가(예시, 시장 검증 전)");
    // 저장본에 참고 수치가 있으면 다시 집계하지 않는다
    expect(fx.rpc).not.toHaveBeenCalled();
  });
  it("0024 전 저장본: 조정 없음, 참고 수치는 지금 집계로 채운다", async () => {
    const snapshot = { taken_at: "2026-10-01T00:00:00Z", summary: [], lines: [], awards: [] };
    fx.respond = (q) => (q.table === "billing_periods" ? { data: { snapshot }, error: null } : { data: null, error: null });
    await exportCsv(new Request("http://x/api/admin/billing/export?month=2026-09"));
    expect(fx.rpc).toHaveBeenCalledWith("billing_reference", { p_from: "2026-09-01", p_to: "2026-10-01" });
  });
  it("열린 달: 조정 항목이나 참고 수치를 못 읽으면 500 (Y 행 합이 명세 합계와 어긋나지 않게)", async () => {
    for (const failing of ["billing_adjustment_lines", "billing_reference"]) {
      fx.rpc.mockImplementation(async (fn: string) => (fn === failing ? { data: null, error: { message: "boom" } } : { data: [], error: null }));
      const r = await exportCsv(new Request("http://x/api/admin/billing/export?month=2026-10"));
      expect(r.status, failing).toBe(500);
    }
  });
  it("0024 전 저장본: 참고 수치를 못 읽으면 500", async () => {
    const snapshot = { taken_at: "2026-10-01T00:00:00Z", summary: [], lines: [], awards: [] };
    fx.respond = (q) => (q.table === "billing_periods" ? { data: { snapshot }, error: null } : { data: null, error: null });
    fx.rpc.mockImplementation(async () => ({ data: null, error: { message: "boom" } }));
    const r = await exportCsv(new Request("http://x/api/admin/billing/export?month=2026-09"));
    expect(r.status).toBe(500);
  });
});

describe("화면", () => {
  const page = readFileSync("app/admin/billing/page.tsx", "utf8");
  const close = readFileSync("components/admin/BillingClose.tsx", "utf8");
  it("마감 해제 버튼이 없고, 마감한 달 안내를 보여 준다", () => {
    expect(close).not.toMatch(/마감 해제/);
    expect(close).not.toMatch(/closed: !closed/);
    expect(page).not.toMatch(/마감을 해제/);
    expect(page).toContain("CLOSED_MONTH_NOTE");
  });
  it("조정 입력은 열린 달에만, 참고 수치에는 이름표", () => {
    expect(page).toMatch(/closed \? \([\s\S]*?\) : \([\s\S]*?<BillingAdjustmentForm/);
    expect(page).toContain("REFERENCE_LABEL");
    expect(page).toContain("REFERENCE_UNIT_LABEL");
  });
  it("조정·참고 수치를 못 읽으면 \"없습니다\" 대신 오류를 보여 주고, 정지한 기관도 조정 대상에 넣는다", () => {
    expect(page).toMatch(/error: adjError/);
    expect(page).toMatch(/error: refError/);
    expect(page).toMatch(/adjFailed \? \(/);
    expect(page).toMatch(/refFailed \? \(/);
    expect(page).toMatch(/\.in\("status", \["approved", "suspended"\]\)/);
  });
  it("조정 입력: 바로잡는 달은 기본이 지정하지 않음, 화면에 없는 칸(month) 오류는 메시지로", () => {
    const form = readFileSync("components/admin/BillingAdjustmentForm.tsx", "utf8");
    expect(form).toMatch(/\[corrects, setCorrects\] = useState\(""\)/);
    expect(form).toMatch(/d\.field && d\.field !== "month"/);
  });
  it("화면 문자열 규칙: 긴 대시 없음", () => {
    for (const f of ["app/admin/billing/page.tsx", "components/admin/BillingClose.tsx", "components/admin/BillingAdjustmentForm.tsx", "app/api/admin/billing/close/route.ts", "app/api/admin/billing/adjustments/route.ts", "app/api/admin/billing/export/route.ts", "lib/billing.ts"]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/[–—]/);
    }
  });
});
