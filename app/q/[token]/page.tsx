import { notFound } from "next/navigation";
import { md } from "@/lib/format";
import { loadQuote } from "@/lib/quote-load";
import { viewerLoadOpts } from "@/lib/auth";
import { RequestView } from "@/components/cro/RequestView";
import { DeclineForm } from "@/components/cro/DeclineForm";

export const dynamic = "force-dynamic";

/**
 * 회신 링크 첫 화면. 참여 전에는 요약과 참여하기·이번 요청 불참(0023), 참여 뒤에는 요청서 전체.
 * ?decline=1 은 참여 뒤 제출 전 "참여 철회" 확인 화면이다 (참여 전 불참은 요약 화면 안에서 바로 처리한다)
 */
export default async function TokenRequest({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ decline?: string }> }) {
  const { token } = await params;
  const { decline } = await searchParams;
  const got = await loadQuote(token, await viewerLoadOpts());
  if (!got) notFound();
  const open = !got.closed && !got.declined && !got.expired && got.draft?.status !== "submitted";
  if (decline === "1" && open) {
    const withdraw = got.joined;
    const joinByLabel = got.joinBy ? md(new Date(got.joinBy).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })) : "";
    return (
      <>
        <div className="ph">
          <div>
            <span className="tnum" style={{ fontSize: 13, fontWeight: 600, color: "var(--brand)" }}>{got.rfq.no}</span>
            <h1>{withdraw ? "이 요청의 참여를 철회합니다" : "이번 요청에 불참합니다"}</h1>
            <p>
              {withdraw
                ? "철회하면 자리가 비고 청구하지 않습니다. 이 요청에는 다시 참여할 수 없습니다."
                : `불참해도 다음 참여 안내에 영향이 없습니다.${joinByLabel ? ` 참여 결정 기한(${joinByLabel})까지는 남은 자리가 있으면 다시 참여할 수 있습니다.` : ""}`}
            </p>
          </div>
        </div>
        <DeclineForm token={token} mode={withdraw ? "withdraw" : "decline"} backHref={`/q/${token}`} afterHref={`/q/${token}`} operator={got.operator} />
      </>
    );
  }
  return <RequestView got={got} replyHref={`/q/${token}/reply`} withdrawHref={`/q/${token}?decline=1`} afterDeclineHref={`/q/${token}`} fileToken={token} />;
}
