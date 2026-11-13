import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getRfqByNo, ownsRfq } from "@/lib/data";
import { loadSponsorQna } from "@/lib/qna-data";
import { QnaBoard } from "@/components/qna/QnaBoard";

export const dynamic = "force-dynamic";

/** 의뢰자 질의응답 (0045). 기관 질의에 답하고(공개 범위 선택), 비교표가 열린 뒤 견적을 낸 기관에 질의한다 */
export default async function SponsorQna({ params, searchParams }: { params: Promise<{ no: string }>; searchParams: Promise<{ q?: string; to?: string }> }) {
  const s = await requireSession("requester");
  const { no } = await params;
  const { q, to } = await searchParams;
  const rfq = await getRfqByNo(no);
  if (!rfq || !(ownsRfq(rfq, s.userId) || s.profile.role === "admin")) notFound();
  const d = await loadSponsorQna(rfq);
  return (
    <QnaBoard
      side="sponsor"
      endpoint={`/api/rfq/${rfq.rfq_no}/qna`}
      no={rfq.rfq_no}
      substance={rfq.substance}
      backHref={`/app/r/${rfq.rfq_no}`}
      items={d.items}
      targets={d.targets}
      canAsk={d.canAsk}
      canAnswer={d.canAnswer}
      askBy={null}
      tests={d.tests}
      initialId={q}
      initialTo={to}
      readOnly={s.profile.role === "admin"}
    />
  );
}
