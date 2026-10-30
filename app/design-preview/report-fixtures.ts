import type { CompareCol, CompareRowDef } from "@/components/CompareBoard";
import type { Funnel } from "@/lib/request-story";

/** 비교 보고서 미리보기용 예시 (DANCHU_DESIGN_PREVIEW=1 에서만). 실제 기관·금액이 아니다. 항목 금액 합이 총액과 맞게 만든 숫자다 */
export const REPORT_ROWS: CompareRowDef[] = [
  { seq: 1, name: "반복투여 4주 · 설치류", category: "일반독성" },
  { seq: 2, name: "반복투여 4주 · 비설치류", category: "일반독성" },
  { seq: 3, name: "복귀돌연변이(Ames, TG 471)", category: "유전독성" },
  { seq: 4, name: "염색체이상 in vitro(TG 473)", category: "유전독성" },
  { seq: 5, name: "소핵 in vivo(랫드)", category: "유전독성" },
  { seq: 6, name: "hERG(in vitro)", category: "안전성약리" },
  { seq: 7, name: "TK(독성동태)", category: "PK/TK/ADME·생체시료분석" },
];

const M = 10000;
const base = { start: "2026-11-16", valid: "2026-11-30", pay: "선급 30%, 잔금 70%", includes: ["임상병리", "조직병리(검경 포함)"], note: null, glpOk: true, glpMissing: [], glp: ["식약처(KGLP)"], hasPdf: true, selected: false, auto: false };
const items = (v: [number, number][], tk: string) => [
  ...v.map(([a, w], i) => ({ seq: i + 1, avail: "가능", amount: a * M, weeks: w })),
  { seq: 7, avail: tk, amount: null, weeks: null },
];
export const REPORT_COLS: CompareCol[] = [
  { ...base, id: "rp-a", name: "예시 기관 A", total: 32460 * M, weeks: 13, final: 35, finalReport: 30, unavailable: ["TK(독성동태)"], conditional: 0, items: items([[9800, 6], [14200, 13], [1600, 3], [2100, 4], [1900, 4], [2860, 3]], "불가") },
  { ...base, id: "rp-b", name: "예시 기관 B", total: 36850 * M, weeks: 20, final: 30, finalReport: 26, unavailable: ["TK(독성동태)"], conditional: 0, items: items([[11500, 20], [15800, 13], [1800, 3], [2400, 4], [2050, 4], [3300, 3]], "불가") },
];

export const STORY_FUNNEL: Funnel = { sent: 5, opened: 4, joined: 3, submitted: 2, rest: 2 };
