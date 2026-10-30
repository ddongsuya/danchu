import { identityVisible, maskedClientLabel } from "@/lib/request-policy";
import { requireSession } from "@/lib/auth";
import { dbReady, listAwardsForOrg, listInvitesForOrg, type InviteWithQuote } from "@/lib/data";
import { PendingOrg } from "@/components/cro/PendingOrg";
import { inviteStage } from "@/lib/status";
import { CroHome } from "@/components/cro/CroHome";

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
  const now = Date.now();
  // 계약 결과 보고가 아직 없는 선정 (기관이 보고해야 다음 단계로 간다, 0025)
  const awards = dbReady() ? await listAwardsForOrg(org.id) : [];
  const pendingAwards = awards
    .filter((a) => !a.contract_reported_at && ["selected", "contracting"].includes(a.rfq?.status ?? ""))
    .map((a) => ({ no: a.rfq?.rfq_no ?? "", substance: a.rfq?.substance ?? "", days: Math.floor((now - new Date(a.awarded_at).getTime()) / 864e5) }));
  return (
      <CroHome orgName={org.name} now={now} awards={pendingAwards} items={list.map((i) => {
        // 참여 전에는 시험물질명과 의뢰 목적을 보이지 않는다 (요약에 없는 정보, 0023). 제출처는 요약에 있다
        const joined = !!i.joined_at;
        const awarded = !!i.quote && !!i.rfq?.selected_quote_id && i.rfq.selected_quote_id === i.quote.id;
        return {
        awarded,
        id: i.id,
        no: i.rfq_no,
        substance: joined ? i.rfq?.substance ?? "" : "",
        client: identityVisible({ awarded }) ? i.rfq?.company ?? "" : maskedClientLabel(i.rfq?.org_type),
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
  );
}
