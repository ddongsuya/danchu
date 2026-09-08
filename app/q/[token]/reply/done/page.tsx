import { loadQuote } from "@/lib/quote-load";
import { ReplyDone } from "@/components/cro/ReplyDone";

export const dynamic = "force-dynamic";

export default async function TokenReplyDone({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ t?: string; w?: string }> }) {
  const { token } = await params;
  const { t, w } = await searchParams;
  const got = await loadQuote(token);
  return <ReplyDone no={got?.rfq.no ?? ""} replyBy={got?.rfq.replyBy} total={Number(t || 0)} weeks={w} editHref={`/q/${token}/reply`} backHref={`/q/${token}`} backLabel="요청서 보기" />;
}
