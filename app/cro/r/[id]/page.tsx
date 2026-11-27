import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getInviteById } from "@/lib/data";
import { loadByInvite } from "@/lib/quote-load";
import { loadOptsFor } from "@/lib/concierge";
import { RequestView } from "@/components/cro/RequestView";
import { Crumb } from "@/components/app/ui";
import { detailCueOfInvite } from "@/lib/detail-data";
import { qnaCounts } from "@/lib/qna-data";

export const dynamic = "force-dynamic";

/** 포털 요청 화면. 참여 전 요약·참여 결정과 참여 뒤 요청서 전체는 /q 와 같다 (RequestView). 불참·참여 철회는 확인 창에서 처리한다 */
export default async function CroRequest({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireSession("cro");
  const { id } = await params;
  const inv = await getInviteById(id);
  if (!inv || (s.profile.role !== "admin" && inv.cro_org_id !== s.profile.cro_org_id)) notFound();
  const got = await loadByInvite(inv, loadOptsFor(s.profile.role));
  if (!got) notFound();
  const detail = got.joined ? await detailCueOfInvite(inv.id, inv.rfq_id, `/cro/r/${id}`) : null;
  const qna = got.joined && !got.withdrawn ? { href: `/cro/r/${id}/qna`, ...(await qnaCounts(inv.rfq_id, inv.id)) } : null;
  return (
    <>
      <Crumb href={`/cro/requests?sel=${id}`} label="받은 요청" />
      <RequestView got={got} replyHref={`/cro/r/${id}/reply`} afterWithdrawHref="/cro/requests" afterDeclineHref="/cro/requests" detail={detail} qna={qna} portal />
    </>
  );
}
