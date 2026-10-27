import { describe, expect, it } from "vitest";
import { shortCite } from "@/lib/cite";

describe("shortCite: 화면용 근거 표기는 문서와 번호까지만", () => {
  it("ICH 개정 표시와 조항을 뺀다", () => {
    expect(shortCite("ICH M3(R2) §9 · 고시 별표 4")).toBe("ICH M3 · 식약처 독성시험기준");
    expect(shortCite("ICH S6(R1) 1부 §4.4, 2부 §3.2")).toBe("ICH S6");
    expect(shortCite("ICH S7A·S7B 안전성약리")).toBe("ICH S7A · ICH S7B");
  });
  it("OECD는 시험 번호를 남긴다", () => {
    expect(shortCite("고시 별표 5, 8 · OECD TG 404, 405, 406")).toBe("식약처 독성시험기준 · OECD TG 404, 405, 406");
    expect(shortCite("OECD GLP 원칙 II.6.2.5")).toBe("OECD GLP 원칙");
  });
  it("국내 규정은 짧은 이름으로, 최대 2개", () => {
    expect(shortCite("의약품 임상시험 계획 승인에 관한 규정 별표 1 주 5")).toBe("식약처 임상시험 승인 규정");
    expect(shortCite("ICH S1A §4.1 · ICH M3(R2) §10 · 품목허가·신고·심사 규정 제7조제4호다목")).toBe("ICH S1A · ICH M3");
    expect(shortCite("식약처 「의약품등의 독성시험기준」 해설")).toBe("식약처 독성시험기준");
  });
  it("내부 참고 표기는 빼고, 빈 값은 빈 문자열", () => {
    expect(shortCite("ICH S7B §3.1.3 · 질의응답 3.1")).toBe("ICH S7B");
    expect(shortCite("")).toBe("");
    expect(shortCite(undefined)).toBe("");
  });
});
