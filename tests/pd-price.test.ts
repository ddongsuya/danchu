import { describe, expect, it } from "vitest";
import { pdPrice, pdPriceDiff, type PriceGroup, type PriceUse } from "@/lib/pd-price";
import { parseItem, parseMargin, parsePrice, previewImport, type PriceItem } from "@/lib/price-book";

// 효력시험 견적 툴 시안(2026-11-18)의 예시 단가. 실제 기관 단가가 아니다
const item = (id: string, category: PriceItem["category"], name: string, unit: PriceItem["unit"], price: number): PriceItem => ({ id, category, name, attrs: {}, unit, price, memo: "", sort: 0, archived: false });
const ITEMS: PriceItem[] = [
  item("c57", "animal", "C57BL/6 마우스", "head", 38_000),
  item("house", "housing", "마우스 사육", "head_day", 2_500),
  item("dss", "model", "DSS 음수 유발", "head", 20_000),
  item("po", "dosing", "경구 투여", "head_time", 3_000),
  item("pc", "dosing", "양성대조물질 구입", "lot", 400_000),
  item("bw", "observe", "체중 측정", "head_time", 500),
  item("dai", "observe", "질환 활성 점수(DAI)", "head_time", 1_500),
  item("colon", "observe", "대장 길이 측정", "head", 5_000),
  item("necro", "observe", "부검", "head", 20_000),
  item("elisa", "molecular", "사이토카인 ELISA", "sample_item", 30_000),
  item("he", "pathology", "H&E 염색", "head", 60_000),
  item("read", "pathology", "판독·병리 보고", "lot", 2_000_000),
  item("rep", "report", "최종 보고서", "lot", 3_000_000),
];
const USES: PriceUse[] = [
  { itemId: "c57", who: "all", times: 1, per: 1 },
  { itemId: "house", who: "all", times: 17, per: 1 },
  { itemId: "dss", who: "induced", times: 1, per: 1 },
  { itemId: "po", who: "dosed", times: 10, per: 1 },
  { itemId: "pc", who: "none", times: 1, per: 1 },
  { itemId: "bw", who: "all", times: 11, per: 1 },
  { itemId: "dai", who: "all", times: 11, per: 1 },
  { itemId: "colon", who: "all", times: 1, per: 1, bucket: "cost_eval" },
  { itemId: "necro", who: "all", times: 1, per: 1, bucket: "cost_path" },
  { itemId: "he", who: "all", times: 1, per: 1 },
  { itemId: "read", who: "none", times: 1, per: 1 },
  { itemId: "rep", who: "none", times: 1, per: 1 },
];
const groups = (roles: PriceGroup["role"][], n: number): PriceGroup[] => roles.map((role, i) => ({ id: `G${i + 1}`, role, n }));
const STD = groups(["normal", "vehicle", "positive", "test", "test"], 8);
const CUR = groups(["normal", "vehicle", "positive", "test", "test", "test"], 10);

describe("효력 금액 계산 (시안 예시 검산)", () => {
  it("표준 설계 5군 × 8마리 = 표준가 16,675,000", () => {
    const r = pdPrice(STD, USES, ITEMS, 15);
    expect(r.sum).toBe(14_500_000);
    expect(r.margin).toBe(2_175_000);
    expect(r.total).toBe(16_675_000);
    expect(r.lines.find((l) => l.itemId === "house")?.formula).toBe("40마리 × 17일 × 2,500");
    expect(r.lines.find((l) => l.itemId === "dss")?.usage).toBe(32);
    expect(r.lines.find((l) => l.itemId === "po")?.usage).toBe(320);
  });

  it("의뢰자 설계 6군 × 10마리 + ELISA 3종 = 28,232,500, 비용 내역 다섯 칸", () => {
    const r = pdPrice(CUR, [...USES, { itemId: "elisa", who: "all", times: 1, per: 3 }], ITEMS, 15);
    expect(r.sum).toBe(24_550_000);
    expect(r.total).toBe(28_232_500);
    expect(r.buckets).toEqual({ cost_animal: 6_704_500, cost_dosing: 3_703_000, cost_eval: 6_555_000, cost_path: 7_820_000, cost_report: 3_450_000 });
    expect(Object.values(r.buckets).reduce((a, b) => a + b, 0)).toBe(r.total);
  });

  it("표준 대비 바뀐 곳만 장부에", () => {
    const std = pdPrice(STD, USES, ITEMS, 15);
    const cur = pdPrice(CUR, [...USES, { itemId: "elisa", who: "all", times: 1, per: 3 }], ITEMS, 15);
    const d = pdPriceDiff(std, cur);
    expect(d.totalDelta).toBe(11_557_500);
    expect(d.sumDelta).toBe(10_050_000);
    expect(d.lines.find((l) => l.itemId === "elisa")).toMatchObject({ before: 0, after: 5_400_000, usageAfter: 180 });
    expect(d.lines.find((l) => l.itemId === "house")).toMatchObject({ usageBefore: 680, usageAfter: 1_020, delta: 850_000 });
    expect(d.lines.some((l) => l.itemId === "rep")).toBe(false);
  });

  it("단가표에 없는 항목은 금액을 짐작하지 않는다", () => {
    const r = pdPrice(STD, [{ itemId: "nope", who: "all", times: 1, per: 1 }], ITEMS, 15);
    expect(r.missing).toBe(1);
    expect(r.total).toBe(0);
  });

  it("끝자리는 마지막 묶음에 맞춰 합계와 같다", () => {
    const r = pdPrice(groups(["normal", "test"], 3), [{ itemId: "c57", who: "all", times: 1, per: 1 }, { itemId: "rep", who: "none", times: 1, per: 1 }], ITEMS, 7.33);
    expect(Object.values(r.buckets).reduce((a, b) => a + b, 0)).toBe(r.total);
  });
});

