/**
 * 의뢰자 비교표 읽기 (에이전트 compare_view, 2026-11-21 D3). 비교표 화면과 같은 규칙:
 * - 회신 도착 순(처음 제출한 때), 같으면 기관명 순. 순위·추천은 매기지 않는다.
 * - 선정 전에는 자유 입력란의 연락처를 가린다. 선정한 기관 것만 그대로.
 * - 시험별 포함 항목은 lib/compare-incl.ts 로 견준다.
 */
import type { QuoteRow, RfqRow } from "./data";
import type { DetailBundle } from "./detail-data";
import { maskedText } from "./contact-guard";
import { compareIncl } from "./compare-incl";
import { hasSchedule } from "./quote-schedule";

/** 회신 design.extra.incl (견적서에서 켠 평가·분석 항목). 없으면 예전 견적 */
export function inclOf(design: unknown): string[] | undefined {
  const x = design && typeof design === "object" ? (design as { extra?: { incl?: unknown } }).extra?.incl : undefined;
  return Array.isArray(x) ? x.filter((v): v is string => typeof v === "string") : undefined;
}

/** 제출한 견적을 회신 도착 순으로 */
export function arrivalOrder<T extends Pick<QuoteRow, "status" | "first_submitted_at" | "submitted_at" | "cro_name">>(quotes: T[]): T[] {
  const at = (q: T) => q.first_submitted_at ?? q.submitted_at ?? "";
  return quotes.filter((q) => q.status === "submitted").sort((a, b) => at(a).localeCompare(at(b)) || a.cro_name.localeCompare(b.cro_name, "ko"));
}

export function compareView(rfq: Pick<RfqRow, "rfq_no" | "selected_quote_id">, all: QuoteRow[], detail: DetailBundle | null) {
  const quotes = arrivalOrder(all);
  const open = (q: QuoteRow) => rfq.selected_quote_id === q.id;
  const mask = (q: QuoteRow, t: string | null | undefined) => (open(q) ? (t ?? "") : maskedText(t)) || null;
  const rowMap = new Map<number, string>();
  for (const q of quotes) for (const it of q.cro_quote_items ?? []) if (!rowMap.has(it.seq)) rowMap.set(it.seq, it.name);
  const seqs = [...rowMap.keys()].sort((a, b) => a - b);
  const itemOf = (q: QuoteRow, seq: number) => (q.cro_quote_items ?? []).find((i) => i.seq === seq);

  return {
    order: "arrival",
    selectedQuoteId: rfq.selected_quote_id ?? null,
    orgs: quotes.map((q) => {
      const dt = detail?.targets.find((t) => t.quoteId === q.id);
      return {
        quoteId: q.id,
        name: q.cro_name,
        total: q.total_amount ?? 0,
        weeks: (hasSchedule(q) ? q.final_weeks : null) ?? q.total_weeks ?? 0,
        start: q.start_date,
        valid: q.valid_until,
        pay: q.pay_terms,
        includes: q.includes ?? [],
        note: mask(q, q.note),
        selected: open(q),
        items: (q.cro_quote_items ?? []).map((i) => ({
          seq: i.seq, name: i.name, avail: i.avail ?? "", amount: i.amount, weeks: i.weeks,
          includes: inclOf(i.design) ?? null, reason: mask(q, i.reason),
        })),
        detail: dt ? { status: dt.status, total: dt.total, weeks: dt.weeks, note: mask(q, dt.note) } : null,
      };
    }),
    tests: seqs.map((seq) => {
      const lists = quotes.map((q) => { const it = itemOf(q, seq); return it && it.avail !== "불가" ? inclOf(it.design) ?? null : null; });
      const cmp = compareIncl(lists);
      return {
        seq, name: rowMap.get(seq)!,
        diff: cmp ? cmp.diff.map((r) => ({ item: r.key, byOrg: r.vals })) : [],
        common: cmp?.common ?? [],
      };
    }),
    path: `/app/r/${rfq.rfq_no}/compare`,
  };
}
