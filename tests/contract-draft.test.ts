import { describe, expect, it } from "vitest";
import { buildContractDraft, contractAmounts, type ContractInput } from "@/lib/contract-draft";

/*
 * 계약서(안) (lib/contract-draft.ts, 2026-11-20)
 * - 금액은 제출한 견적 그대로: 가능·조건부 가능 항목 합계, 부가세 10% 원 미만 버림
 * - 결제 조건·착수일·기간·보고서 언어·포함 항목을 조항에 옮긴다. 없으면 "협의"
 * - 기관 견적서 양식의 기타 조건·비고를 특약으로
 * (금액·이름은 계산 확인용 가상의 값)
 */
const base: ContractInput = {
  rfqNo: "DC-2026-0142",
  substance: "후보물질 A",
  awardedAt: "2026-11-20T03:00:00Z",
  sponsor: { name: "가 바이오", contact: "김 팀장", bizNo: null, address: null },
  cro: { name: "나 연구소", contact: null, bizNo: "123-45-67890", address: "서울" },
  items: [
    { seq: 2, name: "TK 분석", avail: "가능", amount: 6_200_000, weeks: 6 },
    { seq: 1, name: "랫드 4주 반복투여독성", avail: "조건부 가능", amount: 48_500_005, weeks: 14 },
    { seq: 3, name: "유전독성", avail: "불가", amount: null, weeks: null },
  ],
  quote: { pay_terms: "50/50", start_date: "2026-12-07", report_lang: "국문", includes: ["조직병리", "QA 점검"], final_weeks: 16, revision: 2 },
  terms: { extra: "시험물질은 착수 2주 전까지 보낸다.\n운송비는 갑이 부담한다.", note: "" },
};

describe("계약 금액", () => {
  it("가능·조건부 가능 항목만 행 번호 순, 부가세 10% 원 미만 버림", () => {
    const a = contractAmounts(base.items);
    expect(a.tests.map((t) => t.seq)).toEqual([1, 2]);
    expect(a.supply).toBe(54_700_005);
    expect(a.vat).toBe(5_470_000);
    expect(a.total).toBe(60_170_005);
  });
});

describe("계약서(안)", () => {
  it("견적 조건을 조항에 옮기고 금액은 한글·숫자로", () => {
    const d = buildContractDraft(base);
    const text = JSON.stringify(d.articles);
    expect(d.articles[2]!.body[0]).toContain("금 육천일십칠만오원정(₩60,170,005");
    expect(text).toContain("선급 50% · 잔금 50%");
    expect(text).toContain("2026년 12월 7일에 시험을 착수");
    expect(text).toContain("16주 안에 최종 보고서");
    expect(text).toContain("최종 보고서(국문)");
    expect(text).toContain("조직병리, QA 점검");
    expect(text).toContain("DC-2026-0142에 제출한 견적(제2판)");
    expect(d.special).toEqual(["시험물질은 착수 2주 전까지 보낸다.", "운송비는 갑이 부담한다."]);
    expect(d.awardedOn).toBe("2026-11-20");
  });

  it("결제 조건·착수일·기간이 없으면 협의로 둔다", () => {
    const d = buildContractDraft({ ...base, items: [{ seq: 1, name: "x", avail: "가능", amount: 1000, weeks: null }], quote: { pay_terms: null, start_date: null, report_lang: null, includes: null, final_weeks: null, revision: null }, terms: null });
    const text = JSON.stringify(d.articles);
    expect(text).toContain("지급 시기와 방법은 갑과 을이 협의하여 정한다");
    expect(text).toContain("착수일은 시험물질 입고 뒤 갑과 을이 협의하여 정한다");
    expect(text).toContain("최종 보고서 제출 시기는 시험계획서에 따른다");
    expect(d.special).toEqual([]);
  });
});
