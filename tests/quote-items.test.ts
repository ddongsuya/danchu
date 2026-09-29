import { describe, expect, it } from "vitest";
import { glpCoverage, quoteRowsFromPayload } from "@/lib/quote-items";
import { catalogItems, itemKey, rowKey } from "@/lib/catalog";
import type { Values } from "@/lib/rfq-schema";

describe("quoteRowsFromPayload — 요청서 → 회신 표 행", () => {
  it("대분류의 세부 항목마다 행이 생기고 seq 는 1부터", () => {
    const payload: Values = {
      categories: ["일반독성", "유전독성"],
      "일반독성.items": ["단회(급성)투여독성", "반복투여 4주"],
      "일반독성.species": ["랫드", "개(비글)"],
      "일반독성.recovery": "2주",
      "일반독성.tk": "포함",
      "일반독성.glpLevel": "GLP",
    };
    const rows = quoteRowsFromPayload(payload);
    expect(rows.map((r) => r.seq)).toEqual([1, 2, 3]);
    expect(rows[0]).toMatchObject({ category: "일반독성", name: "단회(급성)투여독성" });
    expect(rows[0].cond).toBe("랫드·개(비글) · 회복 2주 · TK 병행 · GLP");
    // 세부 항목을 고르지 않은 대분류는 대분류 자체가 한 행
    expect(rows[2]).toMatchObject({ category: "유전독성", name: "유전독성" });
  });
  it("스키마에 없는 대분류는 무시", () => {
    expect(quoteRowsFromPayload({ categories: ["없는분류"] })).toEqual([]);
  });
  it("행 키는 카탈로그 항목 키와 같은 형식", () => {
    const rows = quoteRowsFromPayload({ categories: ["일반독성"], "일반독성.items": ["반복투여 26주"] });
    expect(rowKey(rows[0])).toBe(itemKey("일반독성", "반복투여 26주"));
    expect(catalogItems().some((it) => it.key === rowKey(rows[0]))).toBe(true);
  });
});

describe("glpCoverage — 제출처 vs 보유 인증", () => {
  it("식약처 제출은 KGLP 필요", () => {
    expect(glpCoverage(["식약처(MFDS)"], ["OECD GLP"])).toEqual({ ok: false, missing: ["식약처(KGLP)"] });
    expect(glpCoverage(["식약처(MFDS)"], ["식약처(KGLP)"]).ok).toBe(true);
  });
  it("EMA·PMDA 는 OECD GLP 로 대응, 중복은 하나로", () => {
    expect(glpCoverage(["EMA", "PMDA(일본)"], [])).toEqual({ ok: false, missing: ["OECD GLP"] });
  });
  it("모르는 제출처는 대응 가능으로 단정하지 않음", () => {
    expect(glpCoverage(["기타"], []).ok).toBe(false);
    expect(glpCoverage([], []).ok).toBe(false);
  });
});
