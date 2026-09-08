import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getInviteById } from "@/lib/data";
import { loadByInvite } from "@/lib/quote-load";
import { RequestView } from "@/components/cro/RequestView";
import { DeclineForm } from "@/components/cro/DeclineForm";
import { Crumb } from "@/components/app/ui";

export const dynamic = "force-dynamic";

export default async function CroRequest({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ decline?: string }> }) {
  const s = await requireSession("cro");
  const { id } = await params;
  const { decline } = await searchParams;
  const inv = await getInviteById(id);
  if (!inv || (s.profile.role !== "admin" && inv.cro_org_id !== s.profile.cro_org_id)) notFound();
  const got = await loadByInvite(inv);
  if (!got) notFound();
  if (decline === "1") {
    return (
      <>
        <Crumb href={`/cro/r/${id}`} label={got.rfq.no} />
        <div className="ph">
          <div>
            <h1>이번 요청은 회신하지 않습니다</h1>
            <p>처리하면 이 요청은 종료 목록으로 이동합니다.</p>
          </div>
        </div>
        <DeclineForm token={inv.token} backHref={`/cro/r/${id}`} afterHref="/cro" />
      </>
    );
  }
  return (
    <>
      <Crumb href="/cro" label="받은 요청" />
      <RequestView got={got} replyHref={`/cro/r/${id}/reply`} declineHref={`/cro/r/${id}?decline=1`} />
    </>
  );
}
