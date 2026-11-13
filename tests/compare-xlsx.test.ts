import { describe, expect, it } from "vitest";
import { compareSheets } from "@/lib/compare-xlsx";
import { workbook } from "@/lib/xlsx";
import type { CompareCol } from "@/components/CompareBoard";

const col = (name: string, total: number, items: CompareCol["items"], extra: Partial<CompareCol> = {}): CompareCol => ({
  id: name, name, total, weeks: 11, start: "2027-01-10", valid: null, pay: null, includes: [], note: null,
  glpOk: true, glpMissing: [], glp: ["식약처"], unavailable: [], conditional: 0, items, hasPdf: true, selected: false, ...extra,
} as CompareCol);

describe("비교표 엑셀", () => {
  const rows = [{ seq: 1, name: "반복투여 4주", category: "일반독성" }, { seq: 2, name: "Ames", category: "유전독성" }];
  const cols = [
    col("기관A", 175_000_000, [{ seq: 1, avail: "가능", amount: 87_000_000, weeks: 10 }, { seq: 2, avail: "불가", amount: null, weeks: null }]),
    col("기관B", 185_000_000, [{ seq: 1, avail: "가능", amount: 92_000_000, weeks: 10, note: "회복군 포함" }], { selected: true }),
  ];
  const sheets = compareSheets({ no: "DC-2026-0002", substance: "물질", comparedAt: "2026-11-13T00:00:00Z", authorities: ["식약처"], cols, rows });

  it("첫 장은 기관이 열, 화면과 같은 값", () => {
    const s = sheets[0].rows;
    const head = s.find((r) => typeof r[0] === "object" && r[0] && (r[0] as { v: string }).v === "항목")!;
    expect(head.slice(1).map((c) => (c as { v: string }).v)).toEqual(["기관A", "기관B"]);
    const total = s.find((r) => typeof r[0] === "object" && r[0] && (r[0] as { v: string }).v === "견적 총액")!;
    expect(total.slice(1).map((c) => (c as { v: number }).v)).toEqual([175_000_000, 185_000_000]);
    expect(s.find((r) => r[0] === "선정")!.slice(1)).toEqual(["", "선정"]);
    // 수행 불가 시험은 금액 대신 "불가", 회신에 없는 시험은 빈칸
    expect(s.filter((r) => r[0] === "Ames")[0].slice(1)).toEqual(["불가", ""]);
  });

  it("둘째 장은 시험×기관 한 줄씩, 빠진 항목은 회신 없음", () => {
    const s = sheets[1].rows;
    expect(s).toHaveLength(1 + rows.length * cols.length);
    expect(s.find((r) => r[0] === "Ames" && r[2] === "기관B")![3]).toBe("회신 없음");
    expect(s.find((r) => r[0] === "반복투여 4주" && r[2] === "기관B")![7]).toBe("회복군 포함");
  });

  it("단추의 평가·순위 낱말이 없고 파일로 만들어진다", () => {
    const text = JSON.stringify(sheets);
    for (const w of ["추천", "순위", "최저가"]) expect(text).not.toContain(w);
    const bytes = workbook(sheets);
    expect(bytes[0]).toBe(0x50);
    expect(bytes.length).toBeGreaterThan(1000);
  });
});
