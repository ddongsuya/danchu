import { describe, expect, it } from "vitest";
import { caretAfterDigits, digitsBefore, digitsOnly, groupDigits } from "@/components/cro/MoneyInput";

/** 쉼표를 다시 넣어도 caret 이 같은 숫자 뒤에 남는지: 180,000,000 의 '180' 뒤에 5를 넣는 경우 */
describe("MoneyInput caret", () => {
  it("중간에 숫자를 넣어도 caret 이 끝으로 가지 않는다", () => {
    const typed = "1805,000,000"; // 사용자가 '180' 뒤에 5를 입력한 직후의 값
    const caret = 4;
    const n = digitsBefore(typed, caret);
    const next = groupDigits(digitsOnly(typed, 13));
    expect(next).toBe("1,805,000,000");
    expect(caretAfterDigits(next, n)).toBe(5); // "1,805" 바로 뒤
  });
  it("지우기", () => {
    const typed = "18,000,000"; // 180,000,000 에서 "18" 뒤의 0 을 지운 뒤 (caret 은 "18" 뒤)
    const n = digitsBefore(typed, 2);
    const next = groupDigits(digitsOnly(typed, 13));
    expect(next).toBe("18,000,000");
    expect(caretAfterDigits(next, n)).toBe(2);
  });
  it("숫자 외 문자와 앞자리 0 제거, 자릿수 제한", () => {
    expect(digitsOnly("00a1,2b3", 13)).toBe("123");
    expect(digitsOnly("12345", 3)).toBe("123");
    expect(caretAfterDigits("1,000", 0)).toBe(0);
  });
});

import { scopeLabel } from "@/components/CompareBoard";
describe("비교표 머리글 범위", () => {
  it("불가·미입력 항목은 금액 항목 수에서 뺀다", () => {
    const items = [
      { seq: 1, avail: "가능", amount: 1, weeks: 1 },
      { seq: 2, avail: "불가", amount: null, weeks: null },
      { seq: 3, avail: "조건부 가능", amount: null, weeks: null },
    ];
    expect(scopeLabel({ items }, 3)).toBe("1/3 항목 금액 · VAT 별도");
  });
});
