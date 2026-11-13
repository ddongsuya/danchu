import { describe, expect, it } from "vitest";
import { croNav, croTier } from "@/lib/cro-nav";

const hrefs = (xs: { href: string }[]) => xs.map((x) => x.href);

describe("요금제별 기관 메뉴 (2026-11-13)", () => {
  it("시범 운영 중에는 모두 Pro 구성", () => {
    expect(croTier({ plan: "free" }, "2027-06-01")).toBe("pro");
    expect(croTier({ plan: "free" }, "2028-01-01")).toBe("free");
    expect(croTier({ plan: "free", plan_next: "plus", plan_next_from: "2028-01-01" }, "2028-01-01")).toBe("plus");
  });
  it("무료: 받은 요청·알림·기관·요금제만, 첫 화면 받은 요청", () => {
    const n = croNav("free", 0);
    expect(hrefs(n.nav)).toEqual(["/cro/requests", "/cro/notifications", "/cro/org", "/cro/billing"]);
    expect(hrefs(n.tabs)).toEqual(["/cro/requests", "/cro/notifications", "/cro/more"]);
    expect(n.home).toBe("/cro/requests");
  });
  it("Plus: 시험 목록·캘린더가 더해지고 고객 관리 메뉴는 없다", () => {
    const n = croNav("plus", 0);
    expect(hrefs(n.nav)).toContain("/cro/catalog");
    expect(hrefs(n.nav)).toContain("/cro/calendar");
    expect(hrefs(n.nav)).not.toContain("/cro/deals");
    expect(hrefs(n.nav)).not.toContain("/cro/docs");
    expect(n.home).toBe("/cro/requests");
  });
  it("Pro: 오늘이 첫 화면, 견적서·고객사 포함", () => {
    const n = croNav("pro", 3);
    expect(n.nav[0].href).toBe("/cro");
    expect(hrefs(n.nav)).toEqual(expect.arrayContaining(["/cro/deals", "/cro/clients", "/cro/reports", "/cro/docs"]));
    expect(hrefs(n.tabs)).toEqual(["/cro", "/cro/deals", "/cro/log", "/cro/more"]);
  });
});
