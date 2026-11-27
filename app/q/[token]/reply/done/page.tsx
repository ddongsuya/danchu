import { loadQuote } from "@/lib/quote-load";
import { viewerLoadOpts } from "@/lib/auth";
import { ReplyDone } from "@/components/cro/ReplyDone";
import { testsLine } from "@/components/cro/CroStory";
import { doneAt } from "@/lib/cro-due";

export const dynamic = "force-dynamic";

export default async function TokenReplyDone({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ t?: string; w?: string; f?: string; at?: string }> }) {
  const { token } = await params;
  const { t, w, f, at } = await searchParams;
  const got = await loadQuote(token, await viewerLoadOpts());
  return <div className="q-center"><ReplyDone no={got?.rfq.no ?? ""} title={got ? testsLine(got.rfq.rows.map((r) => r.name)) : ""} replyBy={got?.rfq.replyBy} total={Number(t || 0)} weeks={w} files={f ? Number(f) : undefined} submittedAt={doneAt(at)} editHref={`/q/${token}/reply`} closed={!!got?.closed} /></div>;
}
