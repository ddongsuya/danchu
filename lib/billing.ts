import { seoulMonthRange } from "./request-policy";
import type { BillingAdjustmentRow, BillingReferenceRow, ReferenceSource } from "./db-types";

/**
 * 요금표 (2026-11-03 결정, 성사 수수료 계산은 2026-11-10 결정). DB 함수(supabase/migrations/0031_fee_schedule.sql, 0039_marginal_success_fee.sql)와 같은 값이다. 모든 금액은 부가세 별도.
 * - 일정: 사전예약 2027-01-01 ~ 2027-05-31, 시범 운영 2027-06-01 ~ 2027-12-31(기관도 무료), 정식 서비스 2028-01-01.
 *   청구 시작일(PAID_FROM) 전에 참여한 요청은 끝까지 청구하지 않는다.
 * - 의뢰자는 비용을 내지 않는다.
 * - 월 구독료 1,000,000원: 견적서 생성 툴, 견적서 디자인 리뉴얼권, 5,000만 원 미만 견적서 무제한 발송.
 * - 5,000만 원 이상 견적서: 송부 비용(견적 1건, 재제출·수정은 다시 청구하지 않음) + 단추를 통해 계약이 확정되면 성사 수수료.
 *     송부 비용: 5,000만 ~ 9,999만 원 30,000원 / 1억 원 이상 50,000원
 *     성사 수수료 (0039, 구간 초과분 누진): 확정된 계약 금액 중 5,000만 원 초과 1억 원까지 2%, 1억 원 초과 5억 원까지 5%, 5억 원 초과분 7% 를 더한다.
 *     구간 요율 하나를 금액 전체에 곱하지 않는다 (그러면 1억·5억 경계에서 수수료가 한꺼번에 뛴다).
 *     예: 8,000만 원 60만 원 / 1억 원 100만 원 / 3억 원 1,100만 원 / 5억 원 2,100만 원 / 7억 원 3,500만 원
 *   대상 판정은 선정 견적 금액 5,000만 원 이상. 예상은 선정 견적 금액으로, 정산은 확정된 계약 금액으로 계산한다.
 * - 그 초대에 기관 본인의 참여 기록이 있어야 청구한다 (0023). 운영자 대리 입력도 기관이 참여했으면 같다.
 * - 기관별 값(per_request_fee·fee_rate)은 요금표 대신 쓰는 특별 조건이다. 비어 있으면 요금표.
 * 기준 값은 tests/billing-rules.test.ts 가 SQL 과 같은지 확인한다.
 */
/** 시범 운영 시작 (서울) */
export const PILOT_FROM = "2027-06-01";
/** 청구 시작 (서울). 이 날 전에 참여한 요청은 청구하지 않는다 */
export const PAID_FROM = "2028-01-01";
/** 월 구독료 기준 금액 (원) */
export const SUBSCRIPTION_FEE = 1_000_000;
/** 이 금액 미만 견적은 월 구독료 구간 (송부 비용 없음) */
export const SUBSCRIPTION_MAX_EXCL = 50_000_000;
/** 이 금액 이상 견적은 송부 비용 + 성사 수수료 대상 */
export const SUCCESS_FEE_MIN = 50_000_000;

/** 5,000만 원 이상 구간 (아래쪽 경계 오름차순). 송부 비용(원)과, 그 구간에 걸친 금액(min 초과분)에 곱하는 성사 수수료율 */
export const FEE_BANDS: readonly { min: number; sendFee: number; rate: number; label: string }[] = [
  { min: 50_000_000, sendFee: 30_000, rate: 0.02, label: "5,000만 ~ 9,999만 원" },
  { min: 100_000_000, sendFee: 50_000, rate: 0.05, label: "1억 ~ 4억 9,999만 원" },
  { min: 500_000_000, sendFee: 50_000, rate: 0.07, label: "5억 원 이상" },
];

function bandOf(amount: number | null | undefined) {
  if (amount == null || !Number.isFinite(amount)) return null;
  let hit: (typeof FEE_BANDS)[number] | null = null;
  for (const b of FEE_BANDS) if (amount >= b.min) hit = b;
  return hit;
}

/** 견적서 송부 비용 (요금표). 5,000만 원 미만·금액 없음은 0. SQL billing_send_fee 와 같다 */
export function sendFee(amount: number | null | undefined): number {
  return bandOf(amount)?.sendFee ?? 0;
}

/**
 * 요금표 성사 수수료 (원, 0039). 구간마다 그 구간에 걸친 금액에만 그 구간의 요율을 곱해 더한다.
 * 5,000만 원 이하·금액 없음은 0. SQL billing_success_fee 와 같다 (백분율 정수로 더한 뒤 한 번만 반올림)
 */
