import { describe, expect, it } from "vitest";
import { compareIncl, oddOnes } from "@/lib/compare-incl";
import { arrivalOrder, compareView, inclOf } from "@/lib/compare-view";
import { submitFromDoc } from "@/lib/agent-quote-doc";
import { testFromCatalog, replyExtra, testIncl, DEFAULT_VISIBLE, EMPTY_TERMS, type DocData } from "@/lib/quote-doc";
import type { CatalogRow } from "@/lib/catalog";
import type { QuoteRow } from "@/lib/data";

/*
 * 비교표 시험별 포함 항목 (2026-11-21 시안 승인, D3)
 * - 기관이 견적서에서 켠 평가·분석 항목을 회신 design.extra.incl 로 넘긴다
 * - 기관마다 갈리는 항목만 줄로, 모두 같은 항목은 공통 포함
 * - 비교표·compare_view 는 회신 도착 순. 순위 없음
 * 값은 시험 종류에 맞춘 가상의 예(반복투여 4주의 TK 분석·안과검사 포함 여부)
 */
describe("포함 항목 견주기", () => {
  it("갈리는 항목은 줄로, 같은 항목은 공통으로", () => {
    const r = compareIncl([
      ["일반증상", "혈액학적 검사", "TK 분석", "안과검사"],
      ["일반증상", "혈액학적 검사", "안과검사"],
      ["일반증상", "혈액학적 검사", "TK 분석"],
    ]);
    expect(r?.common).toEqual(["일반증상", "혈액학적 검사"]);
    expect(r?.diff).toEqual([
      { key: "TK 분석", vals: ["포함", "미포함", "포함"], odd: [false, true, false] },
      { key: "안과검사", vals: ["포함", "포함", "미포함"], odd: [false, false, true] },
    ]);
  });
  it("항목 없는 기관(예전 견적·불가)은 '-' 로 두고 공통에서 뺀다", () => {
    const r = compareIncl([["일반증상", "TK 분석"], null, ["일반증상"]]);
    expect(r?.common).toEqual([]);
    expect(r?.diff.find((x) => x.key === "일반증상")?.vals).toEqual(["포함", "-", "포함"]);
    expect(r?.diff.find((x) => x.key === "TK 분석")?.odd).toEqual([false, false, false]);
  });
  it("견줄 값이 없으면 null", () => {
    expect(compareIncl([null, undefined])).toBeNull();
  });
  it("두 곳 이상 같은 값이 있을 때만 갈리는 칸을 표시", () => {
    expect(oddOnes(["a", "b"])).toEqual([false, false]);
    expect(oddOnes(["a", "a", "b"])).toEqual([false, false, true]);
  });
});

const row = {
  id: "00000000-0000-0000-0000-000000000001", item_key: "tox.repeat", category: "일반독성", item: "반복투여 독성", available: true, glp: "GLP",
  species: ["SD rat"], route: "경구", method: "식약처 독성시험기준", groups_ctrl: 1, groups_test: 3, per_sex: 10, recovery_weeks: 4, recovery_per_sex: 5,
  dosing: "4주, 1일 1회", weeks: 12, includes: ["일반증상", "혈액학적 검사"], options: [{ name: "TK 분석", amount: 7_000_000 }], unit: "total",
  price_min: null, price_max: null, extra: {}, note: null, last_amount: null, last_weeks: null, last_quoted_at: null, std_price: 40_000_000,
} as CatalogRow;

describe("견적서 → 회신에 포함 항목", () => {
  it("켠 평가 항목만, 중복 없이 넘긴다", () => {
    const t = { ...testFromCatalog(row, []), uid: "ta", rfqSeq: 1 };
    t.evals = [{ name: "일반증상", on: true, base: true }, { name: "일반증상 ", on: true, base: true }, { name: "안과검사", on: false, base: false }, { name: " ", on: true, base: false }];
    expect(testIncl(t)).toEqual(["일반증상"]);
    expect(replyExtra(t).incl).toEqual(["일반증상"]);
  });
  it("제출 본문 design.extra.incl 로 들어간다", () => {
    const t = { ...testFromCatalog(row, []), uid: "ta", rfqSeq: 1 };
    const d: DocData = { tests: [t], visible: { ...DEFAULT_VISIBLE }, discount: 0, terms: { ...EMPTY_TERMS }, glp: "GLP" };
    const r = submitFromDoc(d, [{ seq: 1, avail: "가능", amount: "", weeks: "" }], new Map([[1, "반복투여 독성"]]));
    if (!r.ok) throw new Error(r.error);
    const want = testIncl(t);
    expect(want.length).toBeGreaterThan(0);
    expect((r.items[0].design?.extra as Record<string, unknown> | undefined)?.incl).toEqual(want);
  });
});

const q = (id: string, name: string, at: string, incl: string[] | null, extra: Partial<QuoteRow> = {}) => ({
  id, cro_name: name, status: "submitted", first_submitted_at: at, submitted_at: at, total_amount: 48_000_000, total_weeks: 16, final_weeks: null,
  start_date: null, valid_until: null, pay_terms: null, includes: [], note: "담당 010-1234-5678", ...extra,
  cro_quote_items: [{ seq: 1, name: "반복투여 4주", avail: "가능", amount: 30_000_000, weeks: 16, reason: null, design: incl ? { extra: { incl } } : {} }],
}) as unknown as QuoteRow;

describe("compare_view", () => {
  const quotes = [
    q("b", "기관 나", "2026-11-19T02:00:00Z", ["일반증상", "안과검사"]),
    q("a", "기관 가", "2026-11-18T09:00:00Z", ["일반증상", "TK 분석", "안과검사"]),
    q("c", "기관 다", "2026-11-19T01:00:00Z", null, { status: "draft" } as Partial<QuoteRow>),
  ];
  it("제출한 곳만 회신 도착 순", () => {
    expect(arrivalOrder(quotes).map((x) => x.id)).toEqual(["a", "b"]);
  });
  it("시험별 갈리는 항목·공통 항목, 선정 전 연락처 가림", () => {
    const v = compareView({ rfq_no: "DC-2026-0009", selected_quote_id: null }, quotes, null);
    expect(v.order).toBe("arrival");
    expect(v.orgs.map((o) => o.name)).toEqual(["기관 가", "기관 나"]);
    expect(v.orgs[0].note).not.toContain("010-1234-5678");
    expect(v.tests[0]).toEqual({ seq: 1, name: "반복투여 4주", diff: [{ item: "TK 분석", byOrg: ["포함", "미포함"] }], common: ["일반증상", "안과검사"] });
    expect(JSON.stringify(v)).not.toMatch(/rank|best|추천/);
  });
  it("선정한 기관은 메모를 그대로", () => {
    const v = compareView({ rfq_no: "DC-2026-0009", selected_quote_id: "b" }, quotes, null);
    expect(v.orgs[1].note).toContain("010-1234-5678");
    expect(inclOf({ extra: { incl: ["a", 1] } })).toEqual(["a"]);
  });
});
