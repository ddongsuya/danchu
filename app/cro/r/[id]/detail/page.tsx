import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getInviteById } from "@/lib/data";
import { loadByInvite } from "@/lib/quote-load";
import { loadOptsFor } from "@/lib/concierge";
import { loadDetailForInvite } from "@/lib/detail-data";
import { DetailReply } from "@/components/cro/DetailReply";

export const dynamic = "force-dynamic";

/** 포털의 2차 견적 회신 (0042). 상세 견적 요청을 받은 기관만 연다 */
export default async function CroDetailReply({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireSession("cro");
  const { id } = await params;
  const inv = await getInviteById(id);
  if (!inv || (s.profile.role !== "admin" && inv.cro_org_id !== s.profile.cro_org_id)) notFound();
  const got = await loadByInvite(inv, { ...loadOptsFor(s.profile.role), markOpened: false });
  if (!got || !got.joined) notFound();
  const d = await loadDetailForInvite(inv.id, inv.rfq_id, got.rfq.rows);
  if (!d) redirect(`/cro/r/${id}`);
  return <DetailReply token={inv.token} view={{ no: got.rfq.no, substance: got.rfq.substance, ...d }} backHref={`/cro/r/${id}`} operator={got.operator} />;
}
