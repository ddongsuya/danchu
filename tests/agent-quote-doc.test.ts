import { describe, expect, it } from "vitest";
import { applyDocEdits, applyReplyFields, docView, parseDocEdits, replyFromDoc, setManualAmount, spreadDiscount } from "@/lib/agent-quote-doc";
import { blankTest, docTotals, testFromCatalog, testLines, DEFAULT_VISIBLE, EMPTY_TERMS, type DocData, type DocHead, type Rate } from "@/lib/quote-doc";
import { EMPTY_COMMON, type ReplyItem } from "@/lib/cro-data";
import type { CatalogRow } from "@/lib/catalog";

/*
 * 에이전트 견적서 도구 (2026-11-20 설계안 D2)
 * - 금액은 견적서 툴 계산만. 설계(군·조건·옵션·기간)를 바꾸면 코드가 전·후 금액을 낸다
 * - 금액 칸·글 속 금액은 amount_not_allowed. 사람이 넣는 금액은 시험 목록·단가표에 없는 줄에만
 * - 견적서 → 회신: 할인을 줄마다 나눠 공급가액과 맞추고, 가능 여부는 바꾸지 않는다
 */

// 계산 확인용 가상의 값 (어느 기관의 실제 단가도 아니다)
const row = {
  id: "00000000-0000-0000-0000-000000000001", item_key: "tox.repeat", category: "일반독성", item: "반복투여 독성", available: true, glp: "GLP",
  species: ["SD rat"], route: "경구", method: "식약처 독성시험기준", groups_ctrl: 1, groups_test: 3, per_sex: 10, recovery_weeks: 4, recovery_per_sex: 5,
  dosing: "4주, 1일 1회", weeks: 12, includes: ["일반증상"], options: [{ name: "TK 분석", amount: 7_000_000 }], unit: "total",
  price_min: null, price_max: null, extra: {}, note: null, last_amount: null, last_weeks: null, last_quoted_at: null, std_price: 40_000_000,
} as CatalogRow;
const rates: Rate[] = [
  { id: "animal", kind: "animal", label: "본시험 동물 수", unit: "마리", add: 600_000, deduct: 400_000, shown: "동물 수 추가 / 차감" },
  { id: "q1", kind: "qty", label: "추가 장기", unit: "장기", add: 150_000, deduct: null, shown: "장기 추가" },
];

const doc = (): DocData => {
  const a = { ...testFromCatalog(row, rates), uid: "ta", rfqSeq: 1 };
  const b = { ...blankTest("특수 분석"), uid: "tb", rfqSeq: 2 };
  return { tests: [a, b], visible: { ...DEFAULT_VISIBLE }, discount: 0, terms: { ...EMPTY_TERMS }, glp: "GLP" };
};
const head: DocHead = { id: "d1", docNo: "Q-1", title: "", client: "", substance: "", issuedOn: "2026-11-20", validUntil: null, inviteId: "i1", rfqNo: "DC-2026-0001", memo: "", updatedAt: "2026-11-20T00:00:00Z" };
const item = (seq: number, extra: Partial<ReplyItem> = {}): ReplyItem => ({ seq, avail: "", amount: "", weeks: "", ...extra });

describe("견적서 보기", () => {
  it("시험 목록 금액 줄과 사람이 넣어야 하는 줄을 나눈다", () => {
    const v = docView(head, doc());
    expect(v.tests.map((t) => [t.uid, t.source, t.base])).toEqual([["ta", "catalog", 40_000_000], ["tb", "manual", null]]);
    expect(v.manualNeeded).toEqual(["특수 분석"]);
    expect(v.totals.supply).toBe(40_000_000);
    expect(v.tests[0].options).toEqual([expect.objectContaining({ name: "TK 분석" })]);
  });
});

