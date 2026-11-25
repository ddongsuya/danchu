/**
 * 위탁연구 계약서(안) (2026-11-20 사용자 결정: 전자서명은 하지 않고 서명 전까지).
 * 선정된 견적(항목·금액·기간·결제 조건·착수일)과 기관·의뢰자 정보로 계약서(안)을 만든다. 저장하지 않고 볼 때마다 만든다.
 * 금액은 제출한 견적 그대로(코드 합계, 부가세 10% 원 미만 버림). 조항은 일반 위탁연구 계약의 뼈대만 두고,
 * 기관 양식의 특약(견적서 양식의 기타 조건·비고)을 붙인다. 서명·날인은 양 당사자가 단추 밖에서 한다.
 * 순수 함수. 테스트 대상.
 */
import { payTerms } from "./format";
import { parsePay, payAmounts, payError } from "./pay-schedule";
import { wonKo } from "./pd-quote";

export type ContractParty = { name: string; contact: string | null; bizNo: string | null; address: string | null };
export type ContractTest = { seq: number; name: string; amount: number; weeks: number | null };
export type ContractArticle = { no: number; title: string; body: string[] };

export type ContractDraft = {
  title: string;
  rfqNo: string;
  substance: string;
  sponsor: ContractParty;
  cro: ContractParty;
  tests: ContractTest[];
  supply: number;
  vat: number;
  total: number;
  /** 제1조~ */
  articles: ContractArticle[];
  /** 특약 (기관 견적서 양식의 기타 조건·비고) */
  special: string[];
  /** 선정한 날 (YYYY-MM-DD) */
  awardedOn: string;
};

export type ContractInput = {
  rfqNo: string;
  substance: string;
  awardedAt: string;
  sponsor: ContractParty;
  cro: ContractParty;
  items: { seq: number; name: string; avail: string | null; amount: number | null; weeks: number | null }[];
  quote: { pay_terms: string | null; start_date: string | null; report_lang: string | null; includes: string[] | null; final_weeks: number | null; revision: number | null; glp?: boolean };
  /** 기관 견적서 양식의 조건 (lib/quote-doc QuoteStyle.terms) */
  terms?: { extra?: string; note?: string } | null;
};

const won = (n: number) => n.toLocaleString("ko-KR");
const ymdKo = (s: string | null | undefined) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? `${s.slice(0, 4)}년 ${Number(s.slice(5, 7))}월 ${Number(s.slice(8, 10))}일` : null);
const lines = (s: string | undefined | null) => (s ?? "").split(/\n+/).map((x) => x.trim()).filter(Boolean);

/** 계약 금액: 가능·조건부 가능 항목 합계(공급가액), 부가세 10% (원 미만 버림) */
export function contractAmounts(items: ContractInput["items"]): { tests: ContractTest[]; supply: number; vat: number; total: number } {
  const tests = items
    .filter((i) => i.avail && i.avail !== "불가" && i.amount != null && i.amount > 0)
    .sort((a, b) => a.seq - b.seq)
    .map((i) => ({ seq: i.seq, name: i.name, amount: Math.round(i.amount!), weeks: i.weeks }));
  const supply = tests.reduce((a, t) => a + t.amount, 0);
  const vat = Math.floor(supply / 10);
  return { tests, supply, vat, total: supply + vat };
}

/** 제4조 본문: 기관 회신의 지급 조건 줄을 계약 금액으로 환산 (lib/pay-schedule). 줄로 못 읽는 글은 그대로, 비었으면 협의 */
function payBody(raw: string | null, pay: string, total: number): string[] {
  const rows = parsePay(raw);
  if (!rows.length || payError(rows)) return [pay ? `갑은 계약 금액을 다음과 같이 지급한다: ${pay}.` : "지급 시기와 방법은 갑과 을이 협의하여 정한다."];
  const amounts = payAmounts(rows, total);
  // 조항 본문은 화면에서 번호 목록이라 줄마다 번호를 달지 않고 한 문장으로 잇는다
  const parts = rows.map((r, i) => `${r.label} ${r.pct}%(금 ${won(amounts[i])}원${r.when ? `, ${r.when}` : ""})`);
  return [`갑은 계약 금액을 다음과 같이 나누어 지급한다: ${parts.join(", ")}.`];
}

