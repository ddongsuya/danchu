import { PAID_FROM, SUBSCRIPTION_MAX_EXCL } from "./billing";

/**
 * 기관 요금제 (2026-11-13 확정). DB 0044_cro_plans.sql 과 같은 값이다. 금액은 부가세 별도.
 * - 무료 0원: 5,000만 원 미만 견적 월 5건, 담당자 1명
 * - Plus 월 50만 원: 5,000만 원 미만 견적 무제한, 시험 관리, 담당자 3명
 * - Pro 월 100만 원: Plus 전체 + 견적서 작성 툴, 견적서 디자인 브랜딩 연 1회, 고객 관리(견적서 작성 툴 연동), 담당자 무제한
 * 5,000만 원 이상 견적의 송부료·성사 수수료는 요금제와 관계없이 같다 (lib/billing.ts).
 * 요청 수신 범위와 비교표 노출은 요금제와 관계없이 같다 (중립). 요금제로 배포·정렬을 바꾸지 않는다.
 *
 * 시범 운영(PAID_FROM 전)은 전 요금제 무료이고 기능 제한이 없다. 이 기간에 고른 요금제는 PAID_FROM 부터 적용할 예약이다.
 * 정식 서비스 뒤: 올리기는 바로 적용(남은 날만큼 차액), 내리기·해지는 다음 결제일(다음 달 1일)부터.
 * 결제(카드 자동결제)는 PG 연동 뒤 붙는다. 지금은 변경 기록(cro_plan_changes)에 차액만 남긴다.
 */

/**
 * 요금 금액 공개 여부 (2026-11-13 결정). 시범 운영 중에는 요금제·송부료·수수료 금액을 화면에 보이지 않는다.
 * 정식 요금표를 알리는 날(적용일 30일 전, 기관 이용약관 제9조)에 true 로 바꾼다. 요금 계산과 운영자 화면은 이 값과 관계없다.
 */
export const PRICE_OPEN: boolean = false;

export type PlanId = "free" | "plus" | "pro";
export type PlanFeature = "tests" | "quote_tool" | "branding" | "crm";

export const PLAN_IDS: readonly PlanId[] = ["free", "plus", "pro"];

export type PlanDef = {
  id: PlanId;
  name: string;
  /** 월 요금 (원, 부가세 별도) */
  price: number;
  /** 5,000만 원 미만 견적 월 송부 한도. null 이면 무제한 */
  monthlyQuotes: number | null;
  /** 담당자 계정 한도. null 이면 무제한 */
  seats: number | null;
  features: readonly PlanFeature[];
  /** 요금제 목록에 쓰는 항목 (위 단계도 줄이지 않고 다 적는다) */
  items: readonly string[];
};

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: "free", name: "무료", price: 0, monthlyQuotes: 5, seats: 1, features: [],
    items: ["견적 요청 수신·회신", "5,000만 원 미만 견적 월 5건", "담당자 1명"],
  },
  plus: {
    id: "plus", name: "Plus", price: 500_000, monthlyQuotes: null, seats: 3, features: ["tests"],
    items: ["견적 요청 수신·회신", "5,000만 원 미만 견적 무제한", "시험 관리", "담당자 3명"],
  },
  pro: {
    id: "pro", name: "Pro", price: 1_000_000, monthlyQuotes: null, seats: null, features: ["tests", "quote_tool", "branding", "crm"],
    items: ["견적 요청 수신·회신", "5,000만 원 미만 견적 무제한", "시험 관리", "견적서 작성 툴 (엑셀·PDF)", "견적서 디자인 브랜딩 연 1회", "고객 관리, 견적서 작성 툴 연동", "담당자 무제한"],
  },
};

export const FEATURE_LABEL: Record<PlanFeature, string> = {
  tests: "시험 관리",
  quote_tool: "견적서 작성 툴",
  branding: "견적서 디자인 브랜딩",
  crm: "고객 관리",
};

/** 이 기능이 처음 들어가는 요금제 */
export function planFor(feature: PlanFeature): PlanId {
  return PLAN_IDS.find((id) => PLANS[id].features.includes(feature)) ?? "pro";
}

const RANK: Record<PlanId, number> = { free: 0, plus: 1, pro: 2 };
export function isPlanId(v: unknown): v is PlanId {
  return v === "free" || v === "plus" || v === "pro";
}

type OrgPlan = { plan?: string | null; plan_next?: string | null; plan_next_from?: string | null };

/** 시범 운영 중인지 (서울 날짜). 이 기간에는 기능 제한이 없다 */
export function inPilotPeriod(today: string): boolean {
  return today < PAID_FROM;
}

/** 그 날의 요금제. 예약한 요금제는 적용일부터 쓴다 */
export function planOn(org: OrgPlan | null | undefined, today: string): PlanId {
  if (org && isPlanId(org.plan_next) && org.plan_next_from && org.plan_next_from <= today) return org.plan_next;
  return isPlanId(org?.plan) ? org.plan : "free";
}

