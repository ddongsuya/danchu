import { describe, expect, it } from "vitest";
import { confidentialAccess, identityVisible, isIntent, maskedClientLabel, needsCda, seoulMonthRange, withinMonthlyCap } from "@/lib/request-policy";
import { validateRequired } from "@/lib/rfq-schema";

describe("선정 전 익명: 회사명·연락처 공개 조건", () => {
  it("일반 요청도 선정 전에는 회사명을 가린다", () => {
    expect(needsCda("일반")).toBe(false);
    expect(identityVisible({ awarded: false, signedAt: null })).toBe(false);
    expect(maskedClientLabel("바이오벤처")).toBe("바이오벤처 (선정 시 공개)");
    expect(maskedClientLabel(null)).toBe("의뢰기관 (선정 시 공개)");
  });
  it("선정되면 공개된다", () => expect(identityVisible({ awarded: true, signedAt: null })).toBe(true));
  it("CDA 체결이 확인되면 선정 전에도 공개된다", () => expect(identityVisible({ awarded: false, signedAt: "2026-10-01T00:00:00Z" })).toBe(true));
  it("첨부 공개(confidentialAccess)는 기밀 등급을 따르고 회사명 공개와 독립이다", () => {
    expect(confidentialAccess("일반")).toBe(true);
    expect(confidentialAccess("CDA 필요 (단추 표준 CDA)", null)).toBe(false);
  });
});

describe("요청 성격", () => {
  it("세 가지만 허용한다", () => {
    expect(isIntent("발주 예정")).toBe(true);
    expect(isIntent("비교 견적")).toBe(true);
    expect(isIntent("예산 검토")).toBe(true);
    expect(isIntent("기타")).toBe(false);
  });
  it("요청서 검증에서 필수다", () => {
    const base = { company: "회사", name: "담당", email: "a@b.co", croCount: "3곳", confid: "일반", categories: ["일반독성"], purpose: "자체 연구용", substance: "X" };
    expect(validateRequired({ ...base })).toContain("요청의 성격");
    expect(validateRequired({ ...base, intent: "예산 검토" })).not.toContain("요청의 성격");
  });
});

describe("월 전달 한도", () => {
  it("한도가 없으면 항상 전달한다", () => {
    expect(withinMonthlyCap(null, 999)).toBe(true);
    expect(withinMonthlyCap(0, 5)).toBe(true);
  });
  it("한도에 닿으면 멈춘다", () => {
    expect(withinMonthlyCap(10, 9)).toBe(true);
    expect(withinMonthlyCap(10, 10)).toBe(false);
  });
  it("서울 기준 이번 달 범위", () => {
    const r = seoulMonthRange(new Date("2026-12-15T03:00:00Z"));
    expect(r).toEqual({ from: "2026-12-01", to: "2027-01-01" });
    expect(seoulMonthRange(new Date("2026-01-31T16:00:00Z"))).toEqual({ from: "2026-02-01", to: "2026-03-01" });
  });
});
