import { seoulMonthRange } from "./request-policy";

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
export const JOIN_STATUS_NOTE: Record<"legacy" | "not_joined", string> = {
  legacy: "참여 기능 도입 전 견적, 청구하지 않음",
  not_joined: "참여 기록 없음, 청구하지 않음",
};
/** 청구에 넣지 않는 참여 상태면 그 안내, 아니면 빈 문자열. 0023 전 저장본(값 없음)은 안내 없음 */
export function joinStatusNote(status: string | null | undefined): string {
  return status === "legacy" || status === "not_joined" ? JOIN_STATUS_NOTE[status] : "";
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