export function scheduleSuccessFee(amount: number | null | undefined): number {
  if (amount == null || !Number.isFinite(amount) || amount <= SUCCESS_FEE_MIN) return 0;
  let pct = 0;
  FEE_BANDS.forEach((b, i) => {
    const top = FEE_BANDS[i + 1]?.min ?? Infinity;
    const part = Math.min(amount, top) - b.min;
    if (part > 0) pct += part * Math.round(b.rate * 100);
  });
  return Math.round(pct / 100);
}

/** 기관 특별 조건이 있으면 그 값, 없으면 요금표 */
export function effectiveSendFee(amount: number | null | undefined, orgFee: number | null | undefined): number {
  return orgFee ?? sendFee(amount);
}
/** 성사 수수료: 기관 특별 조건 요율이 있으면 금액 전체 × 그 요율, 없으면 요금표(구간 초과분 누진) */
export function effectiveSuccessFee(amount: number | null | undefined, orgRate: number | null | undefined): number {
  if (orgRate != null) return Math.round((amount ?? 0) * orgRate);
  return scheduleSuccessFee(amount);
}

/** 서울 날짜(YYYY-MM-DD)의 참여가 청구 시작일 전(무료)인지 */
export function joinedBeforePaid(seoulDate: string | null | undefined): boolean {
  return !!seoulDate && seoulDate < PAID_FROM;
}

/**
 * 참여 기록에 따른 청구 여부 (0023, 0031). 기관 본인이 청구 시작일 뒤에 참여(joined)한 초대의 견적만 청구한다.
 * legacy: 참여 기능 전에 작성 중·제출이던 견적. not_joined: 참여 기록 없음. pilot: 시범 판이거나 청구 시작일 전 참여. 모두 청구하지 않는다
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

/**
 * 견적 총액의 청구 구간. no_amount: 금액 미입력(아직 청구하지 않음).
 * per_quote 는 0020(1,000만 ~ 5,000만 원) 구간으로, 0031 뒤로는 나오지 않는다. 0031 전 마감 저장본을 읽을 때만 쓴다
 */
export type BillingTier = "no_amount" | "subscription" | "per_quote" | "per_quote_success";

export const TIER_LABEL: Record<BillingTier, string> = {
  no_amount: "금액 미입력",
  subscription: "5,000만 원 미만 (구독)",
  per_quote: "건당 이용료 (옛 기준)",
  per_quote_success: "송부 비용 + 성사 수수료 대상",
};

export function billingTier(amount: number | null | undefined): BillingTier {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return "no_amount";
  if (amount < SUBSCRIPTION_MAX_EXCL) return "subscription";
  if (amount < SUCCESS_FEE_MIN) return "per_quote";
  return "per_quote_success";
}

/** 송부 비용 대상인지 (5,000만 원 이상) */
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

/**
 * 계약 확인 (2026-10-20 결정, 0025). 기관이 체결(체결일·금액)을 보고하면 의뢰자가 확인하거나 이의를 낸다.
 * 이 기간 안에 이의가 없으면 예약 작업(auto_confirm_contracts)이 보고 내용대로 확정한다. 이의가 있으면 운영자가 정리할 때까지 정산하지 않는다.
 * 성사수수료 정산은 확인된 계약만, 확인된 달(서울)에, 확인된 계약 금액으로 한다 (대상 판정은 여전히 선정 견적 5,000만 원 이상).
 * DB 의 contract_confirm_due_at = 보고(또는 확인 전 정정) 시각 + 이 일수
 */
export const CONTRACT_CONFIRM_DAYS = 7;

/** 계약 확정 경로 (0025 rfq_awards.contract_confirmed_via). legacy 는 0025 전에 보고되어 보고 시각으로 확정한 계약 */
export const CONFIRM_VIA_LABEL: Record<string, string> = { sponsor: "의뢰자 확인", auto: "7일 뒤 자동 확정", operator: "운영자 확정", legacy: "확인 절차 전 보고" };


/** 금액 × 요율 (원 단위 반올림). 요율이 없으면 null. 기관 특별 조건 요율처럼 금액 전체에 곱하는 경우에 쓴다 */
export function successFee(amount: number, feeRate: number | null | undefined): number | null {
  if (feeRate == null || feeRate < 0) return null;
  return Math.round(amount * feeRate);
}

/**
 * 성사수수료 두 숫자.
 * - 예상(견적 기준): 선정 견적 금액으로 계산한 수수료. 안내용이며 청구 합계에 넣지 않는다
 * - 정산(계약 기준): 체결 계약 금액으로 계산한 수수료. 계약 상태가 signed 이고 계약이 확인됐을 때만 (0025).
 *   confirmed 를 넘기지 않으면(0025 전 화면) signed 만 본다
 * 선정 견적이 5,000만 원 미만이면 둘 다 대상 아님(eligible false, 금액 0).
 */
