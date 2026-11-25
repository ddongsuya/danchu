import { describe, expect, it } from "vitest";
import { catalogItems, itemKey, newVariant, type CatalogRow } from "@/lib/catalog";
import { cleanKd } from "@/lib/kind-design";
import type { PriceItem } from "@/lib/price-book";
import { standardGroups, testFromCatalog, testLines, type Rate } from "@/lib/quote-doc";
import { animalPriceFor, fillToxRates, toxBookRates } from "@/lib/tox-price";

// 계산 확인용 가상의 값 (어느 기관의 실제 단가도 아니다)
const I = (id: string, attrs: Record<string, string>, price: number, name: string, extra: Partial<PriceItem> = {}): PriceItem => ({
  id, category: "animal", name, attrs, unit: "head", price, memo: "", sort: 0, archived: false, ...extra,
});
const BOOK: PriceItem[] = [
  I("a1", { species: "랫드", strain: "SD", sex: "수컷", weeks: "7" }, 26_000, "랫드 SD 수컷 7주"),
  I("a2", { species: "랫드", strain: "SD", sex: "암컷", weeks: "7" }, 28_000, "랫드 SD 암컷 7주"),
  I("a3", { species: "마우스", strain: "ICR" }, 9_000, "마우스 ICR"),
  I("a4", { species: "개", strain: "비글" }, 1_800_000, "개 비글"),
  I("a5", { species: "토끼" }, 150_000, "토끼"),
  I("h1", { species: "랫드" }, 4_000, "랫드 SPF", { category: "housing", unit: "head_day" }),
];

const items = new Map(catalogItems().map((it) => [it.key, it]));
const tox = (p: Partial<CatalogRow>): CatalogRow => ({
  ...newVariant(items.get(itemKey("일반독성", "반복투여 4주"))!, { species: ["SD 랫드"], groups_ctrl: 1, groups_test: 3, per_sex: 10, recovery_weeks: 2, recovery_per_sex: 5, std_price: 60_000_000, ...p }),
  id: "00000000-0000-4000-8000-000000000001",
});
const rates = (add: number | null): Rate[] => [
  { id: "animal", kind: "animal", label: "본시험 동물 수", unit: "마리", add, deduct: null, shown: "동물 수 추가 / 차감" },
  { id: "recovery", kind: "recovery", label: "회복군", unit: "마리", add: null, deduct: null, shown: "회복군 추가 / 제외" },
  { id: "group", kind: "group", label: "투여군", unit: "군", add: null, deduct: null, shown: "투여군 추가 / 제외" },
];

describe("단가표 동물 단가 찾기", () => {
  it("계통까지 맞는 줄, 여러 줄이면 첫 줄", () => {
    expect(animalPriceFor(BOOK, "SD 랫드")?.id).toBe("a1");
    expect(animalPriceFor(BOOK, "ICR 마우스")?.price).toBe(9_000);
    expect(animalPriceFor(BOOK, "비글")?.price).toBe(1_800_000);
  });
  it("계통 없이 종만 적은 단가는 종으로 맞춘다", () => {
    expect(animalPriceFor(BOOK, "NZW 토끼")?.id).toBe("a5");
  });
  it("동물 분류가 아니거나 숨긴 항목, 없는 동물종은 쓰지 않는다", () => {
    expect(animalPriceFor(BOOK, "미니피그")).toBeNull();
    expect(animalPriceFor([{ ...BOOK[0], archived: true }], "SD 랫드")).toBeNull();
    expect(animalPriceFor([BOOK[5]], "SD 랫드")).toBeNull();
    expect(animalPriceFor(BOOK, "")).toBeNull();
  });
});

describe("독성 동물 단가 채우기", () => {
  it("본시험 동물·회복군의 빈 추가 단가만 채우고 투여군은 그대로", () => {
    const out = fillToxRates(rates(null), ["SD 랫드"], BOOK);
    expect(out.map((r) => r.add)).toEqual([26_000, 26_000, null]);
    expect(out[0].deduct).toBeNull();
  });
  it("기관이 적은 단가는 건드리지 않는다", () => {
    const out = fillToxRates(rates(500_000), ["SD 랫드", "ICR 마우스"], BOOK);
    expect(out[0]).toEqual(rates(500_000)[0]);
  });
  it("대표가 아닌 동물종은 동물종별 칸에, 대표와 같은 금액이면 칸을 만들지 않는다", () => {
    const out = fillToxRates(rates(null), ["SD 랫드", "ICR 마우스", "Wistar 랫드"], BOOK);
    expect(out[0].bySpecies).toEqual({ "ICR 마우스": { add: 9_000, deduct: null } });
  });
  it("동물종별 칸에 적은 금액은 그대로", () => {
    const r = [{ ...rates(null)[0], bySpecies: { "ICR 마우스": { add: 12_000, deduct: 10_000 } } }];
    expect(fillToxRates(r, ["SD 랫드", "ICR 마우스"], BOOK)[0].bySpecies).toEqual({ "ICR 마우스": { add: 12_000, deduct: 10_000 } });
  });
});

