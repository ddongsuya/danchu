import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getRfqByNo, getRfqDetail, ownsRfq } from "@/lib/data";
import { getSupabaseAdmin } from "@/lib/supabase";
import { glpCoverage } from "@/lib/quote-items";
import { Crumb } from "@/components/app/ui";
import { CompareBoard, type CompareCol } from "@/components/CompareBoard";

export const dynamic = "force-dynamic";

export default async function Compare({ params }: { params: Promise<{ no: string }> }) {
  const s = await requireSession("requester");
  const { no } = await params;
  const rfq = await getRfqByNo(no);
  if (!rfq || !(ownsRfq(rfq, s.userId, s.email) || s.profile.role === "admin")) notFound();
  const d = await getRfqDetail(rfq);
  if (!rfq.compared_at && s.profile.role !== "admin") {
    return (
      <>
        <Crumb href={`/app/r/${rfq.rfq_no}`} label={rfq.rfq_no} />
        <div className="empty">
          <b>비교표가 아직 공개되지 않았습니다</b>
          회신 기한이 지나면 단추가 회신 내용을 검수한 뒤 공개합니다. 공개되면 알림과 이메일로 알려 드립니다.
        </div>
      </>
    );
  }

  const quotes = d.quotes.filter((q) => q.status === "submitted");
  const orgIds = quotes.map((q) => q.cro_org_id).filter((x): x is string => !!x);
  const sb = getSupabaseAdmin()!;
  const { data: orgs } = orgIds.length ? await sb.from("cro_orgs").select("id, glp_certs, aaalac").in("id", orgIds) : { data: [] };
  const certsOf = new Map((orgs ?? []).map((o) => [o.id as string, (o.glp_certs ?? []) as string[]]));
  const authorities = Array.isArray(rfq.payload.authority) ? (rfq.payload.authority as string[]) : [];
  const rows = quotes[0]?.cro_quote_items?.map((it) => ({ seq: it.seq, name: it.name, category: it.category })) ?? [];

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
      items: items.map((i) => ({ seq: i.seq, avail: i.avail ?? "", amount: i.amount, weeks: i.weeks })),
      hasPdf: !!q.pdf_path,
      selected: rfq.selected_quote_id === q.id,
    };
  });

  return (
    <>
      <Crumb href={`/app/r/${rfq.rfq_no}`} label={rfq.rfq_no} />
      <div className="ph">
        <div>
          <h1>견적 비교</h1>
          <p>
            {rfq.substance} · {d.invites.length}곳 중 {quotes.length}곳 회신 · 금액은 VAT 별도{authorities.length ? ` · 제출처 ${authorities.join(", ")}` : ""}
          </p>
        </div>
      </div>
      {cols.length === 0 ? (
        <div className="empty">
          <b>비교할 회신이 없습니다</b>
          회신한 CRO가 없어 비교표를 만들 수 없습니다. 단추가 재배포 여부를 안내합니다.
        </div>
      ) : (
        <CompareBoard no={rfq.rfq_no} cols={cols} rows={rows} canSelect={!rfq.selected_quote_id && !!rfq.compared_at} />
      )}
    </>
  );
}
