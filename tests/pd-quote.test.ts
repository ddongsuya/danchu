import { describe, expect, it } from "vitest";
import { cleanPriceSnap, pdBuckets, pdQuote, snapFor, wonKo } from "@/lib/pd-quote";
import { cleanDocData, docTotals, kindRows, scheduleWeeks, testFromCatalog, testLines, type DocTest } from "@/lib/quote-doc";
import { PD_ITEMS, PD_MODEL, PD_REQ, PD_ROW } from "@/app/design-preview/pd-fixtures";

// 시안 v15 예시 (실제 기관 단가가 아니다): 표준 16,675,000 → 요청 반영 28,232,500
const book = { items: PD_ITEMS, marginPct: 15 };
const make = (): DocTest => {
  const t = testFromCatalog(PD_ROW, []);
  return { ...t, kd: { ...t.kd, pd: structuredClone(PD_REQ) }, prices: snapFor(book, PD_MODEL, PD_REQ) };
};

describe("효력 요청 반영 견적", () => {
  it("표준가·견적 금액이 시안과 같다", () => {
    const q = pdQuote(make())!;
    expect(q.std.total).toBe(16_675_000);
    expect(q.cur.total).toBe(28_232_500);
    expect(q.diff.totalDelta).toBe(11_557_500);
  });

  it("달라진 곳: 군 수·군당 마리는 한 칸, 평가항목은 따로", () => {
    const q = pdQuote(make())!;
    expect(q.changes.map((c) => c.item)).toEqual(["군 수", "군당 마리", "평가항목"]);
    expect(q.changes[0]).toMatchObject({ before: "5군", after: "6군 (시험물질 중용량군 추가)", amount: 5_347_500, span: 2 });
    expect(q.changes[1]).toMatchObject({ before: "8", after: "10", amount: null });
    expect(q.changes[2]).toMatchObject({ before: "없음", after: "혈청 사이토카인", amount: 6_210_000 });
    expect(q.changes.reduce((a, c) => a + (c.amount ?? 0), 0)).toBe(q.diff.totalDelta);
  });

  it("견적서 금액·묶음 합이 견적 금액과 같고 단가·%는 내역에 없다", () => {
    const t = make();
    expect(testLines(t).total).toBe(28_232_500);
    expect(testLines(t).base).toBe(16_675_000);
    const rows = kindRows(t)!;
    expect(rows.reduce((a, r) => a + r.amount, 0)).toBe(28_232_500);
    const text = JSON.stringify(rows);
    expect(text).not.toMatch(/38,000|2,500|15%/);
    expect(pdBuckets(pdQuote(t)!, t.kd!.pd!)[0].note).toContain("60마리");
    expect(docTotals({ tests: [t], visible: { perTest: true, adjust: true, formula: false }, discount: 0, terms: { pay: "", extra: "", note: "" }, glp: "" }).supply).toBe(28_232_500);
  });

  it("사본이 없으면 예전 방식", () => {
    const t = make();
    delete t.prices;
    expect(pdQuote(t)).toBeNull();
  });

  it("저장할 때 사본을 정리한다", () => {
    const snap = cleanPriceSnap({ margin: 15, items: [{ id: "a", category: "animal", unit: "head", price: 1000, name: "x" }, { id: "b", category: "nope", unit: "head", price: 1 }, { id: "c", category: "animal", unit: "head", price: -1 }] });
    expect(snap?.items.map((i) => i.id)).toEqual(["a"]);
    expect(cleanPriceSnap({ margin: 999, items: [] })).toBeUndefined();
    const d = cleanDocData({ tests: [make()] });
    expect(pdQuote(d.tests[0])?.cur.total).toBe(28_232_500);
  });

  it("효력 기간은 시험에 적은 주 하나만 쓴다", () => {
    const t = make();
    expect(scheduleWeeks({ tests: [{ ...t, weeks: 8, phases: [{ id: "p", name: "x", start: 0, weeks: 4, kind: "run" }] }], visible: { perTest: true, adjust: true, formula: false }, discount: 0, terms: { pay: "", extra: "", note: "" }, glp: "" })).toBe(8);
  });

  it("금액 한글 표기", () => {
    expect(wonKo(31_055_750)).toBe("삼천일백오만오천칠백오십");
    expect(wonKo(100_000_000)).toBe("일억");
    expect(wonKo(0)).toBe("영");
  });
});
