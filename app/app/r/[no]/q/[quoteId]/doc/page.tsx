import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getRfqByNo, getRfqDetail, ownsRfq } from "@/lib/data";
import { comparisonOpened } from "@/lib/reply-window";
import { submittedDoc } from "@/lib/quote-doc-db";
import { Crumb } from "@/components/app/ui";
import { DocPages } from "@/components/cro/quote/DocPages";
import { PrintButton } from "@/components/cro/PrintButton";
import "@/components/cro/quote/quote.css";

export const dynamic = "force-dynamic";

/**
 * 기관 견적서 (2026-11-20). 기관이 단추 견적서 툴로 만든 이 요청의 견적서를 기관 양식 그대로 보인다.
 * 비교표가 열린 뒤, 제출한 견적과 금액이 같은 견적서만 (lib/quote-doc docMatchesQuote). 다르거나 없으면 404
 */
export default async function QuoteDocPage({ params }: { params: Promise<{ no: string; quoteId: string }> }) {
  const s = await requireSession("requester");
  const { no, quoteId } = await params;
  const rfq = await getRfqByNo(no);
  if (!rfq || !(ownsRfq(rfq, s.userId) || s.profile.role === "admin")) notFound();
  if (!comparisonOpened(rfq) && s.profile.role !== "admin") redirect(`/app/r/${rfq.rfq_no}/compare`);
  const d = await getRfqDetail(rfq);
  const q = d.quotes.find((x) => x.id === quoteId && x.status === "submitted");
  if (!q) notFound();
  const doc = await submittedDoc(q);
  if (!doc) notFound();
  // 받는 쪽 표시는 의뢰자 자신의 회사명으로 (기관 견적서의 "단추 요청 번호" 대신)
  const head = { ...doc.head, client: rfq.company || doc.head.client };
  return (
    <div className="qprint">
      <div className="ph noprint">
        <div>
          <Crumb href={`/app/r/${rfq.rfq_no}/q/${q.id}`} label={q.cro_name ?? "견적"} />
          <h1>{q.cro_name} 견적서</h1>
          <p>기관이 단추 견적서 툴로 만든 견적서예요. 비교표와 금액이 같아요.</p>
        </div>
        <div className="ph__actions">
          <PrintButton />
        </div>
      </div>
      <DocPages head={head} data={doc.data} style={doc.style} />
    </div>
  );
}
