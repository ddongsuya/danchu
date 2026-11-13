import { maskedText } from "./contact-guard";
import { getSupabaseAdmin } from "./supabase";
import { glpCoverage } from "./quote-items";
import { designOfStored, explainOf } from "./catalog";
import { hasSchedule } from "./quote-schedule";
import { loadDetail } from "./detail-data";
import type { getRfqByNo, getRfqDetail } from "./data";
import type { CompareCol } from "@/components/CompareBoard";

type Rfq = NonNullable<Awaited<ReturnType<typeof getRfqByNo>>>;
type Detail = Awaited<ReturnType<typeof getRfqDetail>>;

/**
 * 비교표의 열(기관)과 행(시험). 비교 보고서 화면과 엑셀 내려받기가 같은 값을 쓴다.
 * 공개 여부와 소유 확인은 부르는 쪽에서 한다. 선정 전 자유 입력란의 연락처는 여기서 가린다.
 */
export async function loadCompare(rfq: Rfq, d: Detail) {
  // 금액 오름차순, 같으면 기관명 순. 정렬이 없으면 새로 고칠 때마다 열 순서가 바뀐다
  const quotes = d.quotes.filter((q) => q.status === "submitted").sort((a, b) => (a.total_amount ?? 0) - (b.total_amount ?? 0) || a.cro_name.localeCompare(b.cro_name, "ko"));
  const orgIds = quotes.map((q) => q.cro_org_id).filter((x): x is string => !!x);
  const sb = getSupabaseAdmin()!;
  const { data: orgs } = orgIds.length ? await sb.from("cro_orgs").select("id, glp_certs, aaalac").in("id", orgIds) : { data: [] };
  const certsOf = new Map((orgs ?? []).map((o) => [o.id as string, (o.glp_certs ?? []) as string[]]));
  const authorities = Array.isArray(rfq.payload.authority) ? (rfq.payload.authority as string[]) : [];
  // 행은 첫 견적이 아니라 모든 견적의 항목 합집합 (어느 기관이 항목을 빠뜨려도 행이 사라지지 않게)
  const rowMap = new Map<number, { seq: number; name: string; category: string }>();
  for (const q of quotes) for (const it of q.cro_quote_items ?? []) if (!rowMap.has(it.seq)) rowMap.set(it.seq, { seq: it.seq, name: it.name, category: it.category });
  const rows = [...rowMap.values()].sort((a, b) => a.seq - b.seq);

  // 2차 상세 견적 (0042): 요청한 기관의 열에 1차와 나란히 보인다
  const detail = await loadDetail(rfq.id);
  const cols: CompareCol[] = quotes.map((q) => {
    const dt = detail?.targets.find((t) => t.quoteId === q.id);
    const cov = glpCoverage(authorities, certsOf.get(q.cro_org_id ?? "") ?? []);
    const items = q.cro_quote_items ?? [];
    const unavailable = items.filter((i) => i.avail === "불가").map((i) => i.name);
    return {
      id: q.id,
      name: q.cro_name,
      total: q.total_amount ?? 0,
      weeks: q.total_weeks ?? 0,
      final: hasSchedule(q) ? q.final_weeks : null,
      finalReport: hasSchedule(q) ? (q.final_report_weeks ?? q.final_weeks) : null,
      start: q.start_date,
      valid: q.valid_until,
      pay: q.pay_terms,
      includes: q.includes ?? [],
      // 선정 전 자유 입력란의 연락처는 가린다 (lib/contact-guard.ts). 선정한 기관 것만 그대로
      note: rfq.selected_quote_id === q.id ? q.note : maskedText(q.note),
      glpOk: cov.ok,
      glpMissing: cov.missing,
      glp: certsOf.get(q.cro_org_id ?? "") ?? [],
      unavailable,
      conditional: items.filter((i) => i.avail === "조건부 가능").length,
      items: items.map((i) => ({ seq: i.seq, avail: i.avail ?? "", amount: i.amount, weeks: i.weeks, design: designOfStored(i.design), note: (() => { const t = [i.reason, i.design && typeof i.design.note === "string" ? i.design.note : ""].filter(Boolean).join(" · "); return (rfq.selected_quote_id === q.id ? t : maskedText(t)) || undefined; })(), explain: explainOf(rows.find((r) => r.seq === i.seq)?.category ?? "", i.design?.extra) })),
      hasPdf: !!q.pdf_path,
      selected: rfq.selected_quote_id === q.id,
      auto: !!q.auto,
      operator: q.entry_source === "operator",
      detail: dt ? { status: dt.status, total: dt.total, weeks: dt.weeks, note: (rfq.selected_quote_id === q.id ? dt.note : maskedText(dt.note)) || null, items: dt.items.map((i) => ({ ...i, reason: rfq.selected_quote_id === q.id ? i.reason : maskedText(i.reason) })) } : null,
    };
  });
  return { cols, rows, authorities, detail };
}
