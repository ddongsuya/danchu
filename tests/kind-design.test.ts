import { describe, expect, it } from "vitest";
import { cleanDocData, docTotals, testFromCatalog, testKind, testLines, type DocData, type DocTest } from "@/lib/quote-doc";
import { cleanKd, kindOfCategory, kindStdPrice, parseCount, parseGroups, parseTimes, pdFrom, pdParts, pkSamples, type PdDesign } from "@/lib/kind-design";
import { prefillRow, type CatalogRow } from "@/lib/catalog";
import { kdExtra } from "@/lib/kind-design";

// 계산 확인용 가상의 값 (어느 기관의 실제 단가도 아니다)
const base = (p: Partial<CatalogRow>): CatalogRow => ({
  id: "00000000-0000-0000-0000-000000000009", item_key: "x::y", category: "효력시험(약효)", item: "소화기", available: true, glp: "both",
  species: ["C57BL/6 마우스"], route: "경구(PO)", routes: ["경구(PO)"], method: "대장염(DSS)",
  groups_ctrl: 2, groups_test: 1, per_sex: 8, recovery_weeks: null, recovery_per_sex: null, dosing: "2주", weeks: 4,
  includes: [], options: [], unit: "total", price_min: null, price_max: null, extra: {}, note: null,
  last_amount: null, last_weeks: null, last_quoted_at: null, source: "manual", sort: 0, ...p,
});

const pd: PdDesign = {
  model: "대장염(DSS)", induction: "DSS 3% 음수", lanes: [], endpoints: ["DAI"],
  groups: [
    { id: "g1", label: "정상군", role: "normal", treat: "유발 없음", n: 8, dose: "" },
    { id: "g2", label: "부형제군", role: "vehicle", treat: "DSS 유발 후 부형제", n: 8, dose: "" },
    { id: "g3", label: "양성대조군", role: "positive", treat: "DSS 유발 후 기준물질", n: 8, dose: "" },
    { id: "g4", label: "시험물질군", role: "test", treat: "DSS 유발 후 시험물질", n: 8, dose: "" },
  ],
  costs: { cost_animal: 7_200_000, cost_dosing: 4_000_000, cost_eval: 3_600_000, cost_path: 4_800_000, cost_report: 3_000_000 },
  perGroup: { cost_animal: null, cost_dosing: 1_000_000, cost_eval: null, cost_path: 1_200_000, cost_report: null },
  perAnimal: 50_000,
};

describe("갈래", () => {
  it("대분류로 갈래를 정한다", () => {
    expect(kindOfCategory("일반독성")).toBe("tox");
    expect(kindOfCategory("효력시험(약효)")).toBe("pd");
    expect(kindOfCategory("PK/TK/ADME·생체시료분석")).toBe("pk");
    expect(kindOfCategory("조제물분석")).toBe("other");
    expect(kindOfCategory("기타(임상병리·조직병리 등)")).toBe("other");
  });
  it("예전 견적서(kind 없음)는 대분류로 본다", () => {
    expect(testKind({ category: "효력시험(약효)" })).toBe("pd");
    expect(testKind({ kind: "other", category: "" })).toBe("other");
  });
});

describe("효력 비용 다섯 칸", () => {
  it("표준 그대로면 기준가 합", () => {
    const parts = pdParts(pd, pd);
    expect(parts.reduce((a, p) => a + p.amount, 0)).toBe(22_600_000);
    expect(parts.every((p) => !p.changed)).toBe(true);
  });
  it("군이 늘면 군당 금액이 있는 칸만 늘고, 새 군은 표준 마릿수로 본다", () => {
    const cur = { ...pd, groups: [...pd.groups, { id: "g5", label: "시험물질군 고", role: "test" as const, treat: "", n: 8, dose: "" }] };
    const parts = pdParts(cur, pd);
    expect(parts.find((p) => p.key === "cost_dosing")?.amount).toBe(5_000_000);
    expect(parts.find((p) => p.key === "cost_path")?.amount).toBe(6_000_000);
    expect(parts.find((p) => p.key === "cost_animal")?.amount).toBe(7_200_000);
    expect(parts.reduce((a, p) => a + p.amount, 0)).toBe(24_800_000);
  });
  it("동물 수가 늘면 동물 칸에 마리당 금액", () => {
    const cur = { ...pd, groups: pd.groups.map((g) => ({ ...g, n: 10 })) };
    expect(pdParts(cur, pd).find((p) => p.key === "cost_animal")?.amount).toBe(7_200_000 + 8 * 50_000);
  });
  it("직접 고친 칸은 그 금액", () => {
    const cur = { ...pd, override: { cost_eval: 3_000_000 } };
    const p = pdParts(cur, pd).find((x) => x.key === "cost_eval");
    expect(p?.amount).toBe(3_000_000);
    expect(p?.adj).toBe("직접 고침");
  });
});