describe("설계 고치기", () => {
  it("금액 칸은 어디에 있든 받지 않는다", () => {
    expect(parseDocEdits({ discount: 10 })).toBe("amount_not_allowed");
    expect(parseDocEdits({ tests: [{ uid: "ta", amount: 1 }] })).toBe("amount_not_allowed");
    expect(parseDocEdits({ tests: [{ uid: "ta", extras: [] }] })).toBe("amount_not_allowed");
    expect(parseDocEdits({ terms: { note: "유전독성 3종 별도 3,330만 원" } })).toBe("amount_not_allowed");
    expect(parseDocEdits({ tests: [{ uid: "ta", why: "TK 포함 700만원" }] })).toBe("amount_not_allowed");
  });
  it("모양이 틀리면 bad_request", () => {
    expect(parseDocEdits(null)).toBe("bad_request");
    expect(parseDocEdits({ tests: [{ uid: "ta", groups: [{ id: "x", m: -1 }] }] })).toBe("bad_request");
    expect(parseDocEdits({ tests: [{ uid: "ta", cond: { color: "red" } }] })).toBe("bad_request");
  });
  it("동물 수를 바꾸면 코드가 금액을 다시 계산하고 전·후를 알린다", () => {
    const d = doc();
    const g = d.tests[0].groups[1];
    const e = parseDocEdits({ tests: [{ uid: "ta", groups: [{ id: g.id, m: g.m + 2 }] }] });
    expect(typeof e).toBe("object");
    const r = applyDocEdits(d, e as Exclude<typeof e, string>);
    if (typeof r === "string") throw new Error(r);
    expect(r.diffs[0]).toMatchObject({ uid: "ta", before: 40_000_000, fields: [`groups.${g.id}.m`] });
    expect(r.diffs[0].after).toBe(testLines(r.data.tests[0]).total);
    expect(r.diffs[0].after).toBeGreaterThan(40_000_000);
    expect(r.after).toBe(docTotals(r.data).supply);
    // 원본은 그대로
    expect(d.tests[0].groups[1].m).toBe(g.m);
  });
  it("옵션 켜기는 시험 목록 옵션 금액으로 더한다", () => {
    const r = applyDocEdits(doc(), { tests: [{ uid: "ta", options: [{ name: "TK 분석", on: true }] }] });
    if (typeof r === "string") throw new Error(r);
    expect(r.diffs[0].after - r.diffs[0].before).toBe(7_000_000);
  });
  it("기본 포함 항목과 이름이 같은 옵션도 옵션 쪽을 켠다", () => {
    const d = doc();
    d.tests[0].evals.unshift({ name: "TK 분석", on: true, base: true });
    const r = applyDocEdits(d, { tests: [{ uid: "ta", options: [{ name: "TK 분석", on: true }] }] });
    if (typeof r === "string") throw new Error(r);
    expect(r.diffs[0].after - r.diffs[0].before).toBe(7_000_000);
  });
  it("없는 시험·군·옵션·단가는 not_found", () => {
    expect(applyDocEdits(doc(), { tests: [{ uid: "zz" }] })).toBe("not_found");
    expect(applyDocEdits(doc(), { tests: [{ uid: "ta", groups: [{ id: "nope", m: 1 }] }] })).toBe("not_found");
    expect(applyDocEdits(doc(), { tests: [{ uid: "ta", qty: { nope: 1 } }] })).toBe("not_found");
  });
});

describe("사람이 넣는 금액", () => {
  it("시험 목록 금액이 없는 줄에만 적는다", () => {
    const r = setManualAmount(doc(), { uid: "tb", amount: 5_000_000, label: "특수 분석" });
    if (typeof r === "string") throw new Error(r);
    expect(testLines(r.tests[1]).total).toBe(5_000_000);
    expect(setManualAmount(doc(), { uid: "ta", amount: 1 })).toBe("amount_not_allowed");
  });
  it("다시 넣으면 바꾸고, 0이면 지운다", () => {
    let d = setManualAmount(doc(), { uid: "tb", amount: 5_000_000 }) as DocData;
    d = setManualAmount(d, { uid: "tb", amount: 6_000_000 }) as DocData;
    expect(d.tests[1].extras).toHaveLength(1);
    expect(testLines(d.tests[1]).total).toBe(6_000_000);
    d = setManualAmount(d, { uid: "tb", amount: 0 }) as DocData;
    expect(d.tests[1].extras).toEqual([]);
  });
  it("할인은 0 이상 정수만", () => {
    expect((setManualAmount(doc(), { discount: 1_000_000 }) as DocData).discount).toBe(1_000_000);
    expect(setManualAmount(doc(), { discount: -1 })).toBe("bad_request");
    expect(setManualAmount(doc(), {})).toBe("bad_request");
  });
});

