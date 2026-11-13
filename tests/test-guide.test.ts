import { describe, expect, it } from "vitest";
import { catalogItems, itemKey, newVariant } from "@/lib/catalog";
import { DEFAULT_VISIBLE, EMPTY_TERMS, testFromCatalog, type DocData } from "@/lib/quote-doc";
import { docGuides, guideFor } from "@/lib/test-guide";
import { guidePages, pageCount, pageKeys } from "@/components/cro/quote/DocPages";

const items = new Map(catalogItems().map((it) => [it.key, it]));
const test = (cat: string, item: string) => testFromCatalog(newVariant(items.get(itemKey(cat, item))!), []);
const doc = (tests: ReturnType<typeof test>[], guide?: boolean): DocData => ({ tests, visible: { ...DEFAULT_VISIBLE, guide }, discount: 0, terms: EMPTY_TERMS, glp: "" });

describe("시험 안내 (5부)", () => {
  it("개별 분석(기타)을 뺀 시험 목록 항목은 모두 안내가 있다", () => {
    const missing = catalogItems().filter((it) => !/^기타/.test(it.category)).filter((it) => !guideFor(testFromCatalog(newVariant(it), []))).map((it) => it.key);
    expect(missing).toEqual([]);
  });

  it("항목에 맞는 안내를 고른다", () => {
    expect(guideFor(test("일반독성", "단회(급성)투여독성"))?.key).toBe("single");
    expect(guideFor(test("일반독성", "반복투여 13주"))?.key).toBe("repeat");
    expect(guideFor(test("일반독성", "용량결정(DRF) 2주"))?.key).toBe("drf");
    expect(guideFor(test("유전독성", "복귀돌연변이(Ames, TG 471)"))?.key).toBe("ames");
    expect(guideFor(test("유전독성", "소핵 in vitro(TG 487)"))?.key).toBe("mn-vitro");
    expect(guideFor(test("유전독성", "소핵 in vivo(마우스)"))?.key).toBe("mn-vivo");
    expect(guideFor(test("PK/TK/ADME·생체시료분석", "TK(독성동태)"))?.key).toBe("tk");
  });

  it("같은 종류는 한 번만 싣고 시험 번호를 모은다", () => {
    const d = doc([test("일반독성", "반복투여 4주"), test("유전독성", "복귀돌연변이(Ames, TG 471)"), test("일반독성", "반복투여 13주")]);
    expect(docGuides(d).map((x) => [x.g.key, x.nos])).toEqual([["repeat", [1, 3]], ["ames", [2]]]);
  });

  it("쪽 수와 페이지 순서: 일정표 뒤에 안내, 4종마다 한 쪽, 끄면 없음", () => {
    const six = doc([
      test("일반독성", "단회(급성)투여독성"), test("일반독성", "반복투여 13주"), test("유전독성", "복귀돌연변이(Ames, TG 471)"),
      test("유전독성", "염색체이상 in vitro(TG 473)"), test("유전독성", "소핵 in vivo(마우스)"), test("안전성약리", "hERG(in vitro)"),
    ]);
    expect(guidePages(six).map((p) => p.length)).toEqual([4, 2]);
    expect(pageCount(six)).toBe(3 + 6 + 2);
    expect(pageKeys(six).slice(-3)).toEqual(["schedule", "guide:0", "guide:1"]);
    const off = { ...six, visible: { ...six.visible, guide: false } };
    expect(guidePages(off)).toEqual([]);
    expect(pageCount(off)).toBe(9);
  });

  it("예전 견적서(guide 값 없음)는 켠 것으로 본다", () => {
    expect(guidePages(doc([test("일반독성", "반복투여 13주")], undefined)).length).toBe(1);
  });
});
