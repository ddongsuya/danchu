import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getRfqByNo, getRfqDetail, ownsRfq } from "@/lib/data";
import { getSupabaseAdmin } from "@/lib/supabase";
import { glpCoverage } from "@/lib/quote-items";
import { designSummary, explainOf } from "@/lib/catalog";
import { Crumb } from "@/components/app/ui";
import { CompareBoard, type CompareCol } from "@/components/CompareBoard";
import { md } from "@/lib/format";
import { beforeDeadline, pendingInvites, quoteRevisable, repliesClosed } from "@/lib/reply-window";

export const dynamic = "force-dynamic";

export default async function Compare({ params }: { params: Promise<{ no: string }> }) {
  const s = await requireSession("requester");
  const { no } = await params;
  const rfq = await getRfqByNo(no);
  if (!rfq || !(ownsRfq(rfq, s.userId, s.email) || s.profile.role === "admin")) notFound();
  const d = await getRfqDetail(rfq);
  // 실시간 비교: 기관이 제출한 견적은 바로 이 표에 기관명과 함께 나타난다. 공개 단계가 없다 (lib/reply-window.ts)
  const open = !repliesClosed(rfq);
  const pending = pendingInvites(d.invites);
  const early = open && beforeDeadline(rfq.reply_by);
  const replyByOf = new Map(d.invites.map((i) => [i.id, i.reply_by]));

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

  const cols: CompareCol[] = quotes.map((q) => {
    const cov = glpCoverage(authorities, certsOf.get(q.cro_org_id ?? "") ?? []);
    const items = q.cro_quote_items ?? [];
    const unavailable = items.filter((i) => i.avail === "불가").map((i) => i.name);
    return {
      id: q.id,
      name: q.cro_name,
      total: q.total_amount ?? 0,
      weeks: q.total_weeks ?? 0,
      start: q.start_date,
      valid: q.valid_until,
      pay: q.pay_terms,
      includes: q.includes ?? [],
      note: q.note,
      glpOk: cov.ok,
      glpMissing: cov.missing,
      glp: certsOf.get(q.cro_org_id ?? "") ?? [],
      unavailable,
      conditional: items.filter((i) => i.avail === "조건부 가능").length,
      items: items.map((i) => ({ seq: i.seq, avail: i.avail ?? "", amount: i.amount, weeks: i.weeks, design: designOf(i.design), note: [i.reason, i.design && typeof i.design.note === "string" ? i.design.note : ""].filter(Boolean).join(" · ") || undefined, explain: explainOf(rows.find((r) => r.seq === i.seq)?.category ?? "", i.design?.extra) })),
      hasPdf: !!q.pdf_path,
      selected: rfq.selected_quote_id === q.id,
      revisable: quoteRevisable(rfq, (q.invite_id && replyByOf.get(q.invite_id)) || rfq.reply_by),
      auto: !!q.auto,
      operator: q.entry_source === "operator",
    };
  });

  return (
    <>
      <Crumb href={`/app/r/${rfq.rfq_no}`} label={rfq.rfq_no} />
      <div className="ph">
        <div>
          <h1>견적 비교</h1>
          <p>
            {rfq.substance} · 금액은 VAT 별도{authorities.length ? ` · 제출처 ${authorities.join(", ")}` : ""}
          </p>
        </div>
      </div>
      <dl className="compare-status" aria-label="회신 현황">
        <div><dt>도착한 견적</dt><dd className="tnum">{quotes.length}건</dd></div>
        <div><dt>아직 회신하지 않은 기관</dt><dd className="tnum">{open ? `${pending}곳` : "마감"}</dd></div>
        <div><dt>회신 기한</dt><dd className="tnum">{rfq.reply_by ? md(rfq.reply_by) : "미정"}{!open ? " · 마감" : ""}</dd></div>
      </dl>
      {rfq.selected_quote_id ? null : open ? (
        <p className="note note--tint" style={{ marginBottom: 16 }}>
          견적은 기관이 제출하는 대로 이 표에 나타납니다. {early ? `회신 기한(${md(rfq.reply_by)})까지는 기관이 견적을 수정할 수 있어, 금액과 조건이 바뀔 수 있습니다. 기한 전에도 선정할 수 있지만, 선정하면 아직 회신하지 않은 기관의 회신 링크가 닫힙니다.` : "회신 기한이 지났습니다. 선정하면 남은 회신 링크가 닫힙니다."}
        </p>
      ) : (
        <p className="note" style={{ marginBottom: 16 }}>회신이 마감되어 견적은 더 바뀌지 않습니다.</p>
      )}
      {cols.length === 0 ? (
        <div className="empty">
          <b>아직 도착한 견적이 없습니다</b>
          {open ? "기관이 견적을 제출하면 바로 여기에 나타나고 알림으로 알려 드립니다." : "회신한 기관이 없어 비교할 견적이 없습니다. 단추가 재배포 여부를 안내합니다."}
        </div>
      ) : (
        <CompareBoard no={rfq.rfq_no} cols={cols} rows={rows} canSelect={!rfq.selected_quote_id && !["closed", "cancelled"].includes(rfq.status)} />
      )}
    </>
  );
}

/** 저장된 설계 jsonb → 한 줄 요약 */
function designOf(d: Record<string, unknown> | null | undefined): string | undefined {
  if (!d || typeof d !== "object") return undefined;
  const n = (k: string) => (typeof d[k] === "number" ? (d[k] as number) : null);
  const s = designSummary({
    species: Array.isArray(d.species) ? (d.species as string[]) : [],
    groups_ctrl: n("groups_ctrl"), groups_test: n("groups_test"), per_sex: n("per_sex"),
    recovery_weeks: n("recovery_weeks"), recovery_per_sex: n("recovery_per_sex"),
    route: typeof d.route === "string" ? d.route : null, dosing: typeof d.dosing === "string" ? d.dosing : null,
    method: typeof d.method === "string" ? d.method : null,
  });
  return s || undefined;
}
