import { describe, expect, it } from "vitest";
import {
  addDays,
  cleanDocData,
  cleanRates,
  docTitle,
  docTotals,
  dosingWeeks,
  inkOn,
  nextDocNo,
  scheduleWeeks,
  standardGroups,
  testFromCatalog,
  testLines,
  type DocData,
  type Rate,
} from "@/lib/quote-doc";
import type { CatalogRow } from "@/lib/catalog";
import { workbook, zip } from "@/lib/xlsx";
import { docSheets } from "@/lib/quote-doc-xlsx";

// 계산 확인용 가상의 값 (어느 기관의 실제 단가도 아니다)
const row: CatalogRow = {
  id: "00000000-0000-0000-0000-000000000001",
  item_key: "tox.repeat",
  category: "일반독성",
  item: "반복투여 독성",
  available: true,
  glp: "GLP",
  species: ["SD rat"],
  route: "경구",
  method: "식약처 독성시험기준",
  groups_ctrl: 1,
  groups_test: 3,
  per_sex: 10,
  recovery_weeks: 4,
  recovery_per_sex: 5,
  dosing: "13주, 1일 1회",
  weeks: 30,
  includes: ["일반증상", "체중", "혈액학"],
  options: [{ name: "TK 분석", amount: 7_000_000 }],
  unit: "total",
  price_min: null,
  price_max: null,
  extra: {},
  note: null,
  last_amount: null,
  last_weeks: null,
  last_quoted_at: null,
  std_price: 168_000_000,
} as CatalogRow;

const rates: Rate[] = [
  { id: "animal", kind: "animal", label: "본시험 동물 수", unit: "마리", add: 600_000, deduct: 400_000, shown: "동물 수 추가 / 차감" },
  { id: "recovery", kind: "recovery", label: "회복군", unit: "마리", add: 900_000, deduct: null, shown: "회복군 추가 / 제외" },
  { id: "group", kind: "group", label: "투여군", unit: "군", add: 4_200_000, deduct: 3_000_000, shown: "투여군 추가 / 제외" },
  { id: "q1", kind: "qty", label: "추가 장기", unit: "장기", add: 150_000, deduct: null, shown: "장기 추가" },
];

describe("표준 설계", () => {
  it("대조군 1 + 시험군 3, 회복은 G1·G4", () => {
    const g = standardGroups(row);
    expect(g.map((x) => x.label)).toEqual(["G1 대조군", "G2 저용량군", "G3 중용량군", "G4 고용량군"]);
    expect(g.map((x) => x.rm)).toEqual([5, 0, 0, 5]);
  });
  it("투여 주수 읽기", () => {
    expect(dosingWeeks("13주, 1일 1회")).toBe(13);
    expect(dosingWeeks("28일")).toBe(4);
    expect(dosingWeeks("1일 1회")).toBeNull();
  });
});

describe("testLines: 표준가 + 달라진 곳", () => {
  it("표준 그대로면 표준가 하나", () => {
    const t = testFromCatalog(row, rates);
    const r = testLines(t);
    expect(r.total).toBe(168_000_000);
    expect(r.lines).toHaveLength(0);
    expect(t.title).toBe("반복투여 독성 (13주, 1일 1회)");
  });

  it("동물 +2마리/성, 회복군 1군, 투여군 2군 추가 = 1억 9,500만 원", () => {
    const t = testFromCatalog(row, rates);
    t.groups = t.groups.map((g) => ({ ...g, m: g.m + 2, f: g.f + 2 }));
    t.groups[1] = { ...t.groups[1], rm: 5, rf: 5 };
    t.groups.push({ id: "g5", label: "G5 시험군", dose: "", m: 10, f: 10, rm: 0, rf: 0 });
    t.groups.push({ id: "g6", label: "G6 시험군", dose: "", m: 10, f: 10, rm: 0, rf: 0 });
    const r = testLines(t);
    const by = Object.fromEntries(r.lines.map((l) => [l.kind, l.amount]));
    expect(by.group).toBe(8_400_000);
    expect(by.animal).toBe(9_600_000);
    expect(by.recovery).toBe(9_000_000);
    expect(r.total).toBe(195_000_000);
  });

  it("차감 단가가 비어 있으면 줄여도 금액이 줄지 않는다", () => {
    const t = testFromCatalog(row, rates);
    t.groups = t.groups.map((g) => ({ ...g, rm: 0, rf: 0 }));
    const r = testLines(t);
    expect(r.lines.find((l) => l.kind === "recovery")?.amount).toBe(0);
    expect(r.total).toBe(168_000_000);
  });

  it("평가항목·수량·직접 입력 줄", () => {
    const t = testFromCatalog(row, rates);
    const tk = t.evals.find((e) => e.name === "TK 분석");
    expect(tk?.on).toBe(false);
    tk!.on = true;
    t.qty.q1 = 4;
    t.extras.push({ id: "e1", label: "시험물질 분석", amount: 2_000_000 });
    expect(testLines(t).total).toBe(168_000_000 + 7_000_000 + 600_000 + 2_000_000);
  });
});

