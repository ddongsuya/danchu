/**
 * 지급 조건 줄 (2026-11-26 시안 v7). 기관 회신에서 "단계 이름 · 비율 · 지급 시점" 줄을 더하고 빼고,
 * 계약서(안) 제4조가 줄마다 금액으로 옮긴다.
 *
 * 저장은 지금 칸(cro_quotes.pay_terms, text)에 글로 한다: "착수금 30% 계약 시 · 중도금 40% … · 잔금 30% …".
 * 비교표·견적 상세는 이 글을 그대로 보여 주고(lib/format payTerms), 예전 숫자 입력("30 · 40 · 30")도 줄로 읽는다.
 */
import { payTerms } from "./format";

export type PayRow = { label: string; pct: number; when: string };

/** 지급 시점 고르기 (회신 화면의 선택 칸) */
export const PAY_WHEN = ["계약 시", "착수 시", "중간 보고서 제출 시", "최종 보고서 초안 제출 시", "최종 보고서 제출 시"] as const;
export const PAY_MAX_ROWS = 6;

export const DEFAULT_PAY: PayRow[] = [
  { label: "착수금", pct: 30, when: "계약 시" },
  { label: "중도금", pct: 40, when: "중간 보고서 제출 시" },
  { label: "잔금", pct: 30, when: "최종 보고서 제출 시" },
];

const LEGACY_WHEN: Record<string, string> = { 선급: "계약 시", 중도: "중간 보고서 제출 시", 잔금: "최종 보고서 제출 시" };
const clean = (s: string, max: number) => s.replace(/[·%]/g, "").replace(/\s+/g, " ").trim().slice(0, max);

export function formatPay(rows: PayRow[]): string {
  return rows.map((r) => `${clean(r.label, 20)} ${Math.round(r.pct)}% ${clean(r.when, 30)}`.trim()).join(" · ");
}

/** 저장 글 → 줄. 예전 숫자 입력은 선급·중도·잔금으로, 줄로 읽을 수 없는 자유 글은 [] */
export function parsePay(s: string | null | undefined): PayRow[] {
  const text = (s ?? "").trim();
  if (!text) return [];
  const segs = text.split(" · ");
  const rows = segs.map((seg) => /^(.+?)\s+(\d{1,3})%\s*(.*)$/.exec(seg.trim()));
  if (rows.every(Boolean)) return rows.map((m) => ({ label: m![1].trim(), pct: Number(m![2]), when: m![3].trim() }));
  // 예전 칸: "30 · 40 · 30", "50/50" → payTerms 가 "선급 30% · 중도 40% · 잔금 30%" 로 풀어 준다
  const legacy = payTerms(text);
  if (legacy === text) return [];
  return legacy.split(" · ").map((x) => {
    const [label, pct] = x.split(" ");
    return { label, pct: Number(pct.replace("%", "")), when: LEGACY_WHEN[label] ?? "" };
  });
}

/** 회신 전 검사. 줄이 없으면 지급 조건을 비운 것으로 보고 통과 */
export function payError(rows: PayRow[]): string | null {
  for (const [i, r] of rows.entries()) {
    if (!clean(r.label, 20)) return `${i + 1}번째 줄의 단계 이름을 적어 주세요.`;
    if (!Number.isInteger(r.pct) || r.pct < 1 || r.pct > 100) return `${i + 1}번째 줄의 비율은 1~100% 사이로 적어 주세요.`;
  }
  const sum = rows.reduce((a, r) => a + r.pct, 0);
  if (rows.length && sum !== 100) return `지급 비율 합계가 100%가 되어야 해요. 지금 ${sum}%예요.`;
  return null;
}

/** 줄마다 금액(원 미만 버림), 버려진 원은 마지막 줄에 더해 합계를 맞춘다 */
export function payAmounts(rows: PayRow[], total: number): number[] {
  const out = rows.map((r) => Math.floor((total * r.pct) / 100));
  if (out.length) out[out.length - 1] += total - out.reduce((a, n) => a + n, 0);
  return out;
}