export function buildContractDraft(a: ContractInput): ContractDraft {
  const { tests, supply, vat, total } = contractAmounts(a.items);
  const weeks = a.quote.final_weeks ?? (tests.reduce((m, t) => Math.max(m, t.weeks ?? 0), 0) || null);
  const pay = payTerms(a.quote.pay_terms);
  const start = ymdKo(a.quote.start_date);
  const articles: ContractArticle[] = [
    { no: 1, title: "목적", body: [`이 계약은 위탁자(이하 "갑")가 수탁자(이하 "을")에게 별표의 비임상 시험(이하 "시험")을 맡기고, 을이 이를 수행하는 데 필요한 사항을 정한다.`] },
    {
      no: 2,
      title: "시험의 범위",
      body: [
        `시험의 범위와 조건은 별표(시험 목록)와 을이 단추 요청 ${a.rfqNo}에 제출한 견적${a.quote.revision ? `(제${a.quote.revision}판)` : ""}에 따른다.`,
        "세부 설계와 일정은 을이 작성하고 갑이 확인한 시험계획서에 따른다.",
      ],
    },
    { no: 3, title: "계약 금액", body: [`계약 금액은 금 ${wonKo(total)}원정(₩${won(total)}, 공급가액 ${won(supply)}원과 부가가치세 ${won(vat)}원)으로 한다.`] },
    { no: 4, title: "지급 조건", body: [...payBody(a.quote.pay_terms, pay, total), "을은 지급 시기마다 세금계산서를 발행한다."] },
    {
      no: 5,
      title: "시험 기간",
      body: [
        start ? `을은 ${start}에 시험을 착수하는 것을 원칙으로 한다.` : "착수일은 시험물질 입고 뒤 갑과 을이 협의하여 정한다.",
        weeks ? `을은 착수일부터 ${weeks}주 안에 최종 보고서를 제출한다.` : "최종 보고서 제출 시기는 시험계획서에 따른다.",
        "시험물질 입고 지연 등 갑의 사유로 일정이 바뀌면 갑과 을은 협의하여 일정을 조정한다.",
      ],
    },
    { no: 6, title: "시험물질과 자료의 제공", body: ["갑은 시험에 필요한 시험물질과 그 특성 자료(안정성, 보관 조건, 취급 주의 사항 등)를 을에게 제공한다."] },
    {
      no: 7,
      title: "시험의 수행과 보고",
      body: [
        "을은 관련 법령과 시험 기준에 따라 시험을 수행한다. 비임상시험관리기준(GLP) 시험이면 그 기준에 따른다.",
        `을은 최종 보고서${a.quote.report_lang ? `(${a.quote.report_lang})` : ""}를 갑에게 제출한다.`,
        ...(a.quote.includes?.length ? [`견적에 포함한 항목: ${a.quote.includes.join(", ")}.`] : []),
      ],
    },
    { no: 8, title: "비밀 유지", body: ["갑과 을은 이 계약과 관련하여 알게 된 상대방의 비밀 정보를 상대방의 서면 동의 없이 제3자에게 공개하거나 이 계약 외의 목적으로 쓰지 않는다. 이 의무는 계약이 끝난 뒤에도 유지된다."] },
    { no: 9, title: "결과의 귀속", body: ["시험 결과와 보고서에 관한 권리는 갑에게 귀속한다. 다만 을이 시험 전부터 보유한 기술과 노하우는 을에게 남는다."] },
    { no: 10, title: "자료의 보관", body: ["을은 시험의 원자료와 표본을 관련 기준이 정한 기간 동안 보관한다."] },
    {
      no: 11,
      title: "계약의 변경과 해지",
      body: [
        "계약 내용의 변경은 갑과 을의 서면 합의로 한다.",
        "어느 한쪽이 계약을 위반하고 상당한 기간을 정한 시정 요구에도 시정하지 않으면 상대방은 계약을 해지할 수 있다. 해지할 때 이미 수행한 부분의 비용은 협의하여 정산한다.",
      ],
    },
    { no: 12, title: "분쟁의 해결", body: ["이 계약에 관한 분쟁은 갑과 을이 협의하여 해결한다. 협의가 되지 않으면 관할 법원은 갑과 을이 협의하여 정한다."] },
  ];
  return {
    title: "비임상 시험 위탁연구 계약서(안)",
    rfqNo: a.rfqNo,
    substance: a.substance,
    sponsor: a.sponsor,
    cro: a.cro,
    tests,
    supply,
    vat,
    total,
    articles,
    special: [...lines(a.terms?.extra), ...lines(a.terms?.note)].slice(0, 20),
    awardedOn: a.awardedAt.slice(0, 10),
  };
}
