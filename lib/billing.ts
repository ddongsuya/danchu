import { seoulMonthRange } from "./request-policy";
import type { BillingAdjustmentRow, BillingReferenceRow, ReferenceSource } from "./db-types";

/**
 * 청구 기준 (2026-10-18 결정). DB 함수(supabase/migrations/0020_billing_rules.sql)와 같은 값이다.
 * - 의뢰자는 비용을 내지 않는다.
 * - 청구 단위는 기관이 실제로 제출한 견적 1건. 견적을 내지 않은 기관에는 청구하지 않는다. 재제출·수정은 다시 청구하지 않는다.
 * - 그 초대에 기관 본인의 참여 기록이 있어야 청구한다 (0023_opt_in.sql). 참여 기록이 있으면 운영자 대리 입력도 같다.
 * - 견적 총액(부가세 별도) 1,000만 원 미만: 월 구독료에 포함 / 1,000만 원 이상: 건당 이용료 /
 *   5,000만 원 이상: 건당 이용료 + 단추를 통해 계약이 체결되면 성사수수료(계약 금액 × 요율)
 * 두 기준 금액은 tests/billing-rules.test.ts 가 SQL 과 같은지 확인한다.
 */
/** 이 금액 미만 견적은 월 구독료 구간 (건당 이용료 없음) */
export const SUBSCRIPTION_MAX_EXCL = 10_000_000;
/** 이 금액 이상 견적은 성사수수료 대상 */
export const SUCCESS_FEE_MIN = 50_000_000;

/**
 * 참여 기록에 따른 청구 여부 (0023). 기관 본인이 참여한(joined) 초대의 견적만 청구한다. 운영자 대리 입력도 기관이 참여했으면 같다.
 * legacy: 참여 기능 전에 작성 중·제출이던 견적. not_joined: 참여 기록 없음. 둘 다 청구하지 않는다
 */
export const JOIN_STATUS_NOTE: Record<"legacy" | "not_joined" | "pilot", string> = {
  legacy: "참여 기능 도입 전 견적, 청구하지 않음",
  not_joined: "참여 기록 없음, 청구하지 않음",
  pilot: "시범 운영 중 참여한 요청, 청구하지 않음",
};
/** 청구에 넣지 않는 참여 상태면 그 안내, 아니면 빈 문자열. 0023 전 저장본(값 없음)은 안내 없음 */
export function joinStatusNote(status: string | null | undefined): string {
  return status === "legacy" || status === "not_joined" || status === "pilot" ? JOIN_STATUS_NOTE[status] : "";
}

/** 견적 총액의 청구 구간. no_amount: 금액 미입력(아직 청구하지 않음) */
export type BillingTier = "no_amount" | "subscription" | "per_quote" | "per_quote_success";

export const TIER_LABEL: Record<BillingTier, string> = {
  no_amount: "금액 미입력",
  subscription: "1,000만 원 미만 (구독)",
  per_quote: "건당 이용료",
  per_quote_success: "건당 이용료 + 성사수수료 대상",
};

export function billingTier(amount: number | null | undefined): BillingTier {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return "no_amount";
  if (amount < SUBSCRIPTION_MAX_EXCL) return "subscription";
  if (amount < SUCCESS_FEE_MIN) return "per_quote";
  return "per_quote_success";
}

/** 건당 이용료 대상인지 (1,000만 원 이상) */
export function chargesPerQuote(amount: number | null | undefined): boolean {
  const t = billingTier(amount);
  return t === "per_quote" || t === "per_quote_success";
}

/** 성사수수료 대상인지. 판정은 선정 견적 금액으로 한다 (계약 금액이 아니다) */
export function successFeeEligible(selectedQuoteAmount: number | null | undefined): boolean {
  return billingTier(selectedQuoteAmount) === "per_quote_success";
}

/** `YYYY-MM` 을 [from, to) 서울 날짜 범위와 이전·다음 달로. 형식이 틀리면 이번 달 */
export function monthRangeOf(month: string | undefined): { label: string; from: string; to: string; prev: string; next: string } {
  const cur = seoulMonthRange();
  const m = month && /^\d{4}-\d{2}$/.test(month) ? month : cur.from.slice(0, 7);
  const [y, mm] = m.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const from = `${y}-${pad(mm)}-01`;
  const to = mm === 12 ? `${y + 1}-01-01` : `${y}-${pad(mm + 1)}-01`;
  const prev = mm === 1 ? `${y - 1}-12` : `${y}-${pad(mm - 1)}`;
  const next = mm === 12 ? `${y + 1}-01` : `${y}-${pad(mm + 1)}`;
  return { label: `${y}년 ${mm}월`, from, to, prev, next };
}

/** 금액 × 요율 (원 단위 반올림). 요율이 없으면 null (미정) */
export function successFee(amount: number, feeRate: number | null | undefined): number | null {
  if (feeRate == null || feeRate < 0) return null;
  return Math.round(amount * feeRate);
}

