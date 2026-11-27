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
    // 예전 숫자 입력 "50/50" 도 지급 조건 줄로 읽어 금액까지 적는다 (lib/pay-schedule)
    expect(d.articles[3]!.body).toEqual([
      "갑은 계약 금액을 다음과 같이 나누어 지급한다: 선급 50%(금 30,085,002원, 계약 시), 잔금 50%(금 30,085,003원, 최종 보고서 제출 시).",
      "을은 지급 시기마다 세금계산서를 발행한다.",
    ]);
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

describe("연동: 2차 견적 금액 + 지급 조건 줄 → 계약서 제3·4조 (시안 v7)", () => {
  it("2차에서 고친 금액으로 계약 금액을 잡고, 지급 줄 금액 합이 계약 금액과 같다", async () => {
    const { applyDetailEdits } = await import("@/lib/detail-quote");
    const items = applyDetailEdits(
      [{ seq: 1, name: "4주 반복", avail: "가능", amount: 100_000_000, weeks: 16 }, { seq: 2, name: "TK", avail: "가능", amount: 20_000_000, weeks: 4 }],
      [{ seq: 2, amount: 26_000_000, weeks: null, mode: "as_requested", reason: "" }],
    );
    const d = buildContractDraft({ ...base, items, quote: { ...base.quote, pay_terms: "착수금 30% 계약 시 · 중도금 40% 중간 보고서 제출 시 · 잔금 30% 최종 보고서 제출 시" } });
    expect(d.articles[2]!.body[0]).toContain("₩138,600,000");
    const pay = d.articles[3]!.body[0];
    expect(pay).toContain("착수금 30%(금 41,580,000원, 계약 시)");
    const sum = [...pay.matchAll(/금 ([\d,]+)원/g)].reduce((a, m) => a + Number(m[1].replace(/,/g, "")), 0);
    expect(sum).toBe(138_600_000);
  });
});
