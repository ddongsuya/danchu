import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getRfqByNo, ownsRfq } from "@/lib/data";
import { comparisonOpened } from "@/lib/reply-window";

export const dynamic = "force-dynamic";

/**
 * 기관 견적 상세는 비교 보고서 옆 패널로 옮겼다 (2026-11-27 시안 r-quote). 예전 주소(메일·알림 링크)는 그 패널로 보낸다.
 * 견적은 비교표가 열린 뒤에만 의뢰자에게 보인다 (2026-10-20 결정 1). 열리기 전에는 비교표 화면이 진행 숫자를 보여 준다
 */
export default async function QuoteDetail({ params }: { params: Promise<{ no: string; quoteId: string }> }) {
  const s = await requireSession("requester");
  const { no, quoteId } = await params;
  const rfq = await getRfqByNo(no);
  if (!rfq || !(ownsRfq(rfq, s.userId) || s.profile.role === "admin")) notFound();
  if (!comparisonOpened(rfq) && s.profile.role !== "admin") redirect(`/app/r/${rfq.rfq_no}/compare`);
  redirect(`/app/r/${rfq.rfq_no}/compare#q-${encodeURIComponent(quoteId)}`);
}
