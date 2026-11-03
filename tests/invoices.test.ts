import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* 월 청구서 (0032). DB 쪽 검사는 tests/db/billing_invoices.sql */

const fx = vi.hoisted(() => ({
  session: null as null | { userId: string; email: string; profile: { role: string } },
  rpc: vi.fn(async (_fn: string, _a?: unknown): Promise<{ data: unknown; error: unknown }> => ({ data: null, error: null })),
  row: null as unknown,
  audit: vi.fn(),
  sendMail: vi.fn(async () => true),
  notifyUsers: vi.fn(async () => {}),
}));

vi.mock("@/lib/supabase", () => {
  const builder = () => {
    const b: Record<string, unknown> = {};
    const self = () => b;
    Object.assign(b, {
      select: self, eq: self, is: self, neq: self, order: self, in: self,
      maybeSingle: async () => ({ data: fx.row, error: null }),
      then: (res: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(res),
    });
    return b;
  };
  return { getSupabaseAdmin: () => ({ from: builder, rpc: (fn: string, a?: unknown) => fx.rpc(fn, a) }) };
});
vi.mock("@/lib/auth", () => ({ sessionOrNull: async () => fx.session }));
vi.mock("@/lib/audit", () => ({ audit: fx.audit }));
vi.mock("@/lib/mail", () => ({ mailWrap: (s: string) => s, esc: (s: string) => s, sendMail: fx.sendMail }));
vi.mock("@/lib/notify", () => ({ notifyUsers: fx.notifyUsers, operatorReplyTo: () => "ops@example.test", siteUrl: () => "https://danchu.kr" }));

import { bankInfo, invoiceItems, invoiceMail, invoiceView, reminderStageFor, vatOf } from "@/lib/invoices";
import { POST as issueRoute } from "@/app/api/admin/billing/invoices/route";
import { POST as actRoute } from "@/app/api/admin/billing/invoices/[id]/route";
import type { BillingInvoiceRow } from "@/lib/db-types";

const ADMIN = { userId: "00000000-0000-4000-8000-0000000000ad", email: "admin@example.test", profile: { role: "admin" } };
const ID = "00000000-0000-4000-8000-0000000000c1";
const post = (body: unknown) => new Request("http://x/api", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const ctx = { params: Promise.resolve({ id: ID }) };

const inv = (over: Partial<BillingInvoiceRow> = {}): BillingInvoiceRow => ({
  id: ID, invoice_no: "DC-202801-001", org_id: "o", org_name: "시험기관", month: "2028-01-01",
  supply_amount: 1_130_000, vat: 113_000, total: 1_243_000,
  detail: {
    summary: { monthly_fee: 1_000_000 } as never,
    lines: [{ quote_id: "q1", rfq_no: "DC-1", fee_due: 50_000, total_amount: 120_000_000 }, { quote_id: "q2", rfq_no: "DC-2", fee_due: 30_000, total_amount: 60_000_000 }] as never,
    awards: [{ kind: "settlement", award_id: "a", rfq_no: "DC-3", fee: 100_000 }] as never,
    adjustments: [{ adjustment_id: "j", amount: -50_000, reason: "중복분 돌려드림" }] as never,
  },
  issued_at: "2028-02-02T01:00:00Z", issued_by: null, due_date: "2028-02-16", status: "issued",
  sent_at: null, last_sent_at: null, sent_count: 0, reminder_stage: 0,
  paid_at: null, paid_on: null, paid_by: null, paid_note: null, voided_at: null, voided_by: null, void_reason: null,
  ...over,
});

beforeEach(() => {
  fx.session = ADMIN;
  fx.row = null;
  fx.rpc.mockReset();
  fx.rpc.mockImplementation(async () => ({ data: null, error: null }));
  fx.audit.mockClear();
  fx.sendMail.mockClear();
  delete process.env.BILLING_BANK_NAME;
  delete process.env.BILLING_BANK_ACCOUNT;
  delete process.env.BILLING_BANK_HOLDER;
});

describe("청구서 계산", () => {
  it("부가세 10%, 원 단위 반올림. SQL 과 같은 식", () => {
    expect(vatOf(80_000)).toBe(8_000);
    expect(vatOf(1_234_565)).toBe(123_457);
    const sql = readFileSync("supabase/migrations/0032_billing_invoices.sql", "utf8");
    expect(sql).toMatch(/round\(p_supply \* 0\.1\)::bigint/);
    expect(sql).toMatch(/billing_invoice_due_days\(\) returns int\s+language sql immutable as \$\$ select 14 \$\$/);
  });
  it("상태: 기한 지남은 오늘과 비교해 계산", () => {
    expect(invoiceView(inv(), "2028-02-16")).toBe("issued");
    expect(invoiceView(inv(), "2028-02-17")).toBe("overdue");
    expect(invoiceView(inv({ status: "paid" }), "2028-03-30")).toBe("paid");
    expect(invoiceView(inv({ status: "void" }), "2028-03-30")).toBe("void");
  });
  it("독촉 단계: 3일 전, 다음 날, 7일 뒤, 30일 뒤. 이미 보낸 단계는 다시 안 보냄", () => {
    expect(reminderStageFor("2028-02-16", "2028-02-12", 0)).toBe(0);
    expect(reminderStageFor("2028-02-16", "2028-02-13", 0)).toBe(1);
    expect(reminderStageFor("2028-02-16", "2028-02-16", 1)).toBe(0);
    expect(reminderStageFor("2028-02-16", "2028-02-17", 1)).toBe(2);
    expect(reminderStageFor("2028-02-16", "2028-02-23", 2)).toBe(3);
    expect(reminderStageFor("2028-02-16", "2028-03-17", 3)).toBe(4);
    expect(reminderStageFor("2028-02-16", "2028-03-30", 4)).toBe(0);
    // 예약 작업이 며칠 빠져도 지금 단계로 건너뛴다
    expect(reminderStageFor("2028-02-16", "2028-02-25", 0)).toBe(3);
  });
  it("항목: 구독료 · 송부 비용 · 성사 수수료 · 조정, 합이 공급가액", () => {
    const items = invoiceItems(inv());
    expect(items.map((i) => i.label)).toEqual(["월 구독료", "견적서 송부 비용", "계약 성사 수수료", "조정"]);
    expect(items.reduce((t, i) => t + i.amount, 0)).toBe(1_130_000);
  });
  it("메일: 계좌가 없으면 회신으로 안내, 있으면 계좌와 청구서 번호. 긴 대시 없음", () => {
    expect(bankInfo()).toBeNull();
    const a = invoiceMail(inv(), "issued");
    expect(a.subject).toBe("[단추] 2028년 1월 이용료 청구서 (DC-202801-001)");
    expect(a.html).toContain("입금 계좌는 운영자가 이 메일 회신으로 따로 알려요");
    expect(a.html).toContain("1,243,000원");
    process.env.BILLING_BANK_NAME = "은행";
    process.env.BILLING_BANK_ACCOUNT = "000-00-0000";
    process.env.BILLING_BANK_HOLDER = "예금주";
    const b = invoiceMail(inv(), "overdue");
    expect(b.html).toContain("000-00-0000");
    expect(b.subject).toContain("납부 기한이 지났어요");
    for (const k of ["issued", "resend", "reminder_before", "overdue"] as const) expect(invoiceMail(inv(), k).html + invoiceMail(inv(), k).subject).not.toMatch(/[–—]/);
  });
});

describe("발행 라우트", () => {
  it("운영자가 아니면 403", async () => {
    fx.session = null;
    expect((await issueRoute(post({ month: "2028-01" }))).status).toBe(403);
  });
  it("달 형식이 틀리면 400", async () => {
    expect((await issueRoute(post({ month: "2028-13" }))).status).toBe(400);
  });
  it("마감 전이면 409 와 안내", async () => {
    fx.rpc.mockImplementation(async () => ({ data: { ok: false, code: "not_closed" }, error: null }));
    const r = await issueRoute(post({ month: "2028-01" }));
    expect(r.status).toBe(409);
    expect(((await r.json()) as { error: string }).error).toContain("마감");
  });
  it("발행: 1일 날짜로 부르고 감사 기록", async () => {
    fx.rpc.mockImplementation(async () => ({ data: { ok: true, issued: 2, skipped: 1 }, error: null }));
    const r = await issueRoute(post({ month: "2028-01" }));
    expect(r.status).toBe(200);
    expect(fx.rpc).toHaveBeenCalledWith("issue_billing_invoices", { p_month: "2028-01-01", p_actor: ADMIN.userId });
    expect(fx.audit).toHaveBeenCalledWith(expect.anything(), "billing.invoice_issue", expect.objectContaining({ label: "2028-01" }), expect.anything());
  });
});

describe("청구서 1장 라우트", () => {
  it("없는 청구서는 404", async () => {
    expect((await actRoute(post({ action: "send" }), ctx)).status).toBe(404);
  });
  it("입금일이 미래면 400, 함수를 부르지 않는다", async () => {
    fx.row = inv();
    const r = await actRoute(post({ action: "paid", paidOn: "2999-01-01" }), ctx);
    expect(r.status).toBe(400);
    expect(fx.rpc).not.toHaveBeenCalled();
  });
  it("취소는 사유가 있어야 한다", async () => {
    fx.row = inv();
    expect((await actRoute(post({ action: "void", reason: " " }), ctx)).status).toBe(400);
    fx.rpc.mockImplementation(async () => ({ data: { ok: false, code: "paid" }, error: null }));
    const r = await actRoute(post({ action: "void", reason: "오기" }), ctx);
    expect(r.status).toBe(409);
    expect(((await r.json()) as { error: string }).error).toContain("조정 항목");
  });
  it("취소한 청구서는 보내지 않는다", async () => {
    fx.row = inv({ status: "void", void_reason: "x", voided_at: "2028-02-03T00:00:00Z" });
    expect((await actRoute(post({ action: "send" }), ctx)).status).toBe(409);
    expect(fx.sendMail).not.toHaveBeenCalled();
  });
});
