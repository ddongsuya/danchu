import { describe, expect, it } from "vitest";
import { parseAwardSubstance } from "@/lib/award-substance";

describe("선정 뒤 시험물질 필요량 (0027)", () => {
  it("필요량이 있으면 앞뒤 공백을 지우고 길이를 자른다", () => {
    expect(parseAwardSubstance({ qty: "  원료 40 g  ", when: "착수 2주 전까지", note: "x".repeat(400) })).toEqual({ qty: "원료 40 g", when: "착수 2주 전까지", note: "x".repeat(300) });
  });
  it("필요량이 비었거나 형식이 틀리면 저장하지 않는다", () => {
    expect(parseAwardSubstance({ qty: "   " })).toBeNull();
    expect(parseAwardSubstance({ qty: 40 })).toBeNull();
    expect(parseAwardSubstance(null)).toBeNull();
  });
});