describe("시험 목록 → 견적서", () => {
  it("효력: 시험 목록 설계가 없으면 기존 칸으로 틀을 만들고, 숫자는 비워 둔다", () => {
    const d = pdFrom({ ...base({}), extra: { induction: "DSS 3% 음수 7일", positiveControl: "설파살라진" } });
    expect(d.groups.map((g) => g.role)).toEqual(["normal", "vehicle", "positive", "test"]);
    expect(d.groups[0].n).toBe(8);
    expect(Object.values(d.costs).every((v) => v == null)).toBe(true);
    expect(kindStdPrice("pd", { pd: d })).toBeNull();
  });
  it("효력: 견적서 금액 = 비용 다섯 칸 + 달라진 곳", () => {
    const t = testFromCatalog(base({ kd: { pd } }), []);
    expect(t.kind).toBe("pd");
    expect(t.std.price).toBe(22_600_000);
    expect(testLines(t).total).toBe(22_600_000);
    const more: DocTest = { ...t, kd: { pd: { ...t.kd!.pd!, groups: [...t.kd!.pd!.groups, { id: "n1", label: "시험물질군 고", role: "test", treat: "", n: 8, dose: "" }] } } };
    const c = testLines(more);
    expect(c.total).toBe(24_800_000);
    expect(c.lines.map((l) => l.label)).toEqual(["투여·관찰 · 4군 → 5군", "병리 · 4군 → 5군"]);
  });
  it("약동학: 검체 수 = 마리 × 시점 × 검체 종류, 분석법 개발은 고를 때만", () => {
    const pk = { types: ["단회 PK"], groups: [{ id: "a", label: "정맥군", route: "정맥", dose: "1", n: 3 }, { id: "b", label: "경구군", route: "경구", dose: "10", n: 3 }], times: ["5분", "15분", "30분", "1시간", "2시간", "4시간", "8시간", "24시간"], matrix: ["혈장"], method: "dev" as const, params: [], animal: 6_000_000, perSample: 45_000, dev: 6_000_000, report: 2_500_000 };
    expect(pkSamples(pk)).toBe(48);
    const t = testFromCatalog(base({ category: "PK/TK/ADME·생체시료분석", unit: "per_sample", kd: { pk } }), []);
    expect(t.std.price).toBe(8_500_000);
    expect(testLines(t).total).toBe(6_000_000 + 2_500_000 + 48 * 45_000 + 6_000_000);
    expect(testLines({ ...t, kd: { pk: { ...pk, method: "have" } } }).total).toBe(6_000_000 + 2_500_000 + 48 * 45_000);
  });
  it("약동학: 설계가 없으면 시험 목록 검체당 단가만 가져온다", () => {
    const t = testFromCatalog(base({ category: "PK/TK/ADME·생체시료분석", unit: "per_sample", std_price: 45_000 }), []);
    expect(t.kd?.pk?.perSample).toBe(45_000);
    expect(t.kd?.pk?.groups).toEqual([]);
  });
  it("개별 분석: 검체 수 × 검체당 단가 + 접수·보고서", () => {
    const t = testFromCatalog(base({ category: "기타(임상병리·조직병리 등)", unit: "per_sample", kd: { other: { sample: "랫드 간", n: 40, perSample: 60_000, setup: 300_000, report: 800_000 } } }), []);
    expect(testLines(t).total).toBe(40 * 60_000 + 1_100_000);
  });
  it("독성은 그대로 (kd 없음)", () => {
    const t = testFromCatalog(base({ category: "일반독성", std_price: 1000 }), []);
    expect(t.kd).toBeUndefined();
    expect(testLines(t).total).toBe(1000);
  });
});

