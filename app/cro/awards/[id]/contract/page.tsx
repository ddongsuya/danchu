import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { dbReady } from "@/lib/data";
import { awardForOrg, draftForAward, draftSentAt } from "@/lib/contract-draft-db";
import { Crumb } from "@/components/app/ui";
import { ContractPages } from "@/components/contract/ContractPages";
import { SendDraftButton } from "@/components/contract/SendDraftButton";
import { PrintButton } from "@/components/cro/PrintButton";
import "@/components/contract/contract.css";

export const dynamic = "force-dynamic";

/** 기관: 선정된 견적으로 만든 계약서(안). PDF로 저장하거나 의뢰자에게 보낸다. 서명은 단추 밖에서 */
export default async function ContractDraftPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireSession("cro");
  if (!s.org || !dbReady()) notFound();
  const award = await awardForOrg(s.org.id, (await params).id);
  if (!award) notFound();
  const [draft, sentAt] = await Promise.all([draftForAward(award), draftSentAt(award.rfq_id)]);
  if (!draft) notFound();
  const done = award.contract_status === "signed" || award.contract_status === "not_signed";
  return (
    <>
      <div className="noprint">
        <Crumb href="/cro/requests?tab=won" label="받은 요청" />
      </div>
      <div className="ph noprint">
        <div>
          <h1>계약서(안)</h1>
          <p>
            {draft.rfqNo}, {draft.sponsor.name}
          </p>
        </div>
        <div className="ph__actions">
          <PrintButton />
          {!done && <SendDraftButton awardId={award.id} sentAt={sentAt} />}
        </div>
      </div>
      <ContractPages draft={draft} />
    </>
  );
}