export function successFeeView(a: { quoteAmount: number | null | undefined; contractAmount: number | null | undefined; contractStatus: string | null | undefined; feeRate: number | null | undefined; confirmed?: boolean }): {
  eligible: boolean;
  /** 예상 (0031부터 요율 미정 없음) */
  expected: number | null;
  /** 정산. 체결·확인 전이면 0 (아직 없음) */
  settled: number | null;
  signed: boolean;
} {
  const eligible = successFeeEligible(a.quoteAmount);
  const signed = a.contractStatus === "signed" && a.contractAmount != null;
  if (!eligible) return { eligible, expected: 0, settled: 0, signed };
  // 기관 특별 조건 요율이 있으면 금액 전체에 곱하고, 없으면 요금표의 구간 초과분 누진 (0039 billing_awards 와 같다)
  const expected = a.contractStatus === "not_signed" ? 0 : effectiveSuccessFee(a.quoteAmount, a.feeRate);
  const settled = signed && a.confirmed !== false ? effectiveSuccessFee(a.contractAmount, a.feeRate) : 0;
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
 * 조정 항목은 돌려드리는 금액(음수)만 넣는다 (2026-10-21 결정, 0026). 적게 받은 금액은 다시 청구하지 않는다. 화면·API 가 같은 문구를 쓴다
 */
export const CLOSED_MONTH_NOTE = "마감한 달은 다시 열 수 없습니다. 돌려드릴 금액은 다음 달 명세에 조정 항목으로 넣고, 적게 받은 금액은 다시 청구하지 않습니다.";

/** 조정 항목은 돌려드리는 금액만 (2026-10-21 결정, 0026 billing_adjustments_credit_only) */
export const ADJUSTMENT_CREDIT_ONLY_NOTE = "조정 항목은 돌려드릴 금액만 넣을 수 있습니다. 마감한 달은 다시 청구하지 않으므로, 적게 받은 금액은 받지 않습니다.";

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
 * 시범 기간 참고 수치 (0024, 0031 부터 요금표로 계산. billing_reference 와 같은 계산).
 * 시범(청구 시작일 전 또는 시범 판)·legacy 참여라 청구하지 않는 견적과 체결을 "유료였다면"으로 센다. 합계·청구에는 넣지 않는다.
 * 기관 특별 조건(송부 비용·성사 수수료율)이 있으면 그 값을, 없으면 요금표를 쓴다.
 */
/** 참고 단가 이름표 */
export const REFERENCE_UNIT_LABEL = "요금표";
/** 참고 수치 이름표 */
export const REFERENCE_LABEL = "참고 (시범 기간, 청구 안 함)";

/** 참고 수치에 세는 견적인지: 운영자가 제외하지 않았고, 시범 또는 legacy 참여 */
export function countsForReference(line: { billable: boolean; join_status?: string | null }): boolean {
  return line.billable && (line.join_status === "pilot" || line.join_status === "legacy");
}

/** 단가·요율 출처 이름 */
export const REFERENCE_SOURCE_LABEL: Record<ReferenceSource, string> = { org: "기관 특별 조건", schedule: "요금표", reference: "옛 참고 단가" };

/** 요율 표시 (0.03 → "3%") */
export function rateLabel(rate: number): string {
  return `${Math.round(rate * 10000) / 100}%`;
}

/**
 * 기관 1곳의 참고 수치. lines 는 그 기관의 그 달 견적(billing_lines), settlements 는 시범·legacy 초대의 체결 확인 수주
 * (계약 금액과 선정 견적 금액). DB(billing_reference)가 같은 값을 계산해 저장본에 남긴다. 이 함수는 같은 규칙을 코드로 확인하는 데 쓴다
 */
export function referenceForOrg(a: {
  lines: { billable: boolean; join_status?: string | null; tier: BillingTier; total_amount?: number | null }[];
  settlements: { contract_amount: number; quote_amount?: number | null }[];
  perRequestFee: number | null | undefined;
  feeRate: number | null | undefined;
}): Omit<BillingReferenceRow, "org_id" | "org_name"> {
  const counted = a.lines.filter(countsForReference);
  const subscription = counted.filter((l) => l.tier === "subscription").length;
  const sendLines = counted.filter((l) => l.tier === "per_quote" || l.tier === "per_quote_success");
  return {
    subscription_count: subscription,
    per_quote_count: sendLines.length,
    per_quote_unit: a.perRequestFee ?? 0,
    per_quote_unit_source: a.perRequestFee == null ? "schedule" : "org",
    per_quote_fee: sendLines.reduce((t, l) => t + effectiveSendFee(l.total_amount, a.perRequestFee), 0),
    success_count: a.settlements.length,
    success_contract_amount: a.settlements.reduce((t, s) => t + s.contract_amount, 0),
    success_rate: a.feeRate ?? 0,
    success_rate_source: a.feeRate == null ? "schedule" : "org",
    success_fee: a.settlements.reduce((t, s) => t + effectiveSuccessFee(s.contract_amount, a.feeRate), 0),
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
