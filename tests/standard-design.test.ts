import { describe, expect, it } from "vitest";
import { catalogItems, SPECIES, ROUTES, INCLUDE_KEYS } from "@/lib/catalog";
import { STANDARD_DESIGN, standardDesign } from "@/lib/presets";
import { cleanKd } from "@/lib/kind-design";

describe("표준 설계 초안", () => {
  const keys = new Set(catalogItems().map((it) => it.key));

  it("항목·동물종·경로·포함 항목이 단추 목록 안의 값이다", () => {
    for (const [key, d] of Object.entries(STANDARD_DESIGN)) {
      expect(keys.has(key), key).toBe(true);
      for (const s of d.species ?? []) expect(SPECIES, key).toContain(s);
      for (const r of d.routes ?? []) expect(ROUTES, key).toContain(r);
      for (const x of d.includes ?? []) expect(INCLUDE_KEYS as readonly string[], key).toContain(x);
      if (d.kd) expect(cleanKd(d.kd), key).toEqual(d.kd);
    }
  });

  it("단가와 GLP 수행 여부는 넣지 않는다", () => {
    for (const d of Object.values(STANDARD_DESIGN)) {
      expect(d.std_price ?? null).toBeNull();
      expect(d.price_min ?? null).toBeNull();
      expect(d.glp).toBeUndefined();
    }
  });

  it("프리셋이 다른 동물종을 고르면 군 구성·마릿수를 비운다", () => {
    const dog = standardDesign("일반독성::반복투여 4주", { species: ["비글"], note: "회복군 2주" });
    expect(dog.species).toEqual(["비글"]);
    expect(dog.per_sex).toBeUndefined();
    expect(dog.groups_test).toBeUndefined();
    expect(dog.recovery_weeks).toBe(2);
    const rat = standardDesign("일반독성::반복투여 4주", { species: ["SD 랫드"] });
    expect(rat.per_sex).toBe(10);
  });

  it("프리셋이 다른 시험법을 고르면 마릿수를 비운다", () => {
    const d = standardDesign("일반독성::단회(급성)투여독성", { method: "OECD TG 423 급성독성등급법" });
    expect(d.method).toBe("OECD TG 423 급성독성등급법");
    expect(d.per_sex).toBeUndefined();
  });

  it("표준 설계가 없는 항목은 프리셋 값만 쓴다", () => {
    expect(standardDesign("일반독성::반복투여 26주", { method: "x" })).toEqual({ method: "x" });
  });
});