describe("견적서 합계", () => {
  it("할인 뒤 공급가액, 부가세는 원 미만 버림", () => {
    const t = testFromCatalog(row, rates);
    t.std.price = 1_234_567;
    const d: DocData = { tests: [t], visible: { perTest: true, adjust: true, formula: false }, discount: 34_567, terms: { pay: "", extra: "", note: "" }, glp: "GLP" };
    const x = docTotals(d);
    expect(x.supply).toBe(1_200_000);
    expect(x.vat).toBe(120_000);
    expect(x.grand).toBe(1_320_000);
  });
  it("할인은 합계를 넘지 않는다", () => {
    const t = testFromCatalog(row, rates);
    const d: DocData = { tests: [t], visible: { perTest: true, adjust: true, formula: false }, discount: 999_000_000, terms: { pay: "", extra: "", note: "" }, glp: "" };
    expect(docTotals(d).supply).toBe(0);
  });
  it("제목과 일정 길이", () => {
    const a = testFromCatalog(row, rates);
    const b = testFromCatalog({ ...row, item: "단회투여 독성", dosing: null, weeks: 8 } as CatalogRow, rates);
    b.startWeek = 2;
    const d: DocData = { tests: [a, b], visible: { perTest: true, adjust: true, formula: false }, discount: 0, terms: { pay: "", extra: "", note: "" }, glp: "" };
    expect(docTitle(d)).toBe("반복투여 독성 (13주, 1일 1회) 외 1건");
    expect(scheduleWeeks(d)).toBe(30);
  });
});

describe("저장 값 정리", () => {
  it("이상한 값은 버리고 기본값으로", () => {
    const d = cleanDocData({ tests: [{ title: "", groups: [{ m: "abc", f: 5000 }], qty: { nope: 3 }, rates: [{ kind: "bad" }], phases: [{ kind: "x", weeks: 0 }] }], discount: -5, visible: { formula: "yes" } });
    const t = d.tests[0];
    expect(t.title).toBe("시험");
    expect(t.groups[0].m).toBe(0);
    expect(t.groups[0].f).toBe(999);
    expect(t.qty).toEqual({});
    expect(t.rates).toEqual([]);
    expect(t.phases[0]).toMatchObject({ kind: "run", weeks: 1 });
    expect(d.discount).toBe(0);
    expect(d.visible).toEqual({ perTest: true, adjust: true, formula: false });
  });
  it("자동 계산 단가는 종류마다 하나", () => {
    const r = cleanRates([{ kind: "animal", add: 1 }, { kind: "animal", add: 2 }, { kind: "flat", add: "3", deduct: 9 }]);
    expect(r).toHaveLength(2);
    expect(r[0].add).toBe(1);
    expect(r[1]).toMatchObject({ kind: "flat", add: 3, deduct: null });
  });
  it("한 번 저장한 값은 다시 정리해도 같다", () => {
    const t = testFromCatalog(row, rates);
    const d: DocData = { tests: [t], visible: { perTest: false, adjust: true, formula: true }, discount: 1000, terms: { pay: "착수 50%", extra: "", note: "" }, glp: "GLP" };
    expect(cleanDocData(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });
});

describe("번호·날짜·색", () => {
  it("견적번호는 그 달 순번", () => {
    expect(nextDocNo("2026-11-06", [])).toBe("Q-2611-001");
    expect(nextDocNo("2026-11-06", ["Q-2611-001", "Q-2611-009", "Q-2610-020"])).toBe("Q-2611-010");
  });
  it("날짜 더하기", () => {
    expect(addDays("2026-11-06", 30)).toBe("2026-12-06");
    expect(addDays("2026-12-20", 30)).toBe("2027-01-19");
  });
  it("브랜드 색 위 글자색", () => {
    expect(inkOn("#edef5c")).toBe("#1b1b19");
    expect(inkOn("#1f3a5f")).toBe("#f4f4f0");
    expect(inkOn("nope")).toBe("#f4f4f0");
  });
});

describe("엑셀 파일", () => {
  it("zip 구조와 시트 세 개", () => {
    const t = testFromCatalog(row, rates);
    const d: DocData = { tests: [t], visible: { perTest: true, adjust: true, formula: false }, discount: 0, terms: { pay: "", extra: "", note: "" }, glp: "GLP" };
    const head = { id: "x", docNo: "Q-2611-001", title: "견적서", client: "의뢰 기관", substance: "시험물질", issuedOn: "2026-11-06", validUntil: "2026-12-06", inviteId: null, rfqNo: null, status: "draft", supply: 0, memo: "", updatedAt: "" };
    const sheets = docSheets(head as never, d, { brandColor: null, logo: null, logoPos: "left", supplier: { name: "", address: "", contact: "", person: "", email: "" }, terms: { pay: "", extra: "", note: "" } });
    expect(sheets.map((s) => s.name)).toEqual(["견적서", "시험 상세", "일정표"]);
    const bytes = workbook(sheets);
    // PK\x03\x04 로 시작하고 끝에 중앙 디렉터리 끝 표식(PK\x05\x06)이 있다
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const tail = bytes.slice(bytes.length - 22, bytes.length - 18);
    expect([...tail]).toEqual([0x50, 0x4b, 0x05, 0x06]);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain("xl/workbook.xml");
    expect(text).toContain("168000000");
  });
  it("zip 빈 파일도 만든다", () => {
    expect(zip([{ name: "a.txt", data: new Uint8Array() }]).length).toBeGreaterThan(22);
  });
});
