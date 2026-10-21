import { needsCda, identityVisible, maskedClientLabel } from "@/lib/request-policy";
import { requireSession } from "@/lib/auth";
import { dbReady, listInvitesForOrg, type InviteWithQuote } from "@/lib/data";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { inviteStage } from "@/lib/status";
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
  // 선정·회신 마감·종료된 요청은 신규로 세지 않는다 (InviteList 의 "종료"와 같은 규칙)
  const closedStatuses = ["compared", "selected", "contracting", "closed", "cancelled"];
  // 참여 결정 전 (0023): 아직 참여·불참을 고르지 않은 열린 안내
  const fresh = list.filter((i) => inviteStage(i) === "undecided" && new Date(i.expires_at).getTime() > Date.now() && !closedStatuses.includes(i.rfq?.status ?? "")).length;
  return (
    <>
      <div className="ph">
        <div>
          <h1>받은 요청</h1>
          <p><span className="tnum">참여 결정 전 {fresh}건</span> · 회신 기한이 가까운 순</p>
        </div>
      </div>
      <InviteList items={list.map((i) => {
        // 참여 전에는 시험물질명과 의뢰 목적을 보이지 않는다 (요약에 없는 정보, 0023). 제출처는 요약에 있다
        const joined = !!i.joined_at;
        return {
        id: i.id,
        no: i.rfq_no,
        substance: joined ? i.rfq?.substance ?? "" : "",
        client: identityVisible({ awarded: !!i.quote && !!i.rfq?.selected_quote_id && i.rfq.selected_quote_id === i.quote.id }) ? i.rfq?.company ?? "" : maskedClientLabel(i.rfq?.org_type),
        purpose: [joined ? i.rfq?.purpose : null, Array.isArray(i.rfq?.payload?.authority) ? (i.rfq!.payload.authority as string[]).join(" · ") : ""].filter(Boolean).join(" · "),
        tags: i.rfq?.categories ?? [],
        replyBy: i.reply_by,
        expiresAt: i.expires_at,
        stage: inviteStage(i),
        cancelled: !!i.revoked_at,
        rfqStatus: i.rfq?.status ?? "",
        total: i.quote?.total_amount ?? null,
        quoteStatus: i.quote?.status ?? null,
        sentAt: i.sent_at,
        };
      })} />
    </>
  );
}
