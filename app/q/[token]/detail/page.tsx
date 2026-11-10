import { notFound, redirect } from "next/navigation";
import { loadQuote } from "@/lib/quote-load";
import { viewerLoadOpts } from "@/lib/auth";
import { loadDetailForInvite } from "@/lib/detail-data";
import { DetailReply } from "@/components/cro/DetailReply";

export const dynamic = "force-dynamic";

/** 회신 링크의 2차 견적 회신 (0042). 로그인 없이 연다. 상세 견적 요청을 받은 기관만 */
export default async function TokenDetailReply({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const got = await loadQuote(token, { ...(await viewerLoadOpts()), markOpened: false });
  if (!got || !got.joined) notFound();
  const d = await loadDetailForInvite(got.inviteId, got.rfqId, got.rfq.rows);
  if (!d) redirect(`/q/${token}`);
  return <DetailReply token={token} view={{ no: got.rfq.no, substance: got.rfq.substance, ...d }} backHref={`/q/${token}`} fileToken={token} operator={got.operator} />;
}
