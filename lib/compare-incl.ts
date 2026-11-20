/**
 * 비교표 시험별 포함 항목 (2026-11-21 시안 승인, D3). 비교표 화면과 에이전트 compare_view 가 같은 규칙을 쓴다.
 * - 기관이 견적서에서 켠 평가·분석 항목(회신 design.extra.incl)을 시험 줄마다 견준다.
 * - 기관마다 갈리는 항목은 줄로(포함/미포함), 모든 기관이 같은 항목은 공통 포함으로 묶는다.
 * - 불가 줄이나 예전 견적(항목 없음)은 "-" 로 두고 견주지 않는다.
 */

/** 다른 곳과 값이 갈리는 칸. 두 곳 이상이 같은 값을 낸 줄에서만 표시한다 */
export function oddOnes(vals: string[]): boolean[] {
  const count = new Map<string, number>();
  for (const v of vals) count.set(v, (count.get(v) ?? 0) + 1);
  const max = Math.max(0, ...count.values());
  return vals.map((v) => max >= 2 && (count.get(v) ?? 0) < max);
}

export type InclRow = { key: string; vals: ("포함" | "미포함" | "-")[]; odd: boolean[] };

/** lists: 기관 순서대로 그 시험의 포함 항목(없으면 null). 비교할 값이 하나도 없으면 null */
export function compareIncl(lists: (string[] | null | undefined)[]): { diff: InclRow[]; common: string[] } | null {
  const known = lists.filter((l): l is string[] => Array.isArray(l));
  if (!known.length) return null;
  const keys = [...new Set(known.flat())];
  const common = keys.filter((k) => known.length === lists.length && known.every((l) => l.includes(k)));
  const diff = keys.filter((k) => !common.includes(k)).map((key) => {
    const vals = lists.map((l) => (Array.isArray(l) ? (l.includes(key) ? "포함" : "미포함") : "-") as InclRow["vals"][number]);
    // 갈리는 칸 표시는 견적이 있는 기관끼리만 견준다
    const idx = vals.map((v, i) => (v === "-" ? -1 : i)).filter((i) => i >= 0);
    const o = oddOnes(idx.map((i) => vals[i]));
    return { key, vals, odd: vals.map((_, i) => { const k = idx.indexOf(i); return k >= 0 && o[k]; }) };
  });
  return { diff, common };
}
