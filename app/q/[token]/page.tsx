import { notFound } from "next/navigation";
import { loadQuote } from "@/lib/quote-load";
import { viewerLoadOpts } from "@/lib/auth";
import { RequestView } from "@/components/cro/RequestView";
import { detailCueOfInvite } from "@/lib/detail-data";
import { qnaCounts } from "@/lib/qna-data";

export const dynamic = "force-dynamic";

/**
 * 회신 링크 첫 화면 (시안 검토판 q-view · q-expired). 참여 전에는 요약과 참여하기·이번 요청 불참(0023), 참여 뒤에는 요청서 전체.
 * 불참은 같은 화면에서 "다시 참여하기"로 되돌릴 수 있고, 참여 철회는 확인 창에서 처리한다
 */
export default async function TokenRequest({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const got = await loadQuote(token, await viewerLoadOpts());
  if (!got) notFound();
  const detail = got.joined ? await detailCueOfInvite(got.inviteId, got.rfqId, `/q/${token}`) : null;
  const qna = got.joined && !got.withdrawn ? { href: `/q/${token}/qna`, ...(await qnaCounts(got.rfqId, got.inviteId)) } : null;
  return <RequestView got={got} replyHref={`/q/${token}/reply`} afterWithdrawHref={`/q/${token}`} afterDeclineHref={`/q/${token}`} fileToken={token} detail={detail} qna={qna} />;
}
