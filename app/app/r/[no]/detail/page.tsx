import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getRfqByNo, getRfqDetail, ownsRfq } from "@/lib/data";
import { comparisonOpened } from "@/lib/reply-window";
import { loadDetail } from "@/lib/detail-data";
import { CATS, type Cat, type Values } from "@/lib/rfq-schema";
import { DetailRequest } from "@/components/app/DetailRequest";

export const dynamic = "force-dynamic";

/** 상세 견적 요청 (0042). 비교 보고서가 열린 뒤, 선정 전, 요청마다 한 번. 그 밖에는 비교 보고서로 돌려보낸다 */
export default async function DetailRequestPage({ params }: { params: Promise<{ no: string }> }) {
  const s = await requireSession("requester");
  const { no } = await params;
  const rfq = await getRfqByNo(no);
  if (!rfq || !(ownsRfq(rfq, s.userId) || s.profile.role === "admin")) notFound();
  const back = `/app/r/${rfq.rfq_no}/compare`;
  if (!comparisonOpened(rfq) || rfq.selected_quote_id || ["selected", "contracting", "closed", "cancelled"].includes(rfq.status)) redirect(back);
  if (await loadDetail(rfq.id)) redirect(back);
  const d = await getRfqDetail(rfq);
  const quotes = d.quotes
    .filter((q) => q.status === "submitted")
    .sort((a, b) => (a.total_amount ?? 0) - (b.total_amount ?? 0) || a.cro_name.localeCompare(b.cro_name, "ko"))
    .map((q) => ({ id: q.id, name: q.cro_name, total: q.total_amount ?? 0 }));
  if (!quotes.length) redirect(back);
  const cats = (rfq.categories ?? []).filter((c): c is Cat => (CATS as readonly string[]).includes(c));
  return <DetailRequest no={rfq.rfq_no} substance={rfq.substance} quotes={quotes} payload={rfq.payload as Values} cats={cats} closeHref={back} />;
}
