import { seoulMonthRange } from "./request-policy";

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

/** 성사수수료: 선정 견적 금액 × 기관 요율. 요율이 없으면 null (미정) */
export function successFee(selectedAmount: number, feeRate: number | null | undefined): number | null {
  if (feeRate == null || feeRate < 0) return null;
  return Math.round(selectedAmount * feeRate);
}
