/**
 * 비교 보고서의 분석 숫자 (2026-10-29 대표 지시: 비교견적표 → 금액·기간·항목 분석 → 시험 설명과 근거).
 * 기관이 낸 값만 계산한다. 단추가 기준값·적정가를 정하거나 순위를 매기지 않는다 (CLAUDE.md "단추는 중립").
 */

export type ReportItem = { seq: number; avail: string; amount: number | null; weeks: number | null };
export type ReportCol = { id: string; name: string; total: number; weeks: number; final?: number | null; items: ReportItem[] };
export type ReportRow = { seq: number; name: string; category: string };

/** 기관의 전체 기간: 일정표(최종보고서까지)가 있으면 그것, 없으면 가장 긴 항목 기간 */
export const spanOf = (c: ReportCol) => c.final ?? (c.weeks || null);

const AVAIL_ORDER = ["가능", "조건부 가능", "불가"];
/** 기관이 그 항목에 답한 상태. 행이 없으면 "회신 없음" */
export function availOf(c: ReportCol, seq: number): string {
  const it = c.items.find((i) => i.seq === seq);
  if (!it) return "회신 없음";
  return AVAIL_ORDER.includes(it.avail) ? it.avail : it.avail || "가능";
}

export function range(vals: (number | null | undefined)[]): { min: number; max: number } | null {
  const v = vals.filter((x): x is number => typeof x === "number" && x > 0);
  if (!v.length) return null;
  return { min: Math.min(...v), max: Math.max(...v) };
}

/** 기관끼리 다르게 답한 항목: 가능 여부가 다르거나, 둘 이상이 낸 기간이 다르다 */
export function differingRows(cols: ReportCol[], rows: ReportRow[]): { row: ReportRow; avail: boolean; weeks: boolean }[] {
  if (cols.length < 2) return [];
  return rows.flatMap((row) => {
    const av = new Set(cols.map((c) => availOf(c, row.seq)));
    const wk = new Set(cols.map((c) => c.items.find((i) => i.seq === row.seq)?.weeks).filter((w): w is number => typeof w === "number" && w > 0));
    const avail = av.size > 1;
    const weeks = wk.size > 1;
    return avail || weeks ? [{ row, avail, weeks }] : [];
  });
}

/** 모든 기관이 불가로 답한 항목 */
export function unavailableEverywhere(cols: ReportCol[], rows: ReportRow[]): ReportRow[] {
  if (!cols.length) return [];
  return rows.filter((r) => cols.every((c) => availOf(c, r.seq) === "불가"));
}

/** 금액 차이가 가장 큰 항목 (둘 이상의 기관이 금액을 낸 항목 중 최고/최저 비율이 가장 큰 것) */
export function widestItem(cols: ReportCol[], rows: ReportRow[]): { row: ReportRow; values: { name: string; amount: number; weeks: number | null }[] } | null {
  let best: { row: ReportRow; ratio: number; values: { name: string; amount: number; weeks: number | null }[] } | null = null;
  for (const row of rows) {
    const values = cols.flatMap((c) => {
      const it = c.items.find((i) => i.seq === row.seq);
      return it && it.avail !== "불가" && typeof it.amount === "number" && it.amount > 0 ? [{ name: c.name, amount: it.amount, weeks: it.weeks }] : [];
    });
    if (values.length < 2) continue;
    const amounts = values.map((v) => v.amount);
    const ratio = Math.max(...amounts) / Math.min(...amounts);
    if (ratio > 1 && (!best || ratio > best.ratio)) best = { row, ratio, values };
  }
  return best ? { row: best.row, values: best.values } : null;
}

/** 기관마다 금액이 가장 큰 분야와 그 비중 (항목 금액 합 기준, 0~1) */
export function topCategoryShare(c: ReportCol, rows: ReportRow[]): { category: string; share: number } | null {
  const by = new Map<string, number>();
  let sum = 0;
  for (const it of c.items) {
    if (it.avail === "불가" || typeof it.amount !== "number" || it.amount <= 0) continue;
    const cat = rows.find((r) => r.seq === it.seq)?.category ?? "기타";
    by.set(cat, (by.get(cat) ?? 0) + it.amount);
    sum += it.amount;
  }
  if (!sum) return null;
  const [category, v] = [...by.entries()].sort((a, b) => b[1] - a[1])[0];
  return { category, share: v / sum };
}