/** 예약 중인 변경 (적용일이 아직 오지 않은 것) */
export function pendingPlan(org: OrgPlan | null | undefined, today: string): { plan: PlanId; from: string } | null {
  if (!org || !isPlanId(org.plan_next) || !org.plan_next_from || org.plan_next_from <= today) return null;
  return { plan: org.plan_next, from: org.plan_next_from };
}

/** 그 날 쓸 수 있는 기능인지. 시범 운영 중에는 모두 쓸 수 있다 */
export function canUse(org: OrgPlan | null | undefined, feature: PlanFeature, today: string): boolean {
  if (inPilotPeriod(today)) return true;
  return PLANS[planOn(org, today)].features.includes(feature);
}

/** 담당자 계정 한도. null 이면 무제한 (시범 운영 중 포함) */
export function seatLimit(org: OrgPlan | null | undefined, today: string): number | null {
  if (inPilotPeriod(today)) return null;
  return PLANS[planOn(org, today)].seats;
}

/** 5,000만 원 미만 견적 월 송부 한도. null 이면 무제한 (시범 운영 중 포함) */
export function monthlyQuoteLimit(org: OrgPlan | null | undefined, today: string): number | null {
  if (inPilotPeriod(today)) return null;
  return PLANS[planOn(org, today)].monthlyQuotes;
}

/** 월 한도에 세는 견적인지 (5,000만 원 미만) */
export function countsTowardQuota(total: number | null | undefined): boolean {
  return (total ?? 0) < SUBSCRIPTION_MAX_EXCL;
}

/** 다음 달 1일 (서울 날짜 YYYY-MM-DD) */
export function firstOfNextMonth(today: string): string {
  const [y, m] = today.split("-").map(Number);
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
}

function daysInMonth(today: string): number {
  const [y, m] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** 이번 달 남은 날 (오늘 포함) */
export function remainingDays(today: string): number {
  return daysInMonth(today) - Number(today.slice(8, 10)) + 1;
}

/** 올리기 차액 (원, 부가세 별도): 두 요금 차이 × 남은 날 / 그 달 날 수, 반올림 */
export function proratedUpgrade(from: PlanId, to: PlanId, today: string): number {
  const diff = PLANS[to].price - PLANS[from].price;
  if (diff <= 0) return 0;
  return Math.round((diff * remainingDays(today)) / daysInMonth(today));
}

export type PlanChange =
  | { kind: "same"; plan: PlanId }
  | { kind: "reserve"; plan: PlanId; from: string }
  | { kind: "cancel"; plan: PlanId }
  | { kind: "upgrade"; plan: PlanId; from: string; prorated: number; periodEnd: string }
  | { kind: "downgrade"; plan: PlanId; from: string };

/**
 * 요금제를 to 로 바꾸면 어떻게 되는지.
 * - 시범 운영 중: PAID_FROM 부터 적용할 예약 (같은 예약이면 same)
 * - 정식 뒤 올리기: 오늘부터, 남은 날 차액
 * - 정식 뒤 내리기: 다음 달 1일부터
 * - 지금 요금제로 되돌리기: 예약 취소 (예약이 없으면 same)
 */
export function planChange(org: OrgPlan | null | undefined, to: PlanId, today: string): PlanChange {
  if (inPilotPeriod(today)) {
    if (org?.plan_next === to && org.plan_next_from === PAID_FROM) return { kind: "same", plan: to };
    return { kind: "reserve", plan: to, from: PAID_FROM };
  }
  const cur = planOn(org, today);
  if (to === cur) return pendingPlan(org, today) ? { kind: "cancel", plan: to } : { kind: "same", plan: to };
  if (RANK[to] > RANK[cur]) {
    const [y, m] = today.split("-");
    return { kind: "upgrade", plan: to, from: today, prorated: proratedUpgrade(cur, to, today), periodEnd: `${y}-${m}-${String(daysInMonth(today)).padStart(2, "0")}` };
  }
  return { kind: "downgrade", plan: to, from: firstOfNextMonth(today) };
}

/** 두 요금제의 차이 항목 (화면의 변경 확인 표) */
export function planDiff(from: PlanId, to: PlanId): { label: string; from: string; to: string }[] {
  const a = PLANS[from];
  const b = PLANS[to];
  const rows: { label: string; from: string; to: string }[] = [];
  const q = (p: PlanDef) => (p.monthlyQuotes == null ? "무제한" : `월 ${p.monthlyQuotes}건`);
  const seats = (p: PlanDef) => (p.seats == null ? "무제한" : `${p.seats}명`);
  const has = (p: PlanDef, f: PlanFeature) => (p.features.includes(f) ? (f === "branding" ? "연 1회" : "포함") : "미제공");
  if (q(a) !== q(b)) rows.push({ label: "5,000만 원 미만 견적", from: q(a), to: q(b) });
  for (const f of ["tests", "quote_tool", "branding", "crm"] as const) {
    if (has(a, f) !== has(b, f)) rows.push({ label: FEATURE_LABEL[f], from: has(a, f), to: has(b, f) });
  }
  if (seats(a) !== seats(b)) rows.push({ label: "담당자 계정", from: seats(a), to: seats(b) });
  return rows;
}
