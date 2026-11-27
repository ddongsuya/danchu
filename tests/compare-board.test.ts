import { describe, expect, it } from "vitest";
import { boardDiffCount, readBoardUrl, sortCols, testDiffers, writeBoardUrl, type CompareCol } from "@/lib/compare-board";
import { topCategoryAll } from "@/lib/compare-report";
import { eulReul, gwaWa } from "@/lib/josa";

const col = (id: string, total: number, over: Partial<CompareCol> = {}): CompareCol => ({
  id, name: id, total, weeks: 10, start: "2027-08-01", valid: null, pay: null, includes: [], note: null, glpOk: true, glpMissing: [], glp: [],
  unavailable: [], conditional: 0, items: [{ seq: 1, avail: "가능", amount: total, weeks: 4 }], hasPdf: true, selected: false, auto: false, ...over,
});

describe("비교표 주소 상태 (?sort=&view=#q-)", () => {
  it("기본값은 주소에서 빠지고, 고른 값과 열린 기관은 남는다", () => {
    expect(writeBoardUrl("", { sort: "default", view: "all", quote: null, doc: false })).toBe("");
    expect(writeBoardUrl("?x=1", { sort: "total", view: "diff", quote: "ab-1", doc: true })).toBe("?x=1&sort=total&view=diff#q-ab-1/doc");
  });
  it("읽기는 쓰기의 역이고, 모르는 값은 기본값으로", () => {
    expect(readBoardUrl("?sort=total&view=diff", "#q-ab-1/doc")).toEqual({ sort: "total", view: "diff", quote: "ab-1", doc: true });
    expect(readBoardUrl("?sort=evil&view=x", "#other")).toEqual({ sort: "default", view: "all", quote: null, doc: false });
    expect(readBoardUrl("", "#q-qa")).toMatchObject({ quote: "qa", doc: false });
  });
});

describe("비교표 정렬과 차이 항목", () => {
  it("기본은 회신 도착 순 그대로, 금액 순은 2차 금액 기준", () => {
    const a = col("a", 300, { detail: { status: "submitted", total: 100, weeks: 10, note: null, items: [] } });
    const b = col("b", 200);
    expect(sortCols([a, b], "default").map((c) => c.id)).toEqual(["a", "b"]);
    expect(sortCols([a, b], "total").map((c) => c.id)).toEqual(["a", "b"]);
    expect(sortCols([b, col("c", 0)], "total").map((c) => c.id)).toEqual(["b", "c"]);
  });
  it("시험 줄은 금액이 없는 칸이 섞일 때만 차이로 센다", () => {
    const a = col("a", 100);
    const b = col("b", 200);
    const c = col("c", 300, { items: [{ seq: 1, avail: "불가", amount: null, weeks: null }] });
    expect(testDiffers([a, b], 1)).toBe(false);
    expect(testDiffers([a, c], 1)).toBe(true);
  });
  it("차이 항목 수는 다른 조건 줄 + 갈리는 시험 줄, 기관이 하나면 0", () => {
    const a = col("a", 100);
    const b = col("b", 200, { start: "2027-09-01" });
    expect(boardDiffCount([a], [{ seq: 1, name: "x", category: "y" }])).toBe(0);
    expect(boardDiffCount([a, b], [{ seq: 1, name: "x", category: "y" }])).toBe(1);
  });
  it("금액이 가장 큰 분야는 모든 기관 금액을 합쳐서 고른다", () => {
    const rows = [{ seq: 1, name: "a", category: "일반독성" }, { seq: 2, name: "b", category: "유전독성" }];
    const x = col("x", 0, { items: [{ seq: 1, avail: "가능", amount: 10, weeks: 1 }, { seq: 2, avail: "가능", amount: 30, weeks: 1 }] });
    const y = col("y", 0, { items: [{ seq: 1, avail: "가능", amount: 25, weeks: 1 }, { seq: 2, avail: "불가", amount: 99, weeks: 1 }] });
    expect(topCategoryAll([x, y], rows)).toBe("일반독성");
    expect(topCategoryAll([], rows)).toBeNull();
  });
});

describe("이름 뒤 조사", () => {
  it("받침에 따라 을/를, 과/와", () => {
    expect(eulReul("예시 기관 A")).toBe("예시 기관 A를");
    expect(eulReul("한국독성연구원")).toBe("한국독성연구원을");
    expect(eulReul("기관 M")).toBe("기관 M을");
    expect(gwaWa("예시 기관 B")).toBe("예시 기관 B와");
    expect(gwaWa("연구소 1")).toBe("연구소 1과");
    expect(gwaWa("바이오(주)")).toBe("바이오(주)와");
  });
});
