import { notFound } from "next/navigation";
import { loadQuote } from "@/lib/quote-load";
import { RequestView } from "@/components/cro/RequestView";
import { DeclineForm } from "@/components/cro/DeclineForm";

export const dynamic = "force-dynamic";

export default async function TokenRequest({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ decline?: string }> }) {
  const { token } = await params;
  const { decline } = await searchParams;
  const got = await loadQuote(token);
  if (!got) notFound();
  if (decline === "1") {
    return (
      <>
        <div className="ph">
          <div>
            <span className="tnum" style={{ fontSize: 13, fontWeight: 600, color: "var(--brand)" }}>{got.rfq.no}</span>
            <h1>이번 요청은 회신하지 않습니다</h1>
            <p>처리하면 이 요청의 회신 링크가 닫힙니다.</p>
          </div>
        </div>
        <DeclineForm token={token} backHref={`/q/${token}`} afterHref={`/q/${token}`} />
      </>
    );
  }
  return <RequestView got={got} replyHref={`/q/${token}/reply`} declineHref={`/q/${token}?decline=1`} fileToken={token} />;
}
