import { notFound } from "next/navigation";
import { loadQuote } from "@/lib/quote-load";
import { ReplyForm } from "@/components/cro/ReplyForm";

export const dynamic = "force-dynamic";

export default async function TokenReply({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const got = await loadQuote(token);
  if (!got) notFound();
  return <ReplyForm token={token} backHref={`/q/${token}`} doneHref={`/q/${token}/reply/done`} />;
}