/**
 * 성사수수료 두 숫자.
 * - 예상(견적 기준): 선정 견적 금액 × 요율. 안내용이며 청구 합계에 넣지 않는다
 * - 정산(계약 기준): 체결 계약 금액 × 요율. 계약 상태가 signed 일 때만
 * 선정 견적이 5,000만 원 미만이면 둘 다 대상 아님(eligible false, 금액 0).
 */
export function successFeeView(a: { quoteAmount: number | null | undefined; contractAmount: number | null | undefined; contractStatus: string | null | undefined; feeRate: number | null | undefined }): {
  eligible: boolean;
  /** 예상. 요율 미정이면 null */
  expected: number | null;
  /** 정산. 체결 전이면 0 (아직 없음), 요율 미정이면 null */
  settled: number | null;
  signed: boolean;
} {
  const eligible = successFeeEligible(a.quoteAmount);
  const signed = a.contractStatus === "signed" && a.contractAmount != null;
  if (!eligible) return { eligible, expected: 0, settled: 0, signed };
  const expected = a.contractStatus === "not_signed" ? 0 : successFee(a.quoteAmount ?? 0, a.feeRate);
  const settled = signed ? successFee(a.contractAmount ?? 0, a.feeRate) : 0;
  return { eligible, expected, settled, signed };
}

/** 금액 표시: null 은 0 으로 숨기지 않고 "미정" */
export function wonOrPending(v: number | null | undefined, won: (n: number) => string, pending = "미정"): string {
  return v == null ? pending : won(v);
}

type StatementRowLike = {
  org_id: string;
  billable: number;
  excluded: number;
  per_quote: number;
  monthly_fee: number | null;
  per_quote_fee: number | null;
  guidance_fee: number | null;
  settled_fee: number | null;
  total_due: number;
  terms_pending: boolean;
};

/** 기관별 명세의 합계. 미정(null)은 0 으로 더하고 미정 기관 수를 따로 센다 */
export function statementTotals(rows: StatementRowLike[]): { billable: number; perQuote: number; perQuoteFee: number; monthlyFee: number; guidanceFee: number; settledFee: number; total: number; pendingOrgs: number } {
  const t = { billable: 0, perQuote: 0, perQuoteFee: 0, monthlyFee: 0, guidanceFee: 0, settledFee: 0, total: 0, pendingOrgs: 0 };
  for (const r of rows) {
    t.billable += r.billable;
    t.perQuote += r.per_quote;
    t.perQuoteFee += r.per_quote_fee ?? 0;
    t.monthlyFee += r.monthly_fee ?? 0;
    t.guidanceFee += r.guidance_fee ?? 0;
    t.settledFee += r.settled_fee ?? 0;
    t.total += r.total_due;
    if (r.terms_pending) t.pendingOrgs++;
  }
  return t;
}

/** 마감 저장본과 지금 집계가 같은지 비교할 지문. 청구 금액에 닿는 값만 본다 */
export function statementDigest(rows: StatementRowLike[]): string {
  return JSON.stringify(
    [...rows]
      .sort((a, b) => a.org_id.localeCompare(b.org_id))
      .map((r) => [r.org_id, r.billable, r.excluded, r.per_quote, r.monthly_fee, r.per_quote_fee, r.settled_fee, r.total_due]),
  );
}

/**
 * 마감한 달 (2026-10-20 결정, 0024). 마감한 달의 명세는 고정하고 다시 열지 않는다 (기관 이용 조건 "마감한 달의 명세는 고정, 다시 청구하지 않음").
 * 바로잡을 금액은 다음 열린 달의 조정 항목으로 넣는다. 화면·API 가 같은 문구를 쓴다
 */
export const CLOSED_MONTH_NOTE = "마감한 달은 다시 열 수 없습니다. 바로잡을 금액은 다음 달 명세에 조정 항목으로 넣습니다.";

/** 조정 금액 한도 (원, 절댓값). 잘못 친 자릿수를 막는다 */
export const ADJUSTMENT_MAX_ABS = 10_000_000_000;

/**
 * 조정 금액 입력을 원 단위 정수로. "-120,000", "120000", " 5 000 " 을 받는다.
 * 0, 소수, 숫자 아님, 한도 초과는 null
 */
export function parseAdjustmentAmount(v: unknown): number | null {
  let n: number;
  if (typeof v === "number") n = v;
  else if (typeof v === "string") {
    const t = v.replace(/[\s,원]/g, "").replace(/^\u2212/, "-");
    if (!/^[+-]?\d+$/.test(t)) return null;
    n = Number(t);
  } else return null;
  if (!Number.isSafeInteger(n) || n === 0 || Math.abs(n) > ADJUSTMENT_MAX_ABS) return null;
  return n;
}

