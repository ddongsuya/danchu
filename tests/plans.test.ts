import { describe, expect, it } from "vitest";
import { PLANS, canUse, monthlyQuoteLimit, pendingPlan, planChange, planDiff, planOn, proratedUpgrade, seatLimit } from "@/lib/plans";
import { PAID_FROM } from "@/lib/billing";

const org = (plan: string, plan_next: string | null = null, plan_next_from: string | null = null) => ({ plan, plan_next, plan_next_from });

describe("요금제 (0044)", () => {
  it("요금과 한도가 확정안과 같다", () => {
    expect([PLANS.free.price, PLANS.plus.price, PLANS.pro.price]).toEqual([0, 500_000, 1_000_000]);
    expect([PLANS.free.monthlyQuotes, PLANS.plus.monthlyQuotes, PLANS.pro.monthlyQuotes]).toEqual([5, null, null]);
    expect([PLANS.free.seats, PLANS.plus.seats, PLANS.pro.seats]).toEqual([1, 3, null]);
    // 위 단계 목록은 아래 단계 항목을 줄이지 않고 다 적는다
    expect(PLANS.plus.items.length).toBe(4);
    expect(PLANS.pro.items.length).toBe(7);
  });

  it("시범 운영 중에는 제한이 없다", () => {
    const d = "2027-08-01";
    expect(canUse(org("free"), "crm", d)).toBe(true);
    expect(monthlyQuoteLimit(org("free"), d)).toBeNull();
    expect(seatLimit(org("free"), d)).toBeNull();
  });

  it("정식 서비스 뒤에는 요금제 기능만 쓴다", () => {
    const d = "2028-02-10";
    expect(canUse(org("free"), "tests", d)).toBe(false);
    expect(canUse(org("plus"), "tests", d)).toBe(true);
    expect(canUse(org("plus"), "quote_tool", d)).toBe(false);
    expect(canUse(org("pro"), "crm", d)).toBe(true);
    expect(monthlyQuoteLimit(org("free"), d)).toBe(5);
    expect(seatLimit(org("plus"), d)).toBe(3);
  });

  it("시범 운영 중 고른 요금제는 2028-01-01부터 적용된다", () => {
    const o = org("free", "pro", PAID_FROM);
    expect(planOn(o, "2027-12-31")).toBe("free");
    expect(planOn(o, PAID_FROM)).toBe("pro");
    expect(planChange(org("free"), "plus", "2027-07-01")).toEqual({ kind: "reserve", plan: "plus", from: PAID_FROM });
    expect(planChange(o, "pro", "2027-07-01").kind).toBe("same");
  });

  it("올리기는 오늘부터 남은 날 차액, 내리기는 다음 달 1일부터", () => {
    // 2028-03-14 ~ 03-31 18일 / 31일 × 50만 원
    expect(proratedUpgrade("plus", "pro", "2028-03-14")).toBe(290_323);
    expect(planChange(org("plus"), "pro", "2028-03-14")).toEqual({ kind: "upgrade", plan: "pro", from: "2028-03-14", prorated: 290_323, periodEnd: "2028-03-31" });
    expect(planChange(org("pro"), "plus", "2028-12-20")).toEqual({ kind: "downgrade", plan: "plus", from: "2029-01-01" });
    const down = org("pro", "plus", "2028-04-01");
    expect(pendingPlan(down, "2028-03-20")).toEqual({ plan: "plus", from: "2028-04-01" });
    expect(planChange(down, "pro", "2028-03-20").kind).toBe("cancel");
  });

  it("차이 항목은 바뀌는 것만", () => {
    expect(planDiff("plus", "pro").map((r) => r.label)).toEqual(["견적서 작성 툴", "견적서 디자인 브랜딩", "고객 관리", "담당자 계정"]);
    expect(planDiff("free", "plus").map((r) => r.label)).toEqual(["5,000만 원 미만 견적", "시험 관리", "담당자 계정"]);
  });
});
