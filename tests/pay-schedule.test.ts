import { describe, expect, it } from "vitest";
import { DEFAULT_PAY, formatPay, parsePay, payAmounts, payError } from "@/lib/pay-schedule";

describe("지급 조건 줄 (시안 v7)", () => {
  it("줄을 글로 저장하고 다시 읽으면 같은 줄이 나온다", () => {
    const s = formatPay(DEFAULT_PAY);
    expect(s).toBe("착수금 30% 계약 시 · 중도금 40% 중간 보고서 제출 시 · 잔금 30% 최종 보고서 제출 시");
    expect(parsePay(s)).toEqual(DEFAULT_PAY);
  });

  it("예전 숫자 입력(30 · 40 · 30, 50/50)은 선급·중도·잔금 줄로 바꾼다", () => {
    expect(parsePay("30 · 40 · 30")).toEqual([
      { label: "선급", pct: 30, when: "계약 시" },
      { label: "중도", pct: 40, when: "중간 보고서 제출 시" },
      { label: "잔금", pct: 30, when: "최종 보고서 제출 시" },
    ]);
    expect(parsePay("50/50").map((r) => [r.label, r.pct])).toEqual([["선급", 50], ["잔금", 50]]);
  });

  it("줄로 읽을 수 없는 자유 글과 빈 값은 빈 목록", () => {
    expect(parsePay("협의 후 결정")).toEqual([]);
    expect(parsePay("")).toEqual([]);
    expect(parsePay(null)).toEqual([]);
  });

  it("이름의 · 와 % 는 지워서 저장 글이 깨지지 않게 한다", () => {
    const s = formatPay([{ label: "착수·계약금%", pct: 100, when: "계약 시" }]);
    expect(parsePay(s)).toEqual([{ label: "착수계약금", pct: 100, when: "계약 시" }]);
  });

  it("합계가 100%가 아니거나 비율·이름이 비면 오류 문구", () => {
    expect(payError(DEFAULT_PAY)).toBeNull();
    expect(payError([])).toBeNull();
    expect(payError([{ label: "착수금", pct: 30, when: "계약 시" }, { label: "잔금", pct: 60, when: "최종 보고서 제출 시" }])).toBe("지급 비율 합계가 100%가 되어야 해요. 지금 90%예요.");
    expect(payError([{ label: "", pct: 100, when: "계약 시" }])).toBe("1번째 줄의 단계 이름을 적어 주세요.");
    expect(payError([{ label: "잔금", pct: 0, when: "계약 시" }])).toBe("1번째 줄의 비율은 1~100% 사이로 적어 주세요.");
  });

  it("금액은 줄마다 원 미만을 버리고 남는 원은 마지막 줄에 더한다", () => {
    expect(payAmounts(DEFAULT_PAY, 100_000_001)).toEqual([30_000_000, 40_000_000, 30_000_001]);
    expect(payAmounts(DEFAULT_PAY, 0)).toEqual([0, 0, 0]);
  });
});
