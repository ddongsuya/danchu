import { notFound } from "next/navigation";
import { md } from "@/lib/format";
import { requireSession } from "@/lib/auth";
import { getInviteById } from "@/lib/data";
import { loadByInvite } from "@/lib/quote-load";
import { loadOptsFor } from "@/lib/concierge";
import { RequestView } from "@/components/cro/RequestView";
import { DeclineForm } from "@/components/cro/DeclineForm";
import { Crumb } from "@/components/app/ui";

export const dynamic = "force-dynamic";

/** 포털 요청 화면. 참여 전 요약·참여 결정과 참여 뒤 요청서 전체는 /q 와 같다 (RequestView). ?decline=1 은 참여 철회 확인 */
export default async function CroRequest({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ decline?: string }> }) {
  const s = await requireSession("cro");
  const { id } = await params;
  const { decline } = await searchParams;
  const inv = await getInviteById(id);
  if (!inv || (s.profile.role !== "admin" && inv.cro_org_id !== s.profile.cro_org_id)) notFound();
  const got = await loadByInvite(inv, loadOptsFor(s.profile.role));
  if (!got) notFound();
  const open = !got.closed && !got.declined && !got.expired && got.draft?.status !== "submitted";
  if (decline === "1" && open) {
    const withdraw = got.joined;
    const joinByLabel = got.joinBy ? md(new Date(got.joinBy).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })) : "";
    return (
      <>
        <Crumb href={`/cro/r/${id}`} label={got.rfq.no} />
        <div className="ph">
          <div>
            <h1>{withdraw ? "이 요청의 참여를 철회합니다" : "이번 요청에 불참합니다"}</h1>
            <p>
              {withdraw
                ? "철회하면 자리가 비고 청구하지 않습니다. 이 요청은 종료 목록으로 이동하고 다시 참여할 수 없습니다."
                : `불참해도 다음 참여 안내에 영향이 없습니다.${joinByLabel ? ` 참여 결정 기한(${joinByLabel})까지는 남은 자리가 있으면 다시 참여할 수 있습니다.` : ""}`}
            </p>
          </div>
        </div>
        <DeclineForm token={inv.token} mode={withdraw ? "withdraw" : "decline"} backHref={`/cro/r/${id}`} afterHref="/cro" operator={got.operator} />
      </>
    );
  }
  return (
    <>
      <Crumb href="/cro" label="받은 요청" />
      <RequestView got={got} replyHref={`/cro/r/${id}/reply`} withdrawHref={`/cro/r/${id}?decline=1`} afterDeclineHref="/cro" />
    </>
  );
}