describe("견적서 단가 (설정 켜고 끄기)", () => {
  const row = tox({});
  it("꺼져 있으면 그대로", () => {
    const m = new Map([[row.item_key, rates(null)]]);
    expect(toxBookRates(m, [row], { items: BOOK, applyTox: false }).get(row.item_key)).toEqual(rates(null));
    expect(toxBookRates(m, [row], null).get(row.item_key)).toEqual(rates(null));
  });
  it("단가를 저장하지 않은 군 구성 시험도 기본 줄부터 채운다", () => {
    const got = toxBookRates(new Map(), [row], { items: BOOK, applyTox: true }).get(row.item_key)!;
    expect(got.find((r) => r.kind === "animal")?.add).toBe(26_000);
  });
  it("효력·군 없는 독성 시험은 채우지 않는다", () => {
    const ames = { ...tox({ groups_ctrl: null, groups_test: null }), item_key: itemKey("유전독성", "복귀돌연변이(Ames, TG 471)"), category: "유전독성" };
    const pd = { ...tox({}), item_key: "효력시험(약효)::대장", category: "효력시험(약효)" };
    const m = toxBookRates(new Map(), [ames, pd], { items: BOOK, applyTox: true });
    expect(m.size).toBe(0);
  });
  it("채운 단가로 견적서 동물 수 추가가 계산된다", () => {
    const filled = toxBookRates(new Map(), [row], { items: BOOK, applyTox: true }).get(row.item_key)!;
    const t = testFromCatalog(row, filled);
    const more = { ...t, groups: t.groups.map((g) => ({ ...g, m: g.m + 1, f: g.f + 1 })) };
    const l = testLines(more);
    expect(l.lines.find((x) => x.kind === "animal")?.amount).toBe(8 * 26_000);
    expect(l.total).toBe(60_000_000 + 8 * 26_000);
  });
});

describe("독성 표준 설계 (군 이름·용량·회복)", () => {
  const kd = cleanKd({ tox: { groups: [{ label: "부형제 대조군", dose: "0 mg/kg" }, { label: "저용량", dose: "100 mg/kg" }, { label: "중용량", dose: "300 mg/kg", rec: true }, { label: "고용량", dose: "1000 mg/kg" }] } });
  it("저장한 이름·용량·회복 여부를 같은 번째 군에 쓴다", () => {
    const g = standardGroups(tox({ kd }));
    expect(g.map((x) => x.label)).toEqual(["G1 부형제 대조군", "G2 저용량", "G3 중용량", "G4 고용량"]);
    expect(g.map((x) => x.dose)).toEqual(["0 mg/kg", "100 mg/kg", "300 mg/kg", "1000 mg/kg"]);
    // G3 에 회복을 켰다. 나머지는 기본 규칙(대조군·최고용량군)
    expect(g.map((x) => x.rm)).toEqual([5, 0, 5, 5]);
  });
  it("군이 저장한 줄보다 많으면 남는 군은 기본 이름", () => {
    const g = standardGroups(tox({ kd, groups_test: 4 }));
    expect(g[4].label).toBe("G5 시험군 4");
    expect(g[4].dose).toBe("");
  });
  it("견적서 새 시험이 기관 표준 설계에서 시작한다", () => {
    const t = testFromCatalog(tox({ kd }), rates(600_000));
    expect(t.groups[1]).toMatchObject({ label: "G2 저용량", dose: "100 mg/kg", m: 10, f: 10 });
    expect(t.std.groups[2].rm).toBe(5);
    // 독성은 갈래 설계(kd)를 견적서에 붙이지 않는다 (금액은 군 구성·단가로)
    expect(t.kd).toBeUndefined();
    expect(testLines(t).total).toBe(60_000_000);
  });
  it("빈 독성 설계는 저장하지 않는다", () => {
    expect(cleanKd({ tox: { groups: [{ label: "", dose: "" }] } })).toBeUndefined();
    expect(cleanKd({ tox: { groups: [{ label: "x".repeat(80), dose: 3 }] } })?.tox?.groups[0]).toEqual({ label: "x".repeat(40), dose: "" });
  });
});
