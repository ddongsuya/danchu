import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getRfqByNo, ownsRfq } from "@/lib/data";
import { awardForRfq, draftForAward, draftSentAt } from "@/lib/contract-draft-db";
import { Crumb } from "@/components/app/ui";
import { ContractPages } from "@/components/contract/ContractPages";
import { PrintButton } from "@/components/cro/PrintButton";
import "@/components/contract/contract.css";

export const dynamic = "force-dynamic";

/** 의뢰자: 선정한 기관이 보낸 계약서(안). 기관이 보낸 뒤에만 보인다 */
export default async function SponsorContractDraft({ params }: { params: Promise<{ no: string }> }) {
  const s = await requireSession("requester");
  const rfq = await getRfqByNo((await params).no);
  if (!rfq || !(ownsRfq(rfq, s.userId) || s.profile.role === "admin")) notFound();
  const [award, sentAt] = await Promise.all([awardForRfq(rfq.id), draftSentAt(rfq.id)]);
  if (!award || !sentAt) notFound();
  const draft = await draftForAward(award);
  if (!draft) notFound();
  return (
    <>
      <div className="noprint">
        <Crumb href={`/app/r/${rfq.rfq_no}`} label={rfq.rfq_no} />
      </div>
      <div className="ph noprint">
        <div>
          <h1>{award.cro_name} 계약서(안)</h1>
          <p>받음 {sentAt.slice(0, 10)}</p>
        </div>
        <div className="ph__actions">
          <PrintButton />
        </div>
      </div>
      <ContractPages draft={draft} />
    </>
  );
}
