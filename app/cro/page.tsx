import { needsCda, confidentialAccess } from "@/lib/request-policy";
import { requireSession } from "@/lib/auth";
import { dbReady, listInvitesForOrg, type InviteWithQuote } from "@/lib/data";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { InviteList } from "@/components/cro/InviteList";

export const dynamic = "force-dynamic";

export default async function CroInbox() {
  const s = await requireSession("cro");
  const org = s.org;
  if (!org || org.status !== "approved") {
    return (
      <>
        <div className="ph">
          <div>
            <h1>받은 요청</h1>
          </div>
        </div>
        <PendingOrg org={org} pendingOrg={s.pendingOrg} />
      </>
    );
  }
  // 빠진 배포는 승인·분야 변경 시점과 매일 크론(distributeOpenRfqs)이 채운다. 읽기 화면에서는 쓰지 않는다.
  const list: InviteWithQuote[] = dbReady() ? await listInvitesForOrg(org.id) : [];
  const fresh = list.filter((i) => i.status === "sent" && new Date(i.expires_at).getTime() > Date.now()).length;
  return (
    <>
      <div className="ph">
        <div>
          <h1>받은 요청</h1>
          <p>신규 {fresh}건 · 회신 기한이 가까운 순</p>
        </div>
      </div>
      <InviteList items={list.map((i) => ({
        id: i.id,
        no: i.rfq_no,
        substance: i.rfq?.substance ?? "",
        client: !confidentialAccess(i.rfq?.confidentiality, i.cda_signed_at) ? `${i.rfq?.org_type || "의뢰기관"} (회사명 비공개)` : i.rfq?.company ?? "",
        purpose: [i.rfq?.purpose, Array.isArray(i.rfq?.payload?.authority) ? (i.rfq!.payload.authority as string[]).join(" · ") : ""].filter(Boolean).join(" · "),
        tags: i.rfq?.categories ?? [],
        replyBy: i.reply_by,
        expiresAt: i.expires_at,
        status: i.status,
        rfqStatus: i.rfq?.status ?? "",
        total: i.quote?.total_amount ?? null,
        quoteStatus: i.quote?.status ?? null,
        sentAt: i.sent_at,
      }))} />
    </>
  );
}
