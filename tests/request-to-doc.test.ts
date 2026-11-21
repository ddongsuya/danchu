import { describe, expect, it } from "vitest";
import { emptyPk, firstInt, pkGroupsFromRequest, pkSamples } from "@/lib/kind-design";

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
