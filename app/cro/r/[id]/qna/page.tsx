import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getInviteById } from "@/lib/data";
import { loadByInvite } from "@/lib/quote-load";
import { loadOptsFor } from "@/lib/concierge";
import { loadCroQna } from "@/lib/qna-data";
import { QnaBoard } from "@/components/qna/QnaBoard";

export const dynamic = "force-dynamic";

/** 포털 질의응답 (0045). 참여한 기관만 연다 */
export default async function CroQna({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  const s = await requireSession("cro");
  const { id } = await params;
  const { q } = await searchParams;
  const inv = await getInviteById(id);
  if (!inv || (s.profile.role !== "admin" && inv.cro_org_id !== s.profile.cro_org_id)) notFound();
  const got = await loadByInvite(inv, { ...loadOptsFor(s.profile.role), markOpened: false });
  if (!got || !got.joined || got.withdrawn) notFound();
  const d = await loadCroQna(inv.id, inv.rfq_id);
  if (!d) notFound();
  const stopped = got.closedReason === "invite_cancelled" || got.closedReason === "org_suspended";
  return (
    <QnaBoard
      side="cro"
      endpoint={`/api/quote/${inv.token}/qna`}
      no={got.rfq.no}
      substance={got.rfq.substance}
      backHref={`/cro/r/${id}`}
      mine={d.mine}
      shared={d.shared}
      canAsk={d.canAsk && !stopped}
      canAnswer={d.canAnswer && !stopped}
      askBy={d.replyBy}
      tests={d.tests}
      initialId={q}
      readOnly={s.profile.role === "admin"}
    />
  );
}
