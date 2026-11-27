import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getRfqByNo, ownsRfq } from "@/lib/data";
import { comparisonOpened } from "@/lib/reply-window";

export const dynamic = "force-dynamic";

/**
 * 선정은 비교 보고서 상세 패널의 확인창에서 한다 (2026-11-27 시안 r-select). 확인창은 패널이 보여 준 견적 판(revision)으로만 선정하고,
 * 그 사이 기관이 견적을 고쳤으면 서버가 409 quote_changed 로 막는다 (0022). 예전 주소는 그 패널로 보낸다.
 * 선정은 비교표가 열린 뒤에만 (2026-10-20 결정 1, 0025 select_quote not_compared)
 */
export default async function SelectCro({ params }: { params: Promise<{ no: string; quoteId: string }> }) {
  const s = await requireSession("requester");
  const { no, quoteId } = await params;
  const rfq = await getRfqByNo(no);
  if (!rfq || !(ownsRfq(rfq, s.userId) || s.profile.role === "admin")) notFound();
  if (!comparisonOpened(rfq)) redirect(`/app/r/${rfq.rfq_no}/compare`);
  redirect(`/app/r/${rfq.rfq_no}/compare#q-${encodeURIComponent(quoteId)}`);
}
