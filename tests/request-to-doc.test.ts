import { describe, expect, it } from "vitest";
import { testFromCatalog, testLines, toxFromRequest, type Rate } from "@/lib/quote-doc";
import { emptyPk, firstInt, pkGroupsFromRequest, pkSamples } from "@/lib/kind-design";
import type { CatalogRow } from "@/lib/catalog";

// 계산 확인용 가상의 값 (어느 기관의 실제 단가도 아니다)
const tox = {
  id: "00000000-0000-0000-0000-000000000001", item_key: "tox.repeat", category: "일반독성", item: "반복투여 4주", available: true, glp: "GLP",
  species: ["랫드"], route: "경구(PO)", method: null, groups_ctrl: 1, groups_test: 3, per_sex: 10, recovery_weeks: null, recovery_per_sex: 5,
  dosing: "4주, 1일 1회", weeks: 12, includes: ["일반증상"], options: [{ name: "TK 분석", amount: 7_000_000 }], unit: "total",
  price_min: null, price_max: null, extra: {}, note: null, last_amount: null, last_weeks: null, last_quoted_at: null, std_price: 50_000_000,
} as unknown as CatalogRow;
const rates: Rate[] = [{ id: "recovery", kind: "recovery", label: "회복군", unit: "마리", add: 900_000, deduct: 500_000, shown: "회복군 추가 / 제외" }];

describe("독성 요청 조건 → 견적서 설계", () => {
  it("회복 4주 요청: 대조군·고용량군에 기관 회복 마릿수, 금액은 회복 단가로", () => {
    const t = testFromCatalog(tox, rates);
    const r = toxFromRequest(t, { recovery: "4주" }, 5);
    expect(r.test.groups.map((g) => g.rm)).toEqual([5, 0, 0, 5]);
    expect(r.resolved).toEqual(["회복군 4주"]);
    // 회복 동물 20마리 × 90만 원
    expect(testLines(r.test).total).toBe(50_000_000 + 20 * 900_000);
  });
  it("기관이 회복 마릿수를 정하지 않았으면 옮기지 않고 기관 확인으로 남긴다", () => {
    const r = toxFromRequest(testFromCatalog(tox, rates), { recovery: "4주" }, null);
    expect(r.test.groups.every((g) => g.rm === 0)).toBe(true);
    expect(r.resolved).toEqual([]);
  });
  it("TK 포함: 같은 이름의 추가 항목을 켠다", () => {
    const r = toxFromRequest(testFromCatalog(tox, []), { tk: "포함" }, null);
    expect(r.resolved).toEqual(["TK 병행"]);
    expect(testLines(r.test).total).toBe(50_000_000 + 7_000_000);
  });
  it("추가 항목이 없는 조건은 그대로 기관 확인", () => {
    const r = toxFromRequest(testFromCatalog(tox, []), { histopath: "포함" }, null);
    expect(r.resolved).toEqual([]);
  });
  it("회복 없음 요청이면 표준 회복 동물을 뺀다", () => {
    const withRec = testFromCatalog({ ...tox, recovery_weeks: 4 } as CatalogRow, rates);
    const r = toxFromRequest(withRec, { recovery: "없음" }, 5);
    expect(r.test.groups.every((g) => g.rm === 0 && g.rf === 0)).toBe(true);
    expect(testLines(r.test).total).toBe(50_000_000 - 20 * 500_000);
  });
});

describe("약동학 군 수·군당 마릿수", () => {
  it("숫자 읽기", () => {
    expect(firstInt("2 (IV 1군, PO 1군)", 20)).toBe(2);
    expect(firstInt("군당 3마리", 200)).toBe(3);
    expect(firstInt("모름", 20)).toBeUndefined();
    expect(firstInt("0", 20)).toBeUndefined();
  });
  it("표준 군이 없어도 요청대로 군을 만들어 검체 수가 나온다", () => {
    const pk = { ...emptyPk(), times: ["0.5시간", "1시간", "2시간", "4시간"], matrix: ["혈장"] };
    const groups = pkGroupsFromRequest(pk.groups, 2, 3);
    expect(groups.map((g) => g.n)).toEqual([3, 3]);
    expect(pkSamples({ ...pk, groups })).toBe(2 * 3 * 4);
  });
  it("표준 군 이름·경로는 앞에서부터 두고 남으면 뒤에서 뺀다", () => {
    const std = [
      { id: "a", label: "IV", route: "정맥", dose: "1", n: 3 },
      { id: "b", label: "PO", route: "경구", dose: "5", n: 3 },
      { id: "c", label: "PO 고용량", route: "경구", dose: "20", n: 3 },
    ];
    expect(pkGroupsFromRequest(std, 2, 4).map((g) => [g.label, g.n])).toEqual([["IV", 4], ["PO", 4]]);
    expect(pkGroupsFromRequest(std, undefined, undefined)).toBe(std);
  });
});