describe("저장 값 정리", () => {
  it("견적서 저장·불러오기에서 갈래 설계와 원안, 고친 이유가 남는다", () => {
    const t = testFromCatalog(base({ kd: { pd } }), []);
    const data: DocData = { tests: [{ ...t, orig: { lines: [["군 구성", "5군, 군당 8마리"]], groups: 5, perGroup: 8 }, why: "용량 반응을 보려고", asks: ["투여 시작일", " "] }], visible: { perTest: true, adjust: true, formula: false }, discount: 0, terms: { pay: "", extra: "", note: "" }, glp: "" };
    const back = cleanDocData(JSON.parse(JSON.stringify(data)));
    expect(back.tests[0].kind).toBe("pd");
    expect(back.tests[0].kd?.pd?.groups.length).toBe(4);
    expect(back.tests[0].std.kd?.pd?.costs.cost_path).toBe(4_800_000);
    expect(back.tests[0].orig?.groups).toBe(5);
    expect(back.tests[0].why).toBe("용량 반응을 보려고");
    expect(back.tests[0].asks).toEqual(["투여 시작일"]);
    expect(docTotals(back).sum).toBe(22_600_000);
  });
  it("잘못된 값은 버린다", () => {
    expect(cleanKd({ pd: { groups: [{ role: "x", n: -3 }], costs: { cost_animal: "abc" } } })?.pd?.groups[0]).toMatchObject({ role: "test", n: 0 });
    expect(cleanKd(null)).toBeUndefined();
  });
});

describe("의뢰자 원안 읽기", () => {
  it("군 수·군당 마릿수", () => {
    expect(parseGroups("5군, 군당 8마리")).toEqual({ groups: 5, perGroup: 8 });
    expect(parseGroups("모름")).toEqual({});
  });
  it("채혈 시점 수", () => {
    expect(parseTimes("0.5, 1, 2, 4, 8, 24h · 총 6회")).toBe(6);
    expect(parseTimes("0.5, 1, 2, 4h")).toBe(4);
  });
  it("시료 수", () => {
    expect(parseCount("랫드 혈청, 40개")).toBe(40);
  });
});

describe("변경 수와 회신 칸", () => {
  it("표준 그대로면 변경 0, 군이 늘면 달라진 칸 수", () => {
    const t = testFromCatalog(base({ kd: { pd } }), []);
    expect(testLines(t).changes).toBe(0);
    const more: DocTest = { ...t, kd: { pd: { ...pd, groups: [...pd.groups, { id: "n1", label: "시험물질군 고", role: "test", treat: "", n: 8, dose: "" }] } } };
    expect(testLines(more).changes).toBe(2);
  });
  it("약동학: 검체 분석 금액만으로는 변경이 아니고, 시점이 줄면 변경", () => {
    const pk = { types: [], groups: [{ id: "a", label: "경구군", route: "", dose: "", n: 3 }], times: ["1시간", "2시간"], matrix: ["혈장"], method: "" as const, params: [], animal: 1_000_000, perSample: 40_000, dev: null, report: 500_000 };
    const t = testFromCatalog(base({ category: "PK/TK/ADME·생체시료분석", unit: "per_sample", kd: { pk } }), []);
    expect(testLines(t).changes).toBe(0);
    expect(testLines({ ...t, kd: { pk: { ...pk, times: ["1시간"] } } }).changes).toBe(1);
  });
  it("효력 회신 칸: 비용 다섯 칸과 군·일정·지표", () => {
    const x = kdExtra("pd", { pd: { ...pd, lanes: [{ id: "l", name: "투여", start: 1, weeks: 2 }] } });
    expect(x.cost_path).toBe("4800000");
    expect(x.exp_groups).toBe("정상군 8, 부형제군 8, 양성대조군 8, 시험물질군 8");
    expect(x.exp_schedule).toBe("투여 2주");
    expect(x.exp_endpoints).toBe("DAI");
  });
  it("금액 칸이 비어 있으면 0원으로 채우지 않는다", () => {
    expect(kdExtra("pd", { pd: { ...pd, costs: { cost_animal: null, cost_dosing: null, cost_eval: null, cost_path: null, cost_report: null } } }).cost_animal).toBeUndefined();
  });
  it("시험 목록으로 바로 회신할 때도 기관 표준 설계가 초안에 들어간다", () => {
    const row = { seq: 1, category: "효력시험(약효)", name: "소화기", cond: "" };
    const p = prefillRow(row, { row: base({ kd: { pd }, std_price: 22_600_000, price_min: 22_600_000 }), mismatch: [] }, {});
    const ex = p.design.extra as Record<string, string>;
    expect(ex.cost_animal).toBe("7200000");
    expect(ex.exp_groups).toContain("양성대조군 8");
    expect(p.amount).toBe("22600000");
  });
});