/** 조정 항목을 기관별로 더한다 */
export function adjustmentsByOrg(rows: Pick<BillingAdjustmentRow, "org_id" | "amount">[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.org_id, (m.get(r.org_id) ?? 0) + r.amount);
  return m;
}

/** 부호를 붙인 금액 (조정 항목). 0 보다 크면 +, 작으면 - */
export function signedWon(n: number, won: (n: number) => string): string {
  return n > 0 ? `+${won(n)}` : n < 0 ? `-${won(-n)}` : won(0);
}

/**
 * 시범 기간 참고 수치 (2026-10-20 결정, 0024 billing_reference 와 같은 계산).
 * 시범 판(pilot-…)·legacy 참여라 청구하지 않는 견적과 체결을 "유료였다면"으로 센다. 합계·청구에는 넣지 않는다.
 * 기관 약정 값(건당 이용료·성사수수료율)이 있으면 그 값을, 없으면 아래 참고 단가를 쓴다.
 * 두 값은 tests/billing-close-lock.test.ts 가 SQL(billing_reference_per_quote_fee·billing_reference_success_rate)과 같은지 본다.
 */
export const REFERENCE_PER_QUOTE_FEE = 30_000;
export const REFERENCE_SUCCESS_RATE = 0.03;
/** 참고 단가 이름표 */
export const REFERENCE_UNIT_LABEL = "참고 단가(예시, 시장 검증 전)";
/** 참고 수치 이름표 */
export const REFERENCE_LABEL = "참고 (시범 기간, 청구 안 함)";

/** 참고 수치에 세는 견적인지: 운영자가 제외하지 않았고, 시범 판 또는 legacy 참여 */
export function countsForReference(line: { billable: boolean; join_status?: string | null }): boolean {
  return line.billable && (line.join_status === "pilot" || line.join_status === "legacy");
}

/** 참고 건당 단가: 기관 약정 값이 있으면 그 값 */
export function referenceUnit(orgFee: number | null | undefined): { unit: number; source: ReferenceSource } {
  return orgFee == null ? { unit: REFERENCE_PER_QUOTE_FEE, source: "reference" } : { unit: orgFee, source: "org" };
}

/** 참고 성사수수료율: 기관 약정 값이 있으면 그 값 */
export function referenceRate(orgRate: number | null | undefined): { rate: number; source: ReferenceSource } {
  return orgRate == null ? { rate: REFERENCE_SUCCESS_RATE, source: "reference" } : { rate: orgRate, source: "org" };
}

/** 요율 표시 (0.03 → "3%") */
export function rateLabel(rate: number): string {
  return `${Math.round(rate * 10000) / 100}%`;
}

/**
 * 기관 1곳의 참고 수치. lines 는 그 기관의 그 달 견적(billing_lines), settlements 는 시범·legacy 초대의 체결 확인 수주(계약 금액).
 * DB(billing_reference)가 같은 값을 계산해 저장본에 남긴다. 이 함수는 같은 규칙을 코드로 확인하는 데 쓴다
 */
export function referenceForOrg(a: {
  lines: { billable: boolean; join_status?: string | null; tier: BillingTier }[];
  settlements: { contract_amount: number }[];
  perRequestFee: number | null | undefined;
  feeRate: number | null | undefined;
}): Omit<BillingReferenceRow, "org_id" | "org_name"> {
  const counted = a.lines.filter(countsForReference);
  const subscription = counted.filter((l) => l.tier === "subscription").length;
  const perQuote = counted.filter((l) => l.tier === "per_quote" || l.tier === "per_quote_success").length;
  const u = referenceUnit(a.perRequestFee);
  const r = referenceRate(a.feeRate);
  return {
    subscription_count: subscription,
    per_quote_count: perQuote,
    per_quote_unit: u.unit,
    per_quote_unit_source: u.source,
    per_quote_fee: perQuote * u.unit,
    success_count: a.settlements.length,
    success_contract_amount: a.settlements.reduce((t, s) => t + s.contract_amount, 0),
    success_rate: r.rate,
    success_rate_source: r.source,
    success_fee: a.settlements.reduce((t, s) => t + Math.round(s.contract_amount * r.rate), 0),
  };
}

/** 참고 수치 합계 (화면 아래 줄). 청구 합계와 따로 둔다 */
export function referenceTotals(rows: Pick<BillingReferenceRow, "subscription_count" | "per_quote_count" | "per_quote_fee" | "success_count" | "success_fee">[]): { subscription: number; perQuote: number; perQuoteFee: number; success: number; successFee: number } {
  const t = { subscription: 0, perQuote: 0, perQuoteFee: 0, success: 0, successFee: 0 };
  for (const r of rows) {
    t.subscription += r.subscription_count;
    t.perQuote += r.per_quote_count;
    t.perQuoteFee += r.per_quote_fee;
    t.success += r.success_count;
    t.successFee += r.success_fee;
  }
  return t;
}
