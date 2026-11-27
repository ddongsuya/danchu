import { describe, expect, it } from "vitest";
import { businessDayLabel } from "@/lib/dates";

describe("회신 기한 칩 날짜 (시안 r-new2~s2 · 독성 대화)", () => {
  it("주말을 건너뛰고 평일 n일 뒤 날짜를 7월 14일 모양으로", () => {
    // 2027-07-05 월요일 기준 평일 7일 뒤 = 7월 14일 수요일
    expect(businessDayLabel(7, new Date(2027, 6, 5, 10))).toBe("7월 14일");
    // 금요일 기준 평일 1일 뒤 = 다음 월요일
    expect(businessDayLabel(1, new Date(2027, 6, 9, 10))).toBe("7월 12일");
  });
});
