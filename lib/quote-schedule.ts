/**
 * 저장된 견적(cro_quotes + cro_quote_items, 0029) → 일정 계산.
 * 의뢰자 비교표·견적 상세가 쓴다. 계산은 회신 화면 미리보기와 같은 planQuote 다
 */
import { MAX_STEPS, type ScheduleStep } from "./cro-data";
import { planQuote, type SchedulePlan } from "./schedule";

/** 저장된 일정 단계(jsonb) → 화면 값. 모양이 맞지 않는 항목은 버린다 */
export function stepsOf(raw: unknown): ScheduleStep[] {
  if (!Array.isArray(raw)) return [];
  const out: ScheduleStep[] = [];
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    if (typeof o.seq !== "number" || typeof o.name !== "string") continue;
    const after = Array.isArray(o.after) ? o.after.filter((n): n is number => typeof n === "number") : [];
    out.push({ seq: o.seq, name: o.name, weeks: typeof o.weeks === "number" ? String(o.weeks) : typeof o.weeks === "string" ? o.weeks : "", after });
  }
  return out.slice(0, MAX_STEPS);
}

type StoredItem = {
  seq: number; name: string; category: string; avail: string | null; weeks: number | null;
  report_weeks?: number | null; translation_weeks?: number | null; after_seqs?: number[] | null;
};

export function planOfStored(q: { schedule_steps?: unknown; cro_quote_items?: StoredItem[] | null }): SchedulePlan {
  const items = [...(q.cro_quote_items ?? [])].sort((a, b) => a.seq - b.seq);
  return planQuote({
    rows: items.map((it) => ({ seq: it.seq, name: it.name, category: it.category })),
    items: items.map((it) => ({ seq: it.seq, avail: it.avail, weeks: it.weeks, afterSeqs: it.after_seqs ?? [], reportWeeks: it.report_weeks ?? null, translationWeeks: it.translation_weeks ?? null })),
    steps: stepsOf(q.schedule_steps),
  });
}

/** 일정 정보를 담은 견적인지 (0029 이전 견적은 최종보고서 주가 없다) */
export const hasSchedule = (q: { final_weeks?: number | null }) => typeof q.final_weeks === "number" && q.final_weeks > 0;
