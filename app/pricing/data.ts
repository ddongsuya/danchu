import { PLANS, type PlanId } from "@/lib/plans";
import { FEE_BANDS } from "@/lib/billing";

/** 요금제 카드의 한 줄 소개와 결제 표기 */
export const PLAN_META: Record<PlanId, { who: string; terms: string }> = {
  free: { who: "견적 요청을 받아 보는 기관", terms: "카드 등록 없음" },
  plus: { who: "견적을 자주 보내는 기관", terms: "부가세 별도, 매월 카드 자동결제" },
  pro: { who: "견적서와 고객 관리까지 단추에서", terms: "부가세 별도, 매월 카드 자동결제" },
};

export function priceOf(id: PlanId): string {
  const n = PLANS[id].price;
  return n ? `${n / 10_000}만 원` : "0원";
}

/** 금액 구간, 송부료, 성사 수수료율 (lib/billing.ts FEE_BANDS) */
export const FEE_ROWS: [string, string, string][] = FEE_BANDS.map((b) => [b.label, `${b.sendFee / 10_000}만 원`, `${Math.round(b.rate * 100)}%`]);
export const FEE_NOTE = "계약 금액 3억 원의 성사 수수료 1,100만 원. 부가세 별도";

export const FAQ: { q: string; a: string }[] = [
  { q: "결제는 어떻게 하나요?", a: "등록한 카드로 매월 1일에 자동 결제돼요. 요금에 부가세 10%가 더해져요." },
  { q: "요금제를 바꾸면 언제부터 적용되나요?", a: "올리면 바로 적용되고, 이번 달 남은 날만큼 차액이 결제돼요. 내리거나 해지하면 다음 달 1일부터 적용돼요." },
  { q: "무료 요금제의 월 5건은 언제 다시 채워지나요?", a: "매월 1일에 다시 5건이 돼요." },
  { q: "시범 운영 중 참여한 요청에도 수수료가 붙나요?", a: "2027년 12월 31일까지 참여한 요청은 정식 서비스 뒤에도 송부료·성사 수수료가 없어요." },
];