describe("견적서 → 회신", () => {
  it("할인을 줄마다 나눠 합계가 공급가액과 같다", () => {
    expect(spreadDiscount([30_000_000, 10_000_000], 4_000_001)).toEqual([26_999_999, 9_000_000]);
    expect(spreadDiscount([100, 0], 0)).toEqual([100, 0]);
    const s = spreadDiscount([333, 333, 334], 100);
    expect(s.reduce((a, b) => a + b, 0)).toBe(900);
  });
  it("금액·기간을 옮기고 가능 여부는 그대로, 빈 줄은 알린다", () => {
    let d = doc();
    d.discount = 4_000_000;
    const r = replyFromDoc(d, [item(1, { avail: "조건부 가능", reason: "시험물질 확인" }), item(2), item(3)]);
    expect(r.filled).toEqual([1]);
    expect(r.empty).toEqual([2, 3]);
    expect(r.items[0]).toMatchObject({ amount: "36000000", avail: "조건부 가능", reason: "시험물질 확인", weeks: "12" });
    expect(r.items[1].avail).toBe("");
    d = setManualAmount(d, { uid: "tb", amount: 10_000_000 }) as DocData;
    const r2 = replyFromDoc(d, [item(1), item(2)]);
    const sum = r2.items.reduce((a, x) => a + Number(x.amount), 0);
    expect(sum).toBe(docTotals(d).supply);
  });
});

describe("회신 칸", () => {
  const draft = { items: [item(1), item(2)], common: { ...EMPTY_COMMON } };
  it("가능 여부·사유·기간·공통 조건을 고친다", () => {
    const r = applyReplyFields(draft, { items: [{ seq: 2, avail: "불가", reason: "장비 없음" }], common: { startDate: "2026-12-01", reportLang: "국문" } });
    if (typeof r === "string") throw new Error(r);
    expect(r.items[1]).toMatchObject({ avail: "불가", reason: "장비 없음" });
    expect(r.common).toMatchObject({ startDate: "2026-12-01", reportLang: "국문" });
    expect(draft.items[1].avail).toBe("");
  });
  it("금액은 받지 않는다", () => {
    expect(applyReplyFields(draft, { items: [{ seq: 1, amount: "100" }] })).toBe("amount_not_allowed");
    expect(applyReplyFields(draft, { items: [{ seq: 1, reason: "추가 500만 원" }] })).toBe("amount_not_allowed");
  });
  it("모르는 줄·값은 막는다", () => {
    expect(applyReplyFields(draft, { items: [{ seq: 9, avail: "가능" }] })).toBe("not_found");
    expect(applyReplyFields(draft, { items: [{ seq: 1, avail: "아마도" }] })).toBe("bad_request");
    expect(applyReplyFields(draft, { common: { includes: [] } })).toBe("bad_request");
  });
});

describe("제출 금액은 견적서 계산값만", () => {
  const names = new Map([[1, "반복투여 독성"], [2, "특수 분석"]]);
  it("본문 금액을 버리고 견적서 금액으로 채운다", async () => {
    const { submitFromDoc } = await import("@/lib/agent-quote-doc");
    const d = setManualAmount(doc(), { uid: "tb", amount: 5_000_000 }) as DocData;
    d.tests[1].item = "특수 분석";
    const r = submitFromDoc(d, [item(1, { avail: "가능", amount: "1" }), item(2, { avail: "가능" })], names);
    if (!r.ok) throw new Error(r.error);
    expect(r.items.map((x) => x.amount)).toEqual(["40000000", "5000000"]);
    expect(r.overridden).toEqual([1]);
  });
  it("금액 없는 줄은 amount_missing, 불가 줄은 금액을 비운다", async () => {
    const { submitFromDoc } = await import("@/lib/agent-quote-doc");
    expect(submitFromDoc(doc(), [item(1, { avail: "가능" }), item(2, { avail: "가능" })], names)).toEqual({ ok: false, error: "amount_missing", seqs: [2] });
    const r = submitFromDoc(doc(), [item(1, { avail: "가능" }), item(2, { avail: "불가", amount: "300" })], names);
    if (!r.ok) throw new Error(r.error);
    expect(r.items[1].amount).toBe("");
  });
  it("요청서와 시험 이름이 달라진 줄은 mismatched", async () => {
    const { submitFromDoc } = await import("@/lib/agent-quote-doc");
    const r = submitFromDoc(doc(), [item(1, { avail: "가능" })], new Map([[1, "단회투여 독성"]]));
    expect(r).toEqual({ ok: false, error: "mismatched", seqs: [1] });
  });
});
