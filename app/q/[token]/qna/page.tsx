import { notFound } from "next/navigation";
import { loadQuote } from "@/lib/quote-load";
import { viewerLoadOpts } from "@/lib/auth";
import { loadCroQna } from "@/lib/qna-data";
import { QnaBoard } from "@/components/qna/QnaBoard";

export const dynamic = "force-dynamic";

/** 회신 링크의 질의응답 (0045). 로그인 없이 연다. 참여한 기관만 */
export default async function TokenQna({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ q?: string }> }) {
  const { token } = await params;
  const { q } = await searchParams;
  const opts = await viewerLoadOpts();
  const got = await loadQuote(token, { ...opts, markOpened: false });
  if (!got || !got.joined || got.withdrawn) notFound();
  const d = await loadCroQna(got.inviteId, got.rfqId);
  if (!d) notFound();
  const stopped = got.closedReason === "invite_cancelled" || got.closedReason === "org_suspended";
  return (
    <QnaBoard
      side="cro"
      endpoint={`/api/quote/${token}/qna`}
      no={got.rfq.no}
      substance={got.rfq.substance}
      backHref={`/q/${token}`}
      mine={d.mine}
      shared={d.shared}
      canAsk={d.canAsk && !stopped}
      canAnswer={d.canAnswer && !stopped}
      askBy={d.replyBy}
      tests={d.tests}
      initialId={q}
      readOnly={opts.operator}
    />
  );
}
