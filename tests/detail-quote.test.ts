import { describe, expect, it } from "vitest";
import { cleanDetail, detailLines, replyItemsOf, revisedTotal } from "@/lib/detail-quote";
import type { Values } from "@/lib/rfq-schema";

const payload: Values = { categories: ["일반독성"], "일반독성.recovery": "2주", "일반독성.species": ["랫드"], storage: "미정" };
const cats = ["일반독성"];

describe("2차 상세 견적 조건", () => {
  it("허용한 키와 선택지만 받고 1차와 같은 값은 뺀다", () => {
    const d = cleanDetail({ "일반독성.recovery": "4주", "일반독성.species": ["랫드"], storage: "냉장(2~8℃)", amount: " 50 g ", budget: "없는 값", hack: "x", "유전독성.exposure": "포함" }, payload, cats);
    expect(d).toEqual({ "일반독성.recovery": "4주", storage: "냉장(2~8℃)", amount: "50 g" });
  });
  it("1차 값이 있던 키는 바뀐 조건, 비었거나 미정이던 키는 새 조건", () => {
    const { changed, added } = detailLines({ "일반독성.recovery": "4주", storage: "냉장(2~8℃)", budget: "1~3억 원" }, payload, cats);
    expect(changed.map((c) => [c.key, c.was, c.now])).toEqual([["일반독성.recovery", "2주", "4주"]]);
    expect(added.map((c) => c.key).sort()).toEqual(["budget", "storage"]);
  });
  it("기관에는 예산을 보내지 않는다", () => {
    const { added } = detailLines({ budget: "1~3억 원", storage: "실온" }, payload, cats, { forCro: true });
    expect(added.map((c) => c.key)).toEqual(["storage"]);
  });
});

describe("2차 회신", () => {
  it("2차 총액은 1차 총액에 고친 줄의 차이를 더한다", () => {
    const first = [{ seq: 1, amount: 48_000_000 }, { seq: 2, amount: 14_000_000 }];
    expect(revisedTotal(62_000_000, first, [{ seq: 1, amount: 54_000_000 }])).toBe(68_000_000);
    expect(revisedTotal(62_000_000, first, [{ seq: 2, amount: null }])).toBe(62_000_000);
  });
  it("저장된 줄에서 잘못된 값은 버린다", () => {
    expect(replyItemsOf([{ seq: 1, amount: 100, weeks: 4, mode: "assumed", reason: " 가정 " }, { seq: 0 }, "x", { seq: 2, amount: -1, weeks: 999 }])).toEqual([
      { seq: 1, amount: 100, weeks: 4, mode: "assumed", reason: "가정" },
      { seq: 2, amount: null, weeks: null, mode: "as_requested", reason: "" },
    ]);
  });
});
