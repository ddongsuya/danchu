import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getInviteById } from "@/lib/data";
import { ReplyForm } from "@/components/cro/ReplyForm";
import { ReplyDone } from "@/components/cro/ReplyDone";

export const dynamic = "force-dynamic";

export default async function CroReply({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string; t?: string; w?: string }> }) {
  const s = await requireSession("cro");
  const { id } = await params;
  const sp = await searchParams;
  const inv = await getInviteById(id);
  if (!inv || (s.profile.role !== "admin" && inv.cro_org_id !== s.profile.cro_org_id)) notFound();
  if (sp.done === "1") {
    return <ReplyDone no={inv.rfq_no} replyBy={inv.reply_by} total={Number(sp.t || 0)} weeks={sp.w} editHref={`/cro/r/${id}/reply`} backHref="/cro/quotes" backLabel="제출한 견적" />;
  }
  return <ReplyForm token={inv.token} backHref={`/cro/r/${id}`} doneHref={`/cro/r/${id}/reply?done=1`} orgCerts={s.org?.glp_certs ?? []} />;
}