describe("단가표 입력 검사", () => {
  it("금액은 숫자·쉼표·원만", () => {
    expect(parsePrice("38,000")).toBe(38_000);
    expect(parsePrice("38000원")).toBe(38_000);
    expect(parsePrice(2500)).toBe(2500);
    for (const bad of ["약 4만", "3.8만", "38000~40000", "38,00", -1, 1.5, ""]) expect(parsePrice(bad)).toBeNull();
  });

  it("분류에 맞는 단위만, 모르는 칸은 버린다", () => {
    expect(parseItem({ category: "animal", name: "BALB/c nude", unit: "head_day", price: 1 })).toMatchObject({ ok: false });
    const p = parseItem({ category: "animal", name: "BALB/c nude", unit: "head", price: "45,000", attrs: { strain: "BALB/c nude", sex: "암컷", hack: "x" } });
    expect(p).toEqual({ ok: true, value: { category: "animal", name: "BALB/c nude", unit: "head", price: 45_000, memo: "", attrs: { strain: "BALB/c nude", sex: "암컷" } } });
  });

  it("관리비·이익 %", () => {
    expect(parseMargin("15%")).toBe(15);
    expect(parseMargin(12.345)).toBe(12.35);
    expect(parseMargin(-1)).toBeNull();
    expect(parseMargin("x")).toBeNull();
  });

  it("가져오기 미리보기: 새 항목·바뀜·그대로·오류", () => {
    const rows = [
      { category: "animal", name: "C57BL/6 마우스", unit: "head", price: "40,000" },
      { category: "housing", name: "마우스 사육", unit: "head_day", price: 2500 },
      { category: "animal", name: "SD 랫드", unit: "head", price: 26_000 },
      { category: "animal", name: "SD 랫드", unit: "head", price: 27_000 },
      { category: "animal", name: "Wistar", unit: "head", price: "약 3만" },
      "x",
    ];
    const p = previewImport(rows, ITEMS);
    expect(p.map((r) => r.status)).toEqual(["changed", "same", "new", "error", "error", "error"]);
    expect(p[0]).toMatchObject({ id: "c57", before: 38_000 });
  });
});

describe("모델 표준 저장 칸 (0047)", () => {
  it("cleanKd 가 일 단위 스키마·평가항목·사용량을 남기고 이상한 값은 버린다", async () => {
    const { cleanKd } = await import("@/lib/kind-design");
    const kd = cleanKd({ pd: {
      model: "DSS", induction: "", groups: [{ id: "g1", label: "정상군", role: "normal", treat: "", n: 8, dose: "", induce: "없음" }], lanes: [], endpoints: [], costs: {}, perGroup: {},
      days: [{ id: "d1", name: "순화", from: -1, to: -7, mark: "bar" }, { name: "x", from: 0, to: 0, mark: "zzz" }],
      evals: [{ item: "체중", when: "D0~D10", freq: "하루 1회", method: "전자저울", target: "전 군" }, { item: "" }],
      uses: [{ itemId: "c57", who: "all", times: 1, per: 1, label: "동물" }, { itemId: "", who: "all" }, { itemId: "po", who: "boss", times: -3, per: 0, bucket: "nope" }],
      brief: { animal: "C57BL/6", dosing: 3, period: "" },
    } });
    const pd = kd!.pd!;
    expect(pd.days?.[0]).toMatchObject({ from: -7, to: -1, mark: "bar" });
    expect(pd.days?.[1].mark).toBe("bar");
    expect(pd.evals).toHaveLength(1);
    expect(pd.uses).toEqual([{ itemId: "c57", who: "all", times: 1, per: 1, label: "동물" }, { itemId: "po", who: "all", times: 1, per: 1 }]);
    expect(pd.brief).toEqual({ animal: "C57BL/6", dosing: "", period: "" });
    expect(pd.groups[0].induce).toBe("없음");
  });

  it("pdStdPrice: 사용량 규칙이 없으면 null, 있으면 단가표로 계산", async () => {
    const { pdStdPrice } = await import("@/lib/pd-price");
    const base = { model: "", induction: "", groups: STD.map((g) => ({ id: g.id, label: g.id, role: g.role, treat: "", n: g.n, dose: "" })), lanes: [], endpoints: [], costs: { cost_animal: null, cost_dosing: null, cost_eval: null, cost_path: null, cost_report: null }, perGroup: { cost_animal: null, cost_dosing: null, cost_eval: null, cost_path: null, cost_report: null }, perAnimal: null };
    expect(pdStdPrice(base, ITEMS, 15)).toBeNull();
    expect(pdStdPrice({ ...base, uses: USES }, ITEMS, 15)?.total).toBe(16_675_000);
  });
});
